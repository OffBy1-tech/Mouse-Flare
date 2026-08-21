using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Mouseflare.Core
{
    /// <summary>
    /// In-app auto-updater (docs/auto-update-spec.md §6, §8), mirroring the
    /// macOS Updater.swift: follows GitHub's releases/latest (published stable
    /// only), downloads zip + minisign signature, verifies against the embedded
    /// key, stages, and swaps via the rename-a-running-exe dance on restart.
    ///
    /// Deliberately WPF-free so the check/verify/stage pipeline is testable on
    /// any platform; only InstallAndRestart is Windows-specific.
    /// </summary>
    public sealed class Updater
    {
        public enum UpdatePhase { Idle, Available, Downloading, Ready, Error }

        public sealed class ReleaseInfo
        {
            public string Version = "";
            public string Title = "";
            public string Notes = "";
            public string ZipUrl = "";
            public string SigUrl = "";
            public string PageUrl = "";
            public DateTime? PublishedAt;  // GitHub published_at
            public string[] Changelog = Array.Empty<string>(); // bullet lines from the release body
        }

        public static readonly Updater Shared = new();

        public UpdatePhase Phase { get; private set; } = UpdatePhase.Idle;
        public ReleaseInfo? AvailableRelease { get; private set; }
        public string? StagedDirectory { get; private set; }
        public string? ErrorMessage { get; private set; }

        /// <summary>Raised (on a thread-pool thread) whenever Phase changes.</summary>
        public event Action? PhaseChanged;

        /// <summary>Gate for background checks; wire to the persisted setting.</summary>
        public Func<bool> AutoCheckEnabled = () => true;

        /// <summary>Background check cadence in hours (0 = manual only); wire to the persisted setting.</summary>
        public Func<int> CheckIntervalHours = () => 6;

        /// <summary>UTC time of the last completed feed fetch (survives restarts via settings.json).</summary>
        public DateTime? LastCheckedUtc { get; private set; }

        /// <summary>Newest stable release seen on the feed — populated even when up to date.</summary>
        public ReleaseInfo? LatestSeenRelease { get; private set; }

        /// <summary>Restores the persisted last-check time at startup (never overwrites a live one).</summary>
        public void SeedLastChecked(DateTime? utc)
        {
            if (LastCheckedUtc == null) LastCheckedUtc = utc;
        }

        public readonly string CurrentVersion;
        public bool IsDevBuild => CurrentVersion == "0.0.0";

        private readonly Uri _feedUrl;
        private readonly HttpClient _http;
        private Timer? _checkTimer;

        private Updater()
        {
            var custom = Environment.GetEnvironmentVariable("MOUSEFLARE_UPDATE_FEED");
            _feedUrl = Uri.TryCreate(custom, UriKind.Absolute, out var uri)
                ? uri
                : new Uri("https://api.github.com/repos/OffBy1-tech/Mouse-Flare/releases/latest");

            _http = new HttpClient();
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("Mouseflare-Updater"); // required by the GitHub API
            _http.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");

            var informational = Assembly.GetExecutingAssembly()
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "0.0.0";
            CurrentVersion = informational.Split('+')[0];
        }

        // ---- Background polling ----

        public void StartBackgroundChecks()
        {
            if (IsDevBuild) return;
            // A fast tick with an interval gate, so cadence changes apply
            // without rescheduling the timer. 0 hours = manual checks only.
            _checkTimer = new Timer(
                _ =>
                {
                    int hours = CheckIntervalHours();
                    if (hours <= 0 || !AutoCheckEnabled()) return;
                    if (LastCheckedUtc is { } last && DateTime.UtcNow - last < TimeSpan.FromHours(hours)) return;
                    _ = CheckSilently();
                },
                null,
                TimeSpan.FromSeconds(30),
                TimeSpan.FromMinutes(30)
            );
        }

        private async Task CheckSilently()
        {
            try { await CheckAsync(); } catch { /* background checks never nag */ }
        }

        // ---- Check ----

        /// <summary>
        /// Fetches the feed. Returns the differing release, or null when up to
        /// date. Always records LastCheckedUtc and LatestSeenRelease; updates
        /// Phase but never downgrades an in-flight/staged update.
        /// </summary>
        public async Task<ReleaseInfo?> CheckAsync()
        {
            ReleaseInfo release;
            using (var doc = JsonDocument.Parse(await _http.GetStringAsync(_feedUrl)))
            {
                release = ParseRelease(doc.RootElement);
            }

            LatestSeenRelease = release;
            LastCheckedUtc = DateTime.UtcNow;

            if (IsDevBuild || release.Version == CurrentVersion)
            {
                if (Phase is UpdatePhase.Available or UpdatePhase.Error)
                {
                    SetPhase(UpdatePhase.Idle, release: null);
                }
                return null;
            }

            if (release.ZipUrl.Length == 0 || release.SigUrl.Length == 0)
            {
                throw new InvalidOperationException("The latest release has no Windows artifacts.");
            }

            if (Phase is not (UpdatePhase.Downloading or UpdatePhase.Ready))
            {
                SetPhase(UpdatePhase.Available, release);
            }
            return release;
        }

        private static ReleaseInfo ParseRelease(JsonElement root)
        {
            string tag = root.GetProperty("tag_name").GetString() ?? "";
            string version = tag.StartsWith("v") ? tag.Substring(1) : tag;

            string? zipUrl = null, sigUrl = null;
            if (root.TryGetProperty("assets", out var assets))
            {
                foreach (var asset in assets.EnumerateArray())
                {
                    string name = asset.GetProperty("name").GetString() ?? "";
                    string url = asset.GetProperty("browser_download_url").GetString() ?? "";
                    if (name == "Mouseflare-Windows.zip") zipUrl = url;
                    if (name == "Mouseflare-Windows.zip.minisig") sigUrl = url;
                }
            }

            string notes = root.TryGetProperty("body", out var b) ? b.GetString() ?? "" : "";
            DateTime? published = root.TryGetProperty("published_at", out var pub)
                && pub.ValueKind == JsonValueKind.String
                && DateTime.TryParse(pub.GetString(), null, System.Globalization.DateTimeStyles.AdjustToUniversal, out var when)
                ? when : null;

            return new ReleaseInfo
            {
                Version = version,
                Title = root.TryGetProperty("name", out var n) ? n.GetString() ?? $"Mouseflare v{version}" : $"Mouseflare v{version}",
                Notes = notes,
                ZipUrl = zipUrl ?? "",
                SigUrl = sigUrl ?? "",
                PageUrl = root.GetProperty("html_url").GetString() ?? "",
                PublishedAt = published,
                Changelog = ParseChangelog(notes),
            };
        }

        /// <summary>Bullet lines ("- ", "* ", "• ") from the release body, markers stripped.</summary>
        private static string[] ParseChangelog(string body) =>
            body.Split('\n')
                .Select(line => line.Trim())
                .Where(line => line.StartsWith("- ") || line.StartsWith("* ") || line.StartsWith("• "))
                .Select(line => line.Substring(2).Trim().Trim('*').Trim())
                .Where(line => line.Length > 0)
                .Take(8)
                .ToArray();

        // ---- Download, verify & stage ----

        public async Task DownloadAndStageAsync(ReleaseInfo release)
        {
            SetPhase(UpdatePhase.Downloading, release);
            try
            {
                byte[] zip = await _http.GetByteArrayAsync(release.ZipUrl);
                string sig = await _http.GetStringAsync(release.SigUrl);

                // The security boundary: verify before unpacking anything
                MinisignVerifier.Verify(zip, sig);

                string staging = Path.Combine(InstallDirectory, "update-staging");
                if (Directory.Exists(staging)) Directory.Delete(staging, recursive: true);
                Directory.CreateDirectory(staging);

                using (var archive = new ZipArchive(new MemoryStream(zip)))
                {
                    archive.ExtractToDirectory(staging);
                }
                if (!File.Exists(Path.Combine(staging, "Mouseflare.exe")))
                {
                    throw new InvalidOperationException("The downloaded update is missing Mouseflare.exe.");
                }

                StagedDirectory = staging;
                SetPhase(UpdatePhase.Ready, release);
            }
            catch (Exception ex)
            {
                ErrorMessage = ex.Message;
                SetPhase(UpdatePhase.Error, release: null);
            }
        }

        // ---- Install (Windows rename dance) ----

        public static string InstallDirectory => AppContext.BaseDirectory;

        public bool CanSelfInstall
        {
            get
            {
                try
                {
                    string probe = Path.Combine(InstallDirectory, ".mf-write-probe");
                    File.WriteAllText(probe, "");
                    File.Delete(probe);
                    return true;
                }
                catch { return false; }
            }
        }

        /// <summary>
        /// Swaps the staged files into place, starts the new exe, and returns
        /// so the caller can shut this instance down. Never overwrites a file
        /// in place: every existing destination is renamed to .old first — a
        /// rename succeeds even for the running exe and (usually) for files the
        /// runtime has memory-mapped, where an overwrite would throw "in use by
        /// another process" (seen in the field with a lazily-loaded .pdb).
        /// Non-essential files that still cannot be replaced are skipped;
        /// anything else rolls the whole swap back.
        /// </summary>
        public void InstallAndRestart(string stagedDirectory)
        {
            string exePath = Environment.ProcessPath
                ?? throw new InvalidOperationException("Cannot locate the running executable.");
            var renamed = new System.Collections.Generic.List<(string Original, string Old)>();

            static bool IsNonEssential(string path) =>
                Path.GetExtension(path).Equals(".pdb", StringComparison.OrdinalIgnoreCase);

            try
            {
                foreach (string source in Directory.EnumerateFiles(stagedDirectory, "*", SearchOption.AllDirectories))
                {
                    string relative = Path.GetRelativePath(stagedDirectory, source);
                    string destination = Path.Combine(InstallDirectory, relative);
                    Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                    try
                    {
                        if (File.Exists(destination))
                        {
                            string old = destination + ".old";
                            if (File.Exists(old)) File.Delete(old);
                            File.Move(destination, old);
                            renamed.Add((destination, old));
                        }
                        File.Copy(source, destination);
                    }
                    catch when (IsNonEssential(destination))
                    {
                        // e.g. a .pdb the runtime holds without delete-sharing:
                        // stale debug symbols beat a failed update
                    }
                }
            }
            catch
            {
                // Roll back so the current install keeps working
                foreach (var (original, old) in renamed)
                {
                    try { if (File.Exists(original)) File.Delete(original); } catch { }
                    try { if (!File.Exists(original)) File.Move(old, original); } catch { }
                }
                throw;
            }
            try { Directory.Delete(stagedDirectory, recursive: true); } catch { }

            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = exePath,
                UseShellExecute = true,
                WorkingDirectory = InstallDirectory,
            });
        }

        /// <summary>Startup housekeeping: remove leftovers from the previous swap.</summary>
        public static void CleanupAfterUpdate()
        {
            try
            {
                foreach (string old in Directory.EnumerateFiles(InstallDirectory, "*.old", SearchOption.AllDirectories))
                {
                    try { File.Delete(old); } catch { /* may still be releasing; next launch gets it */ }
                }
                string staging = Path.Combine(InstallDirectory, "update-staging");
                if (Directory.Exists(staging)) Directory.Delete(staging, recursive: true);
            }
            catch { }
        }

        private void SetPhase(UpdatePhase phase, ReleaseInfo? release)
        {
            Phase = phase;
            AvailableRelease = release ?? (phase == UpdatePhase.Idle ? null : AvailableRelease);
            if (phase != UpdatePhase.Error) ErrorMessage = null;
            if (phase != UpdatePhase.Ready) StagedDirectory = phase == UpdatePhase.Downloading ? StagedDirectory : null;
            PhaseChanged?.Invoke();
        }
    }
}
