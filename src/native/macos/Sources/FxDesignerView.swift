import Cocoa

/// Native FX Designer (Settings → FX Designer): the same parameter model as the
/// web simulator's designer, editing a CustomFxConfig with LIVE preview — every
/// change applies to the cursor immediately (the overlay draws above this
/// window). The result becomes the "custom-fx" preset once committed with
/// Apply & Save; closing the window first reverts the preview. Save adds the
/// current config to a persistent preset library (customFxPresets), which
/// appears in the archetype popup after the built-ins, marked with ★.
final class FxDesignerView: NSView {
    var onStatus: ((String) -> Void)?

    private var config: CustomFxConfig
    private var customPresets: [CustomFxConfig] = []
    private var suppressApply = false

    private var presetPopup: NeonPopUp!
    private var nameField: NSTextField!
    private var glowSwitch: NeonSwitch!
    private var deleteButton: CardButton!
    private var popupRefs: [(keyPath: WritableKeyPath<CustomFxConfig, String>, popup: NeonPopUp, values: [String])] = []
    private var sliderRefs: [(keyPath: WritableKeyPath<CustomFxConfig, Double>, slider: NSSlider, label: NSTextField, fmt: (Double) -> String)] = []
    private var colorChips: [(keyPath: WritableKeyPath<CustomFxConfig, String>, chip: CardButton)] = []

    /// The library preset currently selected in the popup (nil = an archetype
    /// or a free-floating draft). Gates the Delete button, like the web's
    /// selectedIsCustom.
    private var selectedCustomId: String? {
        didSet { deleteButton?.isHidden = selectedCustomId == nil }
    }

    init() {
        let saved = SettingsManager.shared.settings.customFxJson.flatMap(CustomFxConfig.fromJSON)
        config = saved ?? DefaultFxPresets.archetypes.first ?? CustomFxConfig()
        customPresets = Self.loadLibrary()
        super.init(frame: .zero)
        buildUI()
        syncControls()
        rebuildPresetMenu(selecting: config.id)
    }

    required init?(coder: NSCoder) { fatalError() }

    /// Re-reads the saved Custom FX config after the settings change outside
    /// this view (window shown again, or an unapplied draft was reverted) so
    /// the controls match the live settings instead of a stale working copy.
    func reloadFromSettings() {
        let saved = SettingsManager.shared.settings.customFxJson.flatMap(CustomFxConfig.fromJSON)
        config = saved ?? DefaultFxPresets.archetypes.first ?? CustomFxConfig()
        customPresets = Self.loadLibrary()
        syncControls()
        rebuildPresetMenu(selecting: config.id)
    }

    // MARK: Preset library (persisted instantly, like the web localStorage library)

    private static func loadLibrary() -> [CustomFxConfig] {
        SettingsManager.shared.settings.customFxPresets.compactMap(CustomFxConfig.fromJSON)
    }

    private func persistLibrary() {
        let jsons = customPresets.compactMap { preset -> String? in
            guard let data = try? JSONEncoder().encode(preset) else { return nil }
            return String(data: data, encoding: .utf8)
        }
        var settings = SettingsManager.shared.settings
        settings.customFxPresets = jsons
        SettingsManager.shared.settings = settings
    }

    /// Rebuilds the archetype popup: built-ins first, then ★-prefixed library
    /// presets. Selects the entry matching `id` (archetype or custom), or
    /// clears the selection for a free-floating draft.
    private func rebuildPresetMenu(selecting id: String?) {
        presetPopup.removeAllItems()
        presetPopup.addItems(withTitles: DefaultFxPresets.archetypes.map { $0.name })
        presetPopup.addItems(withTitles: customPresets.map { "★ \($0.name)" })
        if let id, let custom = customPresets.firstIndex(where: { $0.id == id }) {
            presetPopup.selectItem(at: DefaultFxPresets.archetypes.count + custom)
            selectedCustomId = id
        } else if let id, let arch = DefaultFxPresets.archetypes.firstIndex(where: { $0.id == id }) {
            presetPopup.selectItem(at: arch)
            selectedCustomId = nil
        } else {
            presetPopup.selectItem(at: -1)
            selectedCustomId = nil
        }
    }

    private func saveToLibrary() {
        let trimmed = nameField.stringValue.trimmingCharacters(in: .whitespaces)
        let name = trimmed.isEmpty ? "Custom FX" : trimmed
        config.name = name
        // Only the preset currently loaded FROM the library overwrites in
        // place; any other draft mints a new id, even if its id happens to
        // collide with a library entry (e.g. re-imported Copy JSON output).
        if selectedCustomId != config.id {
            config.id = "custom-\(Int(Date().timeIntervalSince1970 * 1000))"
        }
        customPresets.removeAll { $0.id == config.id }
        customPresets.insert(config, at: 0)
        persistLibrary()
        rebuildPresetMenu(selecting: config.id)
        onStatus?("Saved \"\(name)\" to your preset library")
    }

    private func deleteSelectedPreset() {
        guard let id = selectedCustomId, let target = customPresets.first(where: { $0.id == id }) else { return }
        customPresets.removeAll { $0.id == id }
        persistLibrary()
        rebuildPresetMenu(selecting: nil)
        onStatus?("Deleted \"\(target.name)\" from your preset library")
    }

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
                border: Theme.neonViolet.withAlphaComponent(0.3),
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
        presetPopup = NeonPopUp()
        presetPopup.target = self
        presetPopup.action = #selector(presetChosen)

        nameField = NSTextField(string: config.name)
        nameField.font = .systemFont(ofSize: 13)
        nameField.drawsBackground = false
        nameField.isBordered = false
        nameField.wantsLayer = true
        nameField.layer?.backgroundColor = Theme.windowBg.cgColor
        nameField.layer?.borderColor = Theme.neonViolet.withAlphaComponent(0.35).cgColor
        nameField.layer?.borderWidth = 1
        nameField.layer?.cornerRadius = 5
        nameField.textColor = Theme.textPrimary
        nameField.translatesAutoresizingMaskIntoConstraints = false
        nameField.widthAnchor.constraint(equalToConstant: 150).isActive = true
        nameField.target = self
        nameField.action = #selector(controlsChanged)

        let saveButton = smallButton("Save") { [weak self] in
            self?.saveToLibrary()
        }
        deleteButton = smallButtonControl("Delete", titleColor: NSColor(hexString: "#F87171"), border: NSColor(hexString: "#F87171").withAlphaComponent(0.4)) { [weak self] in
            self?.deleteSelectedPreset()
        }
        deleteButton.isHidden = true
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
                // Fresh id, like the web importer — a pasted config must never
                // adopt an existing library id and overwrite it on Save
                var imported = parsed
                imported.id = "custom-imported-\(Int(Date().timeIntervalSince1970 * 1000))"
                self.config = imported
                self.selectedCustomId = nil
                self.presetPopup.selectItem(at: -1)
                self.syncControls()
                self.apply()
                self.onStatus?("Imported: \(parsed.name)")
            } else {
                self.onStatus?("⚠️ Clipboard does not contain a valid FX Designer config.")
            }
        }

        let headerRow = NSStackView(views: [
            label("Archetype:", size: 13, color: Theme.textSecondary), presetPopup,
            label("Name:", size: 13, color: Theme.textSecondary), nameField,
            NSView(), saveButton, deleteButton, copyButton, importButton,
        ])
        headerRow.orientation = .horizontal
        headerRow.spacing = 8
        stack.addArrangedSubview(headerRow)
        headerRow.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true

        let hint = label("Every change previews live on your cursor — click Apply & Save to keep it as the Custom FX preset.", size: 12, color: Theme.textMuted)
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

        // Colors + glow, in a card like the web designer
        glowSwitch = NeonSwitch()
        glowSwitch.target = self
        glowSwitch.action = #selector(controlsChanged)
        let colorsRow = NSStackView(views: [
            label("Colors:", size: 13, color: Theme.textSecondary),
            colorChip("Primary", keyPath: \.primaryColor),
            colorChip("Secondary", keyPath: \.secondaryColor),
            colorChip("Accent", keyPath: \.accentColor),
            NSView(),
            label("Glow Bloom", size: 13, color: Theme.textSecondary),
            glowSwitch,
        ])
        colorsRow.orientation = .horizontal
        colorsRow.spacing = 10
        let colorsCard = card(wrapping: colorsRow)
        stack.addArrangedSubview(colorsCard)
        colorsCard.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true

        // Sliders (two per row), in a card like the web designer
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

        let slidersStack = NSStackView()
        slidersStack.orientation = .vertical
        slidersStack.alignment = .leading
        slidersStack.spacing = 10
        var index = 0
        while index < specs.count {
            let left = sliderColumn(specs[index])
            let right = index + 1 < specs.count ? sliderColumn(specs[index + 1]) : NSView()
            let row = NSStackView(views: [left, right])
            row.orientation = .horizontal
            row.spacing = 20
            row.distribution = .fillEqually
            slidersStack.addArrangedSubview(row)
            row.widthAnchor.constraint(equalTo: slidersStack.widthAnchor).isActive = true
            index += 2
        }
        let slidersCard = card(wrapping: slidersStack)
        stack.addArrangedSubview(slidersCard)
        slidersCard.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
    }

    @objc private func presetChosen() {
        let index = presetPopup.indexOfSelectedItem
        let archetypeCount = DefaultFxPresets.archetypes.count
        if index >= 0 && index < archetypeCount {
            selectedCustomId = nil
            loadPreset(DefaultFxPresets.archetypes[index])
        } else if index >= archetypeCount && index < archetypeCount + customPresets.count {
            // Library presets load keeping their id, so Save overwrites in place
            let preset = customPresets[index - archetypeCount]
            selectedCustomId = preset.id
            config = preset
            syncControls()
            apply()
            onStatus?("Loaded archetype: \(preset.name) — previewing live on your cursor")
        }
    }

    // MARK: Control factories

    private func label(_ text: String, size: CGFloat, color: NSColor) -> NSTextField {
        let field = NSTextField(labelWithString: text)
        field.font = .systemFont(ofSize: size)
        field.textColor = color
        return field
    }

    /// Web neon-card equivalent: rounded bordered container with padding.
    private func card(wrapping inner: NSView, padding: CGFloat = 14) -> NSView {
        let card = NSView()
        card.wantsLayer = true
        card.layer?.backgroundColor = Theme.cardBg.cgColor
        card.layer?.borderColor = Theme.cardBorder.cgColor
        card.layer?.borderWidth = 1
        card.layer?.cornerRadius = 10
        inner.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(inner)
        NSLayoutConstraint.activate([
            inner.topAnchor.constraint(equalTo: card.topAnchor, constant: padding),
            inner.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: padding),
            inner.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -padding),
            inner.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -padding),
        ])
        return card
    }

    private func smallButton(_ title: String, action: @escaping () -> Void) -> CardButton {
        smallButtonControl(title, titleColor: Theme.textPrimary, border: Theme.cardBorder, action: action)
    }

    private func smallButtonControl(_ title: String, titleColor: NSColor, border: NSColor, action: @escaping () -> Void) -> CardButton {
        let button = CardButton()
        button.layer?.cornerRadius = 6
        button.setStyle(background: Theme.controlBg, border: border, borderWidth: 1)
        let titleLabel = label(title, size: 12, color: titleColor)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(titleLabel)
        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: button.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: button.centerYAnchor),
            button.widthAnchor.constraint(greaterThanOrEqualTo: titleLabel.widthAnchor, constant: 18),
            button.heightAnchor.constraint(equalToConstant: 26),
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
        let popup = NeonPopUp()
        popup.addItems(withTitles: titles)
        popup.target = self
        popup.action = #selector(controlsChanged)
        popup.font = .systemFont(ofSize: 12)
        popupRefs.append((keyPath, popup, values))
        let column = NSStackView(views: [label(title, size: 12, color: Theme.textFaint), popup])
        column.orientation = .vertical
        column.alignment = .leading
        column.spacing = 2
        return column
    }

    private func colorChip(_ title: String, keyPath: WritableKeyPath<CustomFxConfig, String>) -> NSView {
        let chip = CardButton()
        chip.layer?.cornerRadius = 9
        chip.setStyle(background: NSColor(hexString: config[keyPath: keyPath]), border: Theme.neonViolet.withAlphaComponent(0.3), borderWidth: 1)
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
                    chip.setStyle(background: NSColor(hexString: hex), border: Theme.neonViolet.withAlphaComponent(0.3), borderWidth: 1)
                    self?.apply()
                },
                onDone: { [weak self] hex in
                    self?.config[keyPath: keyPath] = hex
                    chip.setStyle(background: NSColor(hexString: hex), border: Theme.neonViolet.withAlphaComponent(0.3), borderWidth: 1)
                    self?.apply()
                },
                onCancel: { [weak self] in
                    self?.config[keyPath: keyPath] = prior
                    chip.setStyle(background: NSColor(hexString: prior), border: Theme.neonViolet.withAlphaComponent(0.3), borderWidth: 1)
                    self?.apply()
                }
            )
            panel.center()
            panel.makeKeyAndOrderFront(nil)
        }
        let column = NSStackView(views: [chip, label(title, size: 11, color: Theme.textMuted)])
        column.orientation = .horizontal
        column.spacing = 4
        return column
    }

    private func sliderColumn(_ spec: (String, WritableKeyPath<CustomFxConfig, Double>, Double, Double, (Double) -> String)) -> NSView {
        let (title, keyPath, min, max, fmt) = spec
        let slider = NeonSlider(value: config[keyPath: keyPath], minValue: min, maxValue: max, target: self, action: #selector(controlsChanged))
        slider.isContinuous = true
        let valueLabel = label(fmt(config[keyPath: keyPath]), size: 12, color: Theme.neonValue)
        valueLabel.alignment = .right
        sliderRefs.append((keyPath, slider, valueLabel, fmt))

        let titleLabel = label(title, size: 12, color: NSColor(hexString: "#D4D4D8"))
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
