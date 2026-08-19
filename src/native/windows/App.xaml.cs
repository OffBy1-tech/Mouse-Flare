using System;
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
            ShutdownMode = ShutdownMode.OnExplicitShutdown;

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
            _tray.FindMouseRequested += () =>
            {
                Dispatcher.InvokeAsync(() =>
                {
                    _overlay?.TriggerFindMouse();
                });
            };
            _tray.OpenSettingsRequested += ShowSettings;
            _tray.EnabledToggled += (enabled) =>
            {
                if (_overlay != null) _overlay.IsFxEnabled = enabled;
            };
            _tray.ExitRequested += () =>
            {
                _mouseTracker?.Dispose();
                _hotkeyManager?.Dispose();
                _tray?.Dispose();
                _overlay?.Close();
                _settingsWindow?.Close();
                Shutdown();
            };
        }

        private void ShowSettings()
        {
            Dispatcher.Invoke(() =>
            {
                if (_settingsWindow == null || !_settingsWindow.IsLoaded)
                {
                    _settingsWindow = new SettingsWindow(_overlay, _hotkeyManager, _currentHotkey);
                    _settingsWindow.HotkeyChanged += (combo) => _currentHotkey = combo;
                    _settingsWindow.Closed += (s, e) => _settingsWindow = null;
                    _settingsWindow.Show();
                }
                else
                {
                    _settingsWindow.Activate();
                }
            });
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
            overlay.ShakeToFindEnabled = s.ShakeToFindEnabled;
            overlay.ReducedMotion = s.ReducedMotion;
            overlay.SoundFxEnabled = s.SoundFxEnabled;
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
