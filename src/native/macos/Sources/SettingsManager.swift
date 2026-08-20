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
    public var quickSwatches: [String] = ["#FF007F", "#3B82F6", "#14B8A6", "#F97316", "#A855F7", "#EF4444", "#FACC15", "#22C55E"]

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

    // General
    public var soundFx: Bool = true
    public var startAtLogin: Bool = false
    public var hotkey: String = "⌘ + Shift + F"
    public var autoCheckUpdates: Bool = true

    public init() {}

    // Tolerant decoding: every field falls back to its default when absent, so
    // adding a setting in an update never resets an existing user's settings.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = MacFlareSettings()
        enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? d.enabled
        passiveFxEnabled = try c.decodeIfPresent(Bool.self, forKey: .passiveFxEnabled) ?? d.passiveFxEnabled
        passivePreset = try c.decodeIfPresent(String.self, forKey: .passivePreset) ?? d.passivePreset
        flarePreset = try c.decodeIfPresent(String.self, forKey: .flarePreset) ?? d.flarePreset
        colorPreset = try c.decodeIfPresent(String.self, forKey: .colorPreset) ?? d.colorPreset
        customColorHex = try c.decodeIfPresent(String.self, forKey: .customColorHex) ?? d.customColorHex
        quickSwatches = try c.decodeIfPresent([String].self, forKey: .quickSwatches) ?? d.quickSwatches
        // Older installs saved fewer swatches; pad with the new defaults
        if quickSwatches.count < d.quickSwatches.count {
            quickSwatches += d.quickSwatches[quickSwatches.count...]
        }
        intensity = try c.decodeIfPresent(Double.self, forKey: .intensity) ?? d.intensity
        particleDensity = try c.decodeIfPresent(Double.self, forKey: .particleDensity) ?? d.particleDensity
        animationSpeed = try c.decodeIfPresent(Double.self, forKey: .animationSpeed) ?? d.animationSpeed
        movementThreshold = try c.decodeIfPresent(Double.self, forKey: .movementThreshold) ?? d.movementThreshold
        fluidVorticity = try c.decodeIfPresent(Double.self, forKey: .fluidVorticity) ?? d.fluidVorticity
        fluidDissipation = try c.decodeIfPresent(Double.self, forKey: .fluidDissipation) ?? d.fluidDissipation
        idleBurst = try c.decodeIfPresent(Bool.self, forKey: .idleBurst) ?? d.idleBurst
        monitorCrossingFx = try c.decodeIfPresent(Bool.self, forKey: .monitorCrossingFx) ?? d.monitorCrossingFx
        soundFx = try c.decodeIfPresent(Bool.self, forKey: .soundFx) ?? d.soundFx
        startAtLogin = try c.decodeIfPresent(Bool.self, forKey: .startAtLogin) ?? d.startAtLogin
        hotkey = try c.decodeIfPresent(String.self, forKey: .hotkey) ?? d.hotkey
        autoCheckUpdates = try c.decodeIfPresent(Bool.self, forKey: .autoCheckUpdates) ?? d.autoCheckUpdates
    }

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

    var hexString: String {
        guard let rgb = usingColorSpace(.deviceRGB) else { return "#FFFFFF" }
        return String(
            format: "#%02X%02X%02X",
            Int(round(rgb.redComponent * 255)),
            Int(round(rgb.greenComponent * 255)),
            Int(round(rgb.blueComponent * 255))
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
