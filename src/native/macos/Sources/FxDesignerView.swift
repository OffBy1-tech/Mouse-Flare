import Cocoa

/// Native FX Designer (Settings → FX Designer): the same parameter model as the
/// web simulator's designer, editing a CustomFxConfig with LIVE preview — every
/// change applies to the cursor immediately (the overlay draws above this
/// window), and the result persists as the "custom-fx" preset.
final class FxDesignerView: NSView {
    var onStatus: ((String) -> Void)?

    private var config: CustomFxConfig
    private var suppressApply = false

    private var presetPopup: NSPopUpButton!
    private var nameField: NSTextField!
    private var glowSwitch: NSSwitch!
    private var popupRefs: [(keyPath: WritableKeyPath<CustomFxConfig, String>, popup: NSPopUpButton, values: [String])] = []
    private var sliderRefs: [(keyPath: WritableKeyPath<CustomFxConfig, Double>, slider: NSSlider, label: NSTextField, fmt: (Double) -> String)] = []
    private var colorChips: [(keyPath: WritableKeyPath<CustomFxConfig, String>, chip: CardButton)] = []

    init() {
        let saved = SettingsManager.shared.settings.customFxJson.flatMap(CustomFxConfig.fromJSON)
        config = saved ?? DefaultFxPresets.archetypes.first ?? CustomFxConfig()
        super.init(frame: .zero)
        buildUI()
        syncControls()
    }

    required init?(coder: NSCoder) { fatalError() }

    // MARK: Apply (live preview + persistence)

    private func apply() {
        guard !suppressApply else { return }
        guard let data = try? JSONEncoder().encode(config),
              let json = String(data: data, encoding: .utf8) else { return }
        var settings = SettingsManager.shared.settings
        settings.customFxJson = json
        settings.passivePreset = "custom-fx"
        settings.passiveFxEnabled = true
        SettingsManager.shared.settings = settings
    }

    @objc private func controlsChanged() {
        for ref in sliderRefs {
            config[keyPath: ref.keyPath] = ref.slider.doubleValue
            ref.label.stringValue = ref.fmt(ref.slider.doubleValue)
        }
        for ref in popupRefs {
            let index = ref.popup.indexOfSelectedItem
            if index >= 0 && index < ref.values.count {
                config[keyPath: ref.keyPath] = ref.values[index]
            }
        }
        config.glowBloom = glowSwitch.state == .on
        config.name = nameField.stringValue.isEmpty ? "Custom FX" : nameField.stringValue
        apply()
    }

    private func syncControls() {
        suppressApply = true
        nameField.stringValue = config.name
        glowSwitch.state = config.glowBloom ? .on : .off
        for ref in sliderRefs {
            ref.slider.doubleValue = config[keyPath: ref.keyPath]
            ref.label.stringValue = ref.fmt(config[keyPath: ref.keyPath])
        }
        for ref in popupRefs {
            if let index = ref.values.firstIndex(of: config[keyPath: ref.keyPath]) {
                ref.popup.selectItem(at: index)
            }
        }
        for ref in colorChips {
            ref.chip.setStyle(
                background: NSColor(hexString: config[keyPath: ref.keyPath]),
                border: NSColor(hexString: "#3F3F46"),
                borderWidth: 1
            )
        }
        suppressApply = false
    }

    private func loadPreset(_ preset: CustomFxConfig) {
        var loaded = preset
        loaded.id = "custom-\(Int(Date.timeIntervalSinceReferenceDate))"
        config = loaded
        syncControls()
        apply()
        onStatus?("Loaded archetype: \(preset.name) — previewing live on your cursor")
    }

    // MARK: UI

    private func buildUI() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        // Header: archetype picker, name, actions
        presetPopup = NSPopUpButton()
        presetPopup.addItems(withTitles: DefaultFxPresets.archetypes.map { "\($0.name)" })
        presetPopup.target = self
        presetPopup.action = #selector(presetChosen)

        nameField = NSTextField(string: config.name)
        nameField.font = .systemFont(ofSize: 11)
        nameField.backgroundColor = Theme.cardBg
        nameField.textColor = Theme.textPrimary
        nameField.translatesAutoresizingMaskIntoConstraints = false
        nameField.widthAnchor.constraint(equalToConstant: 150).isActive = true
        nameField.target = self
        nameField.action = #selector(controlsChanged)

        let copyButton = smallButton("Copy JSON") { [weak self] in
            guard let self, let data = try? JSONEncoder().encode(self.config),
                  let json = String(data: data, encoding: .utf8) else { return }
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(json, forType: .string)
            self.onStatus?("Copied \(self.config.name) as JSON — importable on any platform")
        }
        let importButton = smallButton("Import Clipboard") { [weak self] in
            guard let self else { return }
            if let json = NSPasteboard.general.string(forType: .string),
               let parsed = CustomFxConfig.fromJSON(json) {
                self.config = parsed
                self.syncControls()
                self.apply()
                self.onStatus?("Imported: \(parsed.name)")
            } else {
                self.onStatus?("⚠️ Clipboard does not contain a valid FX Designer config.")
            }
        }

        let headerRow = NSStackView(views: [
            label("Archetype:", size: 11, color: Theme.textSecondary), presetPopup,
            label("Name:", size: 11, color: Theme.textSecondary), nameField,
            NSView(), copyButton, importButton,
        ])
        headerRow.orientation = .horizontal
        headerRow.spacing = 8
        stack.addArrangedSubview(headerRow)
        headerRow.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true

        let hint = label("Every change previews live on your cursor and is saved as the Custom FX preset.", size: 10, color: Theme.textMuted)
        stack.addArrangedSubview(hint)

        // Popups: pattern / shape / blend / color mode / size curve
        let popupRow = NSStackView(views: [
            popupColumn("Emission", keyPath: \.emissionPattern,
                        values: ["trail", "radial-burst", "vortex-spiral", "fountain", "orbit", "directional-cone"],
                        titles: ["Trail", "Radial Burst", "Vortex Spiral", "Fountain", "Orbit", "Directional Cone"]),
            popupColumn("Shape", keyPath: \.shape,
                        values: ["circle", "sparkle-star", "glow-disc", "ring", "shard-crystal", "plasma-orb", "smoke-puff", "lightning-bolt", "bubble", "heart", "sakura-petal", "diamond", "rune"],
                        titles: ["Circle", "Star", "Glow Disc", "Ring", "Crystal", "Plasma Orb", "Smoke", "Lightning", "Bubble", "Heart", "Petal", "Diamond", "Rune"]),
            popupColumn("Blend", keyPath: \.blendMode,
                        values: ["source-over", "lighter", "screen", "color-dodge"],
                        titles: ["Normal", "Additive", "Screen", "Color Dodge"]),
            popupColumn("Color Mode", keyPath: \.colorMode,
                        values: ["single", "gradient-lifetime", "rainbow-cycle", "speed-responsive"],
                        titles: ["Single", "Lifetime Gradient", "Rainbow Cycle", "Speed Responsive"]),
            popupColumn("Size Curve", keyPath: \.sizeCurve,
                        values: ["linear-shrink", "grow-shrink", "constant", "pop-fade"],
                        titles: ["Linear Shrink", "Grow-Shrink", "Constant", "Pop & Fade"]),
        ])
        popupRow.orientation = .horizontal
        popupRow.spacing = 12
        popupRow.distribution = .fillEqually
        stack.addArrangedSubview(popupRow)
        popupRow.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true

        // Colors + glow
        glowSwitch = NSSwitch()
        glowSwitch.target = self
        glowSwitch.action = #selector(controlsChanged)
        let colorsRow = NSStackView(views: [
            label("Colors:", size: 11, color: Theme.textSecondary),
            colorChip("Primary", keyPath: \.primaryColor),
            colorChip("Secondary", keyPath: \.secondaryColor),
            colorChip("Accent", keyPath: \.accentColor),
            NSView(),
            label("Glow Bloom", size: 11, color: Theme.textSecondary),
            glowSwitch,
        ])
        colorsRow.orientation = .horizontal
        colorsRow.spacing = 10
        stack.addArrangedSubview(colorsRow)
        colorsRow.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true

        // Sliders (two per row)
        let pct: (Double) -> String = { String(format: "%.0f%%", $0 * 100) }
        let one: (Double) -> String = { String(format: "%.1f", $0) }
        let whole: (Double) -> String = { String(format: "%.0f", $0) }
        let px: (Double) -> String = { String(format: "%.0f px", $0) }
        let deg: (Double) -> String = { String(format: "%.0f°", $0) }

        let specs: [(String, WritableKeyPath<CustomFxConfig, Double>, Double, Double, (Double) -> String)] = [
            ("Spawn Rate (move)", \.spawnRateOnMove, 1, 20, whole),
            ("Burst Count (flare)", \.spawnBurstOnClick, 0, 60, whole),
            ("Emission Angle", \.emissionAngle, 0, 360, deg),
            ("Emission Spread", \.emissionSpread, 0, 360, deg),
            ("Velocity Inheritance", \.velocityInheritance, 0, 1, pct),
            ("Glow Radius", \.glowRadius, 0, 30, px),
            ("Speed Min", \.initialSpeedMin, 0, 15, one),
            ("Speed Max", \.initialSpeedMax, 0, 15, one),
            ("Wind (Gravity X)", \.gravityX, -3, 3, one),
            ("Gravity Y", \.gravityY, -3, 3, one),
            ("Drag", \.drag, 0.85, 1.0, { String(format: "%.2f", $0) }),
            ("Turbulence", \.turbulence, 0, 5, one),
            ("Vortex Attraction", \.vortexAttraction, -3, 3, one),
            ("Rainbow Speed", \.rainbowSpeed, 0, 10, one),
            ("Rotation Min", \.rotationSpeedMin, -10, 10, one),
            ("Rotation Max", \.rotationSpeedMax, -10, 10, one),
            ("Lifetime Min", \.lifetimeMin, 10, 120, whole),
            ("Lifetime Max", \.lifetimeMax, 10, 120, whole),
            ("Start Size", \.startSize, 1, 40, px),
            ("Peak Size", \.peakSize, 1, 40, px),
            ("End Size", \.endSize, 0, 40, px),
            ("Start Alpha", \.startAlpha, 0, 1, pct),
            ("Peak Alpha", \.peakAlpha, 0, 1, pct),
            ("End Alpha", \.endAlpha, 0, 1, pct),
        ]

        var index = 0
        while index < specs.count {
            let left = sliderColumn(specs[index])
            let right = index + 1 < specs.count ? sliderColumn(specs[index + 1]) : NSView()
            let row = NSStackView(views: [left, right])
            row.orientation = .horizontal
            row.spacing = 20
            row.distribution = .fillEqually
            stack.addArrangedSubview(row)
            row.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
            index += 2
        }
    }

    @objc private func presetChosen() {
        let index = presetPopup.indexOfSelectedItem
        guard index >= 0 && index < DefaultFxPresets.archetypes.count else { return }
        loadPreset(DefaultFxPresets.archetypes[index])
    }

    // MARK: Control factories

    private func label(_ text: String, size: CGFloat, color: NSColor) -> NSTextField {
        let field = NSTextField(labelWithString: text)
        field.font = .systemFont(ofSize: size)
        field.textColor = color
        return field
    }

    private func smallButton(_ title: String, action: @escaping () -> Void) -> CardButton {
        let button = CardButton()
        button.layer?.cornerRadius = 6
        button.setStyle(background: Theme.controlBg, border: Theme.cardBorder, borderWidth: 1)
        let titleLabel = label(title, size: 10, color: Theme.textPrimary)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(titleLabel)
        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: button.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: button.centerYAnchor),
            button.widthAnchor.constraint(greaterThanOrEqualTo: titleLabel.widthAnchor, constant: 18),
            button.heightAnchor.constraint(equalToConstant: 24),
        ])
        button.onClick = action
        return button
    }

    private func popupColumn(
        _ title: String,
        keyPath: WritableKeyPath<CustomFxConfig, String>,
        values: [String],
        titles: [String]
    ) -> NSView {
        let popup = NSPopUpButton()
        popup.addItems(withTitles: titles)
        popup.target = self
        popup.action = #selector(controlsChanged)
        popup.font = .systemFont(ofSize: 10)
        popupRefs.append((keyPath, popup, values))
        let column = NSStackView(views: [label(title, size: 10, color: Theme.textFaint), popup])
        column.orientation = .vertical
        column.alignment = .leading
        column.spacing = 2
        return column
    }

    private func colorChip(_ title: String, keyPath: WritableKeyPath<CustomFxConfig, String>) -> NSView {
        let chip = CardButton()
        chip.layer?.cornerRadius = 9
        chip.setStyle(background: NSColor(hexString: config[keyPath: keyPath]), border: NSColor(hexString: "#3F3F46"), borderWidth: 1)
        chip.translatesAutoresizingMaskIntoConstraints = false
        chip.widthAnchor.constraint(equalToConstant: 18).isActive = true
        chip.heightAnchor.constraint(equalToConstant: 18).isActive = true
        chip.onClick = { [weak self] in
            guard let self else { return }
            let prior = self.config[keyPath: keyPath]
            let panel = ColorPickerPanel(
                initial: NSColor(hexString: prior),
                title: "\(title) Color",
                swatches: SettingsManager.shared.settings.quickSwatches,
                onLive: { [weak self] hex in
                    self?.config[keyPath: keyPath] = hex
                    chip.setStyle(background: NSColor(hexString: hex), border: NSColor(hexString: "#3F3F46"), borderWidth: 1)
                    self?.apply()
                },
                onDone: { [weak self] hex in
                    self?.config[keyPath: keyPath] = hex
                    chip.setStyle(background: NSColor(hexString: hex), border: NSColor(hexString: "#3F3F46"), borderWidth: 1)
                    self?.apply()
                },
                onCancel: { [weak self] in
                    self?.config[keyPath: keyPath] = prior
                    chip.setStyle(background: NSColor(hexString: prior), border: NSColor(hexString: "#3F3F46"), borderWidth: 1)
                    self?.apply()
                }
            )
            panel.center()
            panel.makeKeyAndOrderFront(nil)
        }
        let column = NSStackView(views: [chip, label(title, size: 9, color: Theme.textMuted)])
        column.orientation = .horizontal
        column.spacing = 4
        return column
    }

    private func sliderColumn(_ spec: (String, WritableKeyPath<CustomFxConfig, Double>, Double, Double, (Double) -> String)) -> NSView {
        let (title, keyPath, min, max, fmt) = spec
        let slider = NSSlider(value: config[keyPath: keyPath], minValue: min, maxValue: max, target: self, action: #selector(controlsChanged))
        slider.isContinuous = true
        let valueLabel = label(fmt(config[keyPath: keyPath]), size: 10, color: Theme.amber)
        valueLabel.alignment = .right
        sliderRefs.append((keyPath, slider, valueLabel, fmt))

        let titleLabel = label(title, size: 10, color: NSColor(hexString: "#D4D4D8"))
        let header = NSStackView(views: [titleLabel, NSView(), valueLabel])
        header.orientation = .horizontal
        let column = NSStackView(views: [header, slider])
        column.orientation = .vertical
        column.alignment = .leading
        column.spacing = 2
        header.widthAnchor.constraint(equalTo: column.widthAnchor).isActive = true
        slider.widthAnchor.constraint(equalTo: column.widthAnchor).isActive = true
        return column
    }
}
