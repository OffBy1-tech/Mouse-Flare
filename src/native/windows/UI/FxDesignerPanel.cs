using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using Mouseflare.Core;

namespace Mouseflare.UI
{
    /// <summary>
    /// Native FX Designer (Settings → FX Designer), mirroring the macOS
    /// FxDesignerView: the web designer's full parameter model with LIVE
    /// preview — every change applies to the cursor immediately (the overlay is
    /// topmost) as a draft; Apply &amp; Save commits it as the "custom-fx" preset.
    /// </summary>
    public sealed class FxDesignerPanel
    {
        private readonly TransparentOverlayWindow _overlay;
        private readonly Window _owner;
        private readonly Action<string> _status;
        private readonly Action _persist;

        private CustomFxConfig _config;
        private bool _suppress;

        private TextBox _nameBox = null!;
        private CheckBox _glowCheck = null!;
        private ComboBox _archetypes = null!;
        private Button _deleteBtn = null!;
        private readonly List<CustomFxConfig> _customPresets = new();
        // Library preset currently selected in the popup (null = archetype or
        // free-floating draft); gates the Delete button, like the web's
        // selectedIsCustom.
        private string? _selectedCustomId;
        private readonly List<(Func<CustomFxConfig, string> Get, Action<CustomFxConfig, string> Set, ComboBox Combo, string[] Values)> _popups = new();
        private readonly List<(Func<CustomFxConfig, double> Get, Action<CustomFxConfig, double> Set, Slider Slider, TextBlock Value, Func<double, string> Fmt)> _sliders = new();
        private readonly List<(Func<CustomFxConfig, string> Get, Action<CustomFxConfig, string> Set, Border Chip)> _chips = new();

        public FxDesignerPanel(TransparentOverlayWindow overlay, Window owner, Action<string> status, Action persist)
        {
            _overlay = overlay;
            _owner = owner;
            _status = status;
            _persist = persist;
            _config = (overlay.CustomFxJson != null ? CustomFxConfig.FromJson(overlay.CustomFxJson) : null)
                      ?? Clone(DefaultFxPresets.Archetypes[0]);
            foreach (var json in overlay.CustomFxPresets)
            {
                var parsed = CustomFxConfig.FromJson(json);
                if (parsed != null) _customPresets.Add(parsed);
            }
        }

        private static CustomFxConfig Clone(CustomFxConfig source) =>
            CustomFxConfig.FromJson(JsonSerializer.Serialize(source)) ?? new CustomFxConfig();

        // ---- Preset library (persisted instantly, like the web localStorage library) ----

        private void PersistLibrary()
        {
            _overlay.CustomFxPresets = _customPresets.ConvertAll(p => JsonSerializer.Serialize(p)).ToArray();
            _persist();
        }

        /// <summary>
        /// Rebuilds the archetype popup: built-ins first, then ★-prefixed
        /// library presets. Selects the entry matching <paramref name="selectId"/>
        /// (archetype or custom), or clears the selection for a free draft.
        /// </summary>
        private void RebuildPresetMenu(string? selectId)
        {
            _suppress = true;
            _archetypes.Items.Clear();
            foreach (var preset in DefaultFxPresets.Archetypes) _archetypes.Items.Add(preset.name);
            foreach (var preset in _customPresets) _archetypes.Items.Add($"★ {preset.name}");
            int archetypeCount = DefaultFxPresets.Archetypes.Count;
            int custom = selectId == null ? -1 : _customPresets.FindIndex(p => p.id == selectId);
            int archetype = selectId == null ? -1 : DefaultFxPresets.Archetypes.FindIndex(p => p.id == selectId);
            if (custom >= 0) { _archetypes.SelectedIndex = archetypeCount + custom; _selectedCustomId = selectId; }
            else if (archetype >= 0) { _archetypes.SelectedIndex = archetype; _selectedCustomId = null; }
            else { _archetypes.SelectedIndex = -1; _selectedCustomId = null; }
            UpdateDeleteVisibility();
            _suppress = false;
        }

        private void UpdateDeleteVisibility() =>
            _deleteBtn.Visibility = _selectedCustomId == null ? Visibility.Collapsed : Visibility.Visible;

        private void SaveToLibrary()
        {
            _config.name = string.IsNullOrWhiteSpace(_nameBox.Text) ? "Custom FX" : _nameBox.Text.Trim();
            // Only the preset currently loaded FROM the library overwrites in
            // place; any other draft mints a new id, even if its id happens to
            // collide with a library entry (e.g. re-imported Copy JSON output).
            if (_config.id != _selectedCustomId)
                _config.id = $"custom-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            _customPresets.RemoveAll(p => p.id == _config.id);
            _customPresets.Insert(0, Clone(_config));
            PersistLibrary();
            RebuildPresetMenu(_config.id);
            _status($"Saved \"{_config.name}\" to your preset library");
        }

        private void DeleteSelectedPreset()
        {
            var target = _selectedCustomId == null ? null : _customPresets.Find(p => p.id == _selectedCustomId);
            if (target == null) return;
            _customPresets.RemoveAll(p => p.id == target.id);
            PersistLibrary();
            RebuildPresetMenu(null);
            _status($"Deleted \"{target.name}\" from your preset library");
        }

        // ---- Apply (live draft preview; committed by the window's Apply & Save) ----

        private void Apply()
        {
            if (_suppress) return;
            _overlay.CustomFxJson = JsonSerializer.Serialize(_config);
            _overlay.PassiveFxStyle = "custom-fx";
            _overlay.EnablePassiveFx = true;
        }

        private void ControlsChanged()
        {
            if (_suppress) return;
            foreach (var s in _sliders)
            {
                s.Set(_config, s.Slider.Value);
                s.Value.Text = s.Fmt(s.Slider.Value);
            }
            foreach (var p in _popups)
            {
                int index = p.Combo.SelectedIndex;
                if (index >= 0 && index < p.Values.Length) p.Set(_config, p.Values[index]);
            }
            _config.glowBloom = _glowCheck.IsChecked == true;
            _config.name = string.IsNullOrWhiteSpace(_nameBox.Text) ? "Custom FX" : _nameBox.Text;
            Apply();
        }

        private void SyncControls()
        {
            _suppress = true;
            _nameBox.Text = _config.name;
            _glowCheck.IsChecked = _config.glowBloom;
            foreach (var s in _sliders)
            {
                s.Slider.Value = Math.Max(s.Slider.Minimum, Math.Min(s.Slider.Maximum, s.Get(_config)));
                s.Value.Text = s.Fmt(s.Get(_config));
            }
            foreach (var p in _popups)
            {
                p.Combo.SelectedIndex = Math.Max(0, Array.IndexOf(p.Values, p.Get(_config)));
            }
            foreach (var c in _chips)
            {
                c.Chip.Background = new SolidColorBrush(ColorPickerWindow.ParseHex(c.Get(_config), Colors.White));
            }
            _suppress = false;
        }

        // ---- UI construction ----

        public FrameworkElement Build()
        {
            var root = new StackPanel();

            // Header: archetype picker, name, actions
            var header = new DockPanel { LastChildFill = false, Margin = new Thickness(0, 0, 0, 4) };
            _archetypes = new ComboBox { Width = 190, FontSize = 13 };
            _archetypes.SelectionChanged += (s, e) =>
            {
                if (_suppress || _archetypes.SelectedIndex < 0) return;
                int index = _archetypes.SelectedIndex;
                int archetypeCount = DefaultFxPresets.Archetypes.Count;
                if (index < archetypeCount)
                {
                    // Keep the preset's own id so reopening the designer
                    // re-selects it; Save mints a fresh id for non-library drafts
                    _config = Clone(DefaultFxPresets.Archetypes[index]);
                    _selectedCustomId = null;
                }
                else if (index - archetypeCount < _customPresets.Count)
                {
                    // Library presets load keeping their id, so Save overwrites in place
                    var preset = Clone(_customPresets[index - archetypeCount]);
                    _config = preset;
                    _selectedCustomId = preset.id;
                }
                else
                {
                    return;
                }
                UpdateDeleteVisibility();
                SyncControls();
                Apply();
                _status($"Loaded preset: {_config.name} — previewing live on your cursor");
            };
            _nameBox = new TextBox { FontSize = 13, Margin = new Thickness(8, 0, 0, 0), MinWidth = 90 };
            _nameBox.LostFocus += (s, e) => ControlsChanged();

            var save = SmallButton("Save", SaveToLibrary);
            _deleteBtn = SmallButton("Delete", DeleteSelectedPreset);
            _deleteBtn.Foreground = Hex("#F87171");
            _deleteBtn.Visibility = Visibility.Collapsed;
            var copy = SmallButton("Copy JSON", () =>
            {
                try { Clipboard.SetText(JsonSerializer.Serialize(_config)); } catch { }
                _status($"Copied {_config.name} as JSON — importable on any platform");
            });
            var import = SmallButton("Import Clipboard", () =>
            {
                string json;
                try { json = Clipboard.GetText(); } catch { json = ""; }
                var parsed = string.IsNullOrWhiteSpace(json) ? null : CustomFxConfig.FromJson(json);
                if (parsed == null)
                {
                    _status("⚠️ Clipboard does not contain a valid FX Designer config.");
                    return;
                }
                // Fresh id, like the web importer — a pasted config must never
                // adopt an existing library id and overwrite it on Save
                parsed.id = $"custom-imported-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
                _config = parsed;
                RebuildPresetMenu(null);
                SyncControls();
                Apply();
                _status($"Imported: {parsed.name}");
            });

            // Fixed pieces dock left/right; the name box fills whatever is
            // left so nothing clips at narrow widths
            header.LastChildFill = true;
            var left = new StackPanel { Orientation = Orientation.Horizontal };
            left.Children.Add(Label("Preset:"));
            left.Children.Add(_archetypes);
            DockPanel.SetDock(left, Dock.Left);
            var right = new StackPanel { Orientation = Orientation.Horizontal };
            right.Children.Add(save);
            right.Children.Add(_deleteBtn);
            right.Children.Add(copy);
            right.Children.Add(import);
            DockPanel.SetDock(right, Dock.Right);
            var nameSection = new DockPanel { LastChildFill = true, Margin = new Thickness(8, 0, 8, 0) };
            var nameLabel = Label("Name:");
            DockPanel.SetDock(nameLabel, Dock.Left);
            nameSection.Children.Add(nameLabel);
            nameSection.Children.Add(_nameBox);
            header.Children.Add(left);
            header.Children.Add(right);
            header.Children.Add(nameSection);
            root.Children.Add(header);

            root.Children.Add(new TextBlock
            {
                Text = "Every change previews live on your cursor — click Apply & Save to keep it as the Custom FX preset.",
                FontSize = 12,
                Foreground = Hex("#71717A"),
                Margin = new Thickness(0, 0, 0, 10),
            });

            // Popups row
            var popupRow = new UniformGrid { Rows = 1, Columns = 5, Margin = new Thickness(0, 0, 0, 10) };
            popupRow.Children.Add(PopupColumn("Emission", c => c.emissionPattern, (c, v) => c.emissionPattern = v,
                new[] { "trail", "radial-burst", "vortex-spiral", "fountain", "orbit", "directional-cone" },
                new[] { "Trail", "Radial Burst", "Vortex Spiral", "Fountain", "Orbit", "Directional Cone" }));
            popupRow.Children.Add(PopupColumn("Shape", c => c.shape, (c, v) => c.shape = v,
                new[] { "circle", "sparkle-star", "glow-disc", "ring", "shard-crystal", "plasma-orb", "smoke-puff", "lightning-bolt", "bubble", "heart", "sakura-petal", "diamond", "rune" },
                new[] { "Circle", "Star", "Glow Disc", "Ring", "Crystal", "Plasma Orb", "Smoke", "Lightning", "Bubble", "Heart", "Petal", "Diamond", "Rune" }));
            popupRow.Children.Add(PopupColumn("Blend", c => c.blendMode, (c, v) => c.blendMode = v,
                new[] { "source-over", "lighter", "screen", "color-dodge" },
                new[] { "Normal", "Additive", "Screen", "Color Dodge" }));
            popupRow.Children.Add(PopupColumn("Color Mode", c => c.colorMode, (c, v) => c.colorMode = v,
                new[] { "single", "gradient-lifetime", "rainbow-cycle", "speed-responsive" },
                new[] { "Single", "Lifetime Gradient", "Rainbow Cycle", "Speed Responsive" }));
            popupRow.Children.Add(PopupColumn("Size Curve", c => c.sizeCurve, (c, v) => c.sizeCurve = v,
                new[] { "linear-shrink", "grow-shrink", "constant", "pop-fade" },
                new[] { "Linear Shrink", "Grow-Shrink", "Constant", "Pop & Fade" }));
            root.Children.Add(popupRow);

            // Colors + glow row, in a card like the web designer
            var colorsRow = new StackPanel { Orientation = Orientation.Horizontal };
            colorsRow.Children.Add(Label("Colors: "));
            colorsRow.Children.Add(ColorChip("Primary", c => c.primaryColor, (c, v) => c.primaryColor = v));
            colorsRow.Children.Add(ColorChip("Secondary", c => c.secondaryColor, (c, v) => c.secondaryColor = v));
            colorsRow.Children.Add(ColorChip("Accent", c => c.accentColor, (c, v) => c.accentColor = v));
            _glowCheck = new CheckBox { Margin = new Thickness(18, 0, 6, 0), VerticalAlignment = VerticalAlignment.Center };
            _glowCheck.Checked += (s, e) => ControlsChanged();
            _glowCheck.Unchecked += (s, e) => ControlsChanged();
            colorsRow.Children.Add(_glowCheck);
            colorsRow.Children.Add(Label("Glow Bloom"));
            root.Children.Add(Card(colorsRow));

            // Sliders (two per row)
            Func<double, string> pct = v => $"{v * 100:0}%";
            Func<double, string> one = v => $"{v:0.0}";
            Func<double, string> whole = v => $"{v:0}";
            Func<double, string> px = v => $"{v:0} px";
            Func<double, string> deg = v => $"{v:0}°";

            var specs = new (string Title, Func<CustomFxConfig, double> Get, Action<CustomFxConfig, double> Set, double Min, double Max, Func<double, string> Fmt)[]
            {
                ("Spawn Rate (move)", c => c.spawnRateOnMove, (c, v) => c.spawnRateOnMove = v, 1, 20, whole),
                ("Burst Count (flare)", c => c.spawnBurstOnClick, (c, v) => c.spawnBurstOnClick = v, 0, 60, whole),
                ("Emission Angle", c => c.emissionAngle, (c, v) => c.emissionAngle = v, 0, 360, deg),
                ("Emission Spread", c => c.emissionSpread, (c, v) => c.emissionSpread = v, 0, 360, deg),
                ("Velocity Inheritance", c => c.velocityInheritance, (c, v) => c.velocityInheritance = v, 0, 1, pct),
                ("Glow Radius", c => c.glowRadius, (c, v) => c.glowRadius = v, 0, 30, px),
                ("Speed Min", c => c.initialSpeedMin, (c, v) => c.initialSpeedMin = v, 0, 15, one),
                ("Speed Max", c => c.initialSpeedMax, (c, v) => c.initialSpeedMax = v, 0, 15, one),
                ("Wind (Gravity X)", c => c.gravityX, (c, v) => c.gravityX = v, -3, 3, one),
                ("Gravity Y", c => c.gravityY, (c, v) => c.gravityY = v, -3, 3, one),
                ("Drag", c => c.drag, (c, v) => c.drag = v, 0.85, 1.0, v => $"{v:0.00}"),
                ("Turbulence", c => c.turbulence, (c, v) => c.turbulence = v, 0, 5, one),
                ("Vortex Attraction", c => c.vortexAttraction, (c, v) => c.vortexAttraction = v, -3, 3, one),
                ("Rainbow Speed", c => c.rainbowSpeed, (c, v) => c.rainbowSpeed = v, 0, 10, one),
                ("Rotation Min", c => c.rotationSpeedMin, (c, v) => c.rotationSpeedMin = v, -10, 10, one),
                ("Rotation Max", c => c.rotationSpeedMax, (c, v) => c.rotationSpeedMax = v, -10, 10, one),
                ("Lifetime Min", c => c.lifetimeMin, (c, v) => c.lifetimeMin = v, 10, 120, whole),
                ("Lifetime Max", c => c.lifetimeMax, (c, v) => c.lifetimeMax = v, 10, 120, whole),
                ("Start Size", c => c.startSize, (c, v) => c.startSize = v, 1, 40, px),
                ("Peak Size", c => c.peakSize, (c, v) => c.peakSize = v, 1, 40, px),
                ("End Size", c => c.endSize, (c, v) => c.endSize = v, 0, 40, px),
                ("Start Alpha", c => c.startAlpha, (c, v) => c.startAlpha = v, 0, 1, pct),
                ("Peak Alpha", c => c.peakAlpha, (c, v) => c.peakAlpha = v, 0, 1, pct),
                ("End Alpha", c => c.endAlpha, (c, v) => c.endAlpha = v, 0, 1, pct),
            };

            // Sliders in a card like the web designer
            var grid = new UniformGrid { Columns = 2 };
            foreach (var spec in specs) grid.Children.Add(SliderColumn(spec));
            root.Children.Add(Card(grid));

            // No Apply() here: just visiting the tab must not hijack the live
            // preset — the preview starts with the first actual edit
            RebuildPresetMenu(_config.id);
            SyncControls();
            return root;
        }

        // ---- control factories ----

        private static SolidColorBrush Hex(string hex)
        {
            var brush = new SolidColorBrush(ColorPickerWindow.ParseHex(hex, Colors.White));
            brush.Freeze();
            return brush;
        }

        /// <summary>Web neon-card equivalent: rounded bordered container with padding.</summary>
        private static Border Card(UIElement child) => new()
        {
            Background = Hex("#1A0F2E"),
            BorderBrush = Hex("#2E1B4A"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(14),
            Margin = new Thickness(0, 0, 0, 12),
            Child = child,
        };

        private static TextBlock Label(string text) => new()
        {
            Text = text,
            FontSize = 13,
            Foreground = Hex("#A1A1AA"),
            VerticalAlignment = VerticalAlignment.Center,
        };

        private Button SmallButton(string title, Action onClick)
        {
            // Look comes from the window's implicit neon Button template
            var button = new Button
            {
                Content = title,
                FontSize = 12,
                Padding = new Thickness(10, 4, 10, 4),
                Margin = new Thickness(6, 0, 0, 0),
            };
            button.Click += (s, e) => onClick();
            return button;
        }

        private FrameworkElement PopupColumn(string title, Func<CustomFxConfig, string> get, Action<CustomFxConfig, string> set, string[] values, string[] titles)
        {
            var combo = new ComboBox { FontSize = 12, Margin = new Thickness(0, 2, 8, 0) };
            foreach (var t in titles) combo.Items.Add(t);
            combo.SelectionChanged += (s, e) => ControlsChanged();
            _popups.Add((get, set, combo, values));
            var column = new StackPanel();
            column.Children.Add(new TextBlock { Text = title, FontSize = 12, Foreground = Hex("#6E5F8E"), FontWeight = FontWeights.Bold });
            column.Children.Add(combo);
            return column;
        }

        private FrameworkElement ColorChip(string title, Func<CustomFxConfig, string> get, Action<CustomFxConfig, string> set)
        {
            var chip = new Border
            {
                Width = 18,
                Height = 18,
                CornerRadius = new CornerRadius(9),
                BorderBrush = Hex("#4A2E75"),
                BorderThickness = new Thickness(1),
                Background = Hex(get(_config)),
                Cursor = Cursors.Hand,
                Margin = new Thickness(8, 0, 4, 0),
                VerticalAlignment = VerticalAlignment.Center,
            };
            // Hover: brighten the ring so the chip reads as clickable
            chip.MouseEnter += (s, e) => chip.BorderBrush = Hex("#A855F7");
            chip.MouseLeave += (s, e) => chip.BorderBrush = Hex("#4A2E75");
            chip.MouseLeftButtonDown += (s, e) =>
            {
                string prior = get(_config);
                var picker = new ColorPickerWindow($"{title} Color", prior, _overlay.QuickSwatches) { Owner = _owner };
                picker.LiveColorChanged += hex =>
                {
                    set(_config, hex);
                    chip.Background = Hex(hex);
                    Apply();
                };
                bool confirmed = picker.ShowDialog() == true && picker.ResultHex != null;
                string final = confirmed ? picker.ResultHex! : prior;
                set(_config, final);
                chip.Background = Hex(final);
                Apply();
            };
            _chips.Add((get, set, chip));
            var wrap = new StackPanel { Orientation = Orientation.Horizontal };
            wrap.Children.Add(chip);
            wrap.Children.Add(new TextBlock { Text = title, FontSize = 11, Foreground = Hex("#71717A"), VerticalAlignment = VerticalAlignment.Center });
            return wrap;
        }

        private FrameworkElement SliderColumn((string Title, Func<CustomFxConfig, double> Get, Action<CustomFxConfig, double> Set, double Min, double Max, Func<double, string> Fmt) spec)
        {
            var slider = new Slider { Minimum = spec.Min, Maximum = spec.Max, Value = spec.Get(_config), IsMoveToPointEnabled = true };
            var valueLabel = new TextBlock { Text = spec.Fmt(spec.Get(_config)), FontSize = 12, Foreground = Hex("#FFA62E"), FontWeight = FontWeights.Bold };
            slider.ValueChanged += (s, e) => ControlsChanged();
            _sliders.Add((spec.Get, spec.Set, slider, valueLabel, spec.Fmt));

            var headerRow = new DockPanel { LastChildFill = false };
            var titleLabel = new TextBlock { Text = spec.Title, FontSize = 12, Foreground = Hex("#D4D4D8"), FontWeight = FontWeights.SemiBold };
            DockPanel.SetDock(titleLabel, Dock.Left);
            DockPanel.SetDock(valueLabel, Dock.Right);
            headerRow.Children.Add(titleLabel);
            headerRow.Children.Add(valueLabel);

            var column = new StackPanel { Margin = new Thickness(0, 0, 14, 8) };
            column.Children.Add(headerRow);
            column.Children.Add(slider);
            return column;
        }
    }
}
