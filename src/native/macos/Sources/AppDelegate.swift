import Cocoa
import ApplicationServices
import ServiceManagement

enum AppLogo {
    /// The bundled Mouseflare logo (assets/app-logo.png), or nil when it is
    /// unavailable (callers fall back to emoji/text).
    ///
    /// Resolved by hand rather than through Bundle.module: the accessor swift
    /// build generates only checks the app-bundle root and the machine-specific
    /// build directory, and it fatalErrors on a miss — which crashed the
    /// CI-packaged .app on every machine except the one that built it.
    static let image: NSImage? = {
        let fm = FileManager.default
        var candidates: [URL] = []
        if let resourceURL = Bundle.main.resourceURL {
            // Packaged Mouseflare.app: Contents/Resources/app-logo.png
            candidates.append(resourceURL.appendingPathComponent("app-logo.png"))
        }
        if let exeDir = Bundle.main.executableURL?.deletingLastPathComponent() {
            // Dev flow (swift build): SwiftPM resource bundle next to the binary
            candidates.append(exeDir.appendingPathComponent("Mouseflare_Mouseflare.bundle/app-logo.png"))
            candidates.append(exeDir.appendingPathComponent("app-logo.png"))
        }
        for url in candidates where fm.fileExists(atPath: url.path) {
            return NSImage(contentsOf: url)
        }
        return nil
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

        // Rebuild the menu when the updater changes phase (available/ready/…)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(settingsChanged),
            name: Updater.phaseChangedNotification,
            object: nil
        )
        Updater.shared.startBackgroundChecks()

        // Dev convenience: `Mouseflare --settings` opens the Settings window immediately
        if CommandLine.arguments.contains("--settings") {
            openPreferences()
        }
        // Headless exercise of the full update path (used by CI-adjacent testing)
        if CommandLine.arguments.contains("--self-update-test") {
            runSelfUpdateTest()
        }
        // `Mouseflare --import-fx <file.json>`: import an FX Designer config
        if let flagIndex = CommandLine.arguments.firstIndex(of: "--import-fx"),
           CommandLine.arguments.count > flagIndex + 1 {
            let path = CommandLine.arguments[flagIndex + 1]
            if let json = try? String(contentsOf: URL(fileURLWithPath: path), encoding: .utf8),
               let config = CustomFxConfig.fromJSON(json) {
                var settings = SettingsManager.shared.settings
                settings.customFxJson = json
                settings.passivePreset = "custom-fx"
                SettingsManager.shared.settings = settings
                print("Imported custom FX: \(config.name)")
            } else {
                print("Could not import FX config from \(path)")
            }
        }
        // `Mouseflare --verify <file> <file.minisig>`: check a download against
        // the embedded release key, mirroring `minisign -Vm` without the tool
        if let flagIndex = CommandLine.arguments.firstIndex(of: "--verify"),
           CommandLine.arguments.count > flagIndex + 2 {
            let filePath = CommandLine.arguments[flagIndex + 1]
            let sigPath = CommandLine.arguments[flagIndex + 2]
            do {
                let data = try Data(contentsOf: URL(fileURLWithPath: filePath))
                let sig = try String(contentsOf: URL(fileURLWithPath: sigPath), encoding: .utf8)
                let comment = try Minisign.verify(data: data, signatureFile: sig)
                print("Signature verified ✓ (trusted comment: \(comment))")
                exit(0)
            } catch {
                print("Signature verification FAILED: \(error.localizedDescription)")
                exit(1)
            }
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
            button.toolTip = "Mouseflare — \(cfg.hotkey) to Find Mouse"
        }

        let menu = NSMenu()

        let findItem = NSMenuItem(title: "⚡ Find Mouse (\(cfg.hotkey))", action: #selector(menuTriggerFindMouse), keyEquivalent: "F")
        findItem.keyEquivalentModifierMask = [.command, .shift]
        menu.addItem(findItem)

        menu.addItem(NSMenuItem.separator())

        // Updater state surfaces at the top of the menu when relevant
        switch Updater.shared.phase {
        case .available(let release):
            let item = NSMenuItem(title: "⬆️ Update to v\(release.version)…", action: #selector(startUpdateDownload), keyEquivalent: "")
            menu.insertItem(item, at: 0)
            menu.insertItem(NSMenuItem.separator(), at: 1)
        case .downloading(let release):
            let item = NSMenuItem(title: "Downloading v\(release.version)…", action: nil, keyEquivalent: "")
            item.isEnabled = false
            menu.insertItem(item, at: 0)
            menu.insertItem(NSMenuItem.separator(), at: 1)
        case .ready(let release, _):
            let item = NSMenuItem(title: "🔁 Restart to Update to v\(release.version)", action: #selector(installStagedUpdate), keyEquivalent: "")
            menu.insertItem(item, at: 0)
            menu.insertItem(NSMenuItem.separator(), at: 1)
        case .idle, .error:
            break
        }

        menu.addItem(NSMenuItem(title: "⚙ Settings & FX Studio...", action: #selector(openPreferences), keyEquivalent: ","))
        menu.addItem(NSMenuItem(title: "Check for Updates…", action: #selector(checkForUpdatesManually), keyEquivalent: ""))

        let toggleItem = NSMenuItem(title: "Enable Effects", action: #selector(toggleEnabled), keyEquivalent: "")
        toggleItem.state = cfg.enabled ? .on : .off
        menu.addItem(toggleItem)

        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit Mouseflare", action: #selector(quitApp), keyEquivalent: "q"))

        statusItem.menu = menu
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
            // Above every normal window INCLUDING our own floating Settings
            // window, so FX stay visible while previewing presets. The overlay
            // is click-through, so drawing on top never blocks interaction.
            window.level = .screenSaver
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
            self.detectMonitorCrossing(at: screenPoint)
            self.lastMousePoint = screenPoint
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
        // Quitting with the Settings window open must not persist an FX draft
        // that was never committed with Apply & Save.
        settingsWindowController?.revertUnappliedFx()
        if let monitor = globalKeyMonitor { NSEvent.removeMonitor(monitor) }
        if let monitor = localKeyMonitor { NSEvent.removeMonitor(monitor) }
    }

    private func matchesConfiguredHotkey(_ event: NSEvent) -> Bool {
        guard let combo = HotkeyCombo(string: SettingsManager.shared.settings.hotkey) else {
            // Unparseable stored value: fall back to the classic default.
            let flags = event.modifierFlags.intersection([.command, .shift, .control, .option])
            return flags == [.command, .shift] && event.charactersIgnoringModifiers?.lowercased() == "f"
        }
        return combo.matches(event)
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

    // MARK: Updates

    @objc private func checkForUpdatesManually() {
        if Updater.shared.isDevBuild {
            showUpdateAlert(title: "Development Build", text: "This is an unversioned dev build — auto-update follows stable releases only. Download builds from GitHub Releases.")
            return
        }
        Task { @MainActor in
            do {
                if let release = try await Updater.shared.check() {
                    let alert = NSAlert()
                    alert.messageText = "Mouseflare v\(release.version) is available"
                    alert.informativeText = "You are running v\(Updater.shared.currentVersion). The update is downloaded from GitHub Releases and verified with the project's signing key before installing."
                    alert.addButton(withTitle: "Install Update")
                    alert.addButton(withTitle: "View Release Notes")
                    alert.addButton(withTitle: "Later")
                    switch alert.runModal() {
                    case .alertFirstButtonReturn:
                        startUpdateDownload()
                    case .alertSecondButtonReturn:
                        NSWorkspace.shared.open(release.pageURL)
                    default:
                        break
                    }
                } else {
                    showUpdateAlert(title: "You're up to date", text: "Mouseflare v\(Updater.shared.currentVersion) is the latest stable release.")
                }
            } catch {
                showUpdateAlert(title: "Update check failed", text: error.localizedDescription)
            }
        }
    }

    // Internal (not private): the Settings window's Updates tab drives the
    // same download/stage/install flow as these menu-bar actions.
    @objc func startUpdateDownload() {
        guard case .available(let release) = Updater.shared.phase else {
            // Manual path can arrive here right after check(); re-read phase safely
            if case .ready = Updater.shared.phase { installStagedUpdate() }
            return
        }
        Task { @MainActor in
            await Updater.shared.downloadAndStage(release)
            switch Updater.shared.phase {
            case .ready:
                promptRestartToInstall()
            case .error(let message):
                showUpdateAlert(title: "Update failed", text: message)
            default:
                break
            }
        }
    }

    @objc func installStagedUpdate() {
        guard case .ready(_, let stagedApp) = Updater.shared.phase else { return }
        do {
            try Updater.shared.installAndRelaunch(stagedApp: stagedApp)
        } catch {
            showUpdateAlert(title: "Could not install update", text: error.localizedDescription)
        }
    }

    private func promptRestartToInstall() {
        guard case .ready(let release, _) = Updater.shared.phase else { return }
        let alert = NSAlert()
        alert.messageText = "Ready to update to v\(release.version)"
        alert.informativeText = "The update was verified and staged. Restart Mouseflare now to finish installing?"
        alert.addButton(withTitle: "Restart Now")
        alert.addButton(withTitle: "Later")
        if alert.runModal() == .alertFirstButtonReturn {
            installStagedUpdate()
        }
    }

    private func showUpdateAlert(title: String, text: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = text
        alert.runModal()
    }

    /// Headless run of the entire update pipeline with printed state
    /// transitions — the M3 acceptance test hook.
    private func runSelfUpdateTest() {
        Task { @MainActor in
            do {
                print("[updater-test] current version: \(Updater.shared.currentVersion), canSelfInstall: \(Updater.shared.canSelfInstall)")
                guard let release = try await Updater.shared.check() else {
                    print("[updater-test] up to date — nothing to do")
                    exit(0)
                }
                print("[updater-test] available: v\(release.version) (\(release.zipURL.lastPathComponent))")
                await Updater.shared.downloadAndStage(release)
                switch Updater.shared.phase {
                case .ready(_, let stagedApp):
                    print("[updater-test] verified & staged: \(stagedApp.path)")
                    try Updater.shared.installAndRelaunch(stagedApp: stagedApp)
                    print("[updater-test] swap complete — relaunching new version")
                case .error(let message):
                    print("[updater-test] ERROR: \(message)")
                    exit(1)
                default:
                    print("[updater-test] unexpected phase")
                    exit(1)
                }
            } catch {
                print("[updater-test] ERROR: \(error.localizedDescription)")
                exit(1)
            }
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
