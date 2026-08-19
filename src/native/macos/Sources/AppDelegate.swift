import Cocoa
import ApplicationServices
import ServiceManagement

enum AppLogo {
    /// The bundled Mouseflare logo (assets/app-logo.png), or nil when the
    /// resource bundle is unavailable (callers fall back to emoji/text).
    static let image: NSImage? = {
        guard let url = Bundle.module.url(forResource: "app-logo", withExtension: "png") else { return nil }
        return NSImage(contentsOf: url)
    }()

    static func resized(to size: CGFloat) -> NSImage? {
        guard let source = image else { return nil }
        let target = NSImage(size: NSSize(width: size, height: size))
        target.lockFocus()
        source.draw(
            in: NSRect(x: 0, y: 0, width: size, height: size),
            from: .zero,
            operation: .sourceOver,
            fraction: 1.0
        )
        target.unlockFocus()
        return target
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var overlayWindows: [NSWindow] = []
    private var mouseTracker: MouseTracker?
    private var settingsWindowController: SettingsWindowController?

    // Shake-to-find state
    private var lastShakeDx: CGFloat = 0
    private var shakeFlips: [TimeInterval] = []
    private var lastShakeTrigger: TimeInterval = 0
    private var lastMousePoint: CGPoint = .zero

    // Monitor-crossing state
    private var lastScreenIndex: Int = -1

    // Hotkey monitor tokens (retained so they can be removed on teardown)
    private var globalKeyMonitor: Any?
    private var localKeyMonitor: Any?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Run as permanent accessory menu bar utility
        NSApp.setActivationPolicy(.accessory)
        if let logo = AppLogo.image {
            NSApp.applicationIconImage = logo // Dock/About/⌘-Tab identity
        }

        print("""
        ========================================================
          ✨ Mouseflare for macOS is now RUNNING!
        ========================================================
          • Menu Bar Icon : ✨ Active in macOS menu bar (top right)
          • Global Hotkey : ⌘ + Shift + F (Find Mouse shockwave)
          • FX Studio     : Click ✨ -> 'Settings & FX Studio...'
          • Stop Utility  : Click ✨ -> 'Quit Mouseflare' or Ctrl+C
        ========================================================
        """)

        checkAccessibilityPermissions()
        setupStatusItem()
        setupOverlayWindows()
        setupMouseTracker()
        setupGlobalHotkey()

        // Dev convenience: `Mouseflare --settings` opens the Settings window immediately
        if CommandLine.arguments.contains("--settings") {
            openPreferences()
        }

        // Reconfigure overlays if displays are attached/detached
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenParametersChanged),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )

        // Refresh menu checkmarks when settings change
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(settingsChanged),
            name: SettingsManager.didChangeNotification,
            object: nil
        )
    }

    @objc private func screenParametersChanged() {
        setupOverlayWindows()
    }

    @objc private func settingsChanged() {
        setupStatusItem()
    }

    private func checkAccessibilityPermissions() {
        let options: NSDictionary = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
        let accessEnabled = AXIsProcessTrustedWithOptions(options)
        if !accessEnabled {
            print("ℹ️ Note: macOS Accessibility permission requested for global hotkey detection.")
        } else {
            print("✓ Accessibility permissions active.")
        }
    }

    private func setupStatusItem() {
        if statusItem == nil {
            statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        }
        let cfg = SettingsManager.shared.settings
        if let button = statusItem.button {
            if let logo = AppLogo.resized(to: 18) {
                button.image = logo
                button.title = ""
            } else {
                button.title = "✨"
            }
            button.toolTip = "Mouseflare (macOS) — \(cfg.hotkey) to Find Mouse"
        }

        let menu = NSMenu()

        let findItem = NSMenuItem(title: "⚡ Find Mouse (\(cfg.hotkey))", action: #selector(menuTriggerFindMouse), keyEquivalent: "F")
        findItem.keyEquivalentModifierMask = [.command, .shift]
        menu.addItem(findItem)

        menu.addItem(NSMenuItem.separator())

        // Direct FX Presets Submenu — ids shared with the Settings window & the Windows build
        let presetsMenu = NSMenu()
        let presets: [(id: String, name: String)] = [
            ("spark-trail", "✨ Spark Trail"),
            ("glow-pulse", "💡 Glow Pulse"),
            ("comet-trail", "☄️ Comet Tail"),
            ("bubbles", "🫧 Bubbles"),
            ("fireflies", "🌿 Fireflies"),
            ("star-dust", "⭐ Star Dust"),
            ("lightning", "⚡ Lightning Arc"),
            ("rainbow", "🌈 Rainbow Wave"),
            ("plasma", "🟣 Plasma Field"),
            ("matrix-rain", "🟩 Matrix Rain"),
            ("fire-flame", "🔥 Fire & Flame"),
            ("neon-cyber", "⚡ Neon Cyber"),
            ("magic-dust", "✨ Magic Dust"),
            ("galaxy", "🌌 Galaxy Supernova"),
            ("minimal-beacon", "🎯 Minimalist Beacon"),
            ("fluid-simulation", "🌊 Fluid Simulation"),
            ("fluid-smoke", "💨 Fluid Smoke Swirl"),
            ("neon-fluid", "🧪 Neon Fluid Dye"),
            ("cosmic-vortex", "🌌 Cosmic Liquid"),
            ("ink-diffusion", "🖋️ Ink Diffusion")
        ]
        for p in presets {
            let item = NSMenuItem(title: p.name, action: #selector(selectPresetFromMenu(_:)), keyEquivalent: "")
            item.representedObject = p.id
            item.state = (p.id == cfg.passivePreset) ? .on : .off
            presetsMenu.addItem(item)
        }

        let presetsParentItem = NSMenuItem(title: "🎨 FX Presets", action: nil, keyEquivalent: "")
        presetsParentItem.submenu = presetsMenu
        menu.addItem(presetsParentItem)

        menu.addItem(NSMenuItem(title: "⚙ Settings & FX Studio...", action: #selector(openPreferences), keyEquivalent: ","))

        let toggleItem = NSMenuItem(title: "Enable Effects", action: #selector(toggleEnabled), keyEquivalent: "")
        toggleItem.state = cfg.enabled ? .on : .off
        menu.addItem(toggleItem)

        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit Mouseflare", action: #selector(quitApp), keyEquivalent: "q"))

        statusItem.menu = menu
    }

    @objc private func selectPresetFromMenu(_ sender: NSMenuItem) {
        guard let presetId = sender.representedObject as? String else { return }
        SettingsManager.shared.settings.passivePreset = presetId
    }

    private func setupOverlayWindows() {
        for window in overlayWindows {
            window.orderOut(nil)
            window.contentView = nil
        }
        overlayWindows.removeAll()

        for screen in NSScreen.screens {
            let window = NSWindow(
                contentRect: screen.frame,
                styleMask: [.borderless],
                backing: .buffered,
                defer: false,
                screen: screen
            )
            window.isReleasedWhenClosed = false // Safe ARC lifecycle
            window.isOpaque = false
            window.backgroundColor = .clear
            window.hasShadow = false
            window.level = .floating
            window.ignoresMouseEvents = true // Pass clicks through to applications underneath
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]

            let overlayView = OverlayView(frame: NSRect(origin: .zero, size: screen.frame.size), screenFrame: screen.frame)
            window.contentView = overlayView
            window.orderFrontRegardless()
            overlayWindows.append(window)
        }
        lastScreenIndex = -1
    }

    private func setupMouseTracker() {
        mouseTracker = MouseTracker { [weak self] screenPoint in
            guard let self = self, SettingsManager.shared.settings.enabled else { return }
            for window in self.overlayWindows {
                if let view = window.contentView as? OverlayView {
                    view.addCursorMotion(atScreenPoint: screenPoint)
                }
            }
            self.detectShake(at: screenPoint)
            self.detectMonitorCrossing(at: screenPoint)
            self.lastMousePoint = screenPoint
        }
    }

    // MARK: Shake-to-Find

    private func detectShake(at point: CGPoint) {
        guard SettingsManager.shared.settings.shakeToFind else { return }
        let dx = point.x - lastMousePoint.x
        let now = Date.timeIntervalSinceReferenceDate

        // Count rapid horizontal direction reversals within a short window
        if abs(dx) > 18, dx.sign != lastShakeDx.sign, abs(lastShakeDx) > 18 {
            shakeFlips.append(now)
        }
        if abs(dx) > 4 { lastShakeDx = dx }
        shakeFlips.removeAll { now - $0 > 0.7 }

        if shakeFlips.count >= 4, now - lastShakeTrigger > 2.0 {
            lastShakeTrigger = now
            shakeFlips.removeAll()
            triggerFindMouse()
        }
    }

    // MARK: Monitor-crossing pulse

    private func detectMonitorCrossing(at point: CGPoint) {
        guard NSScreen.screens.count > 1 else { return }
        let index = NSScreen.screens.firstIndex { $0.frame.contains(point) } ?? -1
        defer { lastScreenIndex = index }
        guard index >= 0, lastScreenIndex >= 0, index != lastScreenIndex else { return }
        guard SettingsManager.shared.settings.monitorCrossingFx else { return }
        for window in overlayWindows {
            if let view = window.contentView as? OverlayView {
                view.monitorCrossingPulse(atScreenPoint: point)
            }
        }
    }

    private func setupGlobalHotkey() {
        // Global monitors never see events delivered to this app itself, so a
        // local monitor is required for the hotkey to work while Mouseflare is
        // frontmost (e.g. testing it from the Settings window).
        globalKeyMonitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self = self else { return }
            if self.matchesConfiguredHotkey(event) {
                self.triggerFindMouse()
            }
        }
        localKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self = self else { return event }
            if self.matchesConfiguredHotkey(event) {
                self.triggerFindMouse()
                return nil // consumed
            }
            return event
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let monitor = globalKeyMonitor { NSEvent.removeMonitor(monitor) }
        if let monitor = localKeyMonitor { NSEvent.removeMonitor(monitor) }
    }

    private func matchesConfiguredHotkey(_ event: NSEvent) -> Bool {
        let flags = event.modifierFlags.intersection([.command, .shift, .control, .option])
        let key = event.charactersIgnoringModifiers?.lowercased() ?? ""
        switch SettingsManager.shared.settings.hotkey {
        case "⌃ + Space":
            return flags == [.control] && key == " "
        case "⌥ + M":
            return flags == [.option] && (key == "m" || key == "µ")
        case "F1":
            return event.keyCode == 122 // F1 function key
        default: // "⌘ + Shift + F"
            return flags == [.command, .shift] && key == "f"
        }
    }

    @objc private func menuTriggerFindMouse() {
        triggerFindMouse()
    }

    @objc func triggerFindMouse() {
        let cfg = SettingsManager.shared.settings
        guard cfg.enabled else { return }
        let mouseLocation = NSEvent.mouseLocation
        for window in overlayWindows {
            if let view = window.contentView as? OverlayView {
                view.triggerFindMouseShockwave(atScreenPoint: mouseLocation)
            }
        }
        if cfg.soundFx {
            NSSound(named: "Ping")?.play()
        }
    }

    func applyStartAtLogin(_ enabled: Bool) {
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
        } catch {
            // Registration is best-effort for a bare SwiftPM binary; a bundled .app is
            // required for SMAppService to persist across reboots.
            print("ℹ️ Start-at-login could not be updated: \(error.localizedDescription)")
        }
    }

    @objc private func openPreferences() {
        if settingsWindowController == nil {
            settingsWindowController = SettingsWindowController()
        }
        settingsWindowController?.show()
    }

    @objc private func toggleEnabled(_ sender: NSMenuItem) {
        SettingsManager.shared.settings.enabled.toggle()
        sender.state = SettingsManager.shared.settings.enabled ? .on : .off
    }

    @objc private func quitApp() {
        NSApplication.shared.terminate(nil)
    }
}
