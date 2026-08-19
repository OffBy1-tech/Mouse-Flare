import Cocoa

// Mirrors the Windows build's settings surface (TransparentOverlayWindow properties)
// so both native apps expose an identical Settings & FX Studio experience.
public struct MacFlareSettings: Codable {
    // Master switches
    public var enabled: Bool = true
    public var passiveFxEnabled: Bool = true

    // FX Studio selections — preset ids are shared verbatim with the Windows app
    public var passivePreset: String = "spark-trail"
    // spark-trail, glow-pulse, comet-trail, bubbles, fireflies, star-dust, lightning,
    // rainbow, plasma, fluid-simulation, fluid-smoke, neon-fluid, cosmic-vortex, ink-diffusion
    public var flarePreset: String = "solar-flare"
    // solar-flare, sonar-radar, neon-beacon, quantum-shockwave, supernova, fluid-vortex-burst
    public var colorPreset: String = "color-amber"
    // color-amber, color-cyan, color-emerald, color-violet, color-gold, color-white, color-crimson, color-custom
    public var customColorHex: String = "#F59E0B"

    // Physics & density
    public var intensity: Double = 1.0        // 0.5 ... 2.0
    public var particleDensity: Double = 5.0  // 1 ... 10
    public var animationSpeed: Double = 1.0   // 0.5 ... 2.0
    public var movementThreshold: Double = 2.0 // px, 0 ... 15

    // Fluid engine
    public var fluidVorticity: Double = 0.85
    public var fluidDissipation: Double = 0.96

    // Behavior & monitors
    public var idleBurst: Bool = true
    public var monitorCrossingFx: Bool = true
    public var shakeToFind: Bool = true
    public var reducedMotion: Bool = false

    // General
    public var soundFx: Bool = true
    public var startAtLogin: Bool = false
    public var hotkey: String = "⌘ + Shift + F"
    public var autoCheckUpdates: Bool = true

    public var primaryColor: NSColor {
        switch colorPreset {
        case "color-cyan":    return NSColor(hexString: "#06B6D4")
        case "color-emerald": return NSColor(hexString: "#10B981")
        case "color-violet":  return NSColor(hexString: "#8B5CF6")
        case "color-gold":    return NSColor(hexString: "#EAB308")
        case "color-white":   return NSColor(hexString: "#F8FAFC")
        case "color-crimson": return NSColor(hexString: "#EF4444")
        case "color-custom":  return NSColor(hexString: customColorHex)
        default:              return NSColor(hexString: "#F59E0B") // amber
        }
    }

    public var secondaryColor: NSColor {
        switch colorPreset {
        case "color-cyan":    return NSColor(hexString: "#38BDF8")
        case "color-emerald": return NSColor(hexString: "#34D399")
        case "color-violet":  return NSColor(hexString: "#A78BFA")
        case "color-gold":    return NSColor(hexString: "#FEF08A")
        case "color-white":   return NSColor(hexString: "#E2E8F0")
        case "color-crimson": return NSColor(hexString: "#F87171")
        case "color-custom":  return NSColor(hexString: customColorHex).lightened(by: 0.15)
        default:              return NSColor(hexString: "#FBBF24")
        }
    }
}

public final class SettingsManager {
    public static let shared = SettingsManager()
    public static let didChangeNotification = Notification.Name("MouseflareSettingsChanged")
    private let userDefaultsKey = "MouseflarePreferences_v2"

    public var settings: MacFlareSettings {
        didSet {
            save()
            NotificationCenter.default.post(name: SettingsManager.didChangeNotification, object: nil)
        }
    }

    private init() {
        if let data = UserDefaults.standard.data(forKey: userDefaultsKey),
           let decoded = try? JSONDecoder().decode(MacFlareSettings.self, from: data) {
            self.settings = decoded
        } else {
            self.settings = MacFlareSettings()
        }
    }

    public func save() {
        if let encoded = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(encoded, forKey: userDefaultsKey)
        }
    }

    public func resetToDefaults() {
        settings = MacFlareSettings()
    }
}

public extension NSColor {
    convenience init(hexString: String) {
        var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        var value: UInt64 = 0
        guard hex.count == 6, Scanner(string: hex).scanHexInt64(&value) else {
            self.init(red: 0.96, green: 0.62, blue: 0.04, alpha: 1.0) // amber fallback
            return
        }
        self.init(
            red: CGFloat((value >> 16) & 0xFF) / 255.0,
            green: CGFloat((value >> 8) & 0xFF) / 255.0,
            blue: CGFloat(value & 0xFF) / 255.0,
            alpha: 1.0
        )
    }

    func lightened(by amount: CGFloat) -> NSColor {
        guard let rgb = usingColorSpace(.deviceRGB) else { return self }
        return NSColor(
            red: min(1.0, rgb.redComponent + amount),
            green: min(1.0, rgb.greenComponent + amount),
            blue: min(1.0, rgb.blueComponent + amount),
            alpha: rgb.alphaComponent
        )
    }
}
