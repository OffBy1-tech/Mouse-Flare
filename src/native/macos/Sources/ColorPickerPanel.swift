import Cocoa

// MARK: - HSV model

struct HSVColor {
    var hue: CGFloat        // 0..360
    var saturation: CGFloat // 0..1
    var brightness: CGFloat // 0..1

    var nsColor: NSColor {
        NSColor(hue: hue / 360, saturation: saturation, brightness: brightness, alpha: 1)
    }

    var hex: String { nsColor.hexString }

    static func from(_ color: NSColor) -> HSVColor {
        let rgb = color.usingColorSpace(.deviceRGB) ?? .white
        return HSVColor(
            hue: rgb.hueComponent * 360,
            saturation: rgb.saturationComponent,
            brightness: rgb.brightnessComponent
        )
    }
}

// MARK: - Wheel (hue ring + saturation/brightness disc)

final class ColorWheelView: NSView {
    var color = HSVColor(hue: 40, saturation: 0.96, brightness: 0.96) {
        didSet { needsDisplay = true }
    }
    var onChange: ((HSVColor) -> Void)?

    private enum DragMode { case none, hue, disc }
    private var dragMode: DragMode = .none

    private let ringWidth: CGFloat = 26
    private var outerRadius: CGFloat { min(bounds.width, bounds.height) / 2 - 4 }
    private var innerRadius: CGFloat { outerRadius - ringWidth }
    private var discRadius: CGFloat { innerRadius - 12 }
    private var center: CGPoint { CGPoint(x: bounds.midX, y: bounds.midY) }

    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }

        // Hue ring: 1° stroked segments
        let midRadius = (outerRadius + innerRadius) / 2
        ctx.setLineWidth(ringWidth)
        for degree in 0..<360 {
            let start = CGFloat(degree - 1) * .pi / 180
            let end = CGFloat(degree + 1) * .pi / 180
            ctx.setStrokeColor(NSColor(hue: CGFloat(degree) / 360, saturation: 1, brightness: 1, alpha: 1).cgColor)
            ctx.beginPath()
            ctx.addArc(center: center, radius: midRadius, startAngle: start, endAngle: end, clockwise: false)
            ctx.strokePath()
        }

        // Saturation/brightness disc for the current hue:
        // x -> saturation (0..1), y -> brightness (bottom 0 .. top 1)
        let discRect = CGRect(
            x: center.x - discRadius, y: center.y - discRadius,
            width: discRadius * 2, height: discRadius * 2
        )
        ctx.saveGState()
        ctx.addEllipse(in: discRect)
        ctx.clip()
        let hueColor = NSColor(hue: color.hue / 360, saturation: 1, brightness: 1, alpha: 1)
        let satColors = [NSColor.white.cgColor, hueColor.cgColor] as CFArray
        if let satGradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: satColors, locations: [0, 1]) {
            ctx.drawLinearGradient(
                satGradient,
                start: CGPoint(x: discRect.minX, y: discRect.midY),
                end: CGPoint(x: discRect.maxX, y: discRect.midY),
                options: []
            )
        }
        let darkColors = [NSColor.black.withAlphaComponent(0).cgColor, NSColor.black.cgColor] as CFArray
        if let darkGradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: darkColors, locations: [0, 1]) {
            ctx.drawLinearGradient(
                darkGradient,
                start: CGPoint(x: discRect.midX, y: discRect.maxY),
                end: CGPoint(x: discRect.midX, y: discRect.minY),
                options: []
            )
        }
        ctx.restoreGState()

        // Handles
        drawHandle(ctx, at: huePosition(), fill: NSColor(hue: color.hue / 360, saturation: 1, brightness: 1, alpha: 1), radius: 13)
        drawHandle(ctx, at: discPosition(), fill: color.nsColor, radius: 11)
    }

    private func drawHandle(_ ctx: CGContext, at point: CGPoint, fill: NSColor, radius: CGFloat) {
        let rect = CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)
        ctx.setShadow(offset: CGSize(width: 0, height: -1), blur: 4, color: NSColor.black.withAlphaComponent(0.5).cgColor)
        ctx.setFillColor(fill.cgColor)
        ctx.fillEllipse(in: rect)
        ctx.setShadow(offset: .zero, blur: 0, color: nil)
        ctx.setStrokeColor(NSColor.white.cgColor)
        ctx.setLineWidth(3)
        ctx.strokeEllipse(in: rect.insetBy(dx: 1.5, dy: 1.5))
    }

    private func huePosition() -> CGPoint {
        let radians = color.hue * .pi / 180
        let midRadius = (outerRadius + innerRadius) / 2
        return CGPoint(x: center.x + cos(radians) * midRadius, y: center.y + sin(radians) * midRadius)
    }

    private func discPosition() -> CGPoint {
        let x = center.x - discRadius + color.saturation * discRadius * 2
        let y = center.y - discRadius + color.brightness * discRadius * 2
        // Clamp visually inside the disc
        let dx = x - center.x, dy = y - center.y
        let dist = hypot(dx, dy)
        if dist <= discRadius { return CGPoint(x: x, y: y) }
        return CGPoint(x: center.x + dx / dist * discRadius, y: center.y + dy / dist * discRadius)
    }

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let dist = hypot(point.x - center.x, point.y - center.y)
        if dist <= discRadius + 6 {
            dragMode = .disc
        } else if dist >= innerRadius - 6 && dist <= outerRadius + 8 {
            dragMode = .hue
        } else {
            dragMode = .none
            return
        }
        apply(point)
    }

    override func mouseDragged(with event: NSEvent) {
        guard dragMode != .none else { return }
        apply(convert(event.locationInWindow, from: nil))
    }

    override func mouseUp(with event: NSEvent) {
        dragMode = .none
    }

    private func apply(_ point: CGPoint) {
        switch dragMode {
        case .hue:
            var degrees = atan2(point.y - center.y, point.x - center.x) * 180 / .pi
            if degrees < 0 { degrees += 360 }
            color.hue = degrees
        case .disc:
            let s = ((point.x - (center.x - discRadius)) / (discRadius * 2)).clamped01
            let v = ((point.y - (center.y - discRadius)) / (discRadius * 2)).clamped01
            color.saturation = s
            color.brightness = v
        case .none:
            return
        }
        onChange?(color)
    }
}

private extension CGFloat {
    var clamped01: CGFloat { Swift.max(0, Swift.min(1, self)) }
}

// MARK: - Arc preview

final class ColorArcView: NSView {
    var color: NSColor = .systemOrange { didSet { needsDisplay = true } }

    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }
        let center = CGPoint(x: bounds.midX, y: bounds.maxY + 26)
        let radius = bounds.height + 34
        ctx.setStrokeColor(color.cgColor)
        ctx.setLineWidth(16)
        ctx.setLineCap(.round)
        ctx.beginPath()
        ctx.addArc(center: center, radius: radius, startAngle: .pi * 1.22, endAngle: .pi * 1.78, clockwise: false)
        ctx.strokePath()
    }
}

// MARK: - Panel

/// Popup color picker (reference: mobile-style hue ring + SV disc) used to edit
/// the custom color and the quick swatches in the FX Studio.
final class ColorPickerPanel: NSPanel, NSTextFieldDelegate {
    private let wheel = ColorWheelView()
    private let arc = ColorArcView()
    private var hexField: NSTextField!
    private var newCircle: NSView!
    private let initialColor: NSColor
    private var swatchButtons: [CardButton] = []

    private let onLive: (String) -> Void
    private let onDone: (String) -> Void
    private let onCancel: () -> Void
    private var finished = false

    init(
        initial: NSColor,
        title: String,
        swatches: [String],
        onLive: @escaping (String) -> Void,
        onDone: @escaping (String) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.initialColor = initial
        self.onLive = onLive
        self.onDone = onDone
        self.onCancel = onCancel
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 336, height: 520),
            styleMask: [.titled, .closable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        self.title = title
        titleVisibility = .hidden
        titlebarAppearsTransparent = true
        appearance = NSAppearance(named: .darkAqua)
        backgroundColor = Theme.windowBg
        isReleasedWhenClosed = false
        level = .modalPanel
        buildUI(title: title, swatches: swatches)
        wheel.color = HSVColor.from(initial)
        refreshDerived()
    }

    override var canBecomeKey: Bool { true }

    private func buildUI(title: String, swatches: [String]) {
        guard let content = contentView else { return }
        content.wantsLayer = true
        content.layer?.backgroundColor = Theme.windowBg.cgColor

        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = .systemFont(ofSize: 13, weight: .bold)
        titleLabel.textColor = Theme.textPrimary

        // Eyedropper: native macOS screen sampler
        let sampler = NSButton(
            image: NSImage(systemSymbolName: "eyedropper", accessibilityDescription: "Pick from screen")!,
            target: self,
            action: #selector(pickFromScreen)
        )
        sampler.bezelStyle = .circular

        // Old / new color circles
        let oldCircle = circleView(color: initialColor)
        newCircle = circleView(color: initialColor)
        let oldNew = NSStackView(views: [oldCircle, newCircle])
        oldNew.orientation = .horizontal
        oldNew.spacing = -6 // slight overlap, like the reference

        let topRow = NSStackView(views: [titleLabel, NSView(), sampler, oldNew])
        topRow.orientation = .horizontal
        topRow.spacing = 10
        topRow.alignment = .centerY

        wheel.onChange = { [weak self] _ in self?.refreshDerived(fromWheel: true) }

        hexField = NSTextField(string: "#FFAA00")
        hexField.font = .monospacedSystemFont(ofSize: 12, weight: .semibold)
        hexField.alignment = .center
        hexField.backgroundColor = Theme.cardBg
        hexField.textColor = Theme.textPrimary
        hexField.delegate = self

        // Quick swatches: click to load that color into the picker
        let swatchLabel = NSTextField(labelWithString: "Quick Swatches")
        swatchLabel.font = .systemFont(ofSize: 10, weight: .bold)
        swatchLabel.textColor = Theme.textFaint
        let swatchRow = NSStackView()
        swatchRow.orientation = .horizontal
        swatchRow.spacing = 8
        for hex in swatches {
            let swatch = CardButton()
            swatch.layer?.cornerRadius = 14
            swatch.setStyle(background: NSColor(hexString: hex), border: NSColor.white.withAlphaComponent(0.25), borderWidth: 1)
            swatch.translatesAutoresizingMaskIntoConstraints = false
            swatch.widthAnchor.constraint(equalToConstant: 28).isActive = true
            swatch.heightAnchor.constraint(equalToConstant: 28).isActive = true
            swatch.onClick = { [weak self] in
                guard let self else { return }
                self.wheel.color = HSVColor.from(NSColor(hexString: hex))
                self.refreshDerived(fromWheel: true)
            }
            swatchButtons.append(swatch)
            swatchRow.addArrangedSubview(swatch)
        }

        let doneButton = NSButton(title: "Done", target: self, action: #selector(confirm))
        doneButton.bezelStyle = .rounded
        doneButton.keyEquivalent = "\r"
        let cancelButton = NSButton(title: "Cancel", target: self, action: #selector(cancelPick))
        cancelButton.bezelStyle = .rounded
        cancelButton.keyEquivalent = "\u{1b}"
        let buttonRow = NSStackView(views: [cancelButton, NSView(), doneButton])
        buttonRow.orientation = .horizontal

        let stack = NSStackView(views: [topRow, wheel, arc, hexField, swatchLabel, swatchRow, buttonRow])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 12
        stack.setCustomSpacing(4, after: wheel)
        stack.setCustomSpacing(6, after: swatchLabel)
        stack.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: content.topAnchor, constant: 34),
            stack.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -24),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: content.bottomAnchor, constant: -20),
            topRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            wheel.widthAnchor.constraint(equalTo: stack.widthAnchor),
            wheel.heightAnchor.constraint(equalTo: wheel.widthAnchor),
            arc.widthAnchor.constraint(equalTo: stack.widthAnchor),
            arc.heightAnchor.constraint(equalToConstant: 44),
            hexField.widthAnchor.constraint(equalTo: stack.widthAnchor),
            buttonRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])
    }

    private func circleView(color: NSColor) -> NSView {
        let view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = color.cgColor
        view.layer?.cornerRadius = 12
        view.layer?.borderColor = NSColor.white.withAlphaComponent(0.85).cgColor
        view.layer?.borderWidth = 2
        view.translatesAutoresizingMaskIntoConstraints = false
        view.widthAnchor.constraint(equalToConstant: 24).isActive = true
        view.heightAnchor.constraint(equalToConstant: 24).isActive = true
        return view
    }

    private func refreshDerived(fromWheel: Bool = false) {
        let color = wheel.color.nsColor
        arc.color = color
        newCircle.layer?.backgroundColor = color.cgColor
        hexField.stringValue = color.hexString
        if fromWheel {
            onLive(color.hexString)
        }
    }

    // Hex typing: apply on Enter
    func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        if commandSelector == #selector(NSResponder.insertNewline(_:)) {
            var hex = hexField.stringValue.trimmingCharacters(in: .whitespaces)
            if !hex.hasPrefix("#") { hex = "#" + hex }
            let stripped = String(hex.dropFirst())
            if stripped.count == 6, stripped.allSatisfy({ $0.isHexDigit }) {
                wheel.color = HSVColor.from(NSColor(hexString: hex))
                refreshDerived(fromWheel: true)
            }
            return true
        }
        return false
    }

    @objc private func pickFromScreen() {
        NSColorSampler().show { [weak self] picked in
            guard let self, let picked else { return }
            self.wheel.color = HSVColor.from(picked)
            self.refreshDerived(fromWheel: true)
        }
    }

    @objc private func confirm() {
        finished = true
        onDone(wheel.color.hex)
        close()
    }

    @objc private func cancelPick() {
        finished = true
        onCancel()
        close()
    }

    override func close() {
        if !finished {
            finished = true
            onCancel() // window-close X behaves like Cancel
        }
        super.close()
    }
}
