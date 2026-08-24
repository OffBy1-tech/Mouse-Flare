import Cocoa

/// Sidebar/button icons, embedded as SVG source rather than bundled files.
///
/// These deliberately do NOT go through `Bundle.module`: the accessor SwiftPM
/// generates fatalErrors when the resource bundle is missing, which crashed the
/// packaged .app the moment the settings window was built (the same trap the
/// AppLogo loader documents). Embedding the markup removes the lookup entirely,
/// so the icons work in every packaging arrangement.
///
/// Markup is lucide (https://lucide.dev), matching the web build's icon set:
/// flame, sparkles, sliders-vertical, activity, refresh-cw, trash-2.
enum NavIcons {
    private static func svg(_ body: String, _ stroke: String) -> String {
        """
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" \
        fill="none" stroke="\(stroke)" stroke-width="2" stroke-linecap="round" \
        stroke-linejoin="round">\(body)</svg>
        """
    }

    private static let slidersBody = """
    <path d="M10 8h4"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M17 16h4"/>\
    <path d="M19 12V3"/><path d="M19 21v-5"/><path d="M3 14h4"/><path d="M5 10V3"/>\
    <path d="M5 21v-7"/>
    """

    private static let markup: [String: String] = [
        "nav-general": svg(
            #"<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>"#,
            "#FBBF24"
        ),
        "nav-fx-studio": svg(
            #"<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>"#,
            "#22D3EE"
        ),
        "nav-fx-designer": svg(slidersBody, "#FBBF24"),
        "nav-behavior": svg(slidersBody, "#34D399"),
        "nav-diagnostics": svg(
            #"<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>"#,
            "#A78BFA"
        ),
        "nav-updates": svg(
            #"<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>"#,
            "#FBBF24"
        ),
        "trash": svg(
            #"<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>"#,
            "#F87171"
        ),
    ]

    /// Rendered icon, or nil when the name is unknown or the SVG fails to
    /// decode — callers fall back to emoji/text rather than trapping.
    static func image(_ name: String) -> NSImage? {
        guard let source = markup[name], let data = source.data(using: .utf8) else { return nil }
        return NSImage(data: data)
    }
}
