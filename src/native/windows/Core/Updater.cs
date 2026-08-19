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

        public readonly string CurrentVersion;
        public bool IsDevBuild => CurrentVersion == "0.0.0";

        private readonly Uri _feedUrl;
        private readonly HttpClient _http;
        private Timer? _checkTimer;
        private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(6);

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
            _checkTimer = new Timer(
                _ => { if (AutoCheckEnabled()) _ = CheckSilently(); },
                null,
                TimeSpan.FromSeconds(30),
                CheckInterval
            );
        }

        private async Task CheckSilently()
        {
            try { await CheckAsync(); } catch { /* background checks never nag */ }
        }

        // ---- Check ----

        /// <summary>
        /// Fetches the feed. Returns the differing release, or null when up to
        /// date. Updates Phase but never downgrades an in-flight/staged update.
        /// </summary>
        public async Task<ReleaseInfo?> CheckAsync()
        {
            using var doc = JsonDocument.Parse(await _http.GetStringAsync(_feedUrl));
            var root = doc.RootElement;

            string tag = root.GetProperty("tag_name").GetString() ?? "";
            string version = tag.StartsWith("v") ? tag.Substring(1) : tag;

            if (IsDevBuild || version == CurrentVersion)
            {
                if (Phase is UpdatePhase.Available or UpdatePhase.Error)
                {
                    SetPhase(UpdatePhase.Idle, release: null);
                }
                return null;
            }

            string? zipUrl = null, sigUrl = null;
            foreach (var asset in root.GetProperty("assets").EnumerateArray())
            {
                string name = asset.GetProperty("name").GetString() ?? "";
                string url = asset.GetProperty("browser_download_url").GetString() ?? "";
                if (name == "Mouseflare-Windows.zip") zipUrl = url;
                if (name == "Mouseflare-Windows.zip.minisig") sigUrl = url;
            }
            if (zipUrl == null || sigUrl == null)
            {
                throw new InvalidOperationException("The latest release has no Windows artifacts.");
            }

            var release = new ReleaseInfo
            {
                Version = version,
                Title = root.TryGetProperty("name", out var n) ? n.GetString() ?? $"Mouseflare v{version}" : $"Mouseflare v{version}",
                Notes = root.TryGetProperty("body", out var b) ? b.GetString() ?? "" : "",
                ZipUrl = zipUrl,
                SigUrl = sigUrl,
                PageUrl = root.GetProperty("html_url").GetString() ?? "",
            };

            if (Phase is not (UpdatePhase.Downloading or UpdatePhase.Ready))
            {
                SetPhase(UpdatePhase.Available, release);
            }
            return release;
        }

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
        /// Swaps the staged files into place (a running exe can be renamed on
        /// Windows, not overwritten), starts the new exe, and returns so the
        /// caller can shut this instance down. Restores on partial failure.
        /// </summary>
        public void InstallAndRestart(string stagedDirectory)
        {
            string exePath = Environment.ProcessPath
                ?? throw new InvalidOperationException("Cannot locate the running executable.");
            string oldPath = exePath + ".old";

            if (File.Exists(oldPath)) File.Delete(oldPath);
            File.Move(exePath, oldPath);
            try
            {
                foreach (string source in Directory.EnumerateFiles(stagedDirectory, "*", SearchOption.AllDirectories))
                {
                    string relative = Path.GetRelativePath(stagedDirectory, source);
                    string destination = Path.Combine(InstallDirectory, relative);
                    Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                    File.Copy(source, destination, overwrite: true);
                }
            }
            catch
            {
                try { if (!File.Exists(exePath)) File.Move(oldPath, exePath); } catch { }
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
                foreach (string old in Directory.EnumerateFiles(InstallDirectory, "*.old"))
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
