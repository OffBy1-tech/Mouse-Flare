using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Mouseflare.UI;

namespace Mouseflare.UI
{
    public partial class SettingsWindow : Window
    {
        private static readonly HashSet<string> PassivePresets = new()
        {
            "spark-trail", "glow-pulse", "comet-trail", "bubbles", "fireflies", "star-dust", "lightning", "rainbow", "plasma",
            "fluid-simulation", "fluid-smoke", "neon-fluid", "cosmic-vortex", "ink-diffusion",
            "matrix-rain", "fire-flame", "neon-cyber", "magic-dust", "galaxy", "minimal-beacon"
        };

        private static readonly HashSet<string> FlarePresets = new()
        {
            "solar-flare", "sonar-radar", "neon-beacon", "quantum-shockwave", "supernova", "fluid-vortex-burst"
        };

        private static readonly HashSet<string> ColorPresets = new()
        {
            "color-amber", "color-cyan", "color-emerald", "color-violet", "color-gold", "color-white", "color-crimson", "color-custom"
        };

        private readonly TransparentOverlayWindow? _overlay;
        private readonly Core.HotkeyManager? _hotkeys;
        private string _activeTab = "fx-studio";
        private bool _isRecordingHotkey = false;
        private string _currentHotkey;

        /// <summary>Raised when the user successfully binds a new global hotkey combo.</summary>
        public event Action<string>? HotkeyChanged;

        public SettingsWindow(TransparentOverlayWindow? overlay, Core.HotkeyManager? hotkeys = null, string currentHotkey = "Ctrl + Shift + F")
        {
            _overlay = overlay;
            _hotkeys = hotkeys;
            _currentHotkey = currentHotkey;
            InitializeComponent();
            LoadCurrentSettings();
        }

        private void LoadCurrentSettings()
        {
            if (_overlay == null) return;

            chkEnabled.IsChecked = _overlay.IsFxEnabled;
            chkPassiveFx.IsChecked = _overlay.EnablePassiveFx;
            chkIdleBurst.IsChecked = _overlay.IdleBurstEnabled;
            chkMonitorCrossing.IsChecked = _overlay.MonitorCrossingFxEnabled;
            chkShakeToFind.IsChecked = _overlay.ShakeToFindEnabled;
            chkReducedMotion.IsChecked = _overlay.ReducedMotion;
            chkSoundFx.IsChecked = _overlay.SoundFxEnabled;

            sliderIntensity.Value = _overlay.IntensityMultiplier;
            sliderDensity.Value = _overlay.SparkDensityMultiplier * 5.0;
            sliderSpeed.Value = _overlay.AnimationSpeedMultiplier;
            sliderThreshold.Value = _overlay.MinMovementThreshold;

            txtIntensityVal.Text = string.Format("{0:0.0}x", _overlay.IntensityMultiplier);
            txtDensityVal.Text = string.Format("{0:0} / 10", _overlay.SparkDensityMultiplier * 5.0);
            txtSpeedVal.Text = string.Format("{0:0.0}x", _overlay.AnimationSpeedMultiplier);
            txtThresholdVal.Text = string.Format("{0:0} px", _overlay.MinMovementThreshold);

            btnHotkey.Content = _currentHotkey;

            // Highlight initial presets and color palettes
            RefreshActivePresetHighlights();

            UpdateTabSelection("fx-studio");
        }

        // Window Title Bar Controls (Frameless Modern Chrome)
        private void OnTitleBarMouseDown(object sender, MouseButtonEventArgs e)
        {
            if (e.LeftButton == MouseButtonState.Pressed)
            {
                DragMove();
            }
        }

        private void OnMinimizeWindow(object sender, RoutedEventArgs e)
        {
            WindowState = WindowState.Minimized;
        }

        private void OnCloseWindow(object sender, RoutedEventArgs e)
        {
            Close();
        }

        // Tab Navigation Handlers
        private void OnNavGeneral(object sender, RoutedEventArgs e) => UpdateTabSelection("general");
        private void OnNavFxStudio(object sender, RoutedEventArgs e) => UpdateTabSelection("fx-studio");
        private void OnNavBehavior(object sender, RoutedEventArgs e) => UpdateTabSelection("behavior");
        private void OnNavDiagnostics(object sender, RoutedEventArgs e) => UpdateTabSelection("diagnostics");

        private void UpdateTabSelection(string tab)
        {
            _activeTab = tab;

            tabGeneral.Visibility = tab == "general" ? Visibility.Visible : Visibility.Collapsed;
            tabFxStudio.Visibility = tab == "fx-studio" ? Visibility.Visible : Visibility.Collapsed;
            tabBehavior.Visibility = tab == "behavior" ? Visibility.Visible : Visibility.Collapsed;
            tabDiagnostics.Visibility = tab == "diagnostics" ? Visibility.Visible : Visibility.Collapsed;

            // Update sidebar nav button active states
            SetNavButtonState(btnNavGeneral, tab == "general");
            SetNavButtonState(btnNavFxStudio, tab == "fx-studio");
            SetNavButtonState(btnNavBehavior, tab == "behavior");
            SetNavButtonState(btnNavDiagnostics, tab == "diagnostics");
        }

        private void SetNavButtonState(Button btn, bool isActive)
        {
            if (btn == null) return;
            btn.Background = isActive ? new SolidColorBrush(Color.FromArgb(35, 245, 158, 11)) : Brushes.Transparent;
            btn.BorderBrush = isActive ? new SolidColorBrush(Color.FromArgb(80, 245, 158, 11)) : Brushes.Transparent;
            btn.BorderThickness = isActive ? new Thickness(1) : new Thickness(0);
        }

        // General Toggles
        private void OnMasterEnabledChanged(object sender, RoutedEventArgs e)
        {
            if (_overlay != null) _overlay.IsFxEnabled = chkEnabled.IsChecked == true;
        }

        private void OnPassiveFxChanged(object sender, RoutedEventArgs e)
        {
            if (_overlay != null) _overlay.EnablePassiveFx = chkPassiveFx.IsChecked == true;
        }

        private void OnIdleBurstChanged(object sender, RoutedEventArgs e)
        {
            if (_overlay != null) _overlay.IdleBurstEnabled = chkIdleBurst.IsChecked == true;
        }

        private void OnMonitorCrossingChanged(object sender, RoutedEventArgs e)
        {
            if (_overlay != null) _overlay.MonitorCrossingFxEnabled = chkMonitorCrossing.IsChecked == true;
        }

        private void OnShakeToFindChanged(object sender, RoutedEventArgs e)
        {
            if (_overlay != null) _overlay.ShakeToFindEnabled = chkShakeToFind.IsChecked == true;
        }

        private void OnReducedMotionChanged(object sender, RoutedEventArgs e)
        {
            if (_overlay != null) _overlay.ReducedMotion = chkReducedMotion.IsChecked == true;
        }

        private void OnSoundFxChanged(object sender, RoutedEventArgs e)
        {
            if (_overlay != null) _overlay.SoundFxEnabled = chkSoundFx.IsChecked == true;
        }

        // Passive Presets (9 Styles)
        private void OnSelectPassivePreset(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is string tag && _overlay != null)
            {
                _overlay.PassiveFxStyle = tag;
                HighlightPresetButton(btn, true);
                SetStatusText($"Selected Passive FX: {FormatPresetName(tag)} • Click Apply & Save");
            }
        }

        // Flare Presets (5 Styles)
        private void OnSelectFlarePreset(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is string tag && _overlay != null)
            {
                _overlay.FlareFxStyle = tag;
                HighlightPresetButton(btn, false);
                _overlay.TriggerFindMouse();
                SetStatusText($"Selected Flare: {FormatPresetName(tag)} (Previewing Flare) • Click Apply & Save");
            }
        }

        private static string FormatPresetName(string tag)
        {
            if (string.IsNullOrEmpty(tag)) return "";
            var words = tag.Replace("-", " ").Split(' ');
            for (int i = 0; i < words.Length; i++)
            {
                if (words[i].Length > 0)
                    words[i] = char.ToUpper(words[i][0]) + words[i].Substring(1);
            }
            return string.Join(" ", words);
        }

        private void RefreshActivePresetHighlights()
        {
            if (_overlay == null || tabFxStudio == null) return;
            foreach (var btn in FindVisualChildren<Button>(tabFxStudio))
            {
                if (btn.Tag is string tag)
                {
                    if (tag == _overlay.PassiveFxStyle)
                    {
                        btn.BorderBrush = new SolidColorBrush(Color.FromRgb(245, 158, 11));
                        btn.Background = new SolidColorBrush(Color.FromArgb(40, 245, 158, 11));
                        btn.BorderThickness = new Thickness(1.5);
                    }
                    else if (tag == _overlay.FlareFxStyle)
                    {
                        btn.BorderBrush = new SolidColorBrush(Color.FromRgb(6, 182, 212));
                        btn.Background = new SolidColorBrush(Color.FromArgb(40, 6, 182, 212));
                        btn.BorderThickness = new Thickness(1.5);
                    }
                    else if (tag == "color-amber" && _overlay.CurrentColor == Color.FromRgb(245, 158, 11))
                    {
                        HighlightColorButton(btn);
                    }
                    else if (tag == "color-cyan" && _overlay.CurrentColor == Color.FromRgb(6, 182, 212))
                    {
                        HighlightColorButton(btn);
                    }
                    else if (tag == "color-emerald" && _overlay.CurrentColor == Color.FromRgb(16, 185, 129))
                    {
                        HighlightColorButton(btn);
                    }
                    else if (tag == "color-violet" && _overlay.CurrentColor == Color.FromRgb(139, 92, 246))
                    {
                        HighlightColorButton(btn);
                    }
                    else if (tag == "color-gold" && _overlay.CurrentColor == Color.FromRgb(234, 179, 8))
                    {
                        HighlightColorButton(btn);
                    }
                    else if (tag == "color-white" && _overlay.CurrentColor == Color.FromRgb(248, 250, 252))
                    {
                        HighlightColorButton(btn);
                    }
                    else if (tag == "color-crimson" && _overlay.CurrentColor == Color.FromRgb(239, 68, 68))
                    {
                        HighlightColorButton(btn);
                    }
                }
            }
        }

        private void HighlightPresetButton(Button selectedBtn, bool isPassive)
        {
            if (tabFxStudio == null) return;
            var targetSet = isPassive ? PassivePresets : FlarePresets;

            foreach (var child in FindVisualChildren<Button>(tabFxStudio))
            {
                if (child.Tag is string t && targetSet.Contains(t))
                {
                    if (child == selectedBtn)
                    {
                        child.BorderBrush = isPassive ? new SolidColorBrush(Color.FromRgb(245, 158, 11)) : new SolidColorBrush(Color.FromRgb(6, 182, 212));
                        child.Background = isPassive ? new SolidColorBrush(Color.FromArgb(40, 245, 158, 11)) : new SolidColorBrush(Color.FromArgb(40, 6, 182, 212));
                        child.BorderThickness = new Thickness(1.5);
                    }
                    else
                    {
                        child.BorderBrush = new SolidColorBrush(Color.FromRgb(39, 39, 42));
                        child.Background = new SolidColorBrush(Color.FromRgb(24, 24, 27));
                        child.BorderThickness = new Thickness(1);
                    }
                }
            }
        }

        private void HighlightColorButton(Button selectedBtn)
        {
            if (tabFxStudio == null) return;
            foreach (var child in FindVisualChildren<Button>(tabFxStudio))
            {
                if (child.Tag is string t && ColorPresets.Contains(t))
                {
                    if (child == selectedBtn)
                    {
                        child.BorderBrush = Brushes.White;
                        child.Background = new SolidColorBrush(Color.FromRgb(39, 39, 42));
                        child.BorderThickness = new Thickness(1.5);
                    }
                    else
                    {
                        child.BorderBrush = new SolidColorBrush(Color.FromRgb(39, 39, 42));
                        child.Background = new SolidColorBrush(Color.FromRgb(24, 24, 27));
                        child.BorderThickness = new Thickness(1);
                    }
                }
            }
        }

        private static IEnumerable<T> FindVisualChildren<T>(DependencyObject depObj) where T : DependencyObject
        {
            if (depObj == null) yield break;
            for (int i = 0; i < VisualTreeHelper.GetChildrenCount(depObj); i++)
            {
                DependencyObject child = VisualTreeHelper.GetChild(depObj, i);
                if (child is T t) yield return t;
                foreach (T childOfChild in FindVisualChildren<T>(child)) yield return childOfChild;
            }
        }

        // Color Palettes
        private void OnColorAmber(object sender, RoutedEventArgs e)
        {
            if (_overlay != null)
            {
                _overlay.CurrentColor = Color.FromRgb(245, 158, 11);
                _overlay.SecondaryColor = Color.FromRgb(251, 191, 36);
                if (sender is Button btn) HighlightColorButton(btn);
                UpdateCustomHexUI("#F59E0B");
                SetStatusText("Color: Amber Flare • Click Apply & Save");
            }
        }

        private void OnColorCyan(object sender, RoutedEventArgs e)
        {
            if (_overlay != null)
            {
                _overlay.CurrentColor = Color.FromRgb(6, 182, 212);
                _overlay.SecondaryColor = Color.FromRgb(56, 189, 248);
                if (sender is Button btn) HighlightColorButton(btn);
                UpdateCustomHexUI("#06B6D4");
                SetStatusText("Color: Cyber Cyan • Click Apply & Save");
            }
        }

        private void OnColorEmerald(object sender, RoutedEventArgs e)
        {
            if (_overlay != null)
            {
                _overlay.CurrentColor = Color.FromRgb(16, 185, 129);
                _overlay.SecondaryColor = Color.FromRgb(52, 211, 153);
                if (sender is Button btn) HighlightColorButton(btn);
                UpdateCustomHexUI("#10B981");
                SetStatusText("Color: Emerald Glow • Click Apply & Save");
            }
        }

        private void OnColorViolet(object sender, RoutedEventArgs e)
        {
            if (_overlay != null)
            {
                _overlay.CurrentColor = Color.FromRgb(139, 92, 246);
                _overlay.SecondaryColor = Color.FromRgb(167, 139, 250);
                if (sender is Button btn) HighlightColorButton(btn);
                UpdateCustomHexUI("#8B5CF6");
                SetStatusText("Color: Electric Violet • Click Apply & Save");
            }
        }

        private void OnColorGold(object sender, RoutedEventArgs e)
        {
            if (_overlay != null)
            {
                _overlay.CurrentColor = Color.FromRgb(234, 179, 8);
                _overlay.SecondaryColor = Color.FromRgb(254, 240, 138);
                if (sender is Button btn) HighlightColorButton(btn);
                UpdateCustomHexUI("#EAB308");
                SetStatusText("Color: Solar Gold • Click Apply & Save");
            }
        }

        private void OnColorWhite(object sender, RoutedEventArgs e)
        {
            if (_overlay != null)
            {
                _overlay.CurrentColor = Color.FromRgb(248, 250, 252);
                _overlay.SecondaryColor = Color.FromRgb(226, 232, 240);
                if (sender is Button btn) HighlightColorButton(btn);
                UpdateCustomHexUI("#FFFFFF");
                SetStatusText("Color: Pure White • Click Apply & Save");
            }
        }

        private void OnColorCrimson(object sender, RoutedEventArgs e)
        {
            if (_overlay != null)
            {
                _overlay.CurrentColor = Color.FromRgb(239, 68, 68);
                _overlay.SecondaryColor = Color.FromRgb(248, 113, 113);
                if (sender is Button btn) HighlightColorButton(btn);
                UpdateCustomHexUI("#EF4444");
                SetStatusText("Color: Crimson Fire • Click Apply & Save");
            }
        }

        private void OnCustomHexChanged(object sender, TextChangedEventArgs e)
        {
            if (txtCustomHex == null || brdCustomPreview == null) return;
            string hex = txtCustomHex.Text.Trim();
            if (!hex.StartsWith("#")) hex = "#" + hex;
            try
            {
                var colorObj = ColorConverter.ConvertFromString(hex);
                if (colorObj is Color c)
                {
                    brdCustomPreview.Background = new SolidColorBrush(c);
                }
            }
            catch { }
        }

        private void OnApplyCustomHex(object sender, RoutedEventArgs e)
        {
            if (txtCustomHex == null || _overlay == null) return;
            string hex = txtCustomHex.Text.Trim();
            if (!hex.StartsWith("#")) hex = "#" + hex;

            try
            {
                var colorObj = ColorConverter.ConvertFromString(hex);
                if (colorObj is Color c)
                {
                    _overlay.CurrentColor = c;
                    // Auto generate subtle secondary tint
                    byte r2 = (byte)Math.Min(255, c.R + 30);
                    byte g2 = (byte)Math.Min(255, c.G + 30);
                    byte b2 = (byte)Math.Min(255, c.B + 30);
                    _overlay.SecondaryColor = Color.FromRgb(r2, g2, b2);

                    if (brdCustomPreview != null)
                    {
                        brdCustomPreview.Background = new SolidColorBrush(c);
                    }

                    if (btnCustomColor != null)
                    {
                        HighlightColorButton(btnCustomColor);
                    }

                    SetStatusText($"Custom Color Applied: {hex.ToUpper()} • Click Apply & Save");
                }
            }
            catch
            {
                SetStatusText("⚠️ Invalid hex code. Please enter e.g. #FF5500 or #00FFCC");
            }
        }

        private void OnQuickColorSwatch(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is string hex)
            {
                if (txtCustomHex != null) txtCustomHex.Text = hex;
                OnApplyCustomHex(sender, e);
            }
        }

        private void UpdateCustomHexUI(string hex)
        {
            if (txtCustomHex != null) txtCustomHex.Text = hex;
            try
            {
                var colorObj = ColorConverter.ConvertFromString(hex);
                if (colorObj is Color c && brdCustomPreview != null)
                {
                    brdCustomPreview.Background = new SolidColorBrush(c);
                }
            }
            catch { }
        }

        private void SetStatusText(string msg)
        {
            if (txtSaveStatus != null)
            {
                txtSaveStatus.Text = msg;
            }
        }

        // Sliders
        private void OnIntensityChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (_overlay != null) _overlay.IntensityMultiplier = sliderIntensity.Value;
            if (txtIntensityVal != null) txtIntensityVal.Text = string.Format("{0:0.0}x", sliderIntensity.Value);
        }

        private void OnDensityChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (_overlay != null) _overlay.SparkDensityMultiplier = sliderDensity.Value / 5.0;
            if (txtDensityVal != null) txtDensityVal.Text = string.Format("{0:0} / 10", sliderDensity.Value);
        }

        private void OnSpeedChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (_overlay != null) _overlay.AnimationSpeedMultiplier = sliderSpeed.Value;
            if (txtSpeedVal != null) txtSpeedVal.Text = string.Format("{0:0.0}x", sliderSpeed.Value);
        }

        private void OnThresholdChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (_overlay != null) _overlay.MinMovementThreshold = sliderThreshold.Value;
            if (txtThresholdVal != null) txtThresholdVal.Text = string.Format("{0:0} px", sliderThreshold.Value);
        }

        // Hotkey & Actions
        private void OnRecordHotkey(object sender, RoutedEventArgs e)
        {
            _isRecordingHotkey = !_isRecordingHotkey;
            btnHotkey.Content = _isRecordingHotkey ? "Press keys..." : _currentHotkey;
            if (_isRecordingHotkey)
            {
                SetStatusText("Recording: press the new Find Mouse key combination...");
            }
        }

        private void OnPresetHotkey(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Content is string keyText)
            {
                ApplyHotkey(keyText);
            }
        }

        private void OnHotkeyPreviewKeyDown(object sender, KeyEventArgs e)
        {
            if (!_isRecordingHotkey) return;
            e.Handled = true;

            Key key = e.Key == Key.System ? e.SystemKey : e.Key;
            if (key is Key.LeftCtrl or Key.RightCtrl or Key.LeftShift or Key.RightShift
                or Key.LeftAlt or Key.RightAlt or Key.LWin or Key.RWin)
            {
                return; // wait for the main key
            }

            var parts = new List<string>();
            if (Keyboard.Modifiers.HasFlag(ModifierKeys.Control)) parts.Add("Ctrl");
            if (Keyboard.Modifiers.HasFlag(ModifierKeys.Shift)) parts.Add("Shift");
            if (Keyboard.Modifiers.HasFlag(ModifierKeys.Alt)) parts.Add("Alt");

            // Normalize WPF Key names into the combo grammar TryParseCombo accepts
            // (Key.D5 -> "5", Key.NumPad5 -> "5", Key.Space -> "Space")
            string mainKey;
            if (key == Key.Space) mainKey = "Space";
            else if (key >= Key.D0 && key <= Key.D9) mainKey = ((char)('0' + (key - Key.D0))).ToString();
            else if (key >= Key.NumPad0 && key <= Key.NumPad9) mainKey = ((char)('0' + (key - Key.NumPad0))).ToString();
            else mainKey = key.ToString();
            parts.Add(mainKey);

            _isRecordingHotkey = false;
            ApplyHotkey(string.Join(" + ", parts));
        }

        /// <summary>
        /// Parses and actually re-registers the global hotkey, updating the UI and
        /// surfacing failures (unsupported key or a combo owned by another app).
        /// </summary>
        private void ApplyHotkey(string combo)
        {
            if (!Core.HotkeyManager.TryParseCombo(combo, out var modifiers, out uint vk))
            {
                btnHotkey.Content = _currentHotkey;
                SetStatusText($"⚠️ '{combo}' is not a supported hotkey. Use letters, digits, F1-F12, or Space with modifiers.");
                return;
            }

            if (_hotkeys != null && !_hotkeys.Reregister(modifiers, vk))
            {
                // Restore the previous combo so a working hotkey isn't silently lost
                if (Core.HotkeyManager.TryParseCombo(_currentHotkey, out var prevMods, out uint prevVk))
                {
                    _hotkeys.Reregister(prevMods, prevVk);
                }
                btnHotkey.Content = _currentHotkey;
                SetStatusText($"⚠️ Could not register '{combo}' — another application may already use it. Kept {_currentHotkey}.");
                return;
            }

            _currentHotkey = combo;
            btnHotkey.Content = combo;
            HotkeyChanged?.Invoke(combo);
            SetStatusText($"Global hotkey set to {combo} • Click Apply & Save to persist");
        }

        private void OnResetDefaults(object sender, RoutedEventArgs e)
        {
            if (_overlay != null)
            {
                _overlay.IsFxEnabled = true;
                _overlay.EnablePassiveFx = true;
                _overlay.PassiveFxStyle = "spark-trail";
                _overlay.FlareFxStyle = "solar-flare";
                _overlay.IntensityMultiplier = 1.0;
                _overlay.SparkDensityMultiplier = 1.0;
                _overlay.AnimationSpeedMultiplier = 1.0;
                _overlay.MinMovementThreshold = 2.0;
                _overlay.CurrentColor = Color.FromRgb(245, 158, 11);
                _overlay.SecondaryColor = Color.FromRgb(251, 191, 36);
                _overlay.IdleBurstEnabled = true;
                _overlay.MonitorCrossingFxEnabled = true;
                _overlay.ShakeToFindEnabled = true;
                _overlay.ReducedMotion = false;
                _overlay.SoundFxEnabled = true;
            }
            LoadCurrentSettings();
            SetStatusText("✓ All Settings Reset to Factory Defaults!");
        }

        private void OnSaveAndApply(object sender, RoutedEventArgs e)
        {
            bool saved = PersistSettings();
            try
            {
                System.Media.SystemSounds.Asterisk.Play();
            }
            catch { }
            SetStatusText(saved
                ? "✓ All Selections Saved & Applied — settings persist across restarts."
                : "⚠️ Applied to live engine, but writing settings.json failed.");
        }

        private bool PersistSettings()
        {
            if (_overlay == null) return false;
            var s = new Core.MouseflareSettings
            {
                IsFxEnabled = _overlay.IsFxEnabled,
                EnablePassiveFx = _overlay.EnablePassiveFx,
                PassiveFxStyle = _overlay.PassiveFxStyle,
                FlareFxStyle = _overlay.FlareFxStyle,
                IntensityMultiplier = _overlay.IntensityMultiplier,
                SparkDensityMultiplier = _overlay.SparkDensityMultiplier,
                AnimationSpeedMultiplier = _overlay.AnimationSpeedMultiplier,
                TrailLengthMultiplier = _overlay.TrailLengthMultiplier,
                MinMovementThreshold = _overlay.MinMovementThreshold,
                CurrentColorHex = ToHex(_overlay.CurrentColor),
                SecondaryColorHex = ToHex(_overlay.SecondaryColor),
                IdleBurstEnabled = _overlay.IdleBurstEnabled,
                MonitorCrossingFxEnabled = _overlay.MonitorCrossingFxEnabled,
                ShakeToFindEnabled = _overlay.ShakeToFindEnabled,
                ReducedMotion = _overlay.ReducedMotion,
                SoundFxEnabled = _overlay.SoundFxEnabled,
                Hotkey = _currentHotkey,
            };
            return Core.SettingsStore.Save(s);
        }

        private static string ToHex(Color c) => $"#{c.R:X2}{c.G:X2}{c.B:X2}";

        private void OnTestFlare(object sender, RoutedEventArgs e)
        {
            _overlay?.TriggerFindMouse();
            SetStatusText("⚡ Triggered Find Mouse Flare Shockwave!");
        }

        private void OnClose(object sender, RoutedEventArgs e)
        {
            Close();
        }
    }
}