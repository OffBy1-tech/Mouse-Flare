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

        private CustomFxConfig _config;
        private bool _suppress;

        private TextBox _nameBox = null!;
        private CheckBox _glowCheck = null!;
        private readonly List<(Func<CustomFxConfig, string> Get, Action<CustomFxConfig, string> Set, ComboBox Combo, string[] Values)> _popups = new();
        private readonly List<(Func<CustomFxConfig, double> Get, Action<CustomFxConfig, double> Set, Slider Slider, TextBlock Value, Func<double, string> Fmt)> _sliders = new();
        private readonly List<(Func<CustomFxConfig, string> Get, Action<CustomFxConfig, string> Set, Border Chip)> _chips = new();

        public FxDesignerPanel(TransparentOverlayWindow overlay, Window owner, Action<string> status)
        {
            _overlay = overlay;
            _owner = owner;
            _status = status;
            _config = (overlay.CustomFxJson != null ? CustomFxConfig.FromJson(overlay.CustomFxJson) : null)
                      ?? Clone(DefaultFxPresets.Archetypes[0]);
        }

        private static CustomFxConfig Clone(CustomFxConfig source) =>
            CustomFxConfig.FromJson(JsonSerializer.Serialize(source)) ?? new CustomFxConfig();

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
            var archetypes = new ComboBox { Width = 190, FontSize = 11 };
            foreach (var preset in DefaultFxPresets.Archetypes) archetypes.Items.Add(preset.name);
            archetypes.SelectionChanged += (s, e) =>
            {
                if (_suppress || archetypes.SelectedIndex < 0) return;
                var loaded = Clone(DefaultFxPresets.Archetypes[archetypes.SelectedIndex]);
                loaded.id = $"custom-{Environment.TickCount64}";
                _config = loaded;
                SyncControls();
                Apply();
                _status($"Loaded archetype: {loaded.name} — previewing live on your cursor");
            };
            _nameBox = new TextBox { FontSize = 11, Margin = new Thickness(8, 0, 0, 0), MinWidth = 90 };
            _nameBox.LostFocus += (s, e) => ControlsChanged();

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
                _config = parsed;
                SyncControls();
                Apply();
                _status($"Imported: {parsed.name}");
            });

            // Fixed pieces dock left/right; the name box fills whatever is
            // left so nothing clips at narrow widths
            header.LastChildFill = true;
            var left = new StackPanel { Orientation = Orientation.Horizontal };
            left.Children.Add(Label("Archetype:"));
            left.Children.Add(archetypes);
            DockPanel.SetDock(left, Dock.Left);
            var right = new StackPanel { Orientation = Orientation.Horizontal };
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
                FontSize = 10,
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

            // Colors + glow row
            var colorsRow = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 12) };
            colorsRow.Children.Add(Label("Colors: "));
            colorsRow.Children.Add(ColorChip("Primary", c => c.primaryColor, (c, v) => c.primaryColor = v));
            colorsRow.Children.Add(ColorChip("Secondary", c => c.secondaryColor, (c, v) => c.secondaryColor = v));
            colorsRow.Children.Add(ColorChip("Accent", c => c.accentColor, (c, v) => c.accentColor = v));
            _glowCheck = new CheckBox { Margin = new Thickness(18, 0, 6, 0), VerticalAlignment = VerticalAlignment.Center };
            _glowCheck.Checked += (s, e) => ControlsChanged();
            _glowCheck.Unchecked += (s, e) => ControlsChanged();
            colorsRow.Children.Add(_glowCheck);
            colorsRow.Children.Add(Label("Glow Bloom"));
            root.Children.Add(colorsRow);

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

            var grid = new UniformGrid { Columns = 2 };
            foreach (var spec in specs) grid.Children.Add(SliderColumn(spec));
            root.Children.Add(grid);

            // No Apply() here: just visiting the tab must not hijack the live
            // preset — the preview starts with the first actual edit
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

        private static TextBlock Label(string text) => new()
        {
            Text = text,
            FontSize = 11,
            Foreground = Hex("#A1A1AA"),
            VerticalAlignment = VerticalAlignment.Center,
        };

        private Button SmallButton(string title, Action onClick)
        {
            // Look comes from the window's implicit neon Button template
            var button = new Button
            {
                Content = title,
                FontSize = 10,
                Padding = new Thickness(10, 4, 10, 4),
                Margin = new Thickness(6, 0, 0, 0),
            };
            button.Click += (s, e) => onClick();
            return button;
        }

        private FrameworkElement PopupColumn(string title, Func<CustomFxConfig, string> get, Action<CustomFxConfig, string> set, string[] values, string[] titles)
        {
            var combo = new ComboBox { FontSize = 10, Margin = new Thickness(0, 2, 8, 0) };
            foreach (var t in titles) combo.Items.Add(t);
            combo.SelectionChanged += (s, e) => ControlsChanged();
            _popups.Add((get, set, combo, values));
            var column = new StackPanel();
            column.Children.Add(new TextBlock { Text = title, FontSize = 10, Foreground = Hex("#6E5F8E"), FontWeight = FontWeights.Bold });
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
            wrap.Children.Add(new TextBlock { Text = title, FontSize = 9, Foreground = Hex("#71717A"), VerticalAlignment = VerticalAlignment.Center });
            return wrap;
        }

        private FrameworkElement SliderColumn((string Title, Func<CustomFxConfig, double> Get, Action<CustomFxConfig, double> Set, double Min, double Max, Func<double, string> Fmt) spec)
        {
            var slider = new Slider { Minimum = spec.Min, Maximum = spec.Max, Value = spec.Get(_config), IsMoveToPointEnabled = true };
            var valueLabel = new TextBlock { Text = spec.Fmt(spec.Get(_config)), FontSize = 10, Foreground = Hex("#FFA62E"), FontWeight = FontWeights.Bold };
            slider.ValueChanged += (s, e) => ControlsChanged();
            _sliders.Add((spec.Get, spec.Set, slider, valueLabel, spec.Fmt));

            var headerRow = new DockPanel { LastChildFill = false };
            var titleLabel = new TextBlock { Text = spec.Title, FontSize = 10, Foreground = Hex("#D4D4D8"), FontWeight = FontWeights.SemiBold };
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
