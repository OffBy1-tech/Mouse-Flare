import Cocoa

// MARK: - Shared dark theme (hex values match the Windows build's XAML palette)

enum Theme {
    static let windowBg = NSColor(hexString: "#09090B")
    static let panelBg = NSColor(hexString: "#0C0C0E")
    static let cardBg = NSColor(hexString: "#18181B")
    static let cardBorder = NSColor(hexString: "#27272A")
    static let insetBg = NSColor(hexString: "#141417")
    static let controlBg = NSColor(hexString: "#27272A")
    static let textPrimary = NSColor(hexString: "#FAFAFA")
    static let textSecondary = NSColor(hexString: "#A1A1AA")
    static let textMuted = NSColor(hexString: "#71717A")
    static let textFaint = NSColor(hexString: "#52525B")
    static let amber = NSColor(hexString: "#F59E0B")
    static let amberBright = NSColor(hexString: "#FBBF24")
    static let cyan = NSColor(hexString: "#06B6D4")
    static let emerald = NSColor(hexString: "#10B981")
}

// MARK: - Small custom controls

/// A rounded, bordered, clickable card — used for nav items, preset cards, and color chips.
final class CardButton: NSView {
    var onClick: (() -> Void)?
    var onDoubleClick: (() -> Void)?

    init() {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.borderWidth = 1
        setStyle(background: Theme.cardBg, border: Theme.cardBorder, borderWidth: 1)
    }

    required init?(coder: NSCoder) { fatalError() }

    func setStyle(background: NSColor, border: NSColor, borderWidth: CGFloat) {
        layer?.backgroundColor = background.cgColor
        layer?.borderColor = border.cgColor
        layer?.borderWidth = borderWidth
    }

    override func mouseDown(with event: NSEvent) {
        if event.clickCount == 2, let onDoubleClick {
            onDoubleClick()
        } else {
            onClick?()
        }
    }

    override func resetCursorRects() {
        addCursorRect(bounds, cursor: .pointingHand)
    }
}

/// NSStackView pinned to the top of a scroll view (AppKit views are bottom-up by default).
final class FlippedView: NSView {
    override var isFlipped: Bool { true }
}

// MARK: - Settings window

final class SettingsWindowController: NSWindowController, NSWindowDelegate {
    // Preset catalogs — ids shared verbatim with the Windows build
    private static let passivePresets: [(id: String, icon: String, title: String, subtitle: String)] = [
        ("fluid-simulation", "🌊", "Fluid Simulation", "Velocity dissipation model"),
        ("spark-trail", "✨", "Spark Trail", "Golden kinetic embers"),
        ("fluid-smoke", "💨", "Fluid Smoke Swirl", "Billowing dye vortices"),
        ("neon-fluid", "🧪", "Neon Fluid Dye", "Luminescent fluid glow"),
        ("cosmic-vortex", "🌌", "Cosmic Liquid", "Galactic chromatic swirls"),
        ("ink-diffusion", "🖋️", "Ink Diffusion", "Organic watercolor plumes"),
        ("glow-pulse", "💡", "Glow Pulse", "Soft luminous aura trail"),
        ("comet-trail", "☄️", "Comet Tail", "Aerodynamic ribbon"),
        ("bubbles", "🫧", "Bubbles", "Translucent spheres"),
        ("fireflies", "🌿", "Fireflies", "Organic bioluminescence"),
        ("star-dust", "⭐", "Star Dust", "Twinkling 4-point stars"),
        ("lightning", "⚡", "Lightning Arc", "Electric micro plasma"),
        ("rainbow", "🌈", "Rainbow Wave", "Chromatic color shifts"),
        ("plasma", "🟣", "Plasma Field", "Ionized energy rings"),
        ("matrix-rain", "🟩", "Matrix Rain", "Cascading green code glyphs"),
        ("fire-flame", "🔥", "Fire & Flame", "Blazing buoyant embers"),
        ("neon-cyber", "⚡", "Neon Cyber", "Electric cyan-magenta pulses"),
        ("magic-dust", "✨", "Magic Dust", "Enchanted pastel shimmer"),
        ("galaxy", "🌌", "Galaxy Supernova", "Deep-space stars & nebula"),
        ("minimal-beacon", "🎯", "Minimalist Beacon", "Single subtle tracking dot"),
        ("custom-fx", "🧪", "Custom FX", "Imported from the FX Designer")
    ]

    private static let flarePresets: [(id: String, icon: String, title: String, subtitle: String)] = [
        ("solar-flare", "☀️", "Solar Flare", "Concentric shockwaves"),
        ("fluid-vortex-burst", "🌀", "Fluid Vortex Burst", "Radial dye shockwave"),
        ("sonar-radar", "📡", "Sonar Radar", "Radar rings & reticle"),
        ("neon-beacon", "🎯", "Neon Beacon", "Dual high-contrast rings"),
        ("quantum-shockwave", "🌫️", "Quantum Wave", "Relativistic expanding wave"),
        ("supernova", "💥", "Supernova", "Starry flash explosion")
    ]

    private static let colorPresets: [(id: String, hex: String, title: String)] = [
        ("color-amber", "#F59E0B", "Amber Flare"),
        ("color-cyan", "#06B6D4", "Cyber Cyan"),
        ("color-emerald", "#10B981", "Emerald Glow"),
        ("color-violet", "#8B5CF6", "Electric Violet"),
        ("color-gold", "#EAB308", "Solar Gold"),
        ("color-white", "#FFFFFF", "Pure White"),
        ("color-crimson", "#EF4444", "Crimson Fire")
    ]

    // Tab machinery
    private var tabs: [String: NSScrollView] = [:]
    private var navButtons: [String: (card: CardButton, label: NSTextField)] = [:]
    private var activeTab = "fx-studio"

    // Stateful controls
    private var passiveCards: [String: CardButton] = [:]
    private var flareCards: [String: CardButton] = [:]
    private var colorChips: [String: (card: CardButton, label: NSTextField)] = [:]
    private var statusLabel: NSTextField!
    private var hotkeyButton: CardButton!
    private var hotkeyLabel: NSTextField!
    private var customHexField: NSTextField!
    private var customHexPreview: NSView!
    private var quickSwatchButtons: [CardButton] = []
    private var activeColorPicker: ColorPickerPanel?

    private enum PickerTarget {
        case custom
        case swatch(Int)
    }

    private var switchEnabled: NSSwitch!
    private var switchPassive: NSSwitch!
    private var switchStartAtLogin: NSSwitch!
    private var switchSound: NSSwitch!
    private var switchAutoUpdate: NSSwitch!
    private var switchIdleBurst: NSSwitch!
    private var switchMonitorCrossing: NSSwitch!

    private var sliderIntensity: NSSlider!
    private var sliderDensity: NSSlider!
    private var sliderSpeed: NSSlider!
    private var sliderThreshold: NSSlider!
    private var sliderVorticity: NSSlider!
    private var sliderDissipation: NSSlider!
    private var valueIntensity: NSTextField!
    private var valueDensity: NSTextField!
    private var valueSpeed: NSTextField!
    private var valueThreshold: NSTextField!
    private var valueVorticity: NSTextField!
    private var valueDissipation: NSTextField!

    init() {
        let win = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 940, height: 680),
            styleMask: [.titled, .closable, .miniaturizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        win.title = "Mouseflare — Settings & FX Studio"
        win.titleVisibility = .hidden
        win.titlebarAppearsTransparent = true
        win.appearance = NSAppearance(named: .darkAqua)
        win.backgroundColor = Theme.windowBg
        win.center()
        win.isReleasedWhenClosed = false
        win.level = .floating
        super.init(window: win)
        win.delegate = self
        setupUI()
        syncUIToSettings()
    }

    required init?(coder: NSCoder) { fatalError() }

    func show() {
        guard let win = self.window else { return }
        win.makeKeyAndOrderFront(nil)
        win.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
        syncUIToSettings()
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false // Non-destructive hide to prevent dealloc transform crash
    }

    // MARK: Layout skeleton

    private func setupUI() {
        guard let window = self.window, let contentView = window.contentView else { return }
        contentView.wantsLayer = true
        contentView.layer?.backgroundColor = Theme.windowBg.cgColor

        // ---- Title bar strip ----
        let titleBar = NSView()
        titleBar.wantsLayer = true
        titleBar.layer?.backgroundColor = Theme.panelBg.cgColor
        titleBar.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(titleBar)

        let titleBarBorder = makeDivider()
        titleBar.addSubview(titleBarBorder)

        let flameTile = makeLogoTile(size: 20, corner: 5)
        let brandTitle = makeLabel("Mouseflare", size: 12, weight: .bold, color: Theme.textPrimary)
        let brandSub = makeLabel(" — Settings & FX Studio", size: 11, weight: .regular, color: Theme.textMuted)

        let brandStack = NSStackView(views: [flameTile, brandTitle, brandSub])
        brandStack.orientation = .horizontal
        brandStack.spacing = 8
        brandStack.setCustomSpacing(0, after: brandTitle)
        brandStack.translatesAutoresizingMaskIntoConstraints = false
        titleBar.addSubview(brandStack)

        // ---- Sidebar ----
        let sidebar = NSView()
        sidebar.wantsLayer = true
        sidebar.layer?.backgroundColor = Theme.panelBg.cgColor
        sidebar.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(sidebar)

        let sidebarBorder = NSView()
        sidebarBorder.wantsLayer = true
        sidebarBorder.layer?.backgroundColor = Theme.cardBorder.cgColor
        sidebarBorder.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(sidebarBorder)

        let navHeader = makeLabel("NAVIGATION", size: 10, weight: .bold, color: Theme.textFaint)

        let navStack = NSStackView(views: [navHeader])
        navStack.orientation = .vertical
        navStack.alignment = .leading
        navStack.spacing = 4
        navStack.setCustomSpacing(10, after: navHeader)
        navStack.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(navStack)

        let navItems: [(id: String, icon: String, title: String)] = [
            ("general", "🔥", "General"),
            ("fx-studio", "✨", "FX Studio"),
            ("behavior", "🎛️", "Behavior & Monitors"),
            ("diagnostics", "📊", "Diagnostics")
        ]
        for item in navItems {
            let (card, titleField) = makeNavButton(icon: item.icon, title: item.title)
            card.onClick = { [weak self] in self?.selectTab(item.id) }
            navButtons[item.id] = (card, titleField)
            navStack.addArrangedSubview(card)
            card.widthAnchor.constraint(equalTo: navStack.widthAnchor).isActive = true
        }

        let versionLabel = makeLabel(
            Updater.shared.isDevBuild ? "Mouseflare dev build" : "Mouseflare v\(Updater.shared.currentVersion)",
            size: 10, weight: .regular, color: Theme.textPrimary
        )
        versionLabel.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(versionLabel)

        let testFlareButton = makeFilledButton(title: "⚡  Test Flare Now", background: Theme.amber, foreground: Theme.windowBg)
        testFlareButton.onClick = { [weak self] in
            (NSApp.delegate as? AppDelegate)?.triggerFindMouse()
            self?.setStatus("⚡ Triggered Find Mouse Flare Shockwave!")
        }
        testFlareButton.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(testFlareButton)

        // ---- Content region + footer ----
        let footer = makeFooter()
        footer.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(footer)

        NSLayoutConstraint.activate([
            titleBar.topAnchor.constraint(equalTo: contentView.topAnchor),
            titleBar.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            titleBar.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            titleBar.heightAnchor.constraint(equalToConstant: 40),

            titleBarBorder.leadingAnchor.constraint(equalTo: titleBar.leadingAnchor),
            titleBarBorder.trailingAnchor.constraint(equalTo: titleBar.trailingAnchor),
            titleBarBorder.bottomAnchor.constraint(equalTo: titleBar.bottomAnchor),
            titleBarBorder.heightAnchor.constraint(equalToConstant: 1),

            // Inset past the macOS traffic-light buttons
            brandStack.leadingAnchor.constraint(equalTo: titleBar.leadingAnchor, constant: 78),
            brandStack.centerYAnchor.constraint(equalTo: titleBar.centerYAnchor),

            sidebar.topAnchor.constraint(equalTo: titleBar.bottomAnchor),
            sidebar.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            sidebar.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            sidebar.widthAnchor.constraint(equalToConstant: 220),

            sidebarBorder.trailingAnchor.constraint(equalTo: sidebar.trailingAnchor),
            sidebarBorder.topAnchor.constraint(equalTo: sidebar.topAnchor),
            sidebarBorder.bottomAnchor.constraint(equalTo: sidebar.bottomAnchor),
            sidebarBorder.widthAnchor.constraint(equalToConstant: 1),

            navStack.topAnchor.constraint(equalTo: sidebar.topAnchor, constant: 16),
            navStack.leadingAnchor.constraint(equalTo: sidebar.leadingAnchor, constant: 12),
            navStack.trailingAnchor.constraint(equalTo: sidebar.trailingAnchor, constant: -13),

            versionLabel.centerXAnchor.constraint(equalTo: sidebar.centerXAnchor),
            versionLabel.bottomAnchor.constraint(equalTo: testFlareButton.topAnchor, constant: -8),

            testFlareButton.leadingAnchor.constraint(equalTo: sidebar.leadingAnchor, constant: 12),
            testFlareButton.trailingAnchor.constraint(equalTo: sidebar.trailingAnchor, constant: -13),
            testFlareButton.bottomAnchor.constraint(equalTo: sidebar.bottomAnchor, constant: -14),
            testFlareButton.heightAnchor.constraint(equalToConstant: 36),

            footer.leadingAnchor.constraint(equalTo: sidebar.trailingAnchor, constant: 22),
            footer.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -22),
            footer.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -14)
        ])

        // ---- Tabs ----
        let tabIds = ["general", "fx-studio", "behavior", "diagnostics"]
        for id in tabIds {
            let (scroll, stack) = makeScrollTab()
            switch id {
            case "general": buildGeneralTab(into: stack)
            case "fx-studio": buildFxStudioTab(into: stack)
            case "behavior": buildBehaviorTab(into: stack)
            default: buildDiagnosticsTab(into: stack)
            }
            scroll.translatesAutoresizingMaskIntoConstraints = false
            contentView.addSubview(scroll)
            NSLayoutConstraint.activate([
                scroll.topAnchor.constraint(equalTo: titleBar.bottomAnchor, constant: 18),
                scroll.leadingAnchor.constraint(equalTo: sidebar.trailingAnchor, constant: 22),
                scroll.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -22),
                scroll.bottomAnchor.constraint(equalTo: footer.topAnchor, constant: -10)
            ])
            tabs[id] = scroll
        }

        selectTab("fx-studio")
    }

    private func selectTab(_ id: String) {
        activeTab = id
        for (tabId, scroll) in tabs {
            scroll.isHidden = (tabId != id)
        }
        for (navId, nav) in navButtons {
            let isActive = navId == id
            nav.card.setStyle(
                background: isActive ? Theme.amber.withAlphaComponent(0.14) : .clear,
                border: isActive ? Theme.amber.withAlphaComponent(0.31) : .clear,
                borderWidth: isActive ? 1 : 0
            )
            nav.label.textColor = isActive ? Theme.amber : Theme.textPrimary
        }
    }

    // MARK: Tab: General

    private func buildGeneralTab(into stack: NSStackView) {
        stack.addArrangedSubview(makeLabel("General Configuration", size: 17, weight: .bold, color: Theme.textPrimary))
        let sub = makeLabel("Control master switches, global hotkey shortcut, and startup behavior.", size: 11, weight: .regular, color: Theme.textSecondary)
        stack.addArrangedSubview(sub)
        stack.setCustomSpacing(16, after: sub)

        switchEnabled = NSSwitch()
        switchEnabled.target = self
        switchEnabled.action = #selector(togglesChanged)
        addToggleCard(
            to: stack,
            title: "Enable Mouseflare",
            subtitle: "Global toggle for all cursor tracking, passive trail effects, and active flares.",
            control: switchEnabled
        )

        switchPassive = NSSwitch()
        switchPassive.target = self
        switchPassive.action = #selector(togglesChanged)
        addToggleCard(
            to: stack,
            title: "Enable Passive Trail FX",
            subtitle: "Renders subtle momentary particle trails behind pointer while moving.",
            control: switchPassive
        )

        // Hotkey card
        let hotkeyCard = makeCard()
        let hotkeyTitle = makeLabel("Find Mouse Global Hotkey", size: 13, weight: .bold, color: Theme.textPrimary)
        let hotkeySub = makeLabel("Press this shortcut anywhere in macOS to blast a beacon flare.", size: 11, weight: .regular, color: Theme.textMuted)

        hotkeyButton = CardButton()
        hotkeyButton.setStyle(background: Theme.controlBg, border: Theme.amber, borderWidth: 1)
        hotkeyLabel = makeLabel(SettingsManager.shared.settings.hotkey, size: 12, weight: .bold, color: Theme.amberBright)
        hotkeyLabel.translatesAutoresizingMaskIntoConstraints = false
        hotkeyButton.addSubview(hotkeyLabel)
        NSLayoutConstraint.activate([
            hotkeyLabel.centerXAnchor.constraint(equalTo: hotkeyButton.centerXAnchor),
            hotkeyLabel.centerYAnchor.constraint(equalTo: hotkeyButton.centerYAnchor),
            hotkeyButton.widthAnchor.constraint(greaterThanOrEqualTo: hotkeyLabel.widthAnchor, constant: 26),
            hotkeyButton.heightAnchor.constraint(equalToConstant: 32)
        ])

        let titleStack = NSStackView(views: [hotkeyTitle, hotkeySub])
        titleStack.orientation = .vertical
        titleStack.alignment = .leading
        titleStack.spacing = 2

        let topRow = NSStackView(views: [titleStack, NSView(), hotkeyButton])
        topRow.orientation = .horizontal
        topRow.alignment = .centerY

        let presetsLabel = makeLabel("Presets:", size: 11, weight: .regular, color: Theme.textMuted)
        let presetsRow = NSStackView(views: [presetsLabel])
        presetsRow.orientation = .horizontal
        presetsRow.spacing = 6
        for combo in ["⌘ + Shift + F", "⌃ + Space", "⌥ + M", "F1"] {
            let chip = makeFilledButton(title: combo, background: Theme.controlBg, foreground: NSColor(hexString: "#D4D4D8"), fontSize: 10, height: 24)
            chip.onClick = { [weak self] in
                SettingsManager.shared.settings.hotkey = combo
                self?.hotkeyLabel.stringValue = combo
                self?.setStatus("Hotkey set to \(combo)")
            }
            presetsRow.addArrangedSubview(chip)
        }

        let hotkeyStack = NSStackView(views: [topRow, presetsRow])
        hotkeyStack.orientation = .vertical
        hotkeyStack.alignment = .leading
        hotkeyStack.spacing = 10
        embed(hotkeyStack, in: hotkeyCard, padding: 14)
        topRow.widthAnchor.constraint(equalTo: hotkeyStack.widthAnchor).isActive = true
        stack.addArrangedSubview(hotkeyCard)
        hotkeyCard.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true

        // Half-width toggle pair
        switchStartAtLogin = NSSwitch()
        switchStartAtLogin.target = self
        switchStartAtLogin.action = #selector(togglesChanged)
        let startCard = makeToggleCard(title: "Start with macOS", subtitle: "Launch upon login.", control: switchStartAtLogin)

        switchSound = NSSwitch()
        switchSound.target = self
        switchSound.action = #selector(togglesChanged)
        let soundCard = makeToggleCard(title: "Beacon Chime", subtitle: "Audio beacon cue.", control: switchSound)

        let pair = NSStackView(views: [startCard, soundCard])
        pair.orientation = .horizontal
        pair.spacing = 10
        pair.distribution = .fillEqually
        stack.addArrangedSubview(pair)
        pair.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true

        switchAutoUpdate = NSSwitch()
        switchAutoUpdate.target = self
        switchAutoUpdate.action = #selector(togglesChanged)
        addToggleCard(
            to: stack,
            title: "Automatic Update Checks",
            subtitle: "Quietly check GitHub Releases every 6 hours (installed: v\(Updater.shared.currentVersion)). Use the menu bar for a manual check.",
            control: switchAutoUpdate
        )
    }

    // MARK: Tab: FX Studio

    private func buildFxStudioTab(into stack: NSStackView) {
        stack.addArrangedSubview(makeLabel("FX Studio & Particle Customizer", size: 17, weight: .bold, color: Theme.textPrimary))
        let sub = makeLabel("Configure movement trails, signature flare shockwaves, color palettes, and physics.", size: 11, weight: .regular, color: Theme.textSecondary)
        stack.addArrangedSubview(sub)
        stack.setCustomSpacing(16, after: sub)

        stack.addArrangedSubview(makeLabel("Passive Movement FX (Trail Styles)", size: 12, weight: .bold, color: Theme.amber))
        let passiveGrid = makePresetGrid(items: Self.passivePresets, cards: &passiveCards) { [weak self] id in
            SettingsManager.shared.settings.passivePreset = id
            self?.refreshPresetHighlights()
            self?.setStatus("Selected Passive FX: \(Self.formatPresetName(id))")
        }
        stack.addArrangedSubview(passiveGrid)
        passiveGrid.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        let importFxButton = makeFilledButton(title: "📋  Import Custom FX (JSON from clipboard)", background: Theme.controlBg, foreground: Theme.textPrimary, fontSize: 11, height: 28, bold: false)
        importFxButton.onClick = { [weak self] in self?.importCustomFxFromClipboard() }
        stack.addArrangedSubview(importFxButton)
        stack.setCustomSpacing(14, after: importFxButton)

        stack.addArrangedSubview(makeLabel("Find Mouse Signature Flare Animations", size: 12, weight: .bold, color: Theme.cyan))
        let flareGrid = makePresetGrid(items: Self.flarePresets, cards: &flareCards) { [weak self] id in
            SettingsManager.shared.settings.flarePreset = id
            self?.refreshPresetHighlights()
            (NSApp.delegate as? AppDelegate)?.triggerFindMouse()
            self?.setStatus("Selected Flare: \(Self.formatPresetName(id)) (Previewing Flare)")
        }
        stack.addArrangedSubview(flareGrid)
        flareGrid.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        stack.setCustomSpacing(14, after: flareGrid)

        stack.addArrangedSubview(makeLabel("Color Palette & Glow Signature", size: 12, weight: .bold, color: Theme.textPrimary))
        let chipRows = NSStackView()
        chipRows.orientation = .vertical
        chipRows.alignment = .leading
        chipRows.spacing = 6
        var currentRow: NSStackView?
        for (index, preset) in Self.colorPresets.enumerated() {
            if index % 4 == 0 {
                let row = NSStackView()
                row.orientation = .horizontal
                row.spacing = 6
                chipRows.addArrangedSubview(row)
                currentRow = row
            }
            let dotColor = NSColor(hexString: preset.hex)
            let (chip, chipLabel) = makeColorChip(title: preset.title, dotColor: dotColor)
            chip.onClick = { [weak self] in
                SettingsManager.shared.settings.colorPreset = preset.id
                self?.customHexField.stringValue = preset.hex
                self?.customHexPreview.layer?.backgroundColor = dotColor.cgColor
                self?.refreshPresetHighlights()
                self?.refreshQuickSwatches()
                self?.setStatus("Color: \(preset.title)")
            }
            colorChips[preset.id] = (chip, chipLabel)
            currentRow?.addArrangedSubview(chip)
        }
        stack.addArrangedSubview(chipRows)

        // Custom color panel
        let customCard = makeCard(background: Theme.insetBg)
        let customLabel = makeLabel("Custom Color:", size: 11, weight: .semibold, color: Theme.textSecondary)
        let previewButton = CardButton()
        previewButton.layer?.cornerRadius = 8
        previewButton.setStyle(background: Theme.amber, border: Theme.textFaint, borderWidth: 1)
        previewButton.translatesAutoresizingMaskIntoConstraints = false
        previewButton.widthAnchor.constraint(equalToConstant: 16).isActive = true
        previewButton.heightAnchor.constraint(equalToConstant: 16).isActive = true
        previewButton.onClick = { [weak self] in self?.openColorPicker(.custom) }
        customHexPreview = previewButton

        customHexField = NSTextField(string: SettingsManager.shared.settings.customColorHex)
        customHexField.font = .systemFont(ofSize: 11)
        customHexField.backgroundColor = Theme.cardBg
        customHexField.textColor = Theme.textPrimary
        customHexField.isBordered = true
        customHexField.translatesAutoresizingMaskIntoConstraints = false
        customHexField.widthAnchor.constraint(equalToConstant: 84).isActive = true
        customHexField.target = self
        customHexField.action = #selector(hexFieldEntered) // Enter applies

        let quickLabel = makeLabel("Quick:", size: 10, weight: .regular, color: Theme.textMuted)
        let customRow = NSStackView(views: [customLabel, customHexPreview, customHexField, NSView(), quickLabel])
        customRow.orientation = .horizontal
        customRow.spacing = 8
        // Quick swatches: click selects the color, double-click opens the picker
        // to edit it; the selected swatch is marked with a white ring
        for (index, hex) in SettingsManager.shared.settings.quickSwatches.enumerated() {
            let swatch = CardButton()
            swatch.layer?.cornerRadius = 9
            swatch.setStyle(background: NSColor(hexString: hex), border: NSColor(hexString: "#3F3F46"), borderWidth: 1)
            swatch.translatesAutoresizingMaskIntoConstraints = false
            swatch.widthAnchor.constraint(equalToConstant: 18).isActive = true
            swatch.heightAnchor.constraint(equalToConstant: 18).isActive = true
            swatch.toolTip = "Click to use this color • double-click to edit it"
            swatch.onClick = { [weak self] in self?.selectQuickSwatch(index) }
            swatch.onDoubleClick = { [weak self] in self?.openColorPicker(.swatch(index)) }
            quickSwatchButtons.append(swatch)
            customRow.addArrangedSubview(swatch)
        }
        embed(customRow, in: customCard, padding: 12)
        stack.addArrangedSubview(customCard)
        customCard.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        stack.setCustomSpacing(16, after: customCard)

        // Physics sliders card
        let physicsCard = makeCard()
        sliderIntensity = makeSlider(min: 0.5, max: 2.0)
        valueIntensity = makeValueLabel()
        sliderDensity = makeSlider(min: 1, max: 10)
        valueDensity = makeValueLabel()
        sliderSpeed = makeSlider(min: 0.5, max: 2.0)
        valueSpeed = makeValueLabel()
        sliderThreshold = makeSlider(min: 0, max: 15)
        valueThreshold = makeValueLabel()

        let physicsGrid = NSStackView(views: [
            makeSliderPairRow(
                left: makeSliderColumn(title: "FX Intensity", slider: sliderIntensity, valueLabel: valueIntensity),
                right: makeSliderColumn(title: "Particle Density", slider: sliderDensity, valueLabel: valueDensity)
            ),
            makeSliderPairRow(
                left: makeSliderColumn(title: "Animation Speed", slider: sliderSpeed, valueLabel: valueSpeed),
                right: makeSliderColumn(title: "Movement Threshold", slider: sliderThreshold, valueLabel: valueThreshold)
            )
        ])
        physicsGrid.orientation = .vertical
        physicsGrid.spacing = 12
        embed(physicsGrid, in: physicsCard, padding: 14)
        for view in physicsGrid.arrangedSubviews {
            view.widthAnchor.constraint(equalTo: physicsGrid.widthAnchor).isActive = true
        }
        stack.addArrangedSubview(physicsCard)
        physicsCard.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        stack.setCustomSpacing(16, after: physicsCard)

        // Fluid dynamics card (cyan accent, mirrors the web build's fluid engine panel)
        let fluidCard = makeCard()
        fluidCard.layer?.borderColor = Theme.cyan.withAlphaComponent(0.45).cgColor
        let fluidTitle = makeLabel("Fluid Dynamics & Vorticity Engine", size: 13, weight: .bold, color: Theme.textPrimary)
        let fluidSub = makeLabel("Vorticity curl, turbulent smoke diffusion & glowing dye for the fluid presets.", size: 11, weight: .regular, color: Theme.textMuted)

        sliderVorticity = makeSlider(min: 0.1, max: 2.0)
        valueVorticity = makeValueLabel(color: Theme.cyan)
        sliderDissipation = makeSlider(min: 0.90, max: 0.99)
        valueDissipation = makeValueLabel(color: Theme.cyan)

        let fluidGrid = makeSliderPairRow(
            left: makeSliderColumn(title: "Vorticity (Curl Spin Strength)", slider: sliderVorticity, valueLabel: valueVorticity),
            right: makeSliderColumn(title: "Smoke Persistence (Dissipation)", slider: sliderDissipation, valueLabel: valueDissipation)
        )

        let fluidStack = NSStackView(views: [fluidTitle, fluidSub, fluidGrid])
        fluidStack.orientation = .vertical
        fluidStack.alignment = .leading
        fluidStack.spacing = 4
        fluidStack.setCustomSpacing(12, after: fluidSub)
        embed(fluidStack, in: fluidCard, padding: 14)
        fluidGrid.widthAnchor.constraint(equalTo: fluidStack.widthAnchor).isActive = true
        stack.addArrangedSubview(fluidCard)
        fluidCard.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
    }

    // MARK: Tab: Behavior & Monitors

    private func buildBehaviorTab(into stack: NSStackView) {
        stack.addArrangedSubview(makeLabel("Adaptive Behavior & Multi-Monitor", size: 17, weight: .bold, color: Theme.textPrimary))
        let sub = makeLabel("Configure situational triggers, boundary crossing detection, and motion accessibility.", size: 11, weight: .regular, color: Theme.textSecondary)
        stack.addArrangedSubview(sub)
        stack.setCustomSpacing(16, after: sub)

        switchIdleBurst = NSSwitch()
        switchIdleBurst.target = self
        switchIdleBurst.action = #selector(togglesChanged)
        addToggleCard(
            to: stack,
            title: "Wake-From-Idle Burst",
            subtitle: "Emits a spark burst when first moving the mouse after >2 seconds of inactivity.",
            control: switchIdleBurst
        )

        switchMonitorCrossing = NSSwitch()
        switchMonitorCrossing.target = self
        switchMonitorCrossing.action = #selector(togglesChanged)
        addToggleCard(
            to: stack,
            title: "Monitor-Crossing Transition FX",
            subtitle: "Fires a subtle pulse when the cursor passes between multiple displays.",
            control: switchMonitorCrossing
        )

    }

    // MARK: Tab: Diagnostics

    private func buildDiagnosticsTab(into stack: NSStackView) {
        stack.addArrangedSubview(makeLabel("Diagnostics & System Telemetry", size: 17, weight: .bold, color: Theme.textPrimary))
        let sub = makeLabel("Real-time rendering metrics and display configuration.", size: 11, weight: .regular, color: Theme.textSecondary)
        stack.addArrangedSubview(sub)
        stack.setCustomSpacing(16, after: sub)

        let card = makeCard()
        let lines = NSStackView(views: [
            makeLabel("Hardware Engine: AppKit / CoreGraphics Composition Target", size: 12, weight: .bold, color: Theme.textPrimary),
            makeLabel("Target Framerate: 60 Hz render loop, 120 Hz cursor polling", size: 11, weight: .regular, color: Theme.textSecondary),
            makeLabel("Virtual Desktop Span: \(NSScreen.screens.count) display(s), Multi-Monitor Ready", size: 11, weight: .regular, color: Theme.textSecondary),
            makeLabel("Input Interception: NSEvent global monitors (Zero Click Lag)", size: 11, weight: .regular, color: Theme.amber)
        ])
        lines.orientation = .vertical
        lines.alignment = .leading
        lines.spacing = 4
        embed(lines, in: card, padding: 16)
        stack.addArrangedSubview(card)
        card.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
    }

    // MARK: Footer

    private func makeFooter() -> NSView {
        let footer = NSStackView()
        footer.orientation = .vertical
        footer.spacing = 8

        let statusCard = makeCard(background: Theme.insetBg)
        statusCard.layer?.cornerRadius = 6
        let statusDot = NSView()
        statusDot.wantsLayer = true
        statusDot.layer?.cornerRadius = 4
        statusDot.layer?.backgroundColor = Theme.emerald.cgColor
        statusDot.translatesAutoresizingMaskIntoConstraints = false
        statusDot.widthAnchor.constraint(equalToConstant: 8).isActive = true
        statusDot.heightAnchor.constraint(equalToConstant: 8).isActive = true
        statusLabel = makeLabel("Ready. Adjust settings and click Apply & Save.", size: 11, weight: .medium, color: Theme.textSecondary)
        let statusRow = NSStackView(views: [statusDot, statusLabel])
        statusRow.orientation = .horizontal
        statusRow.spacing = 8
        embed(statusRow, in: statusCard, paddingX: 10, paddingY: 6)
        footer.addArrangedSubview(statusCard)
        statusCard.widthAnchor.constraint(equalTo: footer.widthAnchor).isActive = true

        let resetButton = makeFilledButton(title: "Reset Defaults", background: .clear, foreground: Theme.textSecondary, fontSize: 11, height: 32)
        resetButton.onClick = { [weak self] in
            SettingsManager.shared.resetToDefaults()
            self?.syncUIToSettings()
            self?.setStatus("✓ All Settings Reset to Factory Defaults!")
        }
        let saveButton = makeFilledButton(title: "Apply & Save", background: Theme.amber, foreground: Theme.windowBg, fontSize: 12, height: 32, bold: true)
        saveButton.onClick = { [weak self] in
            SettingsManager.shared.save()
            if SettingsManager.shared.settings.soundFx { NSSound(named: "Tink")?.play() }
            self?.setStatus("✓ All Selections Saved & Applied to Live Engine!")
        }
        let closeButton = makeFilledButton(title: "Close", background: Theme.controlBg, foreground: Theme.textPrimary, fontSize: 12, height: 32)
        closeButton.onClick = { [weak self] in self?.window?.orderOut(nil) }

        let buttonRow = NSStackView(views: [resetButton, NSView(), saveButton, closeButton])
        buttonRow.orientation = .horizontal
        buttonRow.spacing = 8
        footer.addArrangedSubview(buttonRow)
        buttonRow.widthAnchor.constraint(equalTo: footer.widthAnchor).isActive = true
        resetButton.widthAnchor.constraint(equalToConstant: 100).isActive = true
        saveButton.widthAnchor.constraint(equalToConstant: 116).isActive = true
        closeButton.widthAnchor.constraint(equalToConstant: 76).isActive = true
        return footer
    }

    // MARK: Sync & actions

    private func syncUIToSettings() {
        let cfg = SettingsManager.shared.settings
        switchEnabled.state = cfg.enabled ? .on : .off
        switchPassive.state = cfg.passiveFxEnabled ? .on : .off
        switchStartAtLogin.state = cfg.startAtLogin ? .on : .off
        switchSound.state = cfg.soundFx ? .on : .off
        switchAutoUpdate.state = cfg.autoCheckUpdates ? .on : .off
        switchIdleBurst.state = cfg.idleBurst ? .on : .off
        switchMonitorCrossing.state = cfg.monitorCrossingFx ? .on : .off

        sliderIntensity.doubleValue = cfg.intensity
        sliderDensity.doubleValue = cfg.particleDensity
        sliderSpeed.doubleValue = cfg.animationSpeed
        sliderThreshold.doubleValue = cfg.movementThreshold
        sliderVorticity.doubleValue = cfg.fluidVorticity
        sliderDissipation.doubleValue = cfg.fluidDissipation
        updateSliderLabels()

        hotkeyLabel.stringValue = cfg.hotkey
        customHexField.stringValue = cfg.customColorHex
        customHexPreview.layer?.backgroundColor = NSColor(hexString: cfg.customColorHex).cgColor
        refreshQuickSwatches()
        refreshPresetHighlights()
    }

    private func refreshPresetHighlights() {
        let cfg = SettingsManager.shared.settings
        for (id, card) in passiveCards {
            let active = id == cfg.passivePreset
            card.setStyle(
                background: active ? Theme.amber.withAlphaComponent(0.16) : Theme.cardBg,
                border: active ? Theme.amber : Theme.cardBorder,
                borderWidth: active ? 1.5 : 1
            )
        }
        for (id, card) in flareCards {
            let active = id == cfg.flarePreset
            card.setStyle(
                background: active ? Theme.cyan.withAlphaComponent(0.16) : Theme.cardBg,
                border: active ? Theme.cyan : Theme.cardBorder,
                borderWidth: active ? 1.5 : 1
            )
        }
        for (id, chip) in colorChips {
            let active = id == cfg.colorPreset
            chip.card.setStyle(
                background: active ? Theme.controlBg : Theme.cardBg,
                border: active ? .white : Theme.cardBorder,
                borderWidth: active ? 1.5 : 1
            )
        }
    }

    @objc private func togglesChanged() {
        var cfg = SettingsManager.shared.settings
        cfg.enabled = switchEnabled.state == .on
        cfg.passiveFxEnabled = switchPassive.state == .on
        cfg.startAtLogin = switchStartAtLogin.state == .on
        cfg.soundFx = switchSound.state == .on
        cfg.autoCheckUpdates = switchAutoUpdate.state == .on
        cfg.idleBurst = switchIdleBurst.state == .on
        cfg.monitorCrossingFx = switchMonitorCrossing.state == .on
        SettingsManager.shared.settings = cfg
        (NSApp.delegate as? AppDelegate)?.applyStartAtLogin(cfg.startAtLogin)
    }

    @objc private func slidersChanged() {
        var cfg = SettingsManager.shared.settings
        cfg.intensity = sliderIntensity.doubleValue
        cfg.particleDensity = sliderDensity.doubleValue
        cfg.animationSpeed = sliderSpeed.doubleValue
        cfg.movementThreshold = sliderThreshold.doubleValue
        cfg.fluidVorticity = sliderVorticity.doubleValue
        cfg.fluidDissipation = sliderDissipation.doubleValue
        SettingsManager.shared.settings = cfg
        updateSliderLabels()
    }

    private func updateSliderLabels() {
        valueIntensity.stringValue = String(format: "%.1fx", sliderIntensity.doubleValue)
        valueDensity.stringValue = String(format: "%.0f / 10", sliderDensity.doubleValue)
        valueSpeed.stringValue = String(format: "%.1fx", sliderSpeed.doubleValue)
        valueThreshold.stringValue = String(format: "%.0f px", sliderThreshold.doubleValue)
        valueVorticity.stringValue = String(format: "%.1fx", sliderVorticity.doubleValue)
        valueDissipation.stringValue = String(format: "%.0f%%", sliderDissipation.doubleValue * 100)
    }

    // MARK: Color picker

    private func openColorPicker(_ target: PickerTarget) {
        let cfg = SettingsManager.shared.settings
        let initialHex: String
        let title: String
        switch target {
        case .custom:
            initialHex = cfg.customColorHex
            title = "Custom Color"
        case .swatch(let index):
            initialHex = index < cfg.quickSwatches.count ? cfg.quickSwatches[index] : cfg.customColorHex
            title = "Quick Color \(index + 1)"
        }
        let priorPreset = cfg.colorPreset
        let priorCustom = cfg.customColorHex

        let applyLive: (String) -> Void = { [weak self] hex in
            var settings = SettingsManager.shared.settings
            settings.colorPreset = "color-custom"
            settings.customColorHex = hex
            SettingsManager.shared.settings = settings
            self?.customHexField.stringValue = hex
            self?.customHexPreview.layer?.backgroundColor = NSColor(hexString: hex).cgColor
            self?.refreshPresetHighlights()
            self?.refreshQuickSwatches()
        }

        let panel = ColorPickerPanel(
            initial: NSColor(hexString: initialHex),
            title: title,
            swatches: cfg.quickSwatches,
            onLive: applyLive,
            onDone: { [weak self] hex in
                applyLive(hex)
                if case .swatch(let index) = target {
                    var settings = SettingsManager.shared.settings
                    if index < settings.quickSwatches.count {
                        settings.quickSwatches[index] = hex
                        SettingsManager.shared.settings = settings
                    }
                    self?.refreshQuickSwatches()
                }
                self?.setStatus("Color set to \(hex)")
                self?.activeColorPicker = nil
            },
            onCancel: { [weak self] in
                var settings = SettingsManager.shared.settings
                settings.colorPreset = priorPreset
                settings.customColorHex = priorCustom
                SettingsManager.shared.settings = settings
                self?.customHexField.stringValue = priorCustom
                self?.customHexPreview.layer?.backgroundColor = NSColor(hexString: priorCustom).cgColor
                self?.refreshPresetHighlights()
                self?.refreshQuickSwatches()
                self?.activeColorPicker = nil
            }
        )
        activeColorPicker = panel
        panel.center()
        panel.makeKeyAndOrderFront(nil)
    }

    @objc private func hexFieldEntered() {
        applyCustomHex()
    }

    private func selectQuickSwatch(_ index: Int) {
        var settings = SettingsManager.shared.settings
        guard index < settings.quickSwatches.count else { return }
        let hex = settings.quickSwatches[index]
        settings.colorPreset = "color-custom"
        settings.customColorHex = hex
        SettingsManager.shared.settings = settings
        customHexField.stringValue = hex
        customHexPreview.layer?.backgroundColor = NSColor(hexString: hex).cgColor
        refreshQuickSwatches()
        refreshPresetHighlights()
        setStatus("Color: \(hex) (double-click a swatch to edit it)")
    }

    /// Reads FX Designer JSON from the clipboard (exported via "Copy JSON" in
    /// the web simulator's FX Designer) and activates it as the custom preset.
    private func importCustomFxFromClipboard() {
        guard let json = NSPasteboard.general.string(forType: .string),
              let config = CustomFxConfig.fromJSON(json) else {
            setStatus("⚠️ Clipboard does not contain a valid FX Designer config. Use Copy JSON in the FX Designer.")
            return
        }
        var settings = SettingsManager.shared.settings
        settings.customFxJson = json
        settings.passivePreset = "custom-fx"
        SettingsManager.shared.settings = settings
        refreshPresetHighlights()
        setStatus("Imported custom FX: \(config.name)")
    }

    private func refreshQuickSwatches() {
        let cfg = SettingsManager.shared.settings
        for (index, button) in quickSwatchButtons.enumerated() where index < cfg.quickSwatches.count {
            let hex = cfg.quickSwatches[index]
            let isSelected = cfg.colorPreset == "color-custom"
                && cfg.customColorHex.uppercased() == hex.uppercased()
            button.setStyle(
                background: NSColor(hexString: hex),
                border: isSelected ? .white : NSColor(hexString: "#3F3F46"),
                borderWidth: isSelected ? 2 : 1
            )
        }
    }

    private func applyCustomHex() {
        var hex = customHexField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !hex.hasPrefix("#") { hex = "#" + hex }
        let stripped = String(hex.dropFirst())
        guard stripped.count == 6, stripped.allSatisfy({ $0.isHexDigit }) else {
            setStatus("⚠️ Invalid hex code. Please enter e.g. #FF5500 or #00FFCC")
            return
        }
        var cfg = SettingsManager.shared.settings
        cfg.colorPreset = "color-custom"
        cfg.customColorHex = hex.uppercased()
        SettingsManager.shared.settings = cfg
        customHexPreview.layer?.backgroundColor = NSColor(hexString: hex).cgColor
        refreshPresetHighlights()
        refreshQuickSwatches()
        setStatus("Custom Color Applied: \(hex.uppercased())")
    }

    private func setStatus(_ message: String) {
        statusLabel.stringValue = message
    }

    private static func formatPresetName(_ id: String) -> String {
        id.split(separator: "-").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
    }

    // MARK: View factory helpers

    private func makeScrollTab() -> (NSScrollView, NSStackView) {
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true

        let document = FlippedView()
        document.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = document

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        document.addSubview(stack)

        NSLayoutConstraint.activate([
            document.leadingAnchor.constraint(equalTo: scroll.contentView.leadingAnchor),
            document.trailingAnchor.constraint(equalTo: scroll.contentView.trailingAnchor),
            document.topAnchor.constraint(equalTo: scroll.contentView.topAnchor),
            stack.topAnchor.constraint(equalTo: document.topAnchor),
            stack.leadingAnchor.constraint(equalTo: document.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: document.trailingAnchor, constant: -12),
            stack.bottomAnchor.constraint(equalTo: document.bottomAnchor, constant: -8)
        ])
        return (scroll, stack)
    }

    private func makeCard(background: NSColor = Theme.cardBg) -> CardButton {
        let card = CardButton()
        card.layer?.cornerRadius = 10
        card.setStyle(background: background, border: Theme.cardBorder, borderWidth: 1)
        return card
    }

    private func makeToggleCard(title: String, subtitle: String, control: NSSwitch) -> NSView {
        let card = makeCard()
        let titleLabel = makeLabel(title, size: 13, weight: .bold, color: Theme.textPrimary)
        let subLabel = makeLabel(subtitle, size: 11, weight: .regular, color: Theme.textMuted)
        subLabel.lineBreakMode = .byWordWrapping
        subLabel.maximumNumberOfLines = 2
        let textStack = NSStackView(views: [titleLabel, subLabel])
        textStack.orientation = .vertical
        textStack.alignment = .leading
        textStack.spacing = 2
        let row = NSStackView(views: [textStack, NSView(), control])
        row.orientation = .horizontal
        row.alignment = .centerY
        embed(row, in: card, padding: 14)
        return card
    }

    /// Adds a full-width toggle card to a tab stack (width constraint must come after insertion).
    private func addToggleCard(to stack: NSStackView, title: String, subtitle: String, control: NSSwitch) {
        let card = makeToggleCard(title: title, subtitle: subtitle, control: control)
        stack.addArrangedSubview(card)
        card.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
    }

    private func makePresetGrid(
        items: [(id: String, icon: String, title: String, subtitle: String)],
        cards: inout [String: CardButton],
        onSelect: @escaping (String) -> Void
    ) -> NSStackView {
        let grid = NSStackView()
        grid.orientation = .vertical
        grid.alignment = .leading
        grid.spacing = 8
        var currentRow: NSStackView?
        for (index, item) in items.enumerated() {
            if index % 3 == 0 {
                let row = NSStackView()
                row.orientation = .horizontal
                row.spacing = 8
                row.distribution = .fillEqually
                grid.addArrangedSubview(row)
                row.widthAnchor.constraint(equalTo: grid.widthAnchor).isActive = true
                currentRow = row
            }
            let card = makeCard()
            card.layer?.cornerRadius = 8
            card.heightAnchor.constraint(equalToConstant: 52).isActive = true
            let iconTile = makeIconTile(emoji: item.icon, background: Theme.controlBg, size: 30, corner: 6)
            let titleLabel = makeLabel(item.title, size: 11, weight: .bold, color: Theme.textPrimary)
            let subLabel = makeLabel(item.subtitle, size: 9, weight: .regular, color: Theme.textSecondary)
            let textStack = NSStackView(views: [titleLabel, subLabel])
            textStack.orientation = .vertical
            textStack.alignment = .leading
            textStack.spacing = 1
            let row = NSStackView(views: [iconTile, textStack])
            row.orientation = .horizontal
            row.spacing = 8
            row.alignment = .centerY
            embed(row, in: card, paddingX: 8, paddingY: 6, fillVertically: false)
            card.onClick = { onSelect(item.id) }
            cards[item.id] = card
            currentRow?.addArrangedSubview(card)
        }
        // Pad the last row so trailing cards keep equal width
        if let lastRow = currentRow {
            let remainder = items.count % 3
            if remainder != 0 {
                for _ in 0..<(3 - remainder) {
                    let spacer = NSView()
                    lastRow.addArrangedSubview(spacer)
                }
            }
        }
        return grid
    }

    private func makeColorChip(title: String, dotColor: NSColor) -> (CardButton, NSTextField) {
        let chip = makeCard()
        chip.layer?.cornerRadius = 6
        chip.heightAnchor.constraint(equalToConstant: 32).isActive = true
        chip.widthAnchor.constraint(equalToConstant: 128).isActive = true
        let dot = NSView()
        dot.wantsLayer = true
        dot.layer?.cornerRadius = 4
        dot.layer?.backgroundColor = dotColor.cgColor
        dot.translatesAutoresizingMaskIntoConstraints = false
        dot.widthAnchor.constraint(equalToConstant: 8).isActive = true
        dot.heightAnchor.constraint(equalToConstant: 8).isActive = true
        let chipLabel = makeLabel(title, size: 10, weight: .semibold, color: dotColor == NSColor(hexString: "#FFFFFF") ? Theme.textPrimary : dotColor)
        let row = NSStackView(views: [dot, chipLabel])
        row.orientation = .horizontal
        row.spacing = 6
        row.translatesAutoresizingMaskIntoConstraints = false
        chip.addSubview(row)
        NSLayoutConstraint.activate([
            row.centerXAnchor.constraint(equalTo: chip.centerXAnchor),
            row.centerYAnchor.constraint(equalTo: chip.centerYAnchor)
        ])
        return (chip, chipLabel)
    }

    private func makeSlider(min: Double, max: Double) -> NSSlider {
        let slider = NSSlider(value: min, minValue: min, maxValue: max, target: self, action: #selector(slidersChanged))
        slider.isContinuous = true
        return slider
    }

    private func makeValueLabel(color: NSColor = Theme.amber) -> NSTextField {
        let field = makeLabel("", size: 11, weight: .bold, color: color)
        field.alignment = .right
        return field
    }

    private func makeSliderColumn(title: String, slider: NSSlider, valueLabel: NSTextField) -> NSView {
        let titleLabel = makeLabel(title, size: 11, weight: .semibold, color: NSColor(hexString: "#D4D4D8"))
        let header = NSStackView(views: [titleLabel, NSView(), valueLabel])
        header.orientation = .horizontal
        let column = NSStackView(views: [header, slider])
        column.orientation = .vertical
        column.alignment = .leading
        column.spacing = 4
        header.widthAnchor.constraint(equalTo: column.widthAnchor).isActive = true
        slider.widthAnchor.constraint(equalTo: column.widthAnchor).isActive = true
        return column
    }

    private func makeSliderPairRow(left: NSView, right: NSView) -> NSStackView {
        let row = NSStackView(views: [left, right])
        row.orientation = .horizontal
        row.spacing = 20
        row.distribution = .fillEqually
        return row
    }

    private func makeNavButton(icon: String, title: String) -> (CardButton, NSTextField) {
        let card = CardButton()
        card.layer?.cornerRadius = 7
        card.setStyle(background: .clear, border: .clear, borderWidth: 0)
        card.heightAnchor.constraint(equalToConstant: 38).isActive = true
        let tile = makeIconTile(emoji: icon, background: Theme.cardBg, size: 20, corner: 4)
        let titleLabel = makeLabel(title, size: 12, weight: .semibold, color: Theme.textPrimary)
        let row = NSStackView(views: [tile, titleLabel])
        row.orientation = .horizontal
        row.spacing = 8
        row.alignment = .centerY
        row.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 10),
            row.centerYAnchor.constraint(equalTo: card.centerYAnchor)
        ])
        return (card, titleLabel)
    }

    private func makeFilledButton(
        title: String,
        background: NSColor,
        foreground: NSColor,
        fontSize: CGFloat = 12,
        height: CGFloat = 36,
        bold: Bool = true
    ) -> CardButton {
        let button = CardButton()
        button.layer?.cornerRadius = 7
        button.setStyle(background: background, border: .clear, borderWidth: 0)
        button.heightAnchor.constraint(equalToConstant: height).isActive = true
        let titleLabel = makeLabel(title, size: fontSize, weight: bold ? .bold : .regular, color: foreground)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(titleLabel)
        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: button.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: button.centerYAnchor),
            button.widthAnchor.constraint(greaterThanOrEqualTo: titleLabel.widthAnchor, constant: 20)
        ])
        return button
    }

    /// The app logo as a rounded tile, falling back to the amber flame emoji tile
    /// when the resource bundle is unavailable.
    private func makeLogoTile(size: CGFloat, corner: CGFloat) -> NSView {
        guard let logo = AppLogo.image else {
            return makeIconTile(emoji: "🔥", background: Theme.amber, size: size, corner: corner)
        }
        let imageView = NSImageView(image: logo)
        imageView.imageScaling = .scaleProportionallyUpOrDown
        imageView.wantsLayer = true
        imageView.layer?.cornerRadius = corner
        imageView.layer?.masksToBounds = true
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.widthAnchor.constraint(equalToConstant: size).isActive = true
        imageView.heightAnchor.constraint(equalToConstant: size).isActive = true
        return imageView
    }

    private func makeIconTile(emoji: String, background: NSColor, size: CGFloat, corner: CGFloat) -> NSView {
        let tile = NSView()
        tile.wantsLayer = true
        tile.layer?.backgroundColor = background.cgColor
        tile.layer?.cornerRadius = corner
        tile.translatesAutoresizingMaskIntoConstraints = false
        tile.widthAnchor.constraint(equalToConstant: size).isActive = true
        tile.heightAnchor.constraint(equalToConstant: size).isActive = true
        let label = makeLabel(emoji, size: size * 0.5, weight: .regular, color: .white)
        label.translatesAutoresizingMaskIntoConstraints = false
        tile.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: tile.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: tile.centerYAnchor)
        ])
        return tile
    }

    private func makeDivider() -> NSView {
        let divider = NSView()
        divider.wantsLayer = true
        divider.layer?.backgroundColor = Theme.cardBorder.cgColor
        divider.translatesAutoresizingMaskIntoConstraints = false
        return divider
    }

    private func makeLabel(_ text: String, size: CGFloat, weight: NSFont.Weight, color: NSColor) -> NSTextField {
        let field = NSTextField(labelWithString: text)
        field.font = .systemFont(ofSize: size, weight: weight)
        field.textColor = color
        return field
    }

    private func embed(
        _ view: NSView,
        in container: NSView,
        padding: CGFloat = 0,
        paddingX: CGFloat? = nil,
        paddingY: CGFloat? = nil,
        fillVertically: Bool = true
    ) {
        let px = paddingX ?? padding
        let py = paddingY ?? padding
        view.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(view)
        var constraints = [
            view.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: px),
            view.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -px)
        ]
        if fillVertically {
            constraints.append(view.topAnchor.constraint(equalTo: container.topAnchor, constant: py))
            constraints.append(view.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -py))
        } else {
            constraints.append(view.centerYAnchor.constraint(equalTo: container.centerYAnchor))
        }
        NSLayoutConstraint.activate(constraints)
    }
}
