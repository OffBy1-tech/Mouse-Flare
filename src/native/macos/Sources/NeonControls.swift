import Cocoa

// MARK: - Neon form controls
//
// Custom AppKit counterparts of the Windows NeonControls.xaml templates, so
// stock system chrome (aqua sliders, system-accent switches, native popup
// buttons) doesn't break the neon theme. Each control mimics the API surface
// of the stock control it replaces, so call sites swap by type name only.

// MARK: Slider

/// NSSlider with a custom cell: dark thin track, gradient fill up to the
/// knob, glowing round knob. Interaction and accessibility stay stock.
final class NeonSlider: NSSlider {
    enum Accent {
        case violet
        case cyan

        var fill: [NSColor] {
            switch self {
            case .violet: return [Theme.neonBlue, Theme.neonViolet]
            case .cyan: return [Theme.cyan, Theme.neonBlue]
            }
        }

        var glow: NSColor {
            switch self {
            case .violet: return Theme.neonViolet
            case .cyan: return Theme.cyan
            }
        }
    }

    override class var cellClass: AnyClass? {
        get { NeonSliderCell.self }
        set { _ = newValue }
    }

    var accent: Accent {
        get { (cell as? NeonSliderCell)?.accent ?? .violet }
        set {
            (cell as? NeonSliderCell)?.accent = newValue
            needsDisplay = true
        }
    }
}

final class NeonSliderCell: NSSliderCell {
    var accent: NeonSlider.Accent = .violet

    override func drawBar(inside rect: NSRect, flipped: Bool) {
        let track = NSRect(x: rect.minX, y: rect.midY - 2, width: rect.width, height: 4)
        let path = NSBezierPath(roundedRect: track, xRadius: 2, yRadius: 2)
        Theme.controlBg.setFill()
        path.fill()

        let knob = knobRect(flipped: flipped)
        let fillWidth = max(0, knob.midX - track.minX)
        guard fillWidth > 1 else { return }
        let fillRect = NSRect(x: track.minX, y: track.minY, width: fillWidth, height: track.height)
        NSGraphicsContext.current?.saveGraphicsState()
        NSBezierPath(roundedRect: fillRect, xRadius: 2, yRadius: 2).addClip()
        NSGradient(colors: accent.fill)?.draw(in: fillRect, angle: 0)
        NSGraphicsContext.current?.restoreGraphicsState()
    }

    override func drawKnob(_ knobRect: NSRect) {
        let diameter: CGFloat = 14
        let circle = NSRect(
            x: knobRect.midX - diameter / 2,
            y: knobRect.midY - diameter / 2,
            width: diameter,
            height: diameter
        )
        NSGraphicsContext.current?.saveGraphicsState()
        let shadow = NSShadow()
        shadow.shadowColor = accent.glow.withAlphaComponent(0.6)
        shadow.shadowBlurRadius = 5
        shadow.shadowOffset = .zero
        shadow.set()
        let path = NSBezierPath(ovalIn: circle)
        NSGradient(colors: accent.fill)?.draw(in: path, angle: 90)
        NSGraphicsContext.current?.restoreGraphicsState()
        NSColor.white.withAlphaComponent(0.85).setStroke()
        let ring = NSBezierPath(ovalIn: circle.insetBy(dx: 0.5, dy: 0.5))
        ring.lineWidth = 1
        ring.stroke()
    }
}

// MARK: Switch

/// Drop-in replacement for NSSwitch: same `state` / target-action semantics,
/// drawn as a dark track that fills blue→violet with a soft glow when on.
final class NeonSwitch: NSControl {
    private let trackLayer = CALayer()
    private let fillLayer = CAGradientLayer()
    private let knobLayer = CALayer()
    private static let size = NSSize(width: 42, height: 22)

    var state: NSControl.StateValue = .off {
        didSet { updateAppearance(animated: true) }
    }

    init() {
        super.init(frame: NSRect(origin: .zero, size: Self.size))
        wantsLayer = true
        focusRingType = .exterior

        trackLayer.cornerRadius = Self.size.height / 2
        trackLayer.backgroundColor = Theme.controlBg.cgColor
        layer?.addSublayer(trackLayer)

        fillLayer.cornerRadius = Self.size.height / 2
        fillLayer.colors = [Theme.neonBlue.cgColor, Theme.neonViolet.cgColor]
        fillLayer.startPoint = CGPoint(x: 0, y: 0.5)
        fillLayer.endPoint = CGPoint(x: 1, y: 0.5)
        fillLayer.opacity = 0
        layer?.addSublayer(fillLayer)

        knobLayer.backgroundColor = NSColor.white.cgColor
        knobLayer.cornerRadius = 9
        knobLayer.shadowColor = NSColor.black.cgColor
        knobLayer.shadowOpacity = 0.35
        knobLayer.shadowRadius = 2
        knobLayer.shadowOffset = CGSize(width: 0, height: -1)
        layer?.addSublayer(knobLayer)

        updateAppearance(animated: false)
    }

    required init?(coder: NSCoder) { fatalError() }

    override var intrinsicContentSize: NSSize { Self.size }
    override var acceptsFirstResponder: Bool { isEnabled }

    override func layout() {
        super.layout()
        updateAppearance(animated: false)
    }

    private func updateAppearance(animated: Bool) {
        let on = state == .on
        let reduceMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        CATransaction.begin()
        CATransaction.setAnimationDuration(animated && !reduceMotion ? 0.18 : 0)
        let trackRect = CGRect(origin: .zero, size: Self.size)
        trackLayer.frame = trackRect
        fillLayer.frame = trackRect
        fillLayer.opacity = on ? 1 : 0
        let knobX: CGFloat = on ? Self.size.width - 20 : 2
        knobLayer.frame = CGRect(x: knobX, y: 2, width: 18, height: 18)
        layer?.masksToBounds = false
        layer?.shadowColor = Theme.neonViolet.cgColor
        layer?.shadowOpacity = on ? 0.55 : 0
        layer?.shadowRadius = 6
        layer?.shadowOffset = .zero
        alphaValue = isEnabled ? 1 : 0.5
        CATransaction.commit()
    }

    private func toggle() {
        guard isEnabled else { return }
        state = state == .on ? .off : .on
        if let action { sendAction(action, to: target) }
    }

    override func mouseDown(with event: NSEvent) {
        toggle()
    }

    override func keyDown(with event: NSEvent) {
        if event.charactersIgnoringModifiers == " " || event.keyCode == 36 {
            toggle()
        } else {
            super.keyDown(with: event)
        }
    }

    override func drawFocusRingMask() {
        NSBezierPath(
            roundedRect: bounds,
            xRadius: Self.size.height / 2,
            yRadius: Self.size.height / 2
        ).fill()
    }

    override var focusRingMaskBounds: NSRect { bounds }

    override func resetCursorRects() {
        addCursorRect(bounds, cursor: .pointingHand)
    }

    // Accessibility: behaves as a switch/checkbox for VoiceOver.
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .checkBox }
    override func accessibilityValue() -> Any? { state == .on ? 1 : 0 }
    override func accessibilityPerformPress() -> Bool {
        toggle()
        return true
    }
}

// MARK: Popup

/// Drop-in replacement for NSPopUpButton (the subset of its API this app
/// uses): a dark rounded field with a chevron, opening a floating neon-card
/// panel of options — hover wash, gradient pill for the selected item.
final class NeonPopUp: NSControl {
    private(set) var itemTitles: [String] = []
    private var selectedIndex: Int = -1
    private var isOpen = false { didSet { needsDisplay = true } }
    private var isHovered = false { didSet { needsDisplay = true } }

    private var panel: NSPanel?
    private var rowViews: [PopupRowView] = []
    private var highlightedIndex: Int = -1
    private var clickMonitor: Any?
    private var keyMonitor: Any?

    private static let fieldHeight: CGFloat = 24

    init() {
        super.init(frame: .zero)
        let tracking = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(tracking)
    }

    required init?(coder: NSCoder) { fatalError() }

    deinit {
        // deinit can run off-main during teardown; monitors are removed on
        // every close(), so only the panel reference needs clearing here.
        panel = nil
    }

    // MARK: NSPopUpButton-compatible API

    func addItems(withTitles titles: [String]) {
        itemTitles.append(contentsOf: titles)
        if selectedIndex == -1 && !itemTitles.isEmpty { selectedIndex = 0 }
        invalidateIntrinsicContentSize()
        needsDisplay = true
    }

    func removeAllItems() {
        itemTitles.removeAll()
        selectedIndex = -1
        invalidateIntrinsicContentSize()
        needsDisplay = true
    }

    var indexOfSelectedItem: Int { selectedIndex }

    func selectItem(at index: Int) {
        guard index >= -1 && index < itemTitles.count else { return }
        selectedIndex = index
        needsDisplay = true
    }

    // MARK: Field drawing

    private var drawFont: NSFont { font ?? .systemFont(ofSize: 11) }

    override var intrinsicContentSize: NSSize {
        let attrs: [NSAttributedString.Key: Any] = [.font: drawFont]
        let widest = itemTitles.map { ($0 as NSString).size(withAttributes: attrs).width }.max() ?? 40
        return NSSize(width: ceil(widest) + 34, height: Self.fieldHeight)
    }

    override var acceptsFirstResponder: Bool { isEnabled }

    override func draw(_ dirtyRect: NSRect) {
        let field = bounds
        let path = NSBezierPath(roundedRect: field.insetBy(dx: 0.5, dy: 0.5), xRadius: 6, yRadius: 6)
        Theme.windowBg.setFill()
        path.fill()
        let borderAlpha: CGFloat = isOpen ? 0.9 : (isHovered ? 0.6 : 0.35)
        Theme.neonViolet.withAlphaComponent(borderAlpha).setStroke()
        path.lineWidth = 1
        path.stroke()

        let title = selectedIndex >= 0 && selectedIndex < itemTitles.count ? itemTitles[selectedIndex] : ""
        let attrs: [NSAttributedString.Key: Any] = [.font: drawFont, .foregroundColor: Theme.textPrimary]
        let titleSize = (title as NSString).size(withAttributes: attrs)
        let titleRect = NSRect(
            x: field.minX + 9,
            y: field.midY - titleSize.height / 2,
            width: max(0, field.width - 30),
            height: titleSize.height
        )
        (title as NSString).draw(
            with: titleRect,
            options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine],
            attributes: attrs
        )

        // Chevron, pointing up while open
        let chevron = NSBezierPath()
        let cx = field.maxX - 14
        let cy = field.midY
        if isOpen {
            chevron.move(to: NSPoint(x: cx - 3.5, y: cy - 2))
            chevron.line(to: NSPoint(x: cx, y: cy + 2))
            chevron.line(to: NSPoint(x: cx + 3.5, y: cy - 2))
        } else {
            chevron.move(to: NSPoint(x: cx - 3.5, y: cy + 2))
            chevron.line(to: NSPoint(x: cx, y: cy - 2))
            chevron.line(to: NSPoint(x: cx + 3.5, y: cy + 2))
        }
        chevron.lineWidth = 1.5
        chevron.lineCapStyle = .round
        chevron.lineJoinStyle = .round
        Theme.neonViolet.setStroke()
        chevron.stroke()

        alphaValue = isEnabled ? 1 : 0.5
    }

    override func mouseEntered(with event: NSEvent) { isHovered = true }
    override func mouseExited(with event: NSEvent) { isHovered = false }

    override func mouseDown(with event: NSEvent) {
        guard isEnabled else { return }
        isOpen ? close() : open()
    }

    override func keyDown(with event: NSEvent) {
        guard isEnabled else { return super.keyDown(with: event) }
        if event.charactersIgnoringModifiers == " " || event.keyCode == 36 {
            isOpen ? close() : open()
        } else {
            super.keyDown(with: event)
        }
    }

    override func drawFocusRingMask() {
        NSBezierPath(roundedRect: bounds, xRadius: 6, yRadius: 6).fill()
    }

    override var focusRingMaskBounds: NSRect { bounds }

    override func resetCursorRects() {
        addCursorRect(bounds, cursor: .pointingHand)
    }

    // Accessibility: reads as a pop-up button holding the current selection.
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .popUpButton }
    override func accessibilityValue() -> Any? {
        selectedIndex >= 0 && selectedIndex < itemTitles.count ? itemTitles[selectedIndex] : ""
    }
    override func accessibilityPerformPress() -> Bool {
        isOpen ? close() : open()
        return true
    }

    // MARK: Dropdown panel

    private static let rowHeight: CGFloat = 24
    private static let maxVisibleRows = 8
    private static let glowInset: CGFloat = 14

    private func open() {
        guard !isOpen, !itemTitles.isEmpty, let parentWindow = window else { return }

        highlightedIndex = selectedIndex
        rowViews = itemTitles.enumerated().map { index, title in
            let row = PopupRowView(title: title, font: drawFont, isSelected: index == selectedIndex)
            row.onClick = { [weak self] in self?.commit(index) }
            row.onHover = { [weak self] in self?.highlight(index) }
            return row
        }

        let listStack = NSStackView(views: rowViews)
        listStack.orientation = .vertical
        listStack.alignment = .leading
        listStack.spacing = 2
        listStack.edgeInsets = NSEdgeInsets(top: 5, left: 5, bottom: 5, right: 5)
        listStack.translatesAutoresizingMaskIntoConstraints = false

        let fieldWidth = max(bounds.width, intrinsicContentSize.width)
        let contentWidth = fieldWidth
        let rowsShown = min(itemTitles.count, Self.maxVisibleRows)
        let listHeight = CGFloat(rowsShown) * (Self.rowHeight + 2) + 8

        let card = NSView()
        card.wantsLayer = true
        card.layer?.backgroundColor = Theme.insetBg.cgColor
        card.layer?.borderColor = Theme.neonViolet.withAlphaComponent(0.55).cgColor
        card.layer?.borderWidth = 1
        card.layer?.cornerRadius = 10
        card.layer?.masksToBounds = false
        card.layer?.shadowColor = Theme.neonViolet.cgColor
        card.layer?.shadowOpacity = 0.4
        card.layer?.shadowRadius = 10
        card.layer?.shadowOffset = .zero
        card.translatesAutoresizingMaskIntoConstraints = false

        if itemTitles.count > Self.maxVisibleRows {
            let scroll = NSScrollView()
            scroll.drawsBackground = false
            scroll.hasVerticalScroller = true
            scroll.verticalScroller?.controlSize = .mini
            scroll.translatesAutoresizingMaskIntoConstraints = false
            let flipped = FlippedView()
            flipped.translatesAutoresizingMaskIntoConstraints = false
            flipped.addSubview(listStack)
            NSLayoutConstraint.activate([
                listStack.topAnchor.constraint(equalTo: flipped.topAnchor),
                listStack.leadingAnchor.constraint(equalTo: flipped.leadingAnchor),
                listStack.trailingAnchor.constraint(equalTo: flipped.trailingAnchor),
                listStack.bottomAnchor.constraint(equalTo: flipped.bottomAnchor),
                flipped.widthAnchor.constraint(equalToConstant: contentWidth),
            ])
            scroll.documentView = flipped
            card.addSubview(scroll)
            NSLayoutConstraint.activate([
                scroll.topAnchor.constraint(equalTo: card.topAnchor),
                scroll.leadingAnchor.constraint(equalTo: card.leadingAnchor),
                scroll.trailingAnchor.constraint(equalTo: card.trailingAnchor),
                scroll.bottomAnchor.constraint(equalTo: card.bottomAnchor),
            ])
        } else {
            card.addSubview(listStack)
            NSLayoutConstraint.activate([
                listStack.topAnchor.constraint(equalTo: card.topAnchor),
                listStack.leadingAnchor.constraint(equalTo: card.leadingAnchor),
                listStack.trailingAnchor.constraint(equalTo: card.trailingAnchor),
                listStack.bottomAnchor.constraint(equalTo: card.bottomAnchor),
            ])
        }
        for row in rowViews {
            row.widthAnchor.constraint(equalToConstant: contentWidth - 10).isActive = true
        }

        // Container padded so the glow shadow isn't clipped at the panel edge.
        let container = NSView()
        container.wantsLayer = true
        container.addSubview(card)
        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: container.topAnchor, constant: Self.glowInset),
            card.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: Self.glowInset),
            card.widthAnchor.constraint(equalToConstant: contentWidth),
            card.heightAnchor.constraint(equalToConstant: listHeight),
        ])

        let panelSize = NSSize(
            width: contentWidth + Self.glowInset * 2,
            height: listHeight + Self.glowInset * 2
        )
        let dropdown = NSPanel(
            contentRect: NSRect(origin: .zero, size: panelSize),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: true
        )
        dropdown.isOpaque = false
        dropdown.backgroundColor = .clear
        dropdown.hasShadow = false
        dropdown.level = .popUpMenu
        dropdown.contentView = container

        // Anchor below the field (above it when the screen runs out).
        let fieldInWindow = convert(bounds, to: nil)
        let fieldOnScreen = parentWindow.convertToScreen(fieldInWindow)
        var origin = NSPoint(
            x: fieldOnScreen.minX - Self.glowInset,
            y: fieldOnScreen.minY - panelSize.height + Self.glowInset - 2
        )
        if let screen = parentWindow.screen, origin.y < screen.visibleFrame.minY {
            origin.y = fieldOnScreen.maxY - Self.glowInset + 2
        }
        dropdown.setFrameOrigin(origin)

        parentWindow.addChildWindow(dropdown, ordered: .above)
        panel = dropdown
        isOpen = true
        highlight(highlightedIndex)

        clickMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] event in
            guard let self else { return event }
            if event.window != self.panel {
                // A click on the field itself toggles in mouseDown; anything
                // else outside just dismisses.
                self.close()
            }
            return event
        }
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self, self.isOpen else { return event }
            switch event.keyCode {
            case 125: // down
                self.highlight(min(self.highlightedIndex + 1, self.itemTitles.count - 1))
                return nil
            case 126: // up
                self.highlight(max(self.highlightedIndex - 1, 0))
                return nil
            case 36, 76: // return / keypad enter
                if self.highlightedIndex >= 0 { self.commit(self.highlightedIndex) } else { self.close() }
                return nil
            case 53: // escape
                self.close()
                return nil
            default:
                return event
            }
        }
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(parentResignedKey),
            name: NSWindow.didResignKeyNotification,
            object: parentWindow
        )
    }

    @objc private func parentResignedKey() {
        close()
    }

    private func highlight(_ index: Int) {
        guard index >= -1 && index < rowViews.count else { return }
        highlightedIndex = index
        for (i, row) in rowViews.enumerated() {
            row.setHighlighted(i == index)
        }
        if index >= 0, let scroll = rowViews[index].enclosingScrollView {
            rowViews[index].scrollToVisible(rowViews[index].bounds)
            _ = scroll
        }
    }

    private func commit(_ index: Int) {
        selectedIndex = index
        close()
        needsDisplay = true
        if let action { sendAction(action, to: target) }
    }

    private func close() {
        guard isOpen else { return }
        if let clickMonitor { NSEvent.removeMonitor(clickMonitor) }
        if let keyMonitor { NSEvent.removeMonitor(keyMonitor) }
        clickMonitor = nil
        keyMonitor = nil
        NotificationCenter.default.removeObserver(self, name: NSWindow.didResignKeyNotification, object: nil)
        if let panel {
            panel.parent?.removeChildWindow(panel)
            panel.orderOut(nil)
        }
        panel = nil
        rowViews = []
        isOpen = false
    }
}

/// One option row inside a NeonPopUp dropdown: quiet by default, violet wash
/// on hover/keyboard highlight, gradient pill when it is the selected item.
private final class PopupRowView: NSView {
    var onClick: (() -> Void)?
    var onHover: (() -> Void)?

    private let isSelected: Bool
    private let gradientLayer = CAGradientLayer()

    init(title: String, font: NSFont, isSelected: Bool) {
        self.isSelected = isSelected
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 6
        translatesAutoresizingMaskIntoConstraints = false
        heightAnchor.constraint(equalToConstant: 24).isActive = true

        if isSelected {
            gradientLayer.colors = [
                Theme.neonBlue.withAlphaComponent(0.78).cgColor,
                Theme.neonViolet.withAlphaComponent(0.7).cgColor,
            ]
            gradientLayer.startPoint = CGPoint(x: 0, y: 0.5)
            gradientLayer.endPoint = CGPoint(x: 1, y: 0.5)
            gradientLayer.cornerRadius = 6
            layer?.addSublayer(gradientLayer)
            layer?.borderColor = NSColor(hexString: "#BEA0FF").withAlphaComponent(0.9).cgColor
            layer?.borderWidth = 1
        }

        let label = NSTextField(labelWithString: title)
        label.font = font
        label.textColor = isSelected ? .white : Theme.textPrimary
        label.lineBreakMode = .byTruncatingTail
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            label.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -8),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])

        let tracking = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(tracking)
    }

    required init?(coder: NSCoder) { fatalError() }

    override func layout() {
        super.layout()
        gradientLayer.frame = bounds
    }

    func setHighlighted(_ highlighted: Bool) {
        guard !isSelected else { return }
        layer?.backgroundColor = highlighted
            ? Theme.neonViolet.withAlphaComponent(0.18).cgColor
            : NSColor.clear.cgColor
    }

    override func mouseEntered(with event: NSEvent) { onHover?() }
    override func mouseDown(with event: NSEvent) { onClick?() }

    override func resetCursorRects() {
        addCursorRect(bounds, cursor: .pointingHand)
    }
}
