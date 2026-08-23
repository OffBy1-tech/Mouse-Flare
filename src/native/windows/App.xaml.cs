using System;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using Mouseflare.Core;
using Mouseflare.UI;
using Mouseflare.Tray;

namespace Mouseflare
{
    public partial class App : Application
    {
        private const string DefaultHotkey = "Ctrl + Shift + F";

        private MouseTracker? _mouseTracker;
        private HotkeyManager? _hotkeyManager;
        private TransparentOverlayWindow? _overlay;
        private TrayIconManager? _tray;
        private SettingsWindow? _settingsWindow;
        private string _currentHotkey = DefaultHotkey;

        private void Application_Startup(object sender, StartupEventArgs e)
        {
            // Crash evidence first, before anything that could throw:
            // %AppData%\Mouseflare\crash.log
            AppDomain.CurrentDomain.UnhandledException += (s, args) =>
                Core.CrashLog.Write("AppDomain (fatal)", args.ExceptionObject as Exception);
            DispatcherUnhandledException += (s, args) =>
                // Log and let it crash: swallowing a render-loop exception
                // would just re-throw every frame with the overlay wedged.
                Core.CrashLog.Write("Dispatcher", args.Exception);
            TaskScheduler.UnobservedTaskException += (s, args) =>
            {
                Core.CrashLog.Write("UnobservedTask", args.Exception);
                args.SetObserved();
            };
            Core.CrashLog.NoteStartup();

            ShutdownMode = ShutdownMode.OnExplicitShutdown;

            // Remove leftovers (*.old, update-staging) from a previous self-update
            Updater.CleanupAfterUpdate();

            // Snapshot settings when Windows logs off / shuts down
            SessionEnding += (s, args) => PersistCurrentSettings();

            // 1. Create transparent click-through overlay spanning all screens,
            //    restoring any persisted settings before it renders
            _overlay = new TransparentOverlayWindow();
            MouseflareSettings? saved = SettingsStore.Load();
            if (saved != null)
            {
                ApplySettingsToOverlay(saved, _overlay);
                _currentHotkey = saved.Hotkey;
            }
            _overlay.Show();

            // 2. Obtain window handle for hotkey registration
            var helper = new WindowInteropHelper(_overlay);
            IntPtr hwnd = helper.EnsureHandle();

            // 3. Initialize low-level mouse tracker (WH_MOUSE_LL)
            _mouseTracker = new MouseTracker();
            _mouseTracker.MouseMoved += (x, y) =>
            {
                Dispatcher.InvokeAsync(() =>
                {
                    _overlay?.OnCursorMoved(x, y);
                });
            };

            // 4. Register the global hotkey (persisted combo, falling back to the default)
            if (!HotkeyManager.TryParseCombo(_currentHotkey, out KeyModifiers mods, out uint vk))
            {
                _currentHotkey = DefaultHotkey;
                HotkeyManager.TryParseCombo(_currentHotkey, out mods, out vk);
            }
            _hotkeyManager = new HotkeyManager(hwnd, mods, vk);
            _hotkeyManager.HotkeyPressed += () =>
            {
                Dispatcher.InvokeAsync(() =>
                {
                    _overlay?.TriggerFindMouse();
                });
            };

            // 5. System tray icon
            _tray = new TrayIconManager(_overlay.IsFxEnabled);
            _tray.UpdateHotkey(_currentHotkey);
            _tray.FindMouseRequested += () =>
            {
                Dispatcher.InvokeAsync(() =>
                {
                    _overlay?.TriggerFindMouse();
                });
            };
            _tray.OpenSettingsRequested += ShowSettings;
            _tray.CheckUpdatesRequested += CheckForUpdatesManually;
            _tray.EnabledToggled += (enabled) =>
            {
                if (_overlay != null) _overlay.IsFxEnabled = enabled;
                PersistCurrentSettings();
            };
            _tray.ExitRequested += () =>
            {
                PersistCurrentSettings();
                _mouseTracker?.Dispose();
                _hotkeyManager?.Dispose();
                _tray?.Dispose();
                _overlay?.Close();
                _settingsWindow?.Close();
                Shutdown();
            };

            // 6. Auto-updater: quiet interval-driven background checks, tray-driven install
            Updater.Shared.AutoCheckEnabled = () => _overlay?.AutoCheckUpdates ?? true;
            Updater.Shared.CheckIntervalHours = () => _overlay?.CheckIntervalHours ?? 6;
            Updater.Shared.PhaseChanged += () => Dispatcher.InvokeAsync(RefreshUpdaterTrayItem);
            Updater.Shared.StartBackgroundChecks();

            // Headless pipeline exercise for testing (`Mouseflare --self-update-test`,
            // no console in a WPF app, so progress lands in update-test.log)
            if (e.Args.Contains("--self-update-test"))
            {
                _ = RunSelfUpdateTest();
            }
        }

        // ---- Updates ----

        private void RefreshUpdaterTrayItem()
        {
            var updater = Updater.Shared;
            switch (updater.Phase)
            {
                case Updater.UpdatePhase.Available:
                    _tray?.SetUpdateAction($"⬆ Update to v{updater.AvailableRelease?.Version}...", () => Dispatcher.InvokeAsync(StartUpdateDownload));
                    break;
                case Updater.UpdatePhase.Downloading:
                    _tray?.SetUpdateAction($"Downloading v{updater.AvailableRelease?.Version}...", null, enabled: false);
                    break;
                case Updater.UpdatePhase.Ready:
                    _tray?.SetUpdateAction($"🔁 Restart to Update to v{updater.AvailableRelease?.Version}", () => Dispatcher.InvokeAsync(InstallStagedUpdate));
                    break;
                default:
                    _tray?.SetUpdateAction(null, null);
                    break;
            }
        }

        private async void CheckForUpdatesManually()
        {
            var updater = Updater.Shared;
            if (updater.IsDevBuild)
            {
                MessageBox.Show(
                    "This is an unversioned dev build — auto-update follows stable releases only. Download builds from GitHub Releases.",
                    "Development Build", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            try
            {
                var release = await updater.CheckAsync();
                if (release == null)
                {
                    MessageBox.Show(
                        $"Mouseflare v{updater.CurrentVersion} is the latest stable release.",
                        "You're up to date", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }
                var choice = MessageBox.Show(
                    $"Mouseflare v{release.Version} is available (you are running v{updater.CurrentVersion}).\n\n" +
                    "The update is downloaded from GitHub Releases and verified with the project's signing key before installing.\n\n" +
                    "Install now?",
                    "Update Available", MessageBoxButton.YesNo, MessageBoxImage.Information);
                if (choice == MessageBoxResult.Yes)
                {
                    StartUpdateDownload();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Update check failed", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private async void StartUpdateDownload()
        {
            var updater = Updater.Shared;
            if (updater.Phase == Updater.UpdatePhase.Ready) { InstallStagedUpdate(); return; }
            if (updater.AvailableRelease is not { } release) return;

            await updater.DownloadAndStageAsync(release);
            if (updater.Phase == Updater.UpdatePhase.Ready)
            {
                var choice = MessageBox.Show(
                    $"The update to v{release.Version} was verified and staged. Restart Mouseflare now to finish installing?",
                    "Ready to update", MessageBoxButton.YesNo, MessageBoxImage.Question);
                if (choice == MessageBoxResult.Yes)
                {
                    InstallStagedUpdate();
                }
            }
            else if (updater.Phase == Updater.UpdatePhase.Error)
            {
                MessageBox.Show(updater.ErrorMessage ?? "Unknown error", "Update failed", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        /// <summary>
        /// Settings-window entry into the tray's download → verify → stage →
        /// restart path. StartUpdateDownload already forwards to
        /// InstallStagedUpdate when a staged update is waiting.
        /// </summary>
        internal void RequestUpdateInstall() => Dispatcher.InvokeAsync(StartUpdateDownload);

        private void InstallStagedUpdate()
        {
            var updater = Updater.Shared;
            if (updater.Phase != Updater.UpdatePhase.Ready || updater.StagedDirectory is not { } staged) return;
            if (!updater.CanSelfInstall)
            {
                MessageBox.Show(
                    "Mouseflare cannot update itself from this location (the folder is not writable). Download the update manually from GitHub Releases.",
                    "Cannot install update", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            try
            {
                PersistCurrentSettings(); // survive the update restart with current settings
                updater.InstallAndRestart(staged);
                _mouseTracker?.Dispose();
                _hotkeyManager?.Dispose();
                _tray?.Dispose();
                _overlay?.Close();
                _settingsWindow?.Close();
                Shutdown();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Could not install update", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        /// <summary>Headless run of the whole pipeline; the M4 acceptance-test hook.</summary>
        private async Task RunSelfUpdateTest()
        {
            string log = System.IO.Path.Combine(Updater.InstallDirectory, "update-test.log");
            void Log(string line) => System.IO.File.AppendAllText(log, $"{DateTime.Now:HH:mm:ss} {line}\n");
            try
            {
                var updater = Updater.Shared;
                Log($"current version: {updater.CurrentVersion}, canSelfInstall: {updater.CanSelfInstall}");
                var release = await updater.CheckAsync();
                if (release == null) { Log("up to date — nothing to do"); Shutdown(); return; }
                Log($"available: v{release.Version}");
                await updater.DownloadAndStageAsync(release);
                if (updater.Phase != Updater.UpdatePhase.Ready)
                {
                    Log($"ERROR: {updater.ErrorMessage ?? "unexpected phase"}");
                    Shutdown(1);
                    return;
                }
                Log($"verified & staged: {updater.StagedDirectory}");
                PersistCurrentSettings();
                updater.InstallAndRestart(updater.StagedDirectory!);
                Log("swap complete — relaunching new version");
                Shutdown();
            }
            catch (Exception ex)
            {
                Log($"ERROR: {ex.Message}");
                Shutdown(1);
            }
        }

        private void ShowSettings()
        {
            Dispatcher.Invoke(() =>
            {
                try
                {
                    if (_settingsWindow == null || !_settingsWindow.IsLoaded)
                    {
                        _settingsWindow = new SettingsWindow(_overlay, _hotkeyManager, _currentHotkey);
                        _settingsWindow.HotkeyChanged += (combo) => { _currentHotkey = combo; _tray?.UpdateHotkey(combo); };
                        _settingsWindow.Closed += (s, e) =>
                        {
                            // Instant-domain settings were saved as they changed, and
                            // the window reverts unapplied FX drafts in OnClosing —
                            // nothing left to persist here
                            _settingsWindow = null;
                        };
                        _settingsWindow.Show();
                    }
                    else
                    {
                        _settingsWindow.Activate();
                    }
                }
                catch (Exception ex)
                {
                    // Keep the tray app alive rather than surfacing the WinForms
                    // unhandled-exception dialog
                    MessageBox.Show(ex.ToString(), "Could not open Settings", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            });
        }

        /// <summary>Snapshots the live overlay state to settings.json.</summary>
        private void PersistCurrentSettings()
        {
            if (_overlay == null) return;
            // While Settings is open, FX Studio / FX Designer changes are an
            // unapplied draft — persist the committed FX state instead so a tray
            // toggle, logoff, or update install can't accidentally save a preview
            var settings = _settingsWindow != null && _settingsWindow.IsLoaded
                ? _settingsWindow.ComposeSettingsForPersist()
                : _overlay.ToSettings(_currentHotkey);
            SettingsStore.Save(settings);
        }

        private static void ApplySettingsToOverlay(MouseflareSettings s, TransparentOverlayWindow overlay)
        {
            overlay.IsFxEnabled = s.IsFxEnabled;
            overlay.EnablePassiveFx = s.EnablePassiveFx;
            overlay.PassiveFxStyle = s.PassiveFxStyle;
            overlay.FlareFxStyle = s.FlareFxStyle;
            overlay.IntensityMultiplier = s.IntensityMultiplier;
            overlay.SparkDensityMultiplier = s.SparkDensityMultiplier;
            overlay.AnimationSpeedMultiplier = s.AnimationSpeedMultiplier;
            overlay.TrailLengthMultiplier = s.TrailLengthMultiplier;
            overlay.MinMovementThreshold = s.MinMovementThreshold;
            overlay.IdleBurstEnabled = s.IdleBurstEnabled;
            overlay.MonitorCrossingFxEnabled = s.MonitorCrossingFxEnabled;
            overlay.SoundFxEnabled = s.SoundFxEnabled;
            overlay.AutoCheckUpdates = s.AutoCheckUpdates;
            overlay.CheckIntervalHours = s.CheckIntervalHours;
            Updater.Shared.SeedLastChecked(s.LastCheckedUtc);
            if (s.QuickSwatches is { Length: > 0 })
            {
                // Older installs saved fewer swatches; pad with the new defaults
                var defaults = TransparentOverlayWindow.DefaultQuickSwatches;
                overlay.QuickSwatches = s.QuickSwatches.Length >= defaults.Length
                    ? s.QuickSwatches
                    : s.QuickSwatches.Concat(defaults.Skip(s.QuickSwatches.Length)).ToArray();
            }
            overlay.FluidVorticity = s.FluidVorticity;
            overlay.FluidDissipation = s.FluidDissipation;
            overlay.CustomFxJson = s.CustomFxJson;
            overlay.FluidBloom = s.FluidBloom;
            overlay.FluidRainbowDye = s.FluidRainbowDye;
            overlay.CustomFxPresets = s.CustomFxPresets ?? Array.Empty<string>();
            overlay.StartWithWindows = s.StartWithWindows;
            // Re-assert while enabled so the Run entry tracks the current exe path
            if (s.StartWithWindows) StartupRegistration.Apply(true);
            overlay.CurrentColor = ParseHexColor(s.CurrentColorHex, Color.FromRgb(245, 158, 11));
            overlay.SecondaryColor = ParseHexColor(s.SecondaryColorHex, Color.FromRgb(251, 191, 36));
        }

        internal static Color ParseHexColor(string hex, Color fallback)
        {
            try
            {
                if (ColorConverter.ConvertFromString(hex) is Color c) return c;
            }
            catch { }
            return fallback;
        }
    }
}
