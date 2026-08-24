import Cocoa

// Native port of the web FX Designer's engine (src/engine/customFxRenderer.ts).
// A design made in the simulator's FX Designer exports JSON; this decodes that
// exact JSON and renders it in the native overlay as the "custom-fx" preset.

// MARK: - Config (decodes the designer's exported JSON verbatim)

struct CustomFxConfig: Codable {
    var id: String = "custom"
    var name: String = "Custom FX"

    var emissionPattern: String = "trail"
    var spawnRateOnMove: Double = 3
    var spawnBurstOnClick: Double = 24
    var emissionAngle: Double = 0
    var emissionSpread: Double = 60
    var velocityInheritance: Double = 0.3

    var shape: String = "circle"
    var blendMode: String = "source-over"
    var glowBloom: Bool = false
    var glowRadius: Double = 8

    var initialSpeedMin: Double = 1
    var initialSpeedMax: Double = 4
    var gravityX: Double = 0
    var gravityY: Double = 0
    var drag: Double = 0.95
    var turbulence: Double = 0
    var vortexAttraction: Double = 0
    var rotationSpeedMin: Double = 0
    var rotationSpeedMax: Double = 0

    var lifetimeMin: Double = 20
    var lifetimeMax: Double = 50
    var startSize: Double = 4
    var peakSize: Double = 6
    var endSize: Double = 1
    var sizeCurve: String = "linear-shrink"

    var colorMode: String = "single"
    var primaryColor: String = "#F59E0B"
    var secondaryColor: String = "#FBBF24"
    var accentColor: String = "#FFFFFF"
    var rainbowSpeed: Double = 2
    var startAlpha: Double = 1
    var peakAlpha: Double = 1
    var endAlpha: Double = 0

    init() {}

    // Tolerant decode: any missing key keeps its default, so configs from any
    // designer version load.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = CustomFxConfig()
        func s(_ k: CodingKeys, _ def: String) -> String { (try? c.decodeIfPresent(String.self, forKey: k)) ?? nil ?? def }
        func n(_ k: CodingKeys, _ def: Double) -> Double { (try? c.decodeIfPresent(Double.self, forKey: k)) ?? nil ?? def }
        func b(_ k: CodingKeys, _ def: Bool) -> Bool { (try? c.decodeIfPresent(Bool.self, forKey: k)) ?? nil ?? def }
        id = s(.id, d.id); name = s(.name, d.name)
        emissionPattern = s(.emissionPattern, d.emissionPattern)
        spawnRateOnMove = n(.spawnRateOnMove, d.spawnRateOnMove)
        spawnBurstOnClick = n(.spawnBurstOnClick, d.spawnBurstOnClick)
        emissionAngle = n(.emissionAngle, d.emissionAngle)
        emissionSpread = n(.emissionSpread, d.emissionSpread)
        velocityInheritance = n(.velocityInheritance, d.velocityInheritance)
        shape = s(.shape, d.shape); blendMode = s(.blendMode, d.blendMode)
        glowBloom = b(.glowBloom, d.glowBloom); glowRadius = n(.glowRadius, d.glowRadius)
        initialSpeedMin = n(.initialSpeedMin, d.initialSpeedMin)
        initialSpeedMax = n(.initialSpeedMax, d.initialSpeedMax)
        gravityX = n(.gravityX, d.gravityX); gravityY = n(.gravityY, d.gravityY)
        drag = n(.drag, d.drag); turbulence = n(.turbulence, d.turbulence)
        vortexAttraction = n(.vortexAttraction, d.vortexAttraction)
        rotationSpeedMin = n(.rotationSpeedMin, d.rotationSpeedMin)
        rotationSpeedMax = n(.rotationSpeedMax, d.rotationSpeedMax)
        lifetimeMin = n(.lifetimeMin, d.lifetimeMin); lifetimeMax = n(.lifetimeMax, d.lifetimeMax)
        startSize = n(.startSize, d.startSize); peakSize = n(.peakSize, d.peakSize); endSize = n(.endSize, d.endSize)
        sizeCurve = s(.sizeCurve, d.sizeCurve)
        colorMode = s(.colorMode, d.colorMode)
        primaryColor = s(.primaryColor, d.primaryColor)
        secondaryColor = s(.secondaryColor, d.secondaryColor)
        accentColor = s(.accentColor, d.accentColor)
        rainbowSpeed = n(.rainbowSpeed, d.rainbowSpeed)
        startAlpha = n(.startAlpha, d.startAlpha); peakAlpha = n(.peakAlpha, d.peakAlpha); endAlpha = n(.endAlpha, d.endAlpha)
    }

    static func fromJSON(_ json: String) -> CustomFxConfig? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(CustomFxConfig.self, from: data)
    }
}

// MARK: - Engine

final class CustomFxEngine {
    private struct P {
        var x: CGFloat, y: CGFloat, vx: CGFloat, vy: CGFloat
        var size: CGFloat
        var alpha: CGFloat
        var hue: Double
        var life: Double
        var maxLife: Double
        var rotation: CGFloat
        var rotationSpeed: CGFloat
        var turbulenceSeed: Double
    }

    private var particles: [P] = []
    private let maxParticles = 500
    private var globalHue: Double = 0
    private var cursorVx: CGFloat = 0
    private var cursorVy: CGFloat = 0
    private var cursorSpeed: Double = 0
    private var lastTime = Date.timeIntervalSinceReferenceDate
    private var lastUpdateTime = Date.timeIntervalSinceReferenceDate
    private var spawnBudget: Double = 0

    /// Presets are authored in 60fps frame units, so each update advances by
    /// dt*60 rather than a fixed 1 — identical duration at 60/120/144Hz.
    /// dt is clamped so a stall cannot teleport or mass-expire particles.
    private static let referenceHz: Double = 60
    private static let maxDeltaSeconds: Double = 0.1

    private func frameEquivalents(since previous: Double, now: Double) -> CGFloat {
        let seconds = min(Self.maxDeltaSeconds, max(0, now - previous))
        return CGFloat(seconds * Self.referenceHz)
    }

    var activeCount: Int { particles.count }
    /// Sum of live particle sizes — the benchmark uses it to see how the size
    /// distribution shifts, since blur cost is driven by size, not count.
    var activeSizeSum: CGFloat { particles.reduce(0) { $0 + $1.size } }

    func clear() { particles.removeAll() }

    // NOTE ON COORDINATES: the web engine is y-down; the AppKit overlay is
    // y-up. Emission angles and gravity are computed web-style and vy is
    // negated at the boundary so designs look identical on both.

    func onMove(x: CGFloat, y: CGFloat, dx: CGFloat, dy: CGFloat, config: CustomFxConfig) {
        let now = Date.timeIntervalSinceReferenceDate
        let dt = max(0.001, now - lastTime)
        lastTime = now
        let dist = hypot(dx, dy)
        cursorVx = dx / CGFloat(dt) * 0.0166
        cursorVy = dy / CGFloat(dt) * 0.0166
        cursorSpeed = Double(dist) / dt

        guard dist > 0.5 else { return }
        // Time-budgeted emission: the 120Hz poll timer no longer dictates
        // density, so macOS and Windows agree for the same preset.
        spawnBudget += config.spawnRateOnMove * Double(frameEquivalents(since: now - dt, now: now))
        let count = min(Int(spawnBudget.rounded(.down)), 40)
        spawnBudget -= Double(count)
        for _ in 0..<max(0, count) {
            spawn(x: x, y: y, dx: dx, dy: dy, config: config, isBurst: false)
        }
    }

    func triggerBurst(x: CGFloat, y: CGFloat, config: CustomFxConfig) {
        for _ in 0..<Int(config.spawnBurstOnClick) {
            spawn(x: x, y: y, dx: 0, dy: 0, config: config, isBurst: true)
        }
    }

    private func spawn(x: CGFloat, y: CGFloat, dx: CGFloat, dy: CGFloat, config: CustomFxConfig, isBurst: Bool) {
        if particles.count >= maxParticles { particles.removeFirst() }

        var speed = CGFloat.random(in: CGFloat(config.initialSpeedMin)...CGFloat(max(config.initialSpeedMin, config.initialSpeedMax)))
        var angleWeb: CGFloat = 0 // web-style angle (y-down)

        if isBurst {
            speed *= 1.4
            angleWeb = .random(in: 0...(2 * .pi))
        } else {
            switch config.emissionPattern {
            case "radial-burst", "vortex-spiral", "orbit":
                angleWeb = .random(in: 0...(2 * .pi))
            case "fountain":
                let base = CGFloat(config.emissionAngle - 90) * .pi / 180
                let spread = CGFloat(config.emissionSpread) * .pi / 180
                angleWeb = base + .random(in: -0.5...0.5) * spread
            case "directional-cone":
                let base = CGFloat(config.emissionAngle) * .pi / 180
                let spread = CGFloat(config.emissionSpread) * .pi / 180
                angleWeb = base + .random(in: -0.5...0.5) * spread
            default: // trail
                if hypot(dx, dy) > 0.1 {
                    // dy negated: incoming deltas are y-up, web math is y-down
                    let moveAngle = atan2(-dy, dx)
                    let spread = CGFloat(config.emissionSpread) * .pi / 180
                    angleWeb = moveAngle + .pi + .random(in: -0.5...0.5) * spread
                } else {
                    angleWeb = .random(in: 0...(2 * .pi))
                }
            }
        }

        let inherit = CGFloat(config.velocityInheritance) * 0.15
        let vx = cos(angleWeb) * speed + cursorVx * inherit
        let vyWeb = sin(angleWeb) * speed + (-cursorVy) * inherit
        globalHue = (globalHue + config.rainbowSpeed * 0.5).truncatingRemainder(dividingBy: 360)

        particles.append(P(
            x: x + .random(in: -2...2),
            y: y + .random(in: -2...2),
            vx: vx,
            vy: -vyWeb, // back to y-up
            size: CGFloat(config.startSize),
            alpha: CGFloat(config.startAlpha),
            hue: globalHue,
            life: 0,
            maxLife: Double.random(in: config.lifetimeMin...max(config.lifetimeMin, config.lifetimeMax)),
            rotation: .random(in: 0...(2 * .pi)),
            rotationSpeed: CGFloat.random(in: CGFloat(config.rotationSpeedMin)...CGFloat(max(config.rotationSpeedMin, config.rotationSpeedMax))) * .pi / 180,
            turbulenceSeed: .random(in: 0...100)
        ))
    }

    func update(config: CustomFxConfig, cursor: CGPoint) {
        let now = Date.timeIntervalSinceReferenceDate
        let fe = frameEquivalents(since: lastUpdateTime, now: now)
        lastUpdateTime = now
        let gravityX = CGFloat(config.gravityX) * 0.1
        let gravityYUp = CGFloat(-config.gravityY) * 0.1 // web +Y falls -> mac -Y
        let drag = CGFloat(config.drag)
        let turbulence = CGFloat(config.turbulence)
        let vortex = CGFloat(config.vortexAttraction)

        for i in (0..<particles.count).reversed() {
            particles[i].life += Double(fe)
            if particles[i].life >= particles[i].maxLife {
                particles.remove(at: i)
                continue
            }
            let progress = particles[i].life / particles[i].maxLife

            particles[i].vx += gravityX * fe
            particles[i].vy += gravityYUp * fe
            // drag is a per-frame multiplier, so exponentiate for other rates
            let dragStep = drag == 1 ? 1 : pow(drag, fe)
            particles[i].vx *= dragStep
            particles[i].vy *= dragStep

            if turbulence > 0 {
                let time = (particles[i].life + particles[i].turbulenceSeed) * 0.1
                particles[i].vx += CGFloat(sin(time)) * turbulence * 0.15 * fe
                particles[i].vy += CGFloat(-cos(time * 0.8)) * turbulence * 0.15 * fe
            }

            if vortex != 0 {
                let toX = cursor.x - particles[i].x
                let toY = cursor.y - particles[i].y
                let dist = hypot(toX, toY)
                if dist > 5 && dist < 300 {
                    let normX = toX / dist, normY = toY / dist
                    let tanX = -normY, tanY = normX
                    particles[i].vx += (tanX * vortex * 0.8 + normX * 0.2) * fe
                    particles[i].vy += (tanY * vortex * 0.8 + normY * 0.2) * fe
                }
            }

            particles[i].x += particles[i].vx * fe
            particles[i].y += particles[i].vy * fe
            particles[i].rotation += particles[i].rotationSpeed * fe

            // Size curve
            let start = CGFloat(config.startSize), peak = CGFloat(config.peakSize), end = CGFloat(config.endSize)
            switch config.sizeCurve {
            case "grow-shrink":
                particles[i].size = progress < 0.3
                    ? start + (peak - start) * CGFloat(progress / 0.3)
                    : peak - (peak - end) * CGFloat((progress - 0.3) / 0.7)
            case "pop-fade":
                particles[i].size = progress < 0.15 ? peak : start * CGFloat(1 - progress)
            case "constant":
                particles[i].size = start
            default: // linear-shrink
                particles[i].size = start + (end - start) * CGFloat(progress)
            }
            particles[i].size = max(0.2, particles[i].size)

            // Alpha curve
            let sa = CGFloat(config.startAlpha), pa = CGFloat(config.peakAlpha), ea = CGFloat(config.endAlpha)
            particles[i].alpha = progress < 0.2
                ? sa + (pa - sa) * CGFloat(progress / 0.2)
                : pa - (pa - ea) * CGFloat((progress - 0.2) / 0.8)
            particles[i].alpha = max(0, min(1, particles[i].alpha))
        }
    }

    func draw(in ctx: CGContext, config: CustomFxConfig) {
        guard !particles.isEmpty else { return }
        ctx.saveGState()
        switch config.blendMode {
        case "lighter": ctx.setBlendMode(.plusLighter)
        case "screen": ctx.setBlendMode(.screen)
        case "color-dodge": ctx.setBlendMode(.colorDodge)
        default: ctx.setBlendMode(.normal)
        }

        for p in particles {
            let progress = p.life / p.maxLife
            let color = currentColor(for: p, progress: progress, config: config)
            drawShape(ctx, p: p, color: color.withAlphaComponent(p.alpha), config: config)
        }
        ctx.restoreGState()
    }

    private func currentColor(for p: P, progress: Double, config: CustomFxConfig) -> NSColor {
        switch config.colorMode {
        case "gradient-lifetime":
            if progress < 0.5 {
                return lerp(NSColor(hexString: config.primaryColor), NSColor(hexString: config.secondaryColor), progress / 0.5)
            }
            return lerp(NSColor(hexString: config.secondaryColor), NSColor(hexString: config.accentColor), (progress - 0.5) / 0.5)
        case "rainbow-cycle":
            let h = (p.hue + progress * 120).truncatingRemainder(dividingBy: 360)
            return NSColor(hue: h / 360, saturation: 0.9, brightness: 0.95, alpha: 1)
        case "speed-responsive":
            let ratio = min(1, cursorSpeed / 1200)
            return lerp(NSColor(hexString: config.primaryColor), NSColor(hexString: config.accentColor), ratio)
        default:
            return NSColor(hexString: config.primaryColor)
        }
    }

    private func lerp(_ a: NSColor, _ b: NSColor, _ factor: Double) -> NSColor {
        let f = CGFloat(max(0, min(1, factor)))
        guard let c1 = a.usingColorSpace(.deviceRGB), let c2 = b.usingColorSpace(.deviceRGB) else { return a }
        return NSColor(
            red: c1.redComponent + (c2.redComponent - c1.redComponent) * f,
            green: c1.greenComponent + (c2.greenComponent - c1.greenComponent) * f,
            blue: c1.blueComponent + (c2.blueComponent - c1.blueComponent) * f,
            alpha: 1
        )
    }

    private func drawShape(_ ctx: CGContext, p: P, color: NSColor, config: CustomFxConfig) {
        ctx.saveGState()
        if config.glowBloom && config.glowRadius > 0 {
            ctx.setShadow(offset: .zero, blur: CGFloat(config.glowRadius) * (p.size / 6), color: color.cgColor)
        }
        ctx.translateBy(x: p.x, y: p.y)
        if p.rotation != 0 { ctx.rotate(by: p.rotation) }
        let s = p.size
        ctx.setFillColor(color.cgColor)
        ctx.setStrokeColor(color.cgColor)

        switch config.shape {
        case "glow-disc":
            let colors = [NSColor.white.cgColor, color.cgColor, color.withAlphaComponent(0).cgColor] as CFArray
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.3, 1]) {
                ctx.drawRadialGradient(grad, startCenter: .zero, startRadius: 0, endCenter: .zero, endRadius: max(1, s * 1.5), options: [])
            }
        case "sparkle-star":
            ctx.beginPath()
            ctx.move(to: CGPoint(x: 0, y: -s))
            ctx.addLine(to: CGPoint(x: s * 0.25, y: -s * 0.25))
            ctx.addLine(to: CGPoint(x: s, y: 0))
            ctx.addLine(to: CGPoint(x: s * 0.25, y: s * 0.25))
            ctx.addLine(to: CGPoint(x: 0, y: s))
            ctx.addLine(to: CGPoint(x: -s * 0.25, y: s * 0.25))
            ctx.addLine(to: CGPoint(x: -s, y: 0))
            ctx.addLine(to: CGPoint(x: -s * 0.25, y: -s * 0.25))
            ctx.closePath()
            ctx.fillPath()
        case "ring":
            ctx.setLineWidth(max(1, s * 0.25))
            ctx.strokeEllipse(in: CGRect(x: -s, y: -s, width: s * 2, height: s * 2))
        case "shard-crystal":
            ctx.beginPath()
            ctx.move(to: CGPoint(x: 0, y: -s * 1.2))
            ctx.addLine(to: CGPoint(x: s * 0.6, y: -s * 0.2))
            ctx.addLine(to: CGPoint(x: s * 0.4, y: s * 1.0))
            ctx.addLine(to: CGPoint(x: -s * 0.4, y: s * 1.0))
            ctx.addLine(to: CGPoint(x: -s * 0.6, y: -s * 0.2))
            ctx.closePath()
            ctx.fillPath()
        case "plasma-orb":
            ctx.fillEllipse(in: CGRect(x: -s, y: -s, width: s * 2, height: s * 2))
            ctx.setFillColor(NSColor.white.cgColor)
            ctx.fillEllipse(in: CGRect(x: -s * 0.6, y: -s * 0.6, width: s * 0.7, height: s * 0.7))
        case "smoke-puff":
            let colors = [color.cgColor, color.cgColor, color.withAlphaComponent(0).cgColor] as CFArray
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.6, 1]) {
                ctx.drawRadialGradient(grad, startCenter: .zero, startRadius: 0, endCenter: .zero, endRadius: max(1, s), options: [])
            }
        case "lightning-bolt":
            ctx.setLineWidth(max(1.2, s * 0.2))
            ctx.setLineCap(.round)
            ctx.beginPath()
            ctx.move(to: CGPoint(x: -s * 0.6, y: -s))
            ctx.addLine(to: CGPoint(x: 0, y: -s * 0.2))
            ctx.addLine(to: CGPoint(x: -s * 0.3, y: 0))
            ctx.addLine(to: CGPoint(x: s * 0.6, y: s))
            ctx.strokePath()
        case "bubble":
            ctx.setLineWidth(max(1, s * 0.15))
            ctx.setFillColor(NSColor.white.withAlphaComponent(0.08).cgColor)
            ctx.fillEllipse(in: CGRect(x: -s, y: -s, width: s * 2, height: s * 2))
            ctx.strokeEllipse(in: CGRect(x: -s, y: -s, width: s * 2, height: s * 2))
            ctx.setFillColor(NSColor.white.withAlphaComponent(0.7).cgColor)
            ctx.fillEllipse(in: CGRect(x: -s * 0.55, y: s * 0.15, width: s * 0.4, height: s * 0.4))
        case "sakura-petal":
            ctx.beginPath()
            ctx.move(to: CGPoint(x: 0, y: -s))
            ctx.addCurve(to: CGPoint(x: 0, y: s), control1: CGPoint(x: s * 0.8, y: -s * 0.8), control2: CGPoint(x: s * 0.8, y: s * 0.6))
            ctx.addCurve(to: CGPoint(x: 0, y: -s), control1: CGPoint(x: -s * 0.8, y: s * 0.6), control2: CGPoint(x: -s * 0.8, y: -s * 0.8))
            ctx.fillPath()
        case "rune":
            ctx.setLineWidth(max(1.2, s * 0.15))
            ctx.beginPath()
            ctx.move(to: CGPoint(x: 0, y: -s))
            ctx.addLine(to: CGPoint(x: s, y: 0))
            ctx.addLine(to: CGPoint(x: 0, y: s))
            ctx.addLine(to: CGPoint(x: -s, y: 0))
            ctx.closePath()
            ctx.move(to: CGPoint(x: 0, y: -s * 0.6))
            ctx.addLine(to: CGPoint(x: 0, y: s * 0.6))
            ctx.move(to: CGPoint(x: -s * 0.6, y: 0))
            ctx.addLine(to: CGPoint(x: s * 0.6, y: 0))
            ctx.strokePath()
        case "heart":
            // Web path is y-down; flip locally so the heart points the right way
            ctx.scaleBy(x: 1, y: -1)
            ctx.beginPath()
            ctx.move(to: CGPoint(x: 0, y: s * 0.4))
            ctx.addCurve(to: CGPoint(x: 0, y: -s * 0.3), control1: CGPoint(x: -s * 0.8, y: -s * 0.4), control2: CGPoint(x: -s * 0.8, y: -s * 0.9))
            ctx.addCurve(to: CGPoint(x: 0, y: s * 0.4), control1: CGPoint(x: s * 0.8, y: -s * 0.9), control2: CGPoint(x: s * 0.8, y: -s * 0.4))
            ctx.fillPath()
        case "diamond":
            ctx.beginPath()
            ctx.move(to: CGPoint(x: 0, y: -s))
            ctx.addLine(to: CGPoint(x: s * 0.7, y: 0))
            ctx.addLine(to: CGPoint(x: 0, y: s))
            ctx.addLine(to: CGPoint(x: -s * 0.7, y: 0))
            ctx.closePath()
            ctx.fillPath()
        default: // circle
            ctx.fillEllipse(in: CGRect(x: -max(0.5, s), y: -max(0.5, s), width: max(0.5, s) * 2, height: max(0.5, s) * 2))
        }
        ctx.restoreGState()
    }
}
