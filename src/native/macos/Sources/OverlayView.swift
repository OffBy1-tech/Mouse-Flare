import Cocoa

final class OverlayView: NSView {
    private enum ParticleKind {
        case dot
        case ring
        case star
        case glyph
    }

    private static let matrixGlyphs: [String] =
        "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789Z:・.=*+-<>¦|".map(String.init)

    private struct Particle {
        var x: CGFloat
        var y: CGFloat
        var vx: CGFloat
        var vy: CGFloat
        var size: CGFloat
        var alpha: CGFloat
        var decay: CGFloat
        var color: NSColor
        var kind: ParticleKind = .dot
        var spin: CGFloat = 0.0
        var curlRate: CGFloat = 0.0
        var glyph: String = ""
        var constantVelocity: Bool = false
    }

    private struct BeaconRing {
        var center: CGPoint
        var radius: CGFloat
        var maxRadius: CGFloat
        var alpha: CGFloat
        var progress: CGFloat
        var color: NSColor
        var lineWidth: CGFloat = 3.5
    }

    private var particles: [Particle] = []
    private var rings: [BeaconRing] = []
    private var displayTimer: Timer?
    private var lastPoint: CGPoint = .zero
    private var lastMotionTime: TimeInterval = 0
    private let screenFrame: NSRect
    private var strokeIndex: Int = 0

    override var isFlipped: Bool { false } // AppKit bottom-left coordinate space

    init(frame frameRect: NSRect, screenFrame: NSRect) {
        self.screenFrame = screenFrame
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
        startAnimationLoop()
    }

    override init(frame frameRect: NSRect) {
        self.screenFrame = frameRect
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
        startAnimationLoop()
    }

    required init?(coder: NSCoder) {
        self.screenFrame = .zero
        super.init(coder: coder)
        startAnimationLoop()
    }

    private func startAnimationLoop() {
        let timer = Timer(timeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            self?.updatePhysics()
        }
        RunLoop.main.add(timer, forMode: .common)
        displayTimer = timer
    }

    // MARK: Passive movement FX

    func addCursorMotion(atScreenPoint screenPoint: CGPoint) {
        guard screenFrame.contains(screenPoint) else { return }

        let localX = screenPoint.x - screenFrame.origin.x
        let localY = screenPoint.y - screenFrame.origin.y
        let point = CGPoint(x: localX, y: localY)

        let dx = point.x - lastPoint.x
        let dy = point.y - lastPoint.y
        let dist = hypot(dx, dy)

        // Smoothly re-anchor if cursor teleported or woke from idle (>150pt gap)
        if dist > 150.0 || lastPoint == .zero {
            lastPoint = point
            lastMotionTime = Date.timeIntervalSinceReferenceDate
            return
        }

        let cfg = SettingsManager.shared.settings
        guard cfg.enabled, cfg.passiveFxEnabled, !cfg.reducedMotion else {
            lastPoint = point
            lastMotionTime = Date.timeIntervalSinceReferenceDate
            return
        }

        let now = Date.timeIntervalSinceReferenceDate
        let wasIdle = (now - lastMotionTime) > 2.0
        lastMotionTime = now

        if dist > CGFloat(max(0.5, cfg.movementThreshold)) {
            let speed = min(35.0, Double(dist))
            let angle = atan2(dy, dx)
            let densityScale = cfg.particleDensity / 5.0
            let count = max(1, Int(Double(dist) * 0.35 * densityScale))
            strokeIndex += 1

            for i in 0..<min(count, 14) {
                particles.append(generateParticle(at: point, angle: angle, speed: speed, cfg: cfg, index: i))
            }

            if wasIdle && cfg.idleBurst {
                spawnBurst(at: point, count: 14, speedRange: 2.0...4.5, color: cfg.primaryColor, cfg: cfg)
            }
        }
        lastPoint = point
    }

    private func generateParticle(at point: CGPoint, angle: Double, speed: Double, cfg: MacFlareSettings, index: Int) -> Particle {
        let sizeBase = CGFloat(cfg.intensity)
        let lifeScale = CGFloat(max(0.4, cfg.animationSpeed))
        let primary = cfg.primaryColor
        let secondary = cfg.secondaryColor

        switch cfg.passivePreset {
        case "fluid-simulation", "fluid-smoke", "neon-fluid", "cosmic-vortex", "ink-diffusion":
            // Velocity-based dissipation fluid simulation with dipole vortices
            let spinSign: CGFloat = (index % 2 == 0) ? 1.0 : -1.0
            let normalAngle = angle + (Double.pi * 0.5 * Double(spinSign))
            let offsetDist = CGFloat.random(in: 2.0...8.0)
            let posX = point.x + CGFloat(cos(normalAngle)) * offsetDist
            let posY = point.y + CGFloat(sin(normalAngle)) * offsetDist

            let forwardVel = CGFloat(speed * 0.18)
            let vortexVel = CGFloat(cfg.fluidVorticity * 2.8) * spinSign

            let vx = CGFloat(cos(angle)) * forwardVel - CGFloat(sin(angle)) * vortexVel + CGFloat.random(in: -0.4...0.4)
            let vy = CGFloat(sin(angle)) * forwardVel + CGFloat(cos(angle)) * vortexVel + CGFloat.random(in: -0.4...0.4)

            let dyeColor: NSColor
            switch cfg.passivePreset {
            case "neon-fluid":
                let hue = Double((strokeIndex * 7 + index * 30) % 360) / 360.0
                dyeColor = NSColor(hue: CGFloat(hue), saturation: 0.95, brightness: 1.0, alpha: 1.0)
            case "cosmic-vortex":
                dyeColor = Bool.random() ? NSColor(hexString: "#8B5CF6") : NSColor(hexString: "#06B6D4")
            case "fluid-smoke":
                dyeColor = NSColor(hexString: "#A855F7").withAlphaComponent(0.85)
            case "ink-diffusion":
                dyeColor = NSColor(hexString: "#64748B")
            default: // fluid-simulation
                let hue = Double((strokeIndex * 7 + index * 12) % 360) / 360.0
                dyeColor = NSColor(hue: CGFloat(hue), saturation: 0.9, brightness: 1.0, alpha: 1.0)
            }

            return Particle(
                x: posX, y: posY, vx: vx, vy: vy,
                size: CGFloat.random(in: 4.5...8.5) * sizeBase,
                alpha: 0.92,
                decay: CGFloat(0.025) * lifeScale,
                color: dyeColor,
                spin: spinSign * CGFloat(cfg.fluidVorticity * 0.12),
                curlRate: CGFloat(cfg.fluidVorticity * 0.08)
            )

        case "glow-pulse":
            return Particle(
                x: point.x + CGFloat.random(in: -2...2),
                y: point.y + CGFloat.random(in: -2...2),
                vx: CGFloat.random(in: -0.3...0.3),
                vy: CGFloat.random(in: -0.3...0.3),
                size: CGFloat.random(in: 8.0...14.0) * sizeBase,
                alpha: 0.35,
                decay: CGFloat(0.03) * lifeScale,
                color: primary
            )

        case "comet-trail":
            let spreadAngle = angle + Double.random(in: -0.15...0.15)
            let pSpeed = CGFloat(speed * 0.3 + Double.random(in: 1.0...2.0))
            return Particle(
                x: point.x, y: point.y,
                vx: -CGFloat(cos(spreadAngle)) * pSpeed * 0.5,
                vy: -CGFloat(sin(spreadAngle)) * pSpeed * 0.5,
                size: CGFloat.random(in: 2.5...5.5) * sizeBase,
                alpha: 0.95,
                decay: CGFloat(0.05) * lifeScale,
                color: index % 3 == 0 ? secondary : primary
            )

        case "bubbles":
            return Particle(
                x: point.x + CGFloat.random(in: -6...6),
                y: point.y + CGFloat.random(in: -4...4),
                vx: CGFloat.random(in: -0.3...0.3),
                vy: CGFloat.random(in: 0.6...1.6), // buoyant rise
                size: CGFloat.random(in: 4.0...9.0) * sizeBase,
                alpha: 0.8,
                decay: CGFloat(0.02) * lifeScale,
                color: primary,
                kind: .ring
            )

        case "fireflies":
            let drift = Double.random(in: 0...Double.pi * 2)
            return Particle(
                x: point.x + CGFloat.random(in: -8...8),
                y: point.y + CGFloat.random(in: -8...8),
                vx: CGFloat(cos(drift)) * CGFloat.random(in: 0.3...1.0),
                vy: CGFloat(sin(drift)) * CGFloat.random(in: 0.3...1.0),
                size: CGFloat.random(in: 2.5...4.5) * sizeBase,
                alpha: 0.9,
                decay: CGFloat(0.018) * lifeScale,
                color: index % 4 == 0 ? secondary : primary
            )

        case "star-dust":
            let spreadAngle = Double.random(in: 0...Double.pi * 2)
            return Particle(
                x: point.x + CGFloat.random(in: -4...4),
                y: point.y + CGFloat.random(in: -4...4),
                vx: CGFloat(cos(spreadAngle)) * CGFloat.random(in: 0.4...1.4),
                vy: CGFloat(sin(spreadAngle)) * CGFloat.random(in: 0.4...1.4),
                size: CGFloat.random(in: 3.0...6.5) * sizeBase,
                alpha: 1.0,
                decay: CGFloat(0.035) * lifeScale,
                color: index % 2 == 0 ? primary : secondary,
                kind: .star
            )

        case "lightning":
            let spreadAngle = angle + Double.random(in: -1.2...1.2)
            let pSpeed = CGFloat.random(in: 3.0...6.0)
            return Particle(
                x: point.x, y: point.y,
                vx: -CGFloat(cos(spreadAngle)) * pSpeed,
                vy: -CGFloat(sin(spreadAngle)) * pSpeed,
                size: CGFloat.random(in: 1.5...3.5) * sizeBase,
                alpha: 1.0,
                decay: CGFloat(0.09) * lifeScale,
                color: index % 3 == 0 ? .white : primary
            )

        case "rainbow":
            let hue = Double((strokeIndex * 15 + index * 20) % 360) / 360.0
            let spreadAngle = angle + Double.random(in: -0.8...0.8)
            let pSpeed = CGFloat.random(in: 1.0...3.0)
            return Particle(
                x: point.x + CGFloat.random(in: -3...3),
                y: point.y + CGFloat.random(in: -3...3),
                vx: -CGFloat(cos(spreadAngle)) * pSpeed * 0.3,
                vy: -CGFloat(sin(spreadAngle)) * pSpeed * 0.3,
                size: CGFloat.random(in: 3.0...6.0) * sizeBase,
                alpha: 1.0,
                decay: CGFloat(0.035) * lifeScale,
                color: NSColor(hue: CGFloat(hue), saturation: 1.0, brightness: 1.0, alpha: 1.0)
            )

        case "plasma":
            let spreadAngle = Double.random(in: 0...Double.pi * 2)
            return Particle(
                x: point.x + CGFloat.random(in: -3...3),
                y: point.y + CGFloat.random(in: -3...3),
                vx: CGFloat(cos(spreadAngle)) * CGFloat.random(in: 0.5...1.5),
                vy: CGFloat(sin(spreadAngle)) * CGFloat.random(in: 0.5...1.5),
                size: CGFloat.random(in: 4.0...8.0) * sizeBase,
                alpha: 0.85,
                decay: CGFloat(0.03) * lifeScale,
                color: index % 2 == 0 ? NSColor(hexString: "#8B5CF6") : primary,
                kind: index % 3 == 0 ? .ring : .dot
            )

        case "matrix-rain":
            // Digital rain: green code glyphs cascade downward (fixed Matrix identity)
            let isHead = Double.random(in: 0...1) < 0.25
            return Particle(
                x: point.x + CGFloat.random(in: -14...14),
                y: point.y + CGFloat.random(in: -4...4),
                vx: CGFloat.random(in: -0.2...0.2),
                vy: -CGFloat.random(in: 1.6...4.0), // downward in bottom-left coords
                size: CGFloat.random(in: 9.0...13.0) * sizeBase, // font size
                alpha: isHead ? 1.0 : 0.85,
                decay: CGFloat(0.03) * lifeScale,
                color: isHead ? NSColor(hexString: "#DCFCE7") : NSColor(hexString: "#22C55E"),
                kind: .glyph,
                glyph: Self.matrixGlyphs.randomElement() ?? "0",
                constantVelocity: true
            )

        case "fire-flame":
            // Classic fire: fixed flame palette with upward buoyancy
            let spreadAngle = angle + Double.random(in: -0.6...0.6)
            let pSpeed = CGFloat.random(in: 1.2...3.5)
            let fireColors = [
                NSColor(hexString: "#FDBA13"),
                NSColor(hexString: "#F97316"),
                NSColor(hexString: "#DC2626")
            ]
            return Particle(
                x: point.x + CGFloat.random(in: -3...3),
                y: point.y + CGFloat.random(in: -3...3),
                vx: -CGFloat(cos(spreadAngle)) * pSpeed * 0.4 + CGFloat.random(in: -0.4...0.4),
                vy: -CGFloat(sin(spreadAngle)) * pSpeed * 0.4 + CGFloat.random(in: 0.3...1.2), // buoyant rise
                size: CGFloat.random(in: 3.0...6.0) * sizeBase,
                alpha: 0.95,
                decay: CGFloat(0.045) * lifeScale,
                color: fireColors.randomElement()!
            )

        case "neon-cyber":
            // Fixed electric cyan / magenta / blue arcade palette
            let spreadAngle = angle + Double.random(in: -0.3...0.3)
            let pSpeed = CGFloat(speed * 0.25 + Double.random(in: 1.5...3.5))
            let neonColors = [
                NSColor(hexString: "#00F2FF"),
                NSColor(hexString: "#F200F2"),
                NSColor(hexString: "#3B82F6")
            ]
            return Particle(
                x: point.x + CGFloat.random(in: -2...2),
                y: point.y + CGFloat.random(in: -2...2),
                vx: -CGFloat(cos(spreadAngle)) * pSpeed * 0.4,
                vy: -CGFloat(sin(spreadAngle)) * pSpeed * 0.4,
                size: CGFloat.random(in: 3.5...6.5) * sizeBase,
                alpha: 0.95,
                decay: CGFloat(0.04) * lifeScale,
                color: neonColors.randomElement()!
            )

        case "magic-dust":
            // Enchanted pastel shimmer drifting in all directions
            let drift = Double.random(in: 0...Double.pi * 2)
            let pSpeed = CGFloat.random(in: 0.8...2.8)
            let magicColors = [
                NSColor(hexString: "#D97FFF"),
                NSColor(hexString: "#FFD84D"),
                NSColor(hexString: "#66CCFF")
            ]
            return Particle(
                x: point.x + CGFloat.random(in: -4...4),
                y: point.y + CGFloat.random(in: -4...4),
                vx: CGFloat(cos(drift)) * pSpeed,
                vy: CGFloat(sin(drift)) * pSpeed + 0.4, // gentle float upward
                size: CGFloat.random(in: 3.0...7.0) * sizeBase,
                alpha: 1.0,
                decay: CGFloat(0.03) * lifeScale,
                color: magicColors.randomElement()!,
                kind: index % 3 == 0 ? .star : .dot
            )

        case "galaxy":
            // Deep-space starfield: violet/blue nebula dust with white star sparkles
            let isStar = Double.random(in: 0...1) < 0.35
            let drift = Double.random(in: 0...Double.pi * 2)
            let pSpeed = CGFloat.random(in: 0.3...1.5)
            let nebulaColors = [
                NSColor(hexString: "#8B5CF6"),
                NSColor(hexString: "#3B82F6"),
                NSColor(hexString: "#312E81")
            ]
            return Particle(
                x: point.x + CGFloat.random(in: -12...12),
                y: point.y + CGFloat.random(in: -12...12),
                vx: CGFloat(cos(drift)) * pSpeed,
                vy: CGFloat(sin(drift)) * pSpeed,
                size: (isStar ? CGFloat.random(in: 3.5...6.5) : CGFloat.random(in: 2.0...4.0)) * sizeBase,
                alpha: isStar ? 1.0 : 0.7,
                decay: CGFloat(0.022) * lifeScale,
                color: isStar ? .white : nebulaColors.randomElement()!,
                kind: isStar ? .star : .dot
            )

        case "minimal-beacon":
            // Restrained single tracking dot — the quietest preset
            return Particle(
                x: point.x, y: point.y,
                vx: 0, vy: 0,
                size: CGFloat.random(in: 2.5...4.0) * sizeBase,
                alpha: 0.5,
                decay: CGFloat(0.06) * lifeScale,
                color: primary
            )

        default: // spark-trail
            let spreadAngle = angle + Double.random(in: -0.6...0.6)
            let pSpeed = CGFloat.random(in: 1.2...3.5)
            return Particle(
                x: point.x + CGFloat.random(in: -3...3),
                y: point.y + CGFloat.random(in: -3...3),
                vx: -CGFloat(cos(spreadAngle)) * pSpeed * 0.4 + CGFloat.random(in: -0.4...0.4),
                vy: -CGFloat(sin(spreadAngle)) * pSpeed * 0.4 - CGFloat.random(in: 0.3...1.2), // gravity decay
                size: CGFloat.random(in: 3.0...6.0) * sizeBase,
                alpha: 0.95,
                decay: CGFloat(0.045) * lifeScale,
                color: index % 3 == 0 ? secondary : primary
            )
        }
    }

    // MARK: Find Mouse flares

    func triggerFindMouseShockwave(atScreenPoint screenPoint: CGPoint) {
        guard screenFrame.contains(screenPoint) else { return }

        let localX = screenPoint.x - screenFrame.origin.x
        let localY = screenPoint.y - screenFrame.origin.y
        let point = CGPoint(x: localX, y: localY)

        let cfg = SettingsManager.shared.settings
        guard cfg.enabled else { return }
        let primary = cfg.primaryColor
        let secondary = cfg.secondaryColor

        if cfg.reducedMotion {
            // Single clean, high-contrast locator beacon
            rings.append(BeaconRing(center: point, radius: 8, maxRadius: 110, alpha: 1.0, progress: 0, color: .white, lineWidth: 5.0))
            rings.append(BeaconRing(center: point, radius: 8, maxRadius: 80, alpha: 1.0, progress: -0.1, color: primary, lineWidth: 4.0))
            needsDisplay = true
            return
        }

        switch cfg.flarePreset {
        case "sonar-radar":
            for i in 0..<4 {
                rings.append(BeaconRing(
                    center: point, radius: 6, maxRadius: 60 + CGFloat(i) * 40,
                    alpha: 0.95 - CGFloat(i) * 0.15, progress: -0.12 * CGFloat(i),
                    color: primary, lineWidth: 2.5
                ))
            }
            spawnBurst(at: point, count: 10, speedRange: 1.5...3.0, color: secondary, cfg: cfg)

        case "neon-beacon":
            rings.append(BeaconRing(center: point, radius: 8, maxRadius: 130, alpha: 1.0, progress: 0, color: .white, lineWidth: 5.0))
            rings.append(BeaconRing(center: point, radius: 8, maxRadius: 95, alpha: 1.0, progress: -0.12, color: primary, lineWidth: 4.0))
            spawnBurst(at: point, count: 14, speedRange: 2.0...4.0, color: primary, cfg: cfg)

        case "quantum-shockwave":
            rings.append(BeaconRing(center: point, radius: 10, maxRadius: 170, alpha: 0.9, progress: 0, color: NSColor(hexString: "#8B5CF6"), lineWidth: 6.0))
            rings.append(BeaconRing(center: point, radius: 6, maxRadius: 120, alpha: 0.7, progress: -0.2, color: primary, lineWidth: 3.0))
            spawnBurst(at: point, count: 24, speedRange: 3.0...5.5, color: NSColor(hexString: "#A78BFA"), cfg: cfg)

        case "supernova":
            rings.append(BeaconRing(center: point, radius: 10, maxRadius: 150, alpha: 1.0, progress: 0, color: secondary, lineWidth: 4.0))
            spawnBurst(at: point, count: 60, speedRange: 4.0...9.0, color: primary, cfg: cfg, whiteMix: 0.5, starMix: 0.35)

        case "fluid-vortex-burst":
            rings.append(BeaconRing(center: point, radius: 8, maxRadius: 120, alpha: 0.9, progress: 0, color: primary, lineWidth: 3.5))
            for i in 0..<40 {
                let angle = (Double(i) / 40.0) * .pi * 2.0
                let speed = CGFloat.random(in: 3.0...6.0)
                let tangent = angle + .pi * 0.45 // swirl
                particles.append(Particle(
                    x: point.x, y: point.y,
                    vx: CGFloat(cos(tangent)) * speed,
                    vy: CGFloat(sin(tangent)) * speed,
                    size: CGFloat.random(in: 4.0...7.5) * CGFloat(cfg.intensity),
                    alpha: 0.95,
                    decay: 0.022,
                    color: i % 2 == 0 ? primary : NSColor(hexString: "#06B6D4"),
                    spin: 1.0,
                    curlRate: CGFloat(cfg.fluidVorticity * 0.1)
                ))
            }

        default: // solar-flare
            rings.append(BeaconRing(center: point, radius: 8, maxRadius: 120, alpha: 1.0, progress: 0, color: primary, lineWidth: 3.5))
            rings.append(BeaconRing(center: point, radius: 8, maxRadius: 150, alpha: 0.8, progress: -0.15, color: secondary, lineWidth: 3.5))
            spawnBurst(at: point, count: 36, speedRange: 4.0...7.5, color: primary, cfg: cfg, whiteMix: 0.3)
        }
        needsDisplay = true
    }

    /// Subtle single-ring pulse fired when the cursor crosses a display boundary.
    func monitorCrossingPulse(atScreenPoint screenPoint: CGPoint) {
        guard screenFrame.contains(screenPoint) else { return }
        let cfg = SettingsManager.shared.settings
        guard cfg.enabled, !cfg.reducedMotion else { return }
        let point = CGPoint(
            x: screenPoint.x - screenFrame.origin.x,
            y: screenPoint.y - screenFrame.origin.y
        )
        rings.append(BeaconRing(center: point, radius: 4, maxRadius: 55, alpha: 0.7, progress: 0, color: cfg.primaryColor, lineWidth: 2.5))
        needsDisplay = true
    }

    private func spawnBurst(
        at point: CGPoint,
        count: Int,
        speedRange: ClosedRange<CGFloat>,
        color: NSColor,
        cfg: MacFlareSettings,
        whiteMix: Double = 0.0,
        starMix: Double = 0.0
    ) {
        for i in 0..<count {
            let angle = (Double(i) / Double(count)) * .pi * 2.0 + Double.random(in: -0.2...0.2)
            let speed = CGFloat.random(in: speedRange)
            let useWhite = Double.random(in: 0...1) < whiteMix
            let useStar = Double.random(in: 0...1) < starMix
            particles.append(Particle(
                x: point.x, y: point.y,
                vx: CGFloat(cos(angle)) * speed,
                vy: CGFloat(sin(angle)) * speed,
                size: CGFloat.random(in: 3.5...6.5) * CGFloat(cfg.intensity),
                alpha: 1.0,
                decay: 0.03 * CGFloat(max(0.4, cfg.animationSpeed)),
                color: useWhite ? .white : color,
                kind: useStar ? .star : .dot
            ))
        }
    }

    // MARK: Physics loop

    private func updatePhysics() {
        guard !particles.isEmpty || !rings.isEmpty else { return }
        let cfg = SettingsManager.shared.settings

        let ringStep = CGFloat(0.04) * CGFloat(max(0.4, cfg.animationSpeed))
        for i in (0..<rings.count).reversed() {
            rings[i].progress += ringStep
            if rings[i].progress >= 1.0 {
                rings.remove(at: i)
            }
        }

        let dissipation = CGFloat(cfg.fluidDissipation)
        for i in (0..<particles.count).reversed() {
            particles[i].alpha -= particles[i].decay
            if particles[i].alpha <= 0 {
                particles.remove(at: i)
                continue
            }

            if particles[i].curlRate != 0 {
                // Apply curl vector rotation (fluid presets & vortex flares)
                let curVx = particles[i].vx
                let curVy = particles[i].vy
                let curl = particles[i].spin * 0.05
                particles[i].vx = curVx * cos(curl) - curVy * sin(curl)
                particles[i].vy = curVx * sin(curl) + curVy * cos(curl)
                particles[i].vx *= dissipation
                particles[i].vy *= dissipation
            } else if !particles[i].constantVelocity {
                particles[i].vx *= 0.94
                particles[i].vy *= 0.94
            }

            particles[i].x += particles[i].vx
            particles[i].y += particles[i].vy
        }

        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard let context = NSGraphicsContext.current?.cgContext else { return }

        // Draw expanding rings
        for ring in rings where ring.progress >= 0 {
            let currentRadius = ring.maxRadius * sin(ring.progress * .pi * 0.5)
            let currentAlpha = max(0, ring.alpha * (1.0 - ring.progress))
            context.setStrokeColor(ring.color.withAlphaComponent(currentAlpha).cgColor)
            context.setLineWidth(ring.lineWidth * (1.0 - ring.progress * 0.5))
            context.strokeEllipse(in: CGRect(
                x: ring.center.x - currentRadius,
                y: ring.center.y - currentRadius,
                width: currentRadius * 2,
                height: currentRadius * 2
            ))
        }

        // Draw particles
        for p in particles {
            let color = p.color.withAlphaComponent(p.alpha)
            let rect = CGRect(x: p.x - p.size * 0.5, y: p.y - p.size * 0.5, width: p.size, height: p.size)
            switch p.kind {
            case .dot:
                context.setFillColor(color.cgColor)
                context.fillEllipse(in: rect)
            case .ring:
                context.setStrokeColor(color.cgColor)
                context.setLineWidth(1.4)
                context.strokeEllipse(in: rect)
            case .star:
                // 4-point star as a thin plus shape
                context.setStrokeColor(color.cgColor)
                context.setLineWidth(1.6)
                context.beginPath()
                context.move(to: CGPoint(x: p.x - p.size * 0.7, y: p.y))
                context.addLine(to: CGPoint(x: p.x + p.size * 0.7, y: p.y))
                context.move(to: CGPoint(x: p.x, y: p.y - p.size * 0.7))
                context.addLine(to: CGPoint(x: p.x, y: p.y + p.size * 0.7))
                context.strokePath()
            case .glyph:
                // Matrix code character
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: NSFont.monospacedSystemFont(ofSize: p.size, weight: .bold),
                    .foregroundColor: color
                ]
                let glyphString = NSAttributedString(string: p.glyph, attributes: attrs)
                let glyphSize = glyphString.size()
                glyphString.draw(at: CGPoint(x: p.x - glyphSize.width * 0.5, y: p.y - glyphSize.height * 0.5))
            }
        }
    }

    deinit {
        displayTimer?.invalidate()
    }
}
