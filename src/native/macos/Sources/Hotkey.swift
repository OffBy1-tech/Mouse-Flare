import Cocoa

/// A parsed global hotkey combination. The stored settings string is the
/// display form the UI shows — e.g. "⌘ + Shift + F", "⌃ + Space", "F1" — and
/// this type is the single authority for parsing, matching, and formatting it,
/// so recorded custom combos and the legacy preset strings behave identically.
struct HotkeyCombo {
    let modifiers: NSEvent.ModifierFlags
    /// Lowercased base character, "space", or "f1"..."f12".
    let keyToken: String

    static let functionKeyCodes: [String: UInt16] = [
        "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97,
        "f7": 98, "f8": 100, "f9": 101, "f10": 109, "f11": 103, "f12": 111,
    ]

    init?(string: String) {
        var mods: NSEvent.ModifierFlags = []
        var key: String?
        for raw in string.components(separatedBy: "+") {
            let token = raw.trimmingCharacters(in: .whitespaces)
            switch token.lowercased() {
            case "": continue
            case "⌘", "cmd", "command": mods.insert(.command)
            case "⌃", "ctrl", "control": mods.insert(.control)
            case "⌥", "alt", "option": mods.insert(.option)
            case "⇧", "shift": mods.insert(.shift)
            case "space": key = "space"
            default: key = token.lowercased()
            }
        }
        guard let keyToken = key else { return nil }
        // A bare non-function key would hijack normal typing system-wide.
        if mods.isEmpty && Self.functionKeyCodes[keyToken] == nil { return nil }
        self.modifiers = mods
        self.keyToken = keyToken
    }

    /// Built from a key event while recording; nil for combos we refuse
    /// (no modifier on a non-function key, or an unprintable key).
    init?(event: NSEvent) {
        let mods = event.modifierFlags.intersection([.command, .shift, .control, .option])
        var token: String?
        if let fn = Self.functionKeyCodes.first(where: { $0.value == event.keyCode }) {
            token = fn.key
        } else if let chars = event.characters(byApplyingModifiers: []), !chars.isEmpty {
            token = chars == " " ? "space" : chars.lowercased()
        }
        guard let keyToken = token, !keyToken.isEmpty else { return nil }
        if mods.isEmpty && Self.functionKeyCodes[keyToken] == nil { return nil }
        if keyToken.count == 1, let scalar = keyToken.unicodeScalars.first,
           scalar.value < 0x20 || scalar.value == 0x7F { return nil }
        self.modifiers = mods
        self.keyToken = keyToken
    }

    func matches(_ event: NSEvent) -> Bool {
        let flags = event.modifierFlags.intersection([.command, .shift, .control, .option])
        guard flags == modifiers else { return false }
        if let code = Self.functionKeyCodes[keyToken] { return event.keyCode == code }
        if keyToken == "space" { return event.charactersIgnoringModifiers == " " }
        // Option can remap the reported character (⌥M → "µ"), so accept either
        // the raw characters or the modifier-stripped base key.
        let pressed = event.charactersIgnoringModifiers?.lowercased()
        let base = event.characters(byApplyingModifiers: [])?.lowercased()
        return pressed == keyToken || base == keyToken
    }

    /// Display/storage form, in the preset chips' style.
    var displayString: String {
        var parts: [String] = []
        if modifiers.contains(.control) { parts.append("⌃") }
        if modifiers.contains(.option) { parts.append("⌥") }
        if modifiers.contains(.shift) { parts.append("Shift") }
        if modifiers.contains(.command) { parts.append("⌘") }
        parts.append(keyToken == "space" ? "Space" : keyToken.uppercased())
        return parts.joined(separator: " + ")
    }
}
