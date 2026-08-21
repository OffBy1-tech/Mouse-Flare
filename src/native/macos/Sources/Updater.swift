import Cocoa

/// In-app auto-updater (docs/auto-update-spec.md §6-7).
///
/// Follows GitHub's `releases/latest` (published stable releases only),
/// downloads the macOS zip + its minisign signature, verifies against the
/// embedded public key, stages the new .app, and swaps it on user-approved
/// relaunch. Background checks are silent and respect the persisted cadence;
/// manual checks always answer.
final class Updater {
    /// Metadata every fetched release carries, even when it matches the
    /// installed version (so the Updates tab can render "Latest: vX (date)"
    /// and a changelog while up to date).
    struct ReleaseInfo {
        let version: String
        let title: String
        let notes: String
        let pageURL: URL
        let publishedAt: Date?

        /// Bullet lines ("- " / "* " / "• ") from the GitHub release body,
        /// lightly de-markdowned. Empty when the body has no list items.
        var changelogBullets: [String] {
            notes.split(whereSeparator: \.isNewline).compactMap { line in
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                for prefix in ["- ", "* ", "• "] where trimmed.hasPrefix(prefix) {
                    return String(trimmed.dropFirst(prefix.count))
                        .replacingOccurrences(of: "**", with: "")
                        .replacingOccurrences(of: "`", with: "")
                        .trimmingCharacters(in: .whitespaces)
                }
                return nil
            }
        }
    }

    struct Release {
        let info: ReleaseInfo
        let zipURL: URL
        let sigURL: URL

        var version: String { info.version }
        var title: String { info.title }
        var notes: String { info.notes }
        var pageURL: URL { info.pageURL }
    }

    enum Phase {
        case idle
        case available(Release)
        case downloading(Release)
        case ready(Release, stagedApp: URL)
        case error(String)
    }

    static let shared = Updater()
    static let phaseChangedNotification = Notification.Name("MouseflareUpdaterPhaseChanged")

    private(set) var phase: Phase = .idle {
        didSet { NotificationCenter.default.post(name: Updater.phaseChangedNotification, object: nil) }
    }

    private let feedURL: URL
    private var checkTimer: Timer?
    private var scheduledIntervalHours = -1
    private var settingsObserver: NSObjectProtocol?

    /// The newest release the feed reported on the last successful check —
    /// kept even when it matches the installed version, so the Updates tab
    /// can show "Latest: vX (date)" and a changelog while up to date.
    private(set) var latestInfo: ReleaseInfo?

    /// The running build's version. CI stamps stable tags (e.g. "0.1.0");
    /// dev builds carry "0.0.0" and never self-update.
    let currentVersion: String
    var isDevBuild: Bool { currentVersion == "0.0.0" }

    private init() {
        let custom = ProcessInfo.processInfo.environment["MOUSEFLARE_UPDATE_FEED"]
        feedURL = custom.flatMap(URL.init(string:))
            ?? URL(string: "https://api.github.com/repos/OffBy1-tech/Mouse-Flare/releases/latest")!
        currentVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }

    // MARK: Background polling

    func startBackgroundChecks() {
        guard !isDevBuild else { return }
        // First quiet check shortly after launch, then per the cadence setting
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in
            self?.backgroundCheck()
        }
        scheduleTimer()
        // Re-arm when the user changes the check-frequency setting
        settingsObserver = NotificationCenter.default.addObserver(
            forName: SettingsManager.didChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            self?.scheduleTimer()
        }
    }

    /// (Re)creates the polling timer to match the persisted cadence.
    /// Interval 0 means manual checks only.
    private func scheduleTimer() {
        let hours = SettingsManager.shared.settings.updateCheckIntervalHours
        guard hours != scheduledIntervalHours else { return }
        scheduledIntervalHours = hours
        checkTimer?.invalidate()
        checkTimer = nil
        guard hours > 0 else { return }
        let timer = Timer(timeInterval: TimeInterval(hours) * 3600, repeats: true) { [weak self] _ in
            self?.backgroundCheck()
        }
        RunLoop.main.add(timer, forMode: .common)
        checkTimer = timer
    }

    private func backgroundCheck() {
        let cfg = SettingsManager.shared.settings
        guard cfg.autoCheckUpdates, cfg.updateCheckIntervalHours > 0 else { return }
        Task { _ = try? await self.check() } // silent on every outcome
    }

    // MARK: Check

    private struct Asset: Decodable {
        let name: String
        let browser_download_url: String
    }
    private struct Feed: Decodable {
        let tag_name: String
        let name: String?
        let body: String?
        let html_url: String
        let assets: [Asset]
        let published_at: String?
    }

    /// Fetches the feed. Returns the newer release, or nil when up to date.
    /// Updates `phase` but never downgrades an in-flight or staged update.
    @discardableResult
    func check() async throws -> Release? {
        var request = URLRequest(url: feedURL)
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw UpdaterError.feedUnavailable
        }

        let feed = try JSONDecoder().decode(Feed.self, from: data)

        let version = feed.tag_name.hasPrefix("v") ? String(feed.tag_name.dropFirst()) : feed.tag_name
        guard let pageURL = URL(string: feed.html_url) else { throw UpdaterError.feedUnavailable }
        let info = ReleaseInfo(
            version: version,
            title: feed.name ?? "Mouseflare v\(version)",
            notes: feed.body ?? "",
            pageURL: pageURL,
            publishedAt: feed.published_at.flatMap { ISO8601DateFormatter().date(from: $0) }
        )
        await MainActor.run {
            self.latestInfo = info
            SettingsManager.shared.settings.lastUpdateCheck = Date()
        }

        guard version != currentVersion, !isDevBuild else {
            await MainActor.run {
                if case .available = self.phase { self.phase = .idle }
                if case .error = self.phase { self.phase = .idle }
            }
            return nil
        }

        guard
            let zip = feed.assets.first(where: { $0.name == "Mouseflare-macOS.zip" }),
            let sig = feed.assets.first(where: { $0.name == "Mouseflare-macOS.zip.minisig" }),
            let zipURL = URL(string: zip.browser_download_url),
            let sigURL = URL(string: sig.browser_download_url)
        else {
            throw UpdaterError.assetsMissing
        }

        let release = Release(info: info, zipURL: zipURL, sigURL: sigURL)
        await MainActor.run {
            switch self.phase {
            case .downloading, .ready:
                break // never downgrade an in-flight or staged update
            default:
                self.phase = .available(release)
            }
        }
        return release
    }

    // MARK: Download, verify & stage

    func downloadAndStage(_ release: Release) async {
        await MainActor.run { self.phase = .downloading(release) }
        do {
            let (zipData, zipResponse) = try await URLSession.shared.data(from: release.zipURL)
            let (sigData, sigResponse) = try await URLSession.shared.data(from: release.sigURL)
            guard (zipResponse as? HTTPURLResponse)?.statusCode == 200,
                  (sigResponse as? HTTPURLResponse)?.statusCode == 200,
                  let sigText = String(data: sigData, encoding: .utf8) else {
                throw UpdaterError.downloadFailed
            }

            // The security boundary: verify before touching the payload
            try Minisign.verify(data: zipData, signatureFile: sigText)

            // Stage on the same volume as the installed app so the final swap
            // is an atomic same-volume move.
            let bundleURL = Bundle.main.bundleURL
            let staging = try FileManager.default.url(
                for: .itemReplacementDirectory,
                in: .userDomainMask,
                appropriateFor: bundleURL,
                create: true
            )
            let zipPath = staging.appendingPathComponent("Mouseflare-macOS.zip")
            try zipData.write(to: zipPath)

            let unzip = Process()
            unzip.executableURL = URL(fileURLWithPath: "/usr/bin/ditto")
            unzip.arguments = ["-x", "-k", zipPath.path, staging.path]
            try unzip.run()
            unzip.waitUntilExit()
            guard unzip.terminationStatus == 0 else { throw UpdaterError.unpackFailed }

            let stagedApp = staging.appendingPathComponent("Mouseflare.app")
            let stagedBinary = stagedApp.appendingPathComponent("Contents/MacOS/Mouseflare")
            guard FileManager.default.fileExists(atPath: stagedBinary.path) else {
                throw UpdaterError.unpackFailed
            }

            await MainActor.run { self.phase = .ready(release, stagedApp: stagedApp) }
        } catch {
            await MainActor.run { self.phase = .error(error.localizedDescription) }
        }
    }

    // MARK: Install & relaunch

    /// Whether the running app can replace itself in place.
    var canSelfInstall: Bool {
        let bundleURL = Bundle.main.bundleURL
        guard bundleURL.pathExtension == "app" else { return false }
        guard !bundleURL.path.contains("/AppTranslocation/") else { return false }
        return FileManager.default.isWritableFile(atPath: bundleURL.deletingLastPathComponent().path)
    }

    /// Swaps the staged app into place and relaunches. Restores the previous
    /// version if the swap fails partway.
    func installAndRelaunch(stagedApp: URL) throws {
        let fm = FileManager.default
        let bundleURL = Bundle.main.bundleURL
        guard canSelfInstall else { throw UpdaterError.cannotSelfInstall }

        let backupDir = try fm.url(
            for: .itemReplacementDirectory,
            in: .userDomainMask,
            appropriateFor: bundleURL,
            create: true
        )
        let backup = backupDir.appendingPathComponent("Mouseflare-previous.app")

        try fm.moveItem(at: bundleURL, to: backup)
        do {
            try fm.moveItem(at: stagedApp, to: bundleURL)
        } catch {
            try? fm.moveItem(at: backup, to: bundleURL) // roll back
            throw error
        }
        try? fm.removeItem(at: backup)

        // Relaunch the new version after this process exits
        let relaunch = Process()
        relaunch.executableURL = URL(fileURLWithPath: "/bin/sh")
        relaunch.arguments = ["-c", "sleep 0.5; /usr/bin/open -n \"$0\"", bundleURL.path]
        try relaunch.run()

        DispatchQueue.main.async {
            NSApp.terminate(nil)
        }
    }

    enum UpdaterError: Error, LocalizedError {
        case feedUnavailable
        case assetsMissing
        case downloadFailed
        case unpackFailed
        case cannotSelfInstall

        var errorDescription: String? {
            switch self {
            case .feedUnavailable: return "The release feed could not be reached."
            case .assetsMissing: return "The latest release has no macOS artifacts."
            case .downloadFailed: return "The update could not be downloaded."
            case .unpackFailed: return "The downloaded update could not be unpacked."
            case .cannotSelfInstall: return "Mouseflare cannot update itself from this location — download the update manually."
            }
        }
    }
}
