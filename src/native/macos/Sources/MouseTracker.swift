import Cocoa

final class MouseTracker {
    private var globalMonitor: Any?
    private var localMonitor: Any?
    private var pollTimer: Timer?
    private let onMove: (CGPoint) -> Void
    private var lastLocation: CGPoint = .zero

    init(onMove: @escaping (CGPoint) -> Void) {
        self.onMove = onMove
        startTracking()
    }

    private func startTracking() {
        // 1. High-speed global mouse movement monitor
        globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged, .rightMouseDragged]) { [weak self] _ in
            let loc = NSEvent.mouseLocation
            self?.handleLocation(loc)
        }

        // 2. Local monitor for Mouseflare windows
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged, .rightMouseDragged]) { [weak self] event in
            let loc = NSEvent.mouseLocation
            self?.handleLocation(loc)
            return event
        }

        // 3. Ultra-smooth 120Hz polling fallback
        let timer = Timer(timeInterval: 1.0 / 120.0, repeats: true) { [weak self] _ in
            let loc = NSEvent.mouseLocation
            self?.handleLocation(loc)
        }
        RunLoop.main.add(timer, forMode: .common)
        pollTimer = timer
    }

    private func handleLocation(_ point: CGPoint) {
        guard point != lastLocation else { return }
        lastLocation = point
        onMove(point)
    }

    deinit {
        if let monitor = globalMonitor { NSEvent.removeMonitor(monitor) }
        if let monitor = localMonitor { NSEvent.removeMonitor(monitor) }
        pollTimer?.invalidate()
    }
}