import Cocoa

// Initialize AppKit shared application
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate

// Launch main AppKit event run loop
app.run()
