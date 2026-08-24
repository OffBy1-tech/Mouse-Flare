import Cocoa

// MARK: - Shared neon theme (hex values mirror the web build's index.css neon layer)

enum Theme {
    // Deep-space grounds (--neon-ground-0/1/2 on the web)
    static let windowBg = NSColor(hexString: "#0A0512")
    static let panelBg = NSColor(hexString: "#0D0719")
    static let cardBg = NSColor(hexString: "#1A0F2E")
    static let cardBorder = NSColor(hexString: "#A855F7").withAlphaComponent(0.25)
    static let insetBg = NSColor(hexString: "#120A20")
    static let controlBg = NSColor(hexString: "#2A1A45")
    static let textPrimary = NSColor(hexString: "#FAFAFA")
    static let textSecondary = NSColor(hexString: "#A1A1AA")
    static let textMuted = NSColor(hexString: "#71717A")
    static let textFaint = NSColor(hexString: "#52525B")
    static let amber = NSColor(hexString: "#FFA62E")
    static let amberBright = NSColor(hexString: "#FFC46B")
    static let cyan = NSColor(hexString: "#2FD4F5")
    static let emerald = NSColor(hexString: "#10B981")
    // Neon accents (--neon-violet/blue/magenta on the web)
    static let neonViolet = NSColor(hexString: "#A855F7")
    static let neonBlue = NSColor(hexString: "#4F7CFF")
    static let neonMagenta = NSColor(hexString: "#F043C8")
    static let neonTextBright = NSColor(hexString: "#E9D5FF")
    static let neonValue = NSColor(hexString: "#C8A8FF")
}

// MARK: - Small custom controls

/// A rounded, bordered, clickable card — used for nav items, preset cards, and color chips.
final class CardButton: NSView {
    var onClick: (() -> Void)?
    var onDoubleClick: (() -> Void)?

    /// How the button responds to the pointer resting on it. The setters below
    /// record the "base" appearance; hover renders a variation on top of it and
    /// mouse-exit restores the base exactly, so dynamic restyles
    /// (refreshPresetHighlights, selectTab) can never leave a stale hover look.
    enum HoverStyle {
        /// Quiet cards/buttons: border and surface brighten, faint glow —
        /// the web build's `.neon-card-hover` feel. The default.
        case brightenBorder
        /// Primary gradient buttons: gradient brightens ~10%, glow strengthens.
        case brightenGradient
        /// Selected/active elements own their look; hover changes nothing.
        case none
    }
    var hoverStyle: HoverStyle = .brightenBorder {
        didSet { if isHovered { render(animated: false) } }
    }

    private var isHovered = false
    private var hoverTrackingArea: NSTrackingArea?
    private var gradientLayer: CAGradientLayer?

    // Base appearance as last set by the call site.
    private var baseBackground = Theme.cardBg
    private var baseBorder = Theme.cardBorder
    private var baseBorderWidth: CGFloat = 1
    private var baseGradientColors: [NSColor]?
    private var baseGlowColor: NSColor?
    private var baseGlowRadius: CGFloat = 9
    private var baseGlowOpacity: Float = 0.5

    init() {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.borderWidth = 1
        setStyle(background: Theme.cardBg, border: Theme.cardBorder, borderWidth: 1)
    }

    required init?(coder: NSCoder) { fatalError() }

    func setStyle(background: NSColor, border: NSColor, borderWidth: CGFloat) {
        baseBackground = background
        baseBorder = border
        baseBorderWidth = borderWidth
        render(animated: false)
    }

    /// Fills the card with a diagonal gradient (pass nil to remove it). The
    /// gradient sits under the label subviews, so text stays readable.
    func setGradient(_ colors: [NSColor]?) {
        baseGradientColors = colors
        render(animated: false)
    }

    /// Soft outer glow in the given color (pass nil to remove it).
    func setGlow(_ color: NSColor?, radius: CGFloat = 9, opacity: Float = 0.5) {
        baseGlowColor = color
        baseGlowRadius = radius
        baseGlowOpacity = opacity
        render(animated: false)
    }

    // MARK: Hover mechanics

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let hoverTrackingArea { removeTrackingArea(hoverTrackingArea) }
        let area = NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .activeInKeyWindow],
            owner: self, userInfo: nil
        )
        addTrackingArea(area)
        hoverTrackingArea = area
    }

    override func mouseEntered(with event: NSEvent) {
        isHovered = true
        render(animated: true)
    }

    override func mouseExited(with event: NSEvent) {
        isHovered = false
        render(animated: true)
    }

    override func viewDidHide() {
        super.viewDidHide()
        // A tab switch can hide a hovered button without a mouseExited event.
        if isHovered {
            isHovered = false
            render(animated: false)
        }
    }

    private static func brightened(_ color: NSColor) -> NSColor {
        let lifted = color.withAlphaComponent(min(1, color.alphaComponent * 1.6 + 0.15))
        return lifted.blended(withFraction: 0.2, of: .white) ?? lifted
    }

    private func render(animated: Bool) {
        var background = baseBackground
        var border = baseBorder
        var gradientColors = baseGradientColors
        var glowColor = baseGlowColor
        var glowRadius = baseGlowRadius
        var glowOpacity = baseGlowOpacity

        if isHovered {
            switch hoverStyle {
            case .none:
                break
            case .brightenBorder:
                if baseBackground.alphaComponent < 0.05 {
                    // Transparent buttons (inactive nav, Reset Defaults) get the
                    // web nav's violet hover wash.
                    background = Theme.neonViolet.withAlphaComponent(0.12)
                } else {
                    background = baseBackground.blended(withFraction: 0.07, of: .white) ?? baseBackground
                }
                let hasVisibleBorder = baseBorderWidth > 0 && baseBorder.alphaComponent > 0.05
                if hasVisibleBorder { border = Self.brightened(baseBorder) }
                if baseGlowColor == nil {
                    glowColor = hasVisibleBorder ? baseBorder.withAlphaComponent(1) : Theme.neonViolet
                    glowRadius = 8
                    glowOpacity = 0.25
                }
            case .brightenGradient:
                if let colors = baseGradientColors {
                    gradientColors = colors.map { $0.blended(withFraction: 0.1, of: .white) ?? $0 }
                } else {
                    background = baseBackground.blended(withFraction: 0.1, of: .white) ?? baseBackground
                }
                glowRadius = baseGlowRadius + 4
                glowOpacity = min(1, baseGlowOpacity * 1.5)
            }
        }

        let apply = {
            self.layer?.backgroundColor = background.cgColor
            self.layer?.borderColor = border.cgColor
            self.layer?.borderWidth = self.baseBorderWidth
            self.layer?.masksToBounds = false
            self.layer?.shadowColor = glowColor?.cgColor
            self.layer?.shadowOpacity = glowColor == nil ? 0 : glowOpacity
            self.layer?.shadowRadius = glowRadius
            self.layer?.shadowOffset = .zero
            self.applyGradient(gradientColors)
        }
        if animated && !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.15
                context.timingFunction = CAMediaTimingFunction(name: .easeOut)
                context.allowsImplicitAnimation = true
                apply()
            }
        } else {
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            apply()
            CATransaction.commit()
        }
    }

    private func applyGradient(_ colors: [NSColor]?) {
        guard let colors else {
            gradientLayer?.removeFromSuperlayer()
            gradientLayer = nil
            return
        }
        let gradient = gradientLayer ?? {
            let created = CAGradientLayer()
            created.masksToBounds = true
            layer?.insertSublayer(created, at: 0)
            gradientLayer = created
            return created
        }()
        gradient.colors = colors.map { $0.cgColor }
        gradient.startPoint = CGPoint(x: 0, y: 0.25)
        gradient.endPoint = CGPoint(x: 1, y: 0.75)
        gradient.cornerRadius = layer?.cornerRadius ?? 8
        gradient.frame = bounds
    }

    override func layout() {
        super.layout()
        gradientLayer?.frame = bounds
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

/// Click-through overlay that traces the window edge with a 2px
/// violet→blue→magenta gradient ring — the AppKit translation of the web
/// build's `.neon-frame` border (the window's own shadow stays system-drawn).
final class NeonFrameOverlay: NSView {
    private let gradient = CAGradientLayer()
    private let ring = CAShapeLayer()

    init() {
        super.init(frame: .zero)
        wantsLayer = true
        gradient.colors = [Theme.neonViolet.cgColor, Theme.neonBlue.cgColor, Theme.neonMagenta.cgColor]
        gradient.startPoint = CGPoint(x: 0, y: 1)
        gradient.endPoint = CGPoint(x: 1, y: 0)
        ring.fillColor = NSColor.clear.cgColor
        ring.strokeColor = NSColor.black.cgColor
        ring.lineWidth = 2
        gradient.mask = ring
        layer?.addSublayer(gradient)
    }

    required init?(coder: NSCoder) { fatalError() }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    override func layout() {
        super.layout()
        gradient.frame = bounds
        ring.frame = gradient.bounds
        // Inset by half the stroke so the ring hugs the window's rounded edge
        ring.path = CGPath(roundedRect: bounds.insetBy(dx: 1, dy: 1), cornerWidth: 10, cornerHeight: 10, transform: nil)
    }
}

// MARK: - Settings window

final class SettingsWindowController: NSWindowController, NSWindowDelegate {
    // Preset catalogs — ids shared verbatim with the Windows build
    private static let passivePresets: [(id: String, icon: String, title: String, subtitle: String)] = [
        ("fluid-simulation", "🌊", "Fluid Simulation", "Velocity dissipation model"),
        ("fluid-smoke", "💨", "Fluid Smoke Swirl", "Billowing dye vortices"),
        ("neon-fluid", "🧪", "Neon Fluid Dye", "Luminescent fluid glow"),
        ("cosmic-vortex", "🌌", "Cosmic Liquid", "Galactic chromatic swirls"),
        ("ink-diffusion", "🖋️", "Ink Diffusion", "Organic watercolor plumes"),
        ("spark-trail", "✨", "Spark Trail", "Golden kinetic embers"),
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
    private var isRecordingHotkey = false
    private var hotkeyRecordMonitor: Any?

    // Diagnostics is a hidden section: click the sidebar version label 5
    // times to reveal it. Session-only — re-hidden on each window open.
    private var diagnosticsUnlocked = false
    private var versionClickCount = 0
    private var customHexField: NSTextField!
    private var customHexPreview: NSView!
    private var quickSwatchButtons: [CardButton] = []
    private var activeColorPicker: ColorPickerPanel?
    private var fxDesigner: FxDesignerView?
    private var saveButton: CardButton!

    /// FX Studio / FX Designer values as of the last window open or Apply &
    /// Save. FX changes preview live but stay a draft until committed — closing
    /// the window restores this baseline.
    private var fxBaseline: MacFlareSettings?

    private enum PickerTarget {
        case custom
        case swatch(Int)
    }

    private var switchEnabled: NeonSwitch!
    private var switchPassive: NeonSwitch!
    private var switchStartAtLogin: NeonSwitch!
    private var switchFluidBloom: NeonSwitch!
    private var switchFluidRainbow: NeonSwitch!
    private var switchSound: NeonSwitch!
    private var switchAutoUpdate: NeonSwitch!
    private var switchIdleBurst: NeonSwitch!
    private var switchMonitorCrossing: NeonSwitch!

    // Updates tab: labels/buttons that mirror Updater.shared.phase
    private var updatesStatusLabel: NSTextField!
    private var updatesActionButton: CardButton!
    private var updatesActionLabel: NSTextField!
    private var checkNowButton: CardButton!
    private var checkNowLabel: NSTextField!
    private var isCheckingForUpdates = false
    private var updatesHeroCard: CardButton!
    private var updatesHeroIconTile: NSView!
    private var updatesHeroIconLabel: NSTextField!
    private var updatesHeadlineLabel: NSTextField!
    private var updatesMetaLabel: NSTextField!
    private var changelogStack: NSStackView!
    private var changelogFooterLabel: NSTextField!
    private var updateIntervalPopup: NeonPopUp!
    private static let updateIntervalChoices = [6, 24, 72, 0]

    private var sliderIntensity: NeonSlider!
    private var sliderDensity: NeonSlider!
    private var sliderSpeed: NeonSlider!
    private var sliderThreshold: NeonSlider!
    private var sliderVorticity: NeonSlider!
    private var sliderDissipation: NeonSlider!
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
        // Hard guard: Auto Layout must never be able to inflate the window
        // (long release-note labels once forced it wide offscreen).
        win.contentMinSize = NSSize(width: 940, height: 680)
        win.contentMaxSize = NSSize(width: 940, height: 680)
        win.center()
        win.isReleasedWhenClosed = false
        win.level = .floating
        super.init(window: win)
        win.delegate = self
        setupUI()
        syncUIToSettings()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(updaterPhaseChanged),
            name: Updater.phaseChangedNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    required init?(coder: NSCoder) { fatalError() }

    func show() {
        guard let win = self.window else { return }
        if !win.isVisible {
            // A fresh session: everything currently saved becomes the baseline
            // that closing without Apply & Save falls back to.
            fxBaseline = SettingsManager.shared.settings
            fxDesigner?.reloadFromSettings()
            rehideDiagnostics()
        }
        win.makeKeyAndOrderFront(nil)
        win.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
        syncUIToSettings()
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        dismiss()
        return false // Non-destructive hide to prevent dealloc transform crash
    }

    /// The single close funnel: both the title-bar close button (via
    /// windowShouldClose) and the footer Close button land here.
    private func dismiss() {
        stopHotkeyRecording(revertLabel: true)
        revertUnappliedFx()
        window?.orderOut(nil)
    }

    // MARK: Hidden Diagnostics unlock

    @objc private func versionLabelClicked() {
        guard !diagnosticsUnlocked else { return }
        versionClickCount += 1
        let remaining = 5 - versionClickCount
        if remaining <= 0 {
            diagnosticsUnlocked = true
            navButtons["diagnostics"]?.card.isHidden = false
            selectTab("diagnostics")
            setStatus("📊 Diagnostics unlocked")
        } else if versionClickCount >= 3 {
            setStatus("\(remaining) more click\(remaining == 1 ? "" : "s") to unlock Diagnostics")
        }
    }

    private func rehideDiagnostics() {
        diagnosticsUnlocked = false
        versionClickCount = 0
        navButtons["diagnostics"]?.card.isHidden = true
        if activeTab == "diagnostics" { selectTab("fx-studio") }
    }

    // MARK: Custom hotkey recording

    private func toggleHotkeyRecording() {
        isRecordingHotkey ? stopHotkeyRecording(revertLabel: true) : startHotkeyRecording()
    }

    private func startHotkeyRecording() {
        isRecordingHotkey = true
        hotkeyLabel.stringValue = "Press keys…"
        hotkeyButton.setStyle(background: Theme.controlBg, border: Theme.neonViolet, borderWidth: 1)
        setStatus("Recording: press the new Find Mouse combination (Esc cancels)")
        hotkeyRecordMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self, self.isRecordingHotkey else { return event }
            if event.keyCode == 53 { // Escape cancels
                self.stopHotkeyRecording(revertLabel: true)
                self.setStatus("Hotkey recording cancelled")
                return nil
            }
            guard let combo = HotkeyCombo(event: event) else {
                self.setStatus("Add a modifier (⌘ ⌥ ⌃ ⇧) — a bare key would hijack normal typing")
                return nil
            }
            let display = combo.displayString
            SettingsManager.shared.settings.hotkey = display
            self.stopHotkeyRecording(revertLabel: false)
            self.hotkeyLabel.stringValue = display
            self.setStatus("Hotkey set to \(display)")
            return nil
        }
    }

    private func stopHotkeyRecording(revertLabel: Bool) {
        if let monitor = hotkeyRecordMonitor {
            NSEvent.removeMonitor(monitor)
            hotkeyRecordMonitor = nil
        }
        guard isRecordingHotkey else { return }
        isRecordingHotkey = false
        if revertLabel { hotkeyLabel.stringValue = SettingsManager.shared.settings.hotkey }
        hotkeyButton.setStyle(background: Theme.controlBg, border: Theme.amber, borderWidth: 1)
    }

    /// Discards FX Studio / FX Designer changes never committed with Apply &
    /// Save, restoring the FX fields captured when the window opened. Safe to
    /// call at any time — a no-op when nothing drafted.
    func revertUnappliedFx() {
        guard let baseline = fxBaseline else { return }
        var cfg = SettingsManager.shared.settings
        cfg.applyFxFields(from: baseline)
        guard cfg != SettingsManager.shared.settings else { return }
        SettingsManager.shared.settings = cfg
        syncUIToSettings()
        fxDesigner?.reloadFromSettings()
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

        let navHeader = makeLabel("NAVIGATION", size: 10, weight: .bold, color: NSColor(hexString: "#C4B5FD").withAlphaComponent(0.6))

        let navStack = NSStackView(views: [navHeader])
        navStack.orientation = .vertical
        navStack.alignment = .leading
        navStack.spacing = 4
        navStack.setCustomSpacing(10, after: navHeader)
        navStack.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(navStack)

        let navItems: [(id: String, icon: String, svg: String, title: String)] = [
            ("general", "🔥", "nav-general", "General"),
            ("fx-studio", "✨", "nav-fx-studio", "FX Studio"),
            ("fx-designer", "🧪", "nav-fx-designer", "FX Designer"),
            ("behavior", "🎛️", "nav-behavior", "Behavior & Monitors"),
            ("diagnostics", "📊", "nav-diagnostics", "Diagnostics"),
            ("updates", "🔄", "nav-updates", "Check for Updates")
        ]
        for item in navItems {
            let (card, titleField) = makeNavButton(icon: item.icon, svgResource: item.svg, title: item.title)
            card.onClick = { [weak self] in self?.selectTab(item.id) }
            navButtons[item.id] = (card, titleField)
            navStack.addArrangedSubview(card)
            card.widthAnchor.constraint(equalTo: navStack.widthAnchor).isActive = true
        }
        navButtons["diagnostics"]?.card.isHidden = true

        let versionLabel = makeLabel(
            Updater.shared.isDevBuild ? "Mouseflare dev build" : "Mouseflare v\(Updater.shared.currentVersion)",
            size: 10, weight: .regular, color: Theme.textPrimary
        )
        versionLabel.translatesAutoresizingMaskIntoConstraints = false
        versionLabel.addGestureRecognizer(NSClickGestureRecognizer(target: self, action: #selector(versionLabelClicked)))
        sidebar.addSubview(versionLabel)

        let testFlareButton = makeFilledButton(title: "⚡  Test Flare Now", background: .clear, foreground: NSColor(hexString: "#22080F"))
        applyPrimaryGradient(to: testFlareButton)
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
        let tabIds = ["general", "fx-studio", "fx-designer", "behavior", "diagnostics", "updates"]
        for id in tabIds {
            let (scroll, stack) = makeScrollTab()
            switch id {
            case "general": buildGeneralTab(into: stack)
            case "fx-studio": buildFxStudioTab(into: stack)
            case "fx-designer": buildFxDesignerTab(into: stack)
            case "behavior": buildBehaviorTab(into: stack)
            case "updates": buildUpdatesTab(into: stack)
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

        // Neon edge ring above all content; hitTest returns nil so it never
        // intercepts clicks.
        let frameOverlay = NeonFrameOverlay()
        frameOverlay.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(frameOverlay)
        NSLayoutConstraint.activate([
            frameOverlay.topAnchor.constraint(equalTo: contentView.topAnchor),
            frameOverlay.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            frameOverlay.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            frameOverlay.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
        ])

        selectTab("fx-studio")
    }

    private func selectTab(_ id: String) {
        activeTab = id
        // Only FX Studio / FX Designer changes are drafts needing Apply & Save;
        // the other tabs commit instantly, so the button would mislead there.
        saveButton.isHidden = !(id == "fx-studio" || id == "fx-designer")
        for (tabId, scroll) in tabs {
            scroll.isHidden = (tabId != id)
        }
        for (navId, nav) in navButtons {
            let isActive = navId == id
            if isActive {
                // Gradient pill with soft glow — the web build's .neon-nav-active
                nav.card.hoverStyle = .none
                nav.card.setStyle(background: .clear, border: Theme.neonViolet.withAlphaComponent(0.9), borderWidth: 1)
                nav.card.setGradient([
                    Theme.neonViolet.withAlphaComponent(0.32),
                    Theme.neonMagenta.withAlphaComponent(0.26)
                ])
                nav.card.setGlow(Theme.neonViolet, radius: 8, opacity: 0.45)
                nav.label.textColor = Theme.neonTextBright
            } else {
                nav.card.hoverStyle = .brightenBorder
                nav.card.setGradient(nil)
                nav.card.setGlow(nil)
                nav.card.setStyle(background: .clear, border: .clear, borderWidth: 0)
                nav.label.textColor = Theme.textPrimary
            }
        }
    }

    // MARK: Tab: General

    private func buildGeneralTab(into stack: NSStackView) {
        stack.addArrangedSubview(makeLabel("General Configuration", size: 17, weight: .bold, color: Theme.textPrimary))
        let sub = makeLabel("Control master switches, global hotkey shortcut, and startup behavior.", size: 11, weight: .regular, color: Theme.textSecondary)
        stack.addArrangedSubview(sub)
        stack.setCustomSpacing(16, after: sub)

        switchEnabled = NeonSwitch()
        switchEnabled.target = self
        switchEnabled.action = #selector(togglesChanged)
        addToggleCard(
            to: stack,
            title: "Enable Mouseflare",
            subtitle: "Global toggle for all cursor tracking, passive trail effects, and active flares.",
            control: switchEnabled
        )

        switchSound = NeonSwitch()
        switchSound.target = self
        switchSound.action = #selector(togglesChanged)
        addToggleCard(
            to: stack,
            title: "Play Sound on Flare",
            subtitle: "Subtle synth chime on flare trigger.",
            control: switchSound
        )

        switchPassive = NeonSwitch()
        switchPassive.target = self
        switchPassive.action = #selector(togglesChanged)
        addToggleCard(
            to: stack,
            title: "Enable Passive Trail FX",
            subtitle: "Renders particle trails behind pointer while moving.",
            control: switchPassive
        )

        // Hotkey card
        let hotkeyCard = makeCard()
        let hotkeyTitle = makeLabel("Flare hotkey", size: 13, weight: .bold, color: Theme.textPrimary)
        let hotkeySub = makeLabel("Press this shortcut anywhere in macOS to blast a beacon flare. Click the combo to record your own.", size: 11, weight: .regular, color: Theme.textMuted)

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
        hotkeyButton.onClick = { [weak self] in self?.toggleHotkeyRecording() }

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

        // Startup toggle
        switchStartAtLogin = NeonSwitch()
        switchStartAtLogin.target = self
        switchStartAtLogin.action = #selector(togglesChanged)
        addToggleCard(to: stack, title: "Launch on startup", subtitle: "", control: switchStartAtLogin)
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
            self?.setStatus("Selected Passive FX: \(Self.formatPresetName(id)) • Apply & Save to keep")
        }
        stack.addArrangedSubview(passiveGrid)
        passiveGrid.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        let importFxButton = makeFilledButton(title: "📋  Import Custom FX (JSON from clipboard)", background: Theme.controlBg, foreground: Theme.textPrimary, fontSize: 11, height: 28, bold: false)
        importFxButton.onClick = { [weak self] in self?.importCustomFxFromClipboard() }
        stack.addArrangedSubview(importFxButton)
        stack.setCustomSpacing(14, after: importFxButton)

        stack.addArrangedSubview(makeLabel("Active \"Find Mouse\" Flare Animation", size: 12, weight: .bold, color: Theme.cyan))
        let flareGrid = makePresetGrid(items: Self.flarePresets, cards: &flareCards) { [weak self] id in
            SettingsManager.shared.settings.flarePreset = id
            self?.refreshPresetHighlights()
            (NSApp.delegate as? AppDelegate)?.triggerFindMouse()
            self?.setStatus("Selected Flare: \(Self.formatPresetName(id)) (Previewing) • Apply & Save to keep")
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
                self?.setStatus("Color: \(preset.title) • Apply & Save to keep")
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
        customHexField.drawsBackground = false
        customHexField.textColor = Theme.textPrimary
        customHexField.isBordered = false
        customHexField.wantsLayer = true
        customHexField.layer?.backgroundColor = Theme.windowBg.cgColor
        customHexField.layer?.borderColor = Theme.neonViolet.withAlphaComponent(0.35).cgColor
        customHexField.layer?.borderWidth = 1
        customHexField.layer?.cornerRadius = 5
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
            swatch.setStyle(background: NSColor(hexString: hex), border: Theme.neonViolet.withAlphaComponent(0.3), borderWidth: 1)
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
                right: makeSliderColumn(title: "Min Movement Threshold", slider: sliderThreshold, valueLabel: valueThreshold)
            ),
            makeLabel("Applies to the built-in presets above. Custom FX uses the FX Designer's own parameters.", size: 10, weight: .regular, color: Theme.textMuted)
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
        fluidCard.setGlow(Theme.cyan, radius: 10, opacity: 0.12)
        let fluidTitle = makeLabel("Fluid Dynamics & Vorticity Engine", size: 13, weight: .bold, color: Theme.textPrimary)
        let fluidSub = makeLabel("Vorticity curl, turbulent smoke diffusion & glowing dye for the fluid presets.", size: 11, weight: .regular, color: Theme.textMuted)

        sliderVorticity = makeSlider(min: 0.1, max: 2.0, accent: .cyan)
        valueVorticity = makeValueLabel(color: Theme.cyan)
        sliderDissipation = makeSlider(min: 0.90, max: 0.99, accent: .cyan)
        valueDissipation = makeValueLabel(color: Theme.cyan)

        let fluidGrid = makeSliderPairRow(
            left: makeSliderColumn(title: "Vorticity (Curl Spin Strength)", slider: sliderVorticity, valueLabel: valueVorticity),
            right: makeSliderColumn(title: "Smoke Persistence (Dissipation)", slider: sliderDissipation, valueLabel: valueDissipation)
        )

        switchFluidBloom = NeonSwitch()
        switchFluidBloom.target = self
        switchFluidBloom.action = #selector(fluidTogglesChanged)
        let bloomRow = makeToggleCard(
            title: "Luminescent Glowing Bloom",
            subtitle: "Additive blend mode for intense neon glow",
            control: switchFluidBloom
        )
        switchFluidRainbow = NeonSwitch()
        switchFluidRainbow.target = self
        switchFluidRainbow.action = #selector(fluidTogglesChanged)
        let rainbowRow = makeToggleCard(
            title: "Chromatic Rainbow Dye Cycle",
            subtitle: "Cycles vivid spectrum hues as mouse moves",
            control: switchFluidRainbow
        )
        let fluidToggles = NSStackView(views: [bloomRow, rainbowRow])
        fluidToggles.orientation = .horizontal
        fluidToggles.spacing = 10
        fluidToggles.distribution = .fillEqually

        let fluidStack = NSStackView(views: [fluidTitle, fluidSub, fluidGrid, fluidToggles])
        fluidStack.orientation = .vertical
        fluidStack.alignment = .leading
        fluidStack.spacing = 4
        fluidStack.setCustomSpacing(12, after: fluidSub)
        embed(fluidStack, in: fluidCard, padding: 14)
        fluidGrid.widthAnchor.constraint(equalTo: fluidStack.widthAnchor).isActive = true
        fluidToggles.widthAnchor.constraint(equalTo: fluidStack.widthAnchor).isActive = true
        fluidStack.setCustomSpacing(12, after: fluidGrid)
        stack.addArrangedSubview(fluidCard)
        fluidCard.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
    }

    // MARK: Tab: FX Designer

    private func buildFxDesignerTab(into stack: NSStackView) {
        stack.addArrangedSubview(makeLabel("FX Designer", size: 17, weight: .bold, color: Theme.textPrimary))
        let sub = makeLabel("Design your own particle effect — it previews live on your cursor and becomes the Custom FX preset.", size: 11, weight: .regular, color: Theme.textSecondary)
        stack.addArrangedSubview(sub)
        stack.setCustomSpacing(16, after: sub)

        let designer = FxDesignerView()
        designer.onStatus = { [weak self] message in self?.setStatus(message) }
        stack.addArrangedSubview(designer)
        designer.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        fxDesigner = designer
    }

    // MARK: Tab: Behavior & Monitors

    private func buildBehaviorTab(into stack: NSStackView) {
        stack.addArrangedSubview(makeLabel("Adaptive Behavior & Multi-Monitor", size: 17, weight: .bold, color: Theme.textPrimary))
        let sub = makeLabel("Configure situational triggers and boundary crossing detection.", size: 11, weight: .regular, color: Theme.textSecondary)
        stack.addArrangedSubview(sub)
        stack.setCustomSpacing(16, after: sub)

        switchIdleBurst = NeonSwitch()
        switchIdleBurst.target = self
        switchIdleBurst.action = #selector(togglesChanged)
        addToggleCard(
            to: stack,
            title: "Wake-From-Idle Burst",
            subtitle: "Emits a spark burst when first moving the mouse after >2 seconds of inactivity.",
            control: switchIdleBurst
        )

        switchMonitorCrossing = NeonSwitch()
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

    // MARK: Tab: Updates

    private func buildUpdatesTab(into stack: NSStackView) {
        // ---- Header row: title/subtitle + primary Check button ----
        let titleStack = NSStackView(views: [
            makeLabel("Software Updates & Release Feeds", size: 17, weight: .bold, color: Theme.textPrimary),
            makeLabel("Validate the installed build against verified GitHub Release metadata and install upgrades.", size: 11, weight: .regular, color: Theme.textSecondary)
        ])
        titleStack.orientation = .vertical
        titleStack.alignment = .leading
        titleStack.spacing = 2

        checkNowButton = CardButton()
        checkNowButton.layer?.cornerRadius = 7
        applyPrimaryGradient(to: checkNowButton)
        checkNowLabel = makeLabel("🔄  Check for Updates", size: 12, weight: .bold, color: NSColor(hexString: "#22080F"))
        checkNowLabel.translatesAutoresizingMaskIntoConstraints = false
        checkNowButton.addSubview(checkNowLabel)
        NSLayoutConstraint.activate([
            checkNowLabel.centerXAnchor.constraint(equalTo: checkNowButton.centerXAnchor),
            checkNowLabel.centerYAnchor.constraint(equalTo: checkNowButton.centerYAnchor),
            checkNowButton.widthAnchor.constraint(greaterThanOrEqualTo: checkNowLabel.widthAnchor, constant: 24),
            checkNowButton.heightAnchor.constraint(equalToConstant: 32)
        ])
        checkNowButton.onClick = { [weak self] in self?.runManualUpdateCheck() }

        let headerRow = NSStackView(views: [titleStack, NSView(), checkNowButton])
        headerRow.orientation = .horizontal
        headerRow.alignment = .centerY
        stack.addArrangedSubview(headerRow)
        headerRow.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        stack.setCustomSpacing(16, after: headerRow)

        // ---- Status hero card (tint follows the updater phase) ----
        updatesHeroCard = makeCard(background: Theme.insetBg)
        updatesHeroIconTile = NSView()
        updatesHeroIconTile.wantsLayer = true
        updatesHeroIconTile.layer?.cornerRadius = 12
        updatesHeroIconTile.translatesAutoresizingMaskIntoConstraints = false
        updatesHeroIconTile.widthAnchor.constraint(equalToConstant: 44).isActive = true
        updatesHeroIconTile.heightAnchor.constraint(equalToConstant: 44).isActive = true
        updatesHeroIconLabel = makeLabel("🛰️", size: 22, weight: .regular, color: .white)
        updatesHeroIconLabel.translatesAutoresizingMaskIntoConstraints = false
        updatesHeroIconTile.addSubview(updatesHeroIconLabel)
        NSLayoutConstraint.activate([
            updatesHeroIconLabel.centerXAnchor.constraint(equalTo: updatesHeroIconTile.centerXAnchor),
            updatesHeroIconLabel.centerYAnchor.constraint(equalTo: updatesHeroIconTile.centerYAnchor)
        ])

        updatesHeadlineLabel = makeLabel("", size: 14, weight: .bold, color: Theme.textPrimary)
        makeCompressible(updatesHeadlineLabel)

        updatesStatusLabel = makeLabel("", size: 11, weight: .regular, color: Theme.textMuted)
        updatesStatusLabel.lineBreakMode = .byWordWrapping
        updatesStatusLabel.maximumNumberOfLines = 3
        makeCompressible(updatesStatusLabel, wrapWidth: 560)

        updatesMetaLabel = makeLabel("", size: 10.5, weight: .regular, color: Theme.textMuted)
        updatesMetaLabel.lineBreakMode = .byTruncatingTail
        makeCompressible(updatesMetaLabel)

        let heroText = NSStackView(views: [updatesHeadlineLabel, updatesStatusLabel, updatesMetaLabel])
        heroText.orientation = .vertical
        heroText.alignment = .leading
        heroText.spacing = 4

        let heroTop = NSStackView(views: [updatesHeroIconTile, heroText])
        heroTop.orientation = .horizontal
        heroTop.spacing = 12
        heroTop.alignment = .top

        updatesActionButton = CardButton()
        updatesActionButton.layer?.cornerRadius = 7
        updatesActionLabel = makeLabel("", size: 12, weight: .bold, color: NSColor(hexString: "#22080F"))
        updatesActionLabel.translatesAutoresizingMaskIntoConstraints = false
        updatesActionButton.addSubview(updatesActionLabel)
        NSLayoutConstraint.activate([
            updatesActionLabel.centerXAnchor.constraint(equalTo: updatesActionButton.centerXAnchor),
            updatesActionLabel.centerYAnchor.constraint(equalTo: updatesActionButton.centerYAnchor),
            updatesActionButton.widthAnchor.constraint(greaterThanOrEqualTo: updatesActionLabel.widthAnchor, constant: 24),
            updatesActionButton.heightAnchor.constraint(equalToConstant: 32)
        ])
        applyPrimaryGradient(to: updatesActionButton)
        updatesActionButton.isHidden = true
        updatesActionButton.onClick = { [weak self] in self?.performUpdateAction() }

        let notesButton = makeFilledButton(title: "View on GitHub", background: Theme.controlBg, foreground: Theme.textPrimary, fontSize: 12, height: 32)
        notesButton.onClick = { [weak self] in self?.openReleaseNotes() }

        let actionsRow = NSStackView(views: [updatesActionButton, notesButton, NSView()])
        actionsRow.orientation = .horizontal
        actionsRow.spacing = 8
        actionsRow.alignment = .centerY

        let heroStack = NSStackView(views: [heroTop, actionsRow])
        heroStack.orientation = .vertical
        heroStack.alignment = .leading
        heroStack.spacing = 12
        embed(heroStack, in: updatesHeroCard, padding: 16)
        heroTop.widthAnchor.constraint(equalTo: heroStack.widthAnchor).isActive = true
        updatesStatusLabel.widthAnchor.constraint(lessThanOrEqualTo: heroStack.widthAnchor, constant: -56).isActive = true
        stack.addArrangedSubview(updatesHeroCard)
        updatesHeroCard.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true

        // ---- Release feed header ----
        let feedLabel = makeLabel("✨ RELEASE FEED — LIVE FROM GITHUB RELEASES", size: 10, weight: .bold, color: Theme.textFaint)
        stack.addArrangedSubview(feedLabel)

        // ---- Two-column row: changelog + cadence preferences ----
        let changelogCard = makeCard()
        let changelogHeader = makeLabel("📋 ITEMIZED CHANGELOG", size: 10.5, weight: .bold, color: Theme.textSecondary)
        changelogStack = NSStackView()
        changelogStack.orientation = .vertical
        changelogStack.alignment = .leading
        changelogStack.spacing = 6
        changelogFooterLabel = makeLabel("", size: 10.5, weight: .regular, color: Theme.textMuted)
        makeCompressible(changelogFooterLabel)
        let changelogDivider = makeDivider()
        changelogDivider.heightAnchor.constraint(equalToConstant: 1).isActive = true
        let changelogContent = NSStackView(views: [changelogHeader, changelogStack, NSView(), changelogDivider, changelogFooterLabel])
        changelogContent.orientation = .vertical
        changelogContent.alignment = .leading
        changelogContent.spacing = 10
        embed(changelogContent, in: changelogCard, padding: 14)
        changelogStack.widthAnchor.constraint(equalTo: changelogContent.widthAnchor).isActive = true
        changelogDivider.widthAnchor.constraint(equalTo: changelogContent.widthAnchor).isActive = true

        let cadenceCard = makeCard()
        let cadenceHeader = makeLabel("⚙️ UPDATE CADENCE & PREFERENCES", size: 10.5, weight: .bold, color: Theme.textSecondary)

        switchAutoUpdate = NeonSwitch()
        switchAutoUpdate.target = self
        switchAutoUpdate.action = #selector(togglesChanged)
        let autoTitle = makeLabel("Automatic Background Checks", size: 12, weight: .semibold, color: Theme.textPrimary)
        let autoSub = makeLabel("Periodically query the release feed silently.", size: 10.5, weight: .regular, color: Theme.textMuted)
        autoSub.lineBreakMode = .byWordWrapping
        autoSub.maximumNumberOfLines = 0
        makeCompressible(autoSub, wrapWidth: 240)
        let autoText = NSStackView(views: [autoTitle, autoSub])
        autoText.orientation = .vertical
        autoText.alignment = .leading
        autoText.spacing = 1
        let autoRow = NSStackView(views: [autoText, NSView(), switchAutoUpdate])
        autoRow.orientation = .horizontal
        autoRow.alignment = .centerY

        let freqLabel = makeLabel("Check Frequency", size: 11, weight: .medium, color: Theme.textSecondary)
        updateIntervalPopup = NeonPopUp()
        updateIntervalPopup.addItems(withTitles: [
            "Every 6 Hours (High Frequency)",
            "Every 24 Hours (Daily)",
            "Every 72 Hours (Weekly)",
            "Manual Checks Only"
        ])
        updateIntervalPopup.target = self
        updateIntervalPopup.action = #selector(updateIntervalChanged)

        let reqHeader = makeLabel("🛡️ Minimum System Requirements", size: 10.5, weight: .semibold, color: Theme.textSecondary)
        let reqLine = makeLabel("• macOS 13 (Ventura) or later — Apple Silicon & Intel", size: 10.5, weight: .regular, color: Theme.textMuted)
        reqLine.lineBreakMode = .byWordWrapping
        reqLine.maximumNumberOfLines = 0
        makeCompressible(reqLine, wrapWidth: 300)

        let cadenceDivider1 = makeDivider()
        cadenceDivider1.heightAnchor.constraint(equalToConstant: 1).isActive = true
        let cadenceDivider2 = makeDivider()
        cadenceDivider2.heightAnchor.constraint(equalToConstant: 1).isActive = true

        let cadenceContent = NSStackView(views: [cadenceHeader, autoRow, cadenceDivider1, freqLabel, updateIntervalPopup, cadenceDivider2, reqHeader, reqLine])
        cadenceContent.orientation = .vertical
        cadenceContent.alignment = .leading
        cadenceContent.spacing = 9
        embed(cadenceContent, in: cadenceCard, padding: 14)
        autoRow.widthAnchor.constraint(equalTo: cadenceContent.widthAnchor).isActive = true
        updateIntervalPopup.widthAnchor.constraint(equalTo: cadenceContent.widthAnchor).isActive = true
        cadenceDivider1.widthAnchor.constraint(equalTo: cadenceContent.widthAnchor).isActive = true
        cadenceDivider2.widthAnchor.constraint(equalTo: cadenceContent.widthAnchor).isActive = true

        let columnsRow = NSStackView(views: [changelogCard, cadenceCard])
        columnsRow.orientation = .horizontal
        columnsRow.spacing = 12
        columnsRow.distribution = .fillEqually
        columnsRow.alignment = .top
        stack.addArrangedSubview(columnsRow)
        columnsRow.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        changelogCard.heightAnchor.constraint(equalTo: cadenceCard.heightAnchor).isActive = true

        // Security & Package Verification — parity with the web Updates tab
        let securityCard = makeCard()
        let securityTitle = makeLabel("🛡 SECURITY & PACKAGE VERIFICATION", size: 10.5, weight: .bold, color: Theme.emerald)
        let securityBody = makeLabel(
            "Every release ships SHA-256 checksums, and stable releases are additionally minisign-signed. Verify a download against the project's public key:",
            size: 11, weight: .regular, color: Theme.textSecondary
        )
        securityBody.lineBreakMode = .byWordWrapping
        securityBody.maximumNumberOfLines = 3
        let minisignCommand = "minisign -Vm Mouseflare-macOS.zip -P \(Minisign.mouseflarePublicKey)"
        let commandLabel = makeLabel(minisignCommand, size: 10, weight: .regular, color: Theme.neonValue)
        commandLabel.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
        commandLabel.lineBreakMode = .byCharWrapping
        commandLabel.maximumNumberOfLines = 2
        commandLabel.isSelectable = true
        let copyCommandButton = makeFilledButton(title: "Copy Command", background: Theme.controlBg, foreground: Theme.textPrimary, fontSize: 11, height: 26)
        copyCommandButton.onClick = { [weak self] in
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(minisignCommand, forType: .string)
            self?.setStatus("Copied minisign verify command")
        }
        let checksumsButton = makeFilledButton(title: "Download SHA256SUMS.txt", background: Theme.controlBg, foreground: Theme.textPrimary, fontSize: 11, height: 26)
        checksumsButton.onClick = {
            NSWorkspace.shared.open(URL(string: "https://github.com/OffBy1-tech/Mouse-Flare/releases/latest/download/SHA256SUMS.txt")!)
        }
        let securityButtons = NSStackView(views: [copyCommandButton, checksumsButton, NSView()])
        securityButtons.orientation = .horizontal
        securityButtons.spacing = 8
        let securityContent = NSStackView(views: [securityTitle, securityBody, commandLabel, securityButtons])
        securityContent.orientation = .vertical
        securityContent.alignment = .leading
        securityContent.spacing = 8
        embed(securityContent, in: securityCard, padding: 14)
        securityBody.widthAnchor.constraint(equalTo: securityContent.widthAnchor).isActive = true
        commandLabel.widthAnchor.constraint(equalTo: securityContent.widthAnchor).isActive = true
        stack.addArrangedSubview(securityCard)
        securityCard.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true

        refreshUpdatesUI()
    }

    /// Mirrors Updater.shared.phase (and latestInfo) into the Updates tab.
    /// Runs on the main thread (phase changes arrive via updaterPhaseChanged).
    private func refreshUpdatesUI() {
        guard updatesStatusLabel != nil else { return }
        let cfg = SettingsManager.shared.settings
        let info = Updater.shared.latestInfo
        let installed = Updater.shared.currentVersion

        var actionTitle: String?
        var tint = Theme.neonViolet
        var emoji = "🛰️"
        var headline = "Mouseflare v\(installed)"

        switch Updater.shared.phase {
        case .idle:
            if Updater.shared.isDevBuild {
                emoji = "🧪"
                headline = "Development Build"
                updatesStatusLabel.stringValue = "Dev builds don't self-update — download stable builds from GitHub Releases."
                updatesStatusLabel.textColor = Theme.textMuted
            } else if info != nil {
                tint = Theme.emerald
                emoji = "✅"
                headline = "Mouseflare is Up to Date (v\(installed))"
                if !isCheckingForUpdates {
                    updatesStatusLabel.stringValue = "You are running the latest verified stable build. All physics and stability patches are applied."
                    updatesStatusLabel.textColor = Theme.textMuted
                }
            } else if !isCheckingForUpdates {
                updatesStatusLabel.stringValue = "Run a check to compare this build against the latest verified GitHub release."
                updatesStatusLabel.textColor = Theme.textMuted
            }
        case .available(let release):
            tint = Theme.amber
            emoji = "⬆️"
            headline = "Update Available: v\(release.version)"
            updatesStatusLabel.stringValue = release.title
            updatesStatusLabel.textColor = Theme.amberBright
            actionTitle = "⬆️ Install v\(release.version)"
        case .downloading(let release):
            tint = Theme.cyan
            emoji = "⏳"
            headline = "Downloading v\(release.version)…"
            updatesStatusLabel.stringValue = "Downloading and verifying the signed package…"
            updatesStatusLabel.textColor = Theme.cyan
        case .ready(let release, _):
            tint = Theme.emerald
            emoji = "🔁"
            headline = "v\(release.version) Ready to Install"
            updatesStatusLabel.stringValue = "The update is verified and staged. Restart Mouseflare to finish installing."
            updatesStatusLabel.textColor = Theme.emerald
            actionTitle = "🔁 Restart to Update"
        case .error(let message):
            tint = NSColor(hexString: "#F87171")
            emoji = "⚠️"
            headline = "Update Check Failed"
            updatesStatusLabel.stringValue = message
            updatesStatusLabel.textColor = NSColor(hexString: "#F87171")
        }

        // Hero chrome follows the state tint
        updatesHeroCard.setStyle(
            background: Theme.insetBg.blended(withFraction: 0.08, of: tint) ?? Theme.insetBg,
            border: tint.withAlphaComponent(0.4),
            borderWidth: 1
        )
        updatesHeroIconTile.layer?.backgroundColor = tint.withAlphaComponent(0.18).cgColor
        updatesHeroIconLabel.stringValue = emoji
        updatesHeadlineLabel.stringValue = headline

        // Meta row: Checked / Installed / Latest — real data only
        var meta = "Checked: \(Self.formatTimeAgo(cfg.lastUpdateCheck))  •  Installed: v\(installed)"
        if let info {
            meta += "  •  Latest: v\(info.version)"
            if let date = info.publishedAt {
                let formatter = DateFormatter()
                formatter.dateStyle = .medium
                meta += " (\(formatter.string(from: date)))"
            }
        }
        updatesMetaLabel.stringValue = meta

        // Changelog card mirrors the latest fetched release
        changelogStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let bullets = info?.changelogBullets ?? []
        if bullets.isEmpty {
            let placeholder = makeLabel(
                info == nil ? "Run a check to fetch the latest release notes." : "No itemized changes — open the release on GitHub for details.",
                size: 11, weight: .regular, color: Theme.textMuted
            )
            placeholder.lineBreakMode = .byWordWrapping
            placeholder.maximumNumberOfLines = 0
            makeCompressible(placeholder, wrapWidth: 300)
            changelogStack.addArrangedSubview(placeholder)
        } else {
            for bullet in bullets.prefix(6) {
                let dot = makeLabel("•", size: 11, weight: .bold, color: Theme.amber)
                let text = makeLabel(bullet, size: 11, weight: .regular, color: Theme.textSecondary)
                text.lineBreakMode = .byWordWrapping
                text.maximumNumberOfLines = 0
                makeCompressible(text, wrapWidth: 300)
                let row = NSStackView(views: [dot, text])
                row.orientation = .horizontal
                row.spacing = 6
                row.alignment = .top
                changelogStack.addArrangedSubview(row)
                row.widthAnchor.constraint(equalTo: changelogStack.widthAnchor).isActive = true
                text.widthAnchor.constraint(lessThanOrEqualTo: row.widthAnchor, constant: -14).isActive = true
            }
        }
        changelogFooterLabel.stringValue = "Feed: GitHub Releases (stable)  •  Target: Apple Silicon / Intel"

        if let actionTitle {
            updatesActionLabel.stringValue = actionTitle
            updatesActionButton.isHidden = false
        } else {
            updatesActionButton.isHidden = true
        }
    }

    private static func formatTimeAgo(_ date: Date?) -> String {
        guard let date else { return "never" }
        let seconds = Int(-date.timeIntervalSinceNow)
        switch seconds {
        case ..<60: return "just now"
        case ..<3600: return "\(seconds / 60)m ago"
        case ..<86400: return "\(seconds / 3600)h ago"
        default:
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            return formatter.string(from: date)
        }
    }

    @objc private func updateIntervalChanged() {
        let index = updateIntervalPopup.indexOfSelectedItem
        guard Self.updateIntervalChoices.indices.contains(index) else { return }
        SettingsManager.shared.settings.updateCheckIntervalHours = Self.updateIntervalChoices[index]
    }


    @objc private func updaterPhaseChanged() {
        DispatchQueue.main.async { [weak self] in self?.refreshUpdatesUI() }
    }

    private func runManualUpdateCheck() {
        if Updater.shared.isDevBuild {
            updatesStatusLabel.stringValue = "Dev builds don't self-update — download stable builds from GitHub Releases."
            updatesStatusLabel.textColor = Theme.textMuted
            return
        }
        guard !isCheckingForUpdates else { return }
        isCheckingForUpdates = true
        checkNowLabel.stringValue = "Checking…"
        updatesStatusLabel.stringValue = "Checking GitHub Releases…"
        updatesStatusLabel.textColor = Theme.textSecondary
        Task { @MainActor in
            defer {
                self.isCheckingForUpdates = false
                self.checkNowLabel.stringValue = "🔄  Check for Updates"
            }
            do {
                // A found release flips the phase to .available and the
                // notification repaints; the up-to-date case repaints here so
                // the hero card, meta row, and changelog pick up latestInfo.
                _ = try await Updater.shared.check()
                self.refreshUpdatesUI()
            } catch {
                self.refreshUpdatesUI()
                self.updatesStatusLabel.stringValue = "Update check failed: \(error.localizedDescription)"
                self.updatesStatusLabel.textColor = NSColor(hexString: "#F87171")
            }
        }
    }

    /// Runs the same download/stage/install flow as the menu bar items.
    private func performUpdateAction() {
        guard let delegate = NSApp.delegate as? AppDelegate else { return }
        switch Updater.shared.phase {
        case .available: delegate.startUpdateDownload()
        case .ready: delegate.installStagedUpdate()
        default: break
        }
    }

    private func openReleaseNotes() {
        switch Updater.shared.phase {
        case .available(let release), .downloading(let release):
            NSWorkspace.shared.open(release.pageURL)
        case .ready(let release, _):
            NSWorkspace.shared.open(release.pageURL)
        default:
            NSWorkspace.shared.open(URL(string: "https://github.com/OffBy1-tech/Mouse-Flare/releases")!)
        }
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
        statusLabel = makeLabel("Ready. FX changes preview live — click Apply & Save to keep them.", size: 11, weight: .medium, color: Theme.textSecondary)
        let statusRow = NSStackView(views: [statusDot, statusLabel])
        statusRow.orientation = .horizontal
        statusRow.spacing = 8
        embed(statusRow, in: statusCard, paddingX: 10, paddingY: 6)
        footer.addArrangedSubview(statusCard)
        statusCard.widthAnchor.constraint(equalTo: footer.widthAnchor).isActive = true

        let resetButton = makeFilledButton(title: "Reset Defaults", background: .clear, foreground: Theme.textSecondary, fontSize: 11, height: 32)
        resetButton.onClick = { [weak self] in
            // Reset is an explicit action available on every tab (including
            // ones with no Apply & Save button), so it commits immediately:
            // the baseline is re-anchored to the freshly reset settings.
            SettingsManager.shared.resetToDefaults()
            self?.fxBaseline = SettingsManager.shared.settings
            self?.syncUIToSettings()
            self?.fxDesigner?.reloadFromSettings()
            self?.setStatus("✓ Settings Reset to Factory Defaults")
        }
        saveButton = makeFilledButton(title: "Apply & Save", background: .clear, foreground: NSColor(hexString: "#22080F"), fontSize: 12, height: 32, bold: true)
        applyPrimaryGradient(to: saveButton)
        saveButton.onClick = { [weak self] in
            self?.fxBaseline = SettingsManager.shared.settings
            SettingsManager.shared.save()
            if SettingsManager.shared.settings.soundFx { NSSound(named: "Tink")?.play() }
            self?.setStatus("✓ FX Selections Saved & Applied to Live Engine!")
        }
        let closeButton = makeFilledButton(title: "Close", background: Theme.controlBg, foreground: Theme.textPrimary, fontSize: 12, height: 32)
        closeButton.onClick = { [weak self] in self?.dismiss() }

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
        switchFluidBloom.state = cfg.fluidBloom ? .on : .off
        switchFluidRainbow.state = cfg.fluidRainbowDye ? .on : .off
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

        let intervalIndex = Self.updateIntervalChoices.firstIndex(of: cfg.updateCheckIntervalHours) ?? 0
        updateIntervalPopup.selectItem(at: intervalIndex)

        if !isRecordingHotkey { hotkeyLabel.stringValue = cfg.hotkey }
        customHexField.stringValue = cfg.customColorHex
        customHexPreview.layer?.backgroundColor = NSColor(hexString: cfg.customColorHex).cgColor
        refreshQuickSwatches()
        refreshPresetHighlights()
    }

    private func refreshPresetHighlights() {
        let cfg = SettingsManager.shared.settings
        // Selected cards become filled glowing gradient pills (the web build's
        // .neon-selected / .neon-selected-cyan, i.e. the reference's "Mars" row).
        for (id, card) in passiveCards {
            let active = id == cfg.passivePreset
            card.hoverStyle = active ? .none : .brightenBorder
            if active {
                card.setStyle(background: .clear, border: NSColor(hexString: "#BEA0FF").withAlphaComponent(0.9), borderWidth: 1.5)
                card.setGradient([
                    Theme.neonBlue.withAlphaComponent(0.78),
                    Theme.neonViolet.withAlphaComponent(0.66)
                ])
                card.setGlow(NSColor(hexString: "#6E5AFF"), radius: 9, opacity: 0.5)
            } else {
                card.setGradient(nil)
                card.setGlow(nil)
                card.setStyle(background: Theme.cardBg, border: Theme.cardBorder, borderWidth: 1)
            }
        }
        for (id, card) in flareCards {
            let active = id == cfg.flarePreset
            card.hoverStyle = active ? .none : .brightenBorder
            if active {
                card.setStyle(background: .clear, border: NSColor(hexString: "#96E6FF").withAlphaComponent(0.9), borderWidth: 1.5)
                card.setGradient([
                    Theme.cyan.withAlphaComponent(0.65),
                    Theme.neonBlue.withAlphaComponent(0.72)
                ])
                card.setGlow(NSColor(hexString: "#3CB4FF"), radius: 9, opacity: 0.5)
            } else {
                card.setGradient(nil)
                card.setGlow(nil)
                card.setStyle(background: Theme.cardBg, border: Theme.cardBorder, borderWidth: 1)
            }
        }
        for (id, chip) in colorChips {
            let active = id == cfg.colorPreset
            chip.card.hoverStyle = active ? .none : .brightenBorder
            chip.card.setStyle(
                background: active ? Theme.controlBg : Theme.cardBg,
                border: active ? .white : Theme.cardBorder,
                borderWidth: active ? 1.5 : 1
            )
            chip.card.setGlow(active ? Theme.neonViolet : nil, radius: 7, opacity: 0.35)
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
        // Passive FX is also writable from the FX Designer draft; this General
        // toggle commits instantly, so fold it into the baseline.
        fxBaseline?.passiveFxEnabled = cfg.passiveFxEnabled
        (NSApp.delegate as? AppDelegate)?.applyStartAtLogin(cfg.startAtLogin)
    }

    /// Fluid dye toggles live in the FX draft domain: they preview live and
    /// commit on Apply & Save (unlike togglesChanged's instant General set).
    @objc private func fluidTogglesChanged() {
        var cfg = SettingsManager.shared.settings
        cfg.fluidBloom = switchFluidBloom.state == .on
        cfg.fluidRainbowDye = switchFluidRainbow.state == .on
        SettingsManager.shared.settings = cfg
        setStatus("Fluid dye options updated • Apply & Save to keep")
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
        setStatus("Imported custom FX: \(config.name) • Apply & Save to keep")
    }

    private func refreshQuickSwatches() {
        let cfg = SettingsManager.shared.settings
        for (index, button) in quickSwatchButtons.enumerated() where index < cfg.quickSwatches.count {
            let hex = cfg.quickSwatches[index]
            let isSelected = cfg.colorPreset == "color-custom"
                && cfg.customColorHex.uppercased() == hex.uppercased()
            button.setStyle(
                background: NSColor(hexString: hex),
                border: isSelected ? .white : Theme.neonViolet.withAlphaComponent(0.3),
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

    private func makeToggleCard(title: String, subtitle: String, control: NeonSwitch) -> NSView {
        let card = makeCard()
        let titleLabel = makeLabel(title, size: 13, weight: .bold, color: Theme.textPrimary)
        let subLabel = makeLabel(subtitle, size: 11, weight: .regular, color: Theme.textMuted)
        subLabel.lineBreakMode = .byWordWrapping
        subLabel.maximumNumberOfLines = 2
        // An empty subtitle collapses the card to a single-line row.
        let textStack = NSStackView(views: subtitle.isEmpty ? [titleLabel] : [titleLabel, subLabel])
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
    private func addToggleCard(to stack: NSStackView, title: String, subtitle: String, control: NeonSwitch) {
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

    private func makeSlider(min: Double, max: Double, accent: NeonSlider.Accent = .violet) -> NeonSlider {
        let slider = NeonSlider(value: min, minValue: min, maxValue: max, target: self, action: #selector(slidersChanged))
        slider.isContinuous = true
        slider.accent = accent
        return slider
    }

    private func makeValueLabel(color: NSColor = Theme.neonValue) -> NSTextField {
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

    private func makeNavButton(icon: String, svgResource: String, title: String) -> (CardButton, NSTextField) {
        let card = CardButton()
        card.layer?.cornerRadius = 7
        card.setStyle(background: .clear, border: .clear, borderWidth: 0)
        card.heightAnchor.constraint(equalToConstant: 38).isActive = true
        // Lucide SVG icons (shared with the web build); emoji is the fallback
        // if the bundled resource ever fails to load.
        let tile = makeSvgIconTile(resource: svgResource, fallbackEmoji: icon, background: Theme.cardBg, size: 20, corner: 4)
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

    /// Amber→magenta gradient fill with a warm glow — the web build's
    /// .neon-btn-primary, used for Apply & Save and Test Flare.
    private func applyPrimaryGradient(to button: CardButton) {
        button.hoverStyle = .brightenGradient
        button.setStyle(background: .clear, border: NSColor(hexString: "#FFC88C").withAlphaComponent(0.5), borderWidth: 1)
        button.setGradient([
            Theme.amber,
            NSColor(hexString: "#FF5E62"),
            Theme.neonMagenta
        ])
        button.setGlow(NSColor(hexString: "#FF8C3C"), radius: 8, opacity: 0.45)
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

    private func makeSvgIconTile(resource: String, fallbackEmoji: String, background: NSColor, size: CGFloat, corner: CGFloat) -> NSView {
        guard let image = NavIcons.image(resource) else {
            return makeIconTile(emoji: fallbackEmoji, background: background, size: size, corner: corner)
        }
        let tile = NSView()
        tile.wantsLayer = true
        tile.layer?.backgroundColor = background.cgColor
        tile.layer?.cornerRadius = corner
        tile.translatesAutoresizingMaskIntoConstraints = false
        tile.widthAnchor.constraint(equalToConstant: size).isActive = true
        tile.heightAnchor.constraint(equalToConstant: size).isActive = true
        let imageView = NSImageView(image: image)
        imageView.imageScaling = .scaleProportionallyUpOrDown
        imageView.translatesAutoresizingMaskIntoConstraints = false
        tile.addSubview(imageView)
        NSLayoutConstraint.activate([
            imageView.centerXAnchor.constraint(equalTo: tile.centerXAnchor),
            imageView.centerYAnchor.constraint(equalTo: tile.centerYAnchor),
            imageView.widthAnchor.constraint(equalToConstant: size * 0.7),
            imageView.heightAnchor.constraint(equalToConstant: size * 0.7),
        ])
        return tile
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

    /// Labels whose text arrives at runtime (release notes, status lines) must
    /// never widen the fixed-size window: negligible horizontal compression
    /// resistance lets the surrounding width constraints always win, and a
    /// bounded preferred width makes multi-line height compute correctly.
    private func makeCompressible(_ label: NSTextField, wrapWidth: CGFloat? = nil) {
        label.setContentCompressionResistancePriority(NSLayoutConstraint.Priority(1), for: .horizontal)
        if let wrapWidth { label.preferredMaxLayoutWidth = wrapWidth }
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
