using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;

namespace Mouseflare.UI
{
    public class TransparentOverlayWindow : Window
    {
        private const int WS_EX_TRANSPARENT = 0x00000020;
        private const int WS_EX_LAYERED = 0x00080000;
        private const int WS_EX_TOOLWINDOW = 0x00000080;
        private const int GWL_EXSTYLE = -20;

        public bool IsFxEnabled { get; set; } = true;
        public bool EnablePassiveFx { get; set; } = true;
        public string PassiveFxStyle { get; set; } = "spark-trail";
        public string FlareFxStyle { get; set; } = "solar-flare";
        public Color CurrentColor { get; set; } = Color.FromRgb(245, 158, 11);
        public Color SecondaryColor { get; set; } = Color.FromRgb(251, 191, 36);
        public double IntensityMultiplier { get; set; } = 1.0;
        public double SparkDensityMultiplier { get; set; } = 1.0;
        public double TrailLengthMultiplier { get; set; } = 1.0;
        public double AnimationSpeedMultiplier { get; set; } = 1.0;
        public double MinMovementThreshold { get; set; } = 2.0;
        public bool IdleBurstEnabled { get; set; } = true; // matches Reset Defaults and the macOS/web defaults
        public bool MonitorCrossingFxEnabled { get; set; } = true;
        public bool ShakeToFindEnabled { get; set; } = true;
        public bool ReducedMotion { get; set; } = false;
        public bool SoundFxEnabled { get; set; } = true;
        public bool AutoCheckUpdates { get; set; } = true;
        public string[] QuickSwatches { get; set; } = { "#FF007F", "#3B82F6", "#14B8A6", "#F97316", "#A855F7" };
        public double FluidVorticity { get; set; } = 0.85;    // 0.1 .. 2.0 (curl spin strength)
        public double FluidDissipation { get; set; } = 0.96;  // 0.90 .. 0.99 (smoke persistence)

        /// <summary>Snapshot of every persisted setting, for SettingsStore.Save.</summary>
        public Core.MouseflareSettings ToSettings(string hotkey) => new()
        {
            IsFxEnabled = IsFxEnabled,
            EnablePassiveFx = EnablePassiveFx,
            PassiveFxStyle = PassiveFxStyle,
            FlareFxStyle = FlareFxStyle,
            IntensityMultiplier = IntensityMultiplier,
            SparkDensityMultiplier = SparkDensityMultiplier,
            AnimationSpeedMultiplier = AnimationSpeedMultiplier,
            TrailLengthMultiplier = TrailLengthMultiplier,
            MinMovementThreshold = MinMovementThreshold,
            CurrentColorHex = ColorPickerWindow.ToHex(CurrentColor),
            SecondaryColorHex = ColorPickerWindow.ToHex(SecondaryColor),
            IdleBurstEnabled = IdleBurstEnabled,
            MonitorCrossingFxEnabled = MonitorCrossingFxEnabled,
            ShakeToFindEnabled = ShakeToFindEnabled,
            ReducedMotion = ReducedMotion,
            SoundFxEnabled = SoundFxEnabled,
            AutoCheckUpdates = AutoCheckUpdates,
            QuickSwatches = QuickSwatches,
            FluidVorticity = FluidVorticity,
            FluidDissipation = FluidDissipation,
            Hotkey = hotkey,
        };

        private class Particle
        {
            public double X, Y, Vx, Vy, Size, Alpha, Decay;
            public Color Color;
            public string Type = "spark";
            public double Extra;
            public string Glyph = "";
        }

        // Katakana + digits pool for the Matrix Rain digital-rain preset
        private static readonly string[] MatrixGlyphs =
            "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789Z:・.=*+-<>¦|"
                .Select(c => c.ToString()).ToArray();

        private class FlareRing
        {
            public double X, Y, Radius, MaxRadius, Alpha, Progress;
            public Color Color;
            public string FlareType = "solar-flare";
            public double LineWidth = 3.5;
        }

        private readonly List<Particle> _particles = new();
        private readonly List<FlareRing> _rings = new();
        private readonly Queue<(double X, double Y, long Time)> _motionHistory = new();
        private readonly Random _rand = new();
        private double _lastX, _lastY;
        private long _lastMoveTime;
        private double _rainbowHue;

        private readonly DrawingVisual _visual = new();

        public TransparentOverlayWindow()
        {
            WindowStyle = WindowStyle.None;
            AllowsTransparency = true;
            Background = Brushes.Transparent;
            Topmost = true;
            ShowInTaskbar = false;

            // Span virtual desktop across all connected monitors
            Left = SystemParameters.VirtualScreenLeft;
            Top = SystemParameters.VirtualScreenTop;
            Width = SystemParameters.VirtualScreenWidth;
            Height = SystemParameters.VirtualScreenHeight;

            _lastMoveTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            AddVisualChild(_visual);
            CompositionTarget.Rendering += OnRenderFrame;
        }

        protected override int VisualChildrenCount => 1;
        protected override Visual GetVisualChild(int index) => _visual;

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            var hwnd = new WindowInteropHelper(this).Handle;
            int extendedStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
            // Click-through: mouse clicks pass directly through to desktop apps underneath
            SetWindowLong(hwnd, GWL_EXSTYLE, extendedStyle | WS_EX_TRANSPARENT | WS_EX_LAYERED | WS_EX_TOOLWINDOW);
        }

        /// <summary>
        /// Converts a cursor position in physical screen pixels (as reported by
        /// WH_MOUSE_LL / GetCursorPos) into this window's DIP coordinate space.
        /// Without this every effect lands offset from the cursor at any display
        /// scaling other than 100%.
        /// </summary>
        private (double X, double Y) ScreenToLocalDips(double physicalX, double physicalY)
        {
            var dpi = VisualTreeHelper.GetDpi(this);
            return (physicalX / dpi.DpiScaleX - Left, physicalY / dpi.DpiScaleY - Top);
        }

        public void OnCursorMoved(int screenX, int screenY)
        {
            if (!IsFxEnabled) return;

            long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            (double localX, double localY) = ScreenToLocalDips(screenX, screenY);

            double dx = localX - _lastX;
            double dy = localY - _lastY;
            double dist = Math.Sqrt(dx * dx + dy * dy);
            long idleDuration = now - _lastMoveTime;

            // Re-anchor baseline if idle (>300ms) or teleported (>150px) to prevent screen-spanning streaks
            if (idleDuration > 300 || dist > 150)
            {
                if (IdleBurstEnabled && idleDuration > 2000)
                {
                    SpawnIdleBurst(localX, localY);
                }

                _lastX = localX;
                _lastY = localY;
                _lastMoveTime = now;
                _motionHistory.Clear();
                return;
            }

            // 1. Shake-to-Find Detection (rapid cursor reversals)
            if (ShakeToFindEnabled)
            {
                _motionHistory.Enqueue((localX, localY, now));
                while (_motionHistory.Count > 0 && (now - _motionHistory.Peek().Time) > 450)
                {
                    _motionHistory.Dequeue();
                }

                if (_motionHistory.Count >= 8 && CountDirectionReversals() >= 4)
                {
                    _motionHistory.Clear();
                    TriggerFindMouse();
                }
            }

            _lastMoveTime = now;

            if (dist < MinMovementThreshold || !EnablePassiveFx) return;

            SpawnPassiveParticles(localX, localY, dx, dy, dist);

            _lastX = localX;
            _lastY = localY;
        }

        private int CountDirectionReversals()
        {
            var points = _motionHistory.ToArray();
            int reversals = 0;
            double lastDx = 0;

            for (int i = 1; i < points.Length; i++)
            {
                double curDx = points[i].X - points[i - 1].X;
                if (Math.Abs(curDx) > 14)
                {
                    if (lastDx != 0 && Math.Sign(curDx) != Math.Sign(lastDx))
                    {
                        reversals++;
                    }
                    lastDx = curDx;
                }
            }
            return reversals;
        }

        private void SpawnIdleBurst(double x, double y)
        {
            for (int i = 0; i < 16; i++)
            {
                double angle = _rand.NextDouble() * Math.PI * 2;
                double speed = _rand.NextDouble() * 3.5 + 1.5;
                _particles.Add(new Particle
                {
                    X = x, Y = y,
                    Vx = Math.Cos(angle) * speed,
                    Vy = Math.Sin(angle) * speed,
                    Size = _rand.NextDouble() * 3.5 + 2.0,
                    Alpha = 1.0,
                    Decay = 0.04,
                    Color = CurrentColor,
                    Type = "spark"
                });
            }
        }

        private void SpawnPassiveParticles(double x, double y, double dx, double dy, double dist)
        {
            int baseCount = Math.Max(1, (int)((dist / 14.0) * SparkDensityMultiplier));
            int count = Math.Min(10, baseCount);

            switch (PassiveFxStyle)
            {
                case "spark-trail":
                    for (int i = 0; i < count; i++)
                    {
                        double angle = Math.Atan2(-dy, -dx) + (_rand.NextDouble() - 0.5) * 1.2;
                        double speed = (_rand.NextDouble() * 2.5 + 1.0) * IntensityMultiplier;
                        _particles.Add(new Particle
                        {
                            X = x + (_rand.NextDouble() - 0.5) * 6,
                            Y = y + (_rand.NextDouble() - 0.5) * 6,
                            Vx = Math.Cos(angle) * speed,
                            Vy = Math.Sin(angle) * speed + 0.35,
                            Size = (_rand.NextDouble() * 3.0 + 1.8) * IntensityMultiplier,
                            Alpha = 0.95,
                            Decay = (0.045 * AnimationSpeedMultiplier) / Math.Max(0.5, TrailLengthMultiplier),
                            Color = _rand.NextDouble() > 0.3 ? CurrentColor : SecondaryColor,
                            Type = "spark"
                        });
                    }
                    break;

                case "glow-pulse":
                    if (_rand.NextDouble() < 0.45)
                    {
                        _particles.Add(new Particle
                        {
                            X = x, Y = y, Vx = 0, Vy = 0,
                            Size = Math.Min(35, 12 + dist * 0.4) * IntensityMultiplier,
                            Alpha = 0.5,
                            Decay = 0.06 * AnimationSpeedMultiplier,
                            Color = CurrentColor,
                            Type = "glow"
                        });
                    }
                    break;

                case "comet-trail":
                    for (int i = 0; i < Math.Min(6, count * 2); i++)
                    {
                        double progress = i / 6.0;
                        _particles.Add(new Particle
                        {
                            X = x - dx * progress + (_rand.NextDouble() - 0.5) * 3,
                            Y = y - dy * progress + (_rand.NextDouble() - 0.5) * 3,
                            Vx = -dx * 0.06, Vy = -dy * 0.06,
                            Size = Math.Max(1.5, (4.5 - progress * 3.0)) * IntensityMultiplier,
                            Alpha = 0.9 * (1.0 - progress * 0.4),
                            Decay = 0.065 * AnimationSpeedMultiplier,
                            Color = progress < 0.3 ? Colors.White : CurrentColor,
                            Type = "comet"
                        });
                    }
                    break;

                case "bubbles":
                    if (_rand.NextDouble() < 0.6)
                    {
                        _particles.Add(new Particle
                        {
                            X = x + (_rand.NextDouble() - 0.5) * 10,
                            Y = y + (_rand.NextDouble() - 0.5) * 10,
                            Vx = (_rand.NextDouble() - 0.5) * 1.0,
                            Vy = -(_rand.NextDouble() * 1.6 + 0.4),
                            Size = (_rand.NextDouble() * 5.0 + 3.0) * IntensityMultiplier,
                            Alpha = 0.75,
                            Decay = 0.03 * AnimationSpeedMultiplier,
                            Color = SecondaryColor,
                            Type = "bubble"
                        });
                    }
                    break;

                case "fireflies":
                    if (_rand.NextDouble() < 0.5)
                    {
                        _particles.Add(new Particle
                        {
                            X = x + (_rand.NextDouble() - 0.5) * 12,
                            Y = y + (_rand.NextDouble() - 0.5) * 12,
                            Vx = (_rand.NextDouble() - 0.5) * 1.5,
                            Vy = (_rand.NextDouble() - 0.5) * 1.5,
                            Size = (_rand.NextDouble() * 3.5 + 2.0) * IntensityMultiplier,
                            Alpha = 0.85,
                            Decay = 0.025 * AnimationSpeedMultiplier,
                            Color = CurrentColor,
                            Type = "firefly",
                            Extra = _rand.NextDouble() * Math.PI * 2
                        });
                    }
                    break;

                case "star-dust":
                    for (int i = 0; i < Math.Min(4, count); i++)
                    {
                        _particles.Add(new Particle
                        {
                            X = x + (_rand.NextDouble() - 0.5) * 12,
                            Y = y + (_rand.NextDouble() - 0.5) * 12,
                            Vx = (_rand.NextDouble() - 0.5) * 0.8,
                            Vy = (_rand.NextDouble() - 0.5) * 0.8,
                            Size = (_rand.NextDouble() * 4.0 + 2.5) * IntensityMultiplier,
                            Alpha = 0.95,
                            Decay = 0.04 * AnimationSpeedMultiplier,
                            Color = _rand.NextDouble() > 0.4 ? Colors.White : CurrentColor,
                            Type = "star"
                        });
                    }
                    break;

                case "lightning":
                    for (int i = 0; i < 3; i++)
                    {
                        double arcAngle = Math.Atan2(-dy, -dx) + (_rand.NextDouble() - 0.5) * 1.8;
                        double len = _rand.NextDouble() * 18.0 + 8.0;
                        _particles.Add(new Particle
                        {
                            X = x, Y = y,
                            Vx = Math.Cos(arcAngle) * len * 0.3,
                            Vy = Math.Sin(arcAngle) * len * 0.3,
                            Size = 2.0 * IntensityMultiplier,
                            Alpha = 1.0,
                            Decay = 0.12 * AnimationSpeedMultiplier,
                            Color = Colors.White,
                            Type = "lightning"
                        });
                    }
                    break;

                case "rainbow":
                    _rainbowHue = (_rainbowHue + 8) % 360;
                    Color rainbowColor = HsvToRgb(_rainbowHue, 0.9, 1.0);
                    for (int i = 0; i < Math.Min(5, count); i++)
                    {
                        _particles.Add(new Particle
                        {
                            X = x + (_rand.NextDouble() - 0.5) * 6,
                            Y = y + (_rand.NextDouble() - 0.5) * 6,
                            Vx = -dx * 0.05 + (_rand.NextDouble() - 0.5) * 0.5,
                            Vy = -dy * 0.05 + (_rand.NextDouble() - 0.5) * 0.5,
                            Size = (_rand.NextDouble() * 3.5 + 2.0) * IntensityMultiplier,
                            Alpha = 0.9,
                            Decay = 0.05 * AnimationSpeedMultiplier,
                            Color = rainbowColor,
                            Type = "spark"
                        });
                    }
                    break;

                case "plasma":
                    for (int i = 0; i < 4; i++)
                    {
                        double orbit = (_rand.NextDouble() * Math.PI * 2);
                        _particles.Add(new Particle
                        {
                            X = x + Math.Cos(orbit) * 8,
                            Y = y + Math.Sin(orbit) * 8,
                            Vx = -Math.Sin(orbit) * 2.2,
                            Vy = Math.Cos(orbit) * 2.2,
                            Size = (_rand.NextDouble() * 3.0 + 2.0) * IntensityMultiplier,
                            Alpha = 0.85,
                            Decay = 0.06 * AnimationSpeedMultiplier,
                            Color = CurrentColor,
                            Type = "spark"
                        });
                    }
                    break;

                case "matrix-rain":
                    // Digital rain: green code glyphs cascade downward (fixed Matrix identity)
                    for (int i = 0; i < Math.Min(4, count); i++)
                    {
                        bool isHead = _rand.NextDouble() < 0.25;
                        _particles.Add(new Particle
                        {
                            X = x - dx * _rand.NextDouble() + (_rand.NextDouble() - 0.5) * 28,
                            Y = y - dy * _rand.NextDouble() + (_rand.NextDouble() - 0.5) * 12,
                            Vx = (_rand.NextDouble() - 0.5) * 0.3,
                            Vy = (_rand.NextDouble() * 2.4 + 1.6) * IntensityMultiplier,
                            Size = (_rand.NextDouble() * 4.0 + 9.0) * IntensityMultiplier, // font size
                            Alpha = isHead ? 1.0 : 0.85,
                            Decay = 0.03 * AnimationSpeedMultiplier,
                            Color = isHead ? Color.FromRgb(220, 252, 231) : Color.FromRgb(34, 197, 94),
                            Type = "glyph",
                            Glyph = MatrixGlyphs[_rand.Next(MatrixGlyphs.Length)]
                        });
                    }
                    break;

                case "fire-flame":
                    // Classic fire: fixed flame palette with upward buoyancy
                    for (int i = 0; i < count; i++)
                    {
                        double flameAngle = Math.Atan2(-dy, -dx) + (_rand.NextDouble() - 0.5) * 1.2;
                        double flameSpeed = (_rand.NextDouble() * 1.8 + 0.8) * IntensityMultiplier;
                        int pick = _rand.Next(3);
                        Color flameColor = pick == 0 ? Color.FromRgb(253, 186, 19)
                                         : pick == 1 ? Color.FromRgb(249, 115, 22)
                                                     : Color.FromRgb(220, 38, 38);
                        _particles.Add(new Particle
                        {
                            X = x + (_rand.NextDouble() - 0.5) * 6,
                            Y = y + (_rand.NextDouble() - 0.5) * 6,
                            Vx = Math.Cos(flameAngle) * flameSpeed * 0.5,
                            Vy = Math.Sin(flameAngle) * flameSpeed * 0.5 - (_rand.NextDouble() * 1.4 + 0.5), // rise
                            Size = (_rand.NextDouble() * 3.2 + 2.0) * IntensityMultiplier,
                            Alpha = 0.95,
                            Decay = 0.05 * AnimationSpeedMultiplier,
                            Color = flameColor,
                            Type = "spark"
                        });
                    }
                    break;

                case "neon-cyber":
                    // Fixed electric cyan / magenta / blue arcade palette
                    for (int i = 0; i < Math.Min(5, count); i++)
                    {
                        double neonAngle = Math.Atan2(-dy, -dx) + (_rand.NextDouble() - 0.5) * 0.6;
                        double neonSpeed = (_rand.NextDouble() * 2.2 + 1.4) * IntensityMultiplier;
                        int pick = _rand.Next(3);
                        Color neonColor = pick == 0 ? Color.FromRgb(0, 242, 255)
                                        : pick == 1 ? Color.FromRgb(242, 0, 242)
                                                    : Color.FromRgb(59, 130, 246);
                        _particles.Add(new Particle
                        {
                            X = x + (_rand.NextDouble() - 0.5) * 4,
                            Y = y + (_rand.NextDouble() - 0.5) * 4,
                            Vx = Math.Cos(neonAngle) * neonSpeed,
                            Vy = Math.Sin(neonAngle) * neonSpeed,
                            Size = (_rand.NextDouble() * 2.6 + 1.6) * IntensityMultiplier,
                            Alpha = 0.95,
                            Decay = 0.055 * AnimationSpeedMultiplier,
                            Color = neonColor,
                            Type = "spark"
                        });
                    }
                    break;

                case "magic-dust":
                    // Enchanted pastel shimmer drifting in all directions
                    for (int i = 0; i < Math.Min(5, count); i++)
                    {
                        double drift = _rand.NextDouble() * Math.PI * 2;
                        double driftSpeed = (_rand.NextDouble() * 1.6 + 0.5) * IntensityMultiplier;
                        int pick = _rand.Next(3);
                        Color magicColor = pick == 0 ? Color.FromRgb(217, 127, 255)
                                         : pick == 1 ? Color.FromRgb(255, 216, 77)
                                                     : Color.FromRgb(102, 204, 255);
                        _particles.Add(new Particle
                        {
                            X = x + (_rand.NextDouble() - 0.5) * 10,
                            Y = y + (_rand.NextDouble() - 0.5) * 10,
                            Vx = Math.Cos(drift) * driftSpeed,
                            Vy = Math.Sin(drift) * driftSpeed - 0.3, // gentle float
                            Size = (_rand.NextDouble() * 3.0 + 1.4) * IntensityMultiplier,
                            Alpha = 1.0,
                            Decay = 0.035 * AnimationSpeedMultiplier,
                            Color = magicColor,
                            Type = _rand.NextDouble() < 0.3 ? "star" : "spark"
                        });
                    }
                    break;

                case "galaxy":
                    // Deep-space starfield: violet/blue nebula dust with white star sparkles
                    for (int i = 0; i < Math.Min(5, count); i++)
                    {
                        bool isStarParticle = _rand.NextDouble() < 0.35;
                        double orbitAngle = _rand.NextDouble() * Math.PI * 2;
                        double orbitSpeed = (_rand.NextDouble() * 1.2 + 0.3) * IntensityMultiplier;
                        int pick = _rand.Next(3);
                        Color nebulaColor = pick == 0 ? Color.FromRgb(139, 92, 246)
                                          : pick == 1 ? Color.FromRgb(59, 130, 246)
                                                      : Color.FromRgb(49, 46, 129);
                        _particles.Add(new Particle
                        {
                            X = x - dx * _rand.NextDouble() * 0.6 + (_rand.NextDouble() - 0.5) * 24,
                            Y = y - dy * _rand.NextDouble() * 0.6 + (_rand.NextDouble() - 0.5) * 24,
                            Vx = Math.Cos(orbitAngle) * orbitSpeed,
                            Vy = Math.Sin(orbitAngle) * orbitSpeed,
                            Size = (isStarParticle ? _rand.NextDouble() * 3.5 + 2.0 : _rand.NextDouble() * 2.2 + 1.2) * IntensityMultiplier,
                            Alpha = isStarParticle ? 1.0 : 0.7,
                            Decay = 0.03 * AnimationSpeedMultiplier,
                            Color = isStarParticle ? Colors.White : nebulaColor,
                            Type = isStarParticle ? "star" : "spark"
                        });
                    }
                    break;

                case "minimal-beacon":
                    // Restrained single tracking dot — the quietest preset
                    if (_rand.NextDouble() < 0.5)
                    {
                        _particles.Add(new Particle
                        {
                            X = x, Y = y, Vx = 0, Vy = 0,
                            Size = (_rand.NextDouble() * 1.5 + 2.5) * IntensityMultiplier,
                            Alpha = 0.5,
                            Decay = 0.06 * AnimationSpeedMultiplier,
                            Color = CurrentColor,
                            Type = "spark"
                        });
                    }
                    break;

                case "fluid-simulation":
                case "fluid-smoke":
                case "neon-fluid":
                case "cosmic-vortex":
                case "ink-diffusion":
                    _rainbowHue = (_rainbowHue + 12) % 360;
                    for (int i = 0; i < Math.Min(6, count); i++)
                    {
                        double angle = Math.Atan2(dy, dx) + (_rand.NextDouble() - 0.5) * 1.2;
                        // ~1.5 at the default vorticity of 0.85, scaling with the slider
                        double spin = (i % 2 == 0 ? 1 : -1) * FluidVorticity * 1.76;
                        Color dyeColor = PassiveFxStyle == "neon-fluid" ? HsvToRgb((_rainbowHue + i * 30) % 360, 0.95, 1.0)
                                       : PassiveFxStyle == "cosmic-vortex" ? (_rand.NextDouble() > 0.5 ? Color.FromRgb(139, 92, 246) : Color.FromRgb(6, 182, 212))
                                       : CurrentColor;
                        _particles.Add(new Particle
                        {
                            X = x + (_rand.NextDouble() - 0.5) * 6,
                            Y = y + (_rand.NextDouble() - 0.5) * 6,
                            Vx = Math.Cos(angle) * (dx * 0.15 + spin),
                            Vy = Math.Sin(angle) * (dy * 0.15 - spin),
                            Size = (_rand.NextDouble() * 6.0 + 4.0) * IntensityMultiplier,
                            Alpha = 0.85,
                            Decay = 0.03 * AnimationSpeedMultiplier,
                            Color = dyeColor,
                            Type = "fluid",
                            Extra = (i % 2 == 0 ? 1 : -1) * FluidVorticity * 0.12 // curl spin
                        });
                    }
                    break;
            }
        }

        public void TriggerFindMouse()
        {
            if (!IsFxEnabled) return; // master toggle silences hotkey/tray flares too

            GetCursorPos(out POINT pt);
            (double localX, double localY) = ScreenToLocalDips(pt.X, pt.Y);

            if (SoundFxEnabled)
            {
                try { System.Media.SystemSounds.Asterisk.Play(); } catch { }
            }

            if (ReducedMotion)
            {
                _rings.Add(new FlareRing
                {
                    X = localX, Y = localY, Radius = 6, MaxRadius = 80, Alpha = 1.0, Progress = 0,
                    Color = CurrentColor, FlareType = "solar-flare", LineWidth = 4.0
                });
                return;
            }

            switch (FlareFxStyle)
            {
                case "solar-flare":
                    _rings.Add(new FlareRing { X = localX, Y = localY, Radius = 8, MaxRadius = 110, Alpha = 1.0, Progress = 0, Color = CurrentColor, FlareType = "solar-flare" });
                    _rings.Add(new FlareRing { X = localX, Y = localY, Radius = 8, MaxRadius = 150, Alpha = 0.75, Progress = -0.15, Color = SecondaryColor, FlareType = "solar-flare" });
                    for (int i = 0; i < 36; i++)
                    {
                        double angle = (i / 36.0) * Math.PI * 2 + (_rand.NextDouble() - 0.5) * 0.2;
                        double speed = _rand.NextDouble() * 6.0 + 3.5;
                        _particles.Add(new Particle { X = localX, Y = localY, Vx = Math.Cos(angle) * speed, Vy = Math.Sin(angle) * speed, Size = _rand.NextDouble() * 4.0 + 2.5, Alpha = 1.0, Decay = 0.03, Color = _rand.NextDouble() > 0.3 ? CurrentColor : Colors.White });
                    }
                    break;

                case "sonar-radar":
                    _rings.Add(new FlareRing { X = localX, Y = localY, Radius = 6, MaxRadius = 130, Alpha = 1.0, Progress = 0, Color = Color.FromRgb(6, 182, 212), FlareType = "sonar-radar", LineWidth = 2.5 });
                    _rings.Add(new FlareRing { X = localX, Y = localY, Radius = 6, MaxRadius = 170, Alpha = 0.6, Progress = -0.2, Color = Color.FromRgb(56, 189, 248), FlareType = "sonar-radar", LineWidth = 2.0 });
                    for (int i = 0; i < 20; i++)
                    {
                        double angle = (i / 20.0) * Math.PI * 2;
                        _particles.Add(new Particle { X = localX, Y = localY, Vx = Math.Cos(angle) * 4.0, Vy = Math.Sin(angle) * 4.0, Size = 3.0, Alpha = 0.9, Decay = 0.035, Color = Color.FromRgb(6, 182, 212) });
                    }
                    break;

                case "neon-beacon":
                    _rings.Add(new FlareRing { X = localX, Y = localY, Radius = 10, MaxRadius = 140, Alpha = 1.0, Progress = 0, Color = Color.FromRgb(168, 85, 247), FlareType = "neon-beacon", LineWidth = 3.5 });
                    for (int i = 0; i < 28; i++)
                    {
                        double angle = (i / 28.0) * Math.PI * 2;
                        double speed = _rand.NextDouble() * 5.0 + 2.0;
                        _particles.Add(new Particle { X = localX, Y = localY, Vx = Math.Cos(angle) * speed, Vy = Math.Sin(angle) * speed, Size = 4.0, Alpha = 1.0, Decay = 0.03, Color = Colors.White });
                    }
                    break;

                case "quantum-shockwave":
                    _rings.Add(new FlareRing { X = localX, Y = localY, Radius = 4, MaxRadius = 190, Alpha = 1.0, Progress = 0, Color = Colors.White, FlareType = "quantum-shockwave", LineWidth = 4.5 });
                    _rings.Add(new FlareRing { X = localX, Y = localY, Radius = 4, MaxRadius = 130, Alpha = 0.8, Progress = -0.1, Color = CurrentColor, FlareType = "quantum-shockwave", LineWidth = 3.0 });
                    for (int i = 0; i < 45; i++)
                    {
                        double angle = _rand.NextDouble() * Math.PI * 2;
                        double speed = _rand.NextDouble() * 7.5 + 4.0;
                        _particles.Add(new Particle { X = localX, Y = localY, Vx = Math.Cos(angle) * speed, Vy = Math.Sin(angle) * speed, Size = _rand.NextDouble() * 3.5 + 1.5, Alpha = 1.0, Decay = 0.025, Color = _rand.NextDouble() > 0.5 ? CurrentColor : Colors.White });
                    }
                    break;

                case "supernova":
                    _rings.Add(new FlareRing { X = localX, Y = localY, Radius = 12, MaxRadius = 160, Alpha = 1.0, Progress = 0, Color = Color.FromRgb(245, 158, 11), FlareType = "supernova", LineWidth = 4.0 });
                    for (int i = 0; i < 60; i++)
                    {
                        double angle = (i / 60.0) * Math.PI * 2 + (_rand.NextDouble() - 0.5) * 0.15;
                        double speed = _rand.NextDouble() * 8.5 + 3.0;
                        _particles.Add(new Particle { X = localX, Y = localY, Vx = Math.Cos(angle) * speed, Vy = Math.Sin(angle) * speed, Size = _rand.NextDouble() * 5.0 + 2.0, Alpha = 1.0, Decay = 0.022, Color = _rand.NextDouble() > 0.4 ? Color.FromRgb(251, 191, 36) : Colors.White, Type = "star" });
                    }
                    break;

                case "fluid-vortex-burst":
                    _rings.Add(new FlareRing { X = localX, Y = localY, Radius = 8, MaxRadius = 180, Alpha = 1.0, Progress = 0, Color = Color.FromRgb(6, 182, 212), FlareType = "fluid-vortex-burst", LineWidth = 3.5 });
                    _rings.Add(new FlareRing { X = localX, Y = localY, Radius = 8, MaxRadius = 140, Alpha = 0.8, Progress = -0.15, Color = Color.FromRgb(59, 130, 246), FlareType = "fluid-vortex-burst", LineWidth = 2.5 });
                    for (int i = 0; i < 32; i++)
                    {
                        double angle = (i / 32.0) * Math.PI * 2;
                        double speed = _rand.NextDouble() * 7.0 + 3.0;
                        Color hueColor = HsvToRgb((i * 11.25) % 360, 0.9, 1.0);
                        _particles.Add(new Particle { X = localX, Y = localY, Vx = Math.Cos(angle) * speed, Vy = Math.Sin(angle) * speed, Size = _rand.NextDouble() * 5.0 + 2.5, Alpha = 1.0, Decay = 0.02, Color = hueColor });
                    }
                    break;
            }
        }

        private void OnRenderFrame(object? sender, EventArgs e)
        {
            if (_particles.Count == 0 && _rings.Count == 0) return;

            using (DrawingContext dc = _visual.RenderOpen())
            {
                for (int i = _rings.Count - 1; i >= 0; i--)
                {
                    var r = _rings[i];
                    r.Progress += 0.04 * AnimationSpeedMultiplier;
                    if (r.Progress >= 1.0)
                    {
                        _rings.RemoveAt(i);
                        continue;
                    }
                    if (r.Progress < 0) continue;

                    double curRadius = r.MaxRadius * Math.Sin(r.Progress * Math.PI * 0.5);
                    byte curAlpha = (byte)(Math.Max(0, r.Alpha * (1.0 - r.Progress)) * 255);

                    var pen = new Pen(new SolidColorBrush(Color.FromArgb(curAlpha, r.Color.R, r.Color.G, r.Color.B)), r.LineWidth * (1.0 - r.Progress * 0.4));
                    pen.Freeze();
                    dc.DrawEllipse(null, pen, new Point(r.X, r.Y), curRadius, curRadius);

                    if (r.FlareType == "sonar-radar" && r.Progress < 0.6)
                    {
                        var crossPen = new Pen(new SolidColorBrush(Color.FromArgb(curAlpha, r.Color.R, r.Color.G, r.Color.B)), 1.5);
                        crossPen.Freeze();
                        dc.DrawLine(crossPen, new Point(r.X - curRadius - 8, r.Y), new Point(r.X + curRadius + 8, r.Y));
                        dc.DrawLine(crossPen, new Point(r.X, r.Y - curRadius - 8), new Point(r.X, r.Y + curRadius + 8));
                    }
                }

                for (int i = _particles.Count - 1; i >= 0; i--)
                {
                    var p = _particles[i];
                    p.Alpha -= p.Decay;
                    if (p.Alpha <= 0)
                    {
                        _particles.RemoveAt(i);
                        continue;
                    }

                    p.X += p.Vx;
                    p.Y += p.Vy;
                    if (p.Type == "fluid")
                    {
                        // Curl vector rotation + configurable dissipation (mirrors macOS)
                        double curl = p.Extra * 0.05;
                        double vx = p.Vx * Math.Cos(curl) - p.Vy * Math.Sin(curl);
                        double vy = p.Vx * Math.Sin(curl) + p.Vy * Math.Cos(curl);
                        p.Vx = vx * FluidDissipation;
                        p.Vy = vy * FluidDissipation;
                    }
                    else if (p.Type != "glyph") // glyphs fall at constant cascade speed
                    {
                        p.Vx *= 0.94;
                        p.Vy *= 0.94;
                    }

                    if (p.Type == "firefly")
                    {
                        p.Extra += 0.15;
                        p.X += Math.Sin(p.Extra) * 0.8;
                    }

                    byte alpha = (byte)(Math.Max(0, p.Alpha) * 255);
                    var brush = new SolidColorBrush(Color.FromArgb(alpha, p.Color.R, p.Color.G, p.Color.B));
                    brush.Freeze();

                    if (p.Type == "star")
                    {
                        var pen = new Pen(brush, 1.5);
                        pen.Freeze();
                        dc.DrawLine(pen, new Point(p.X - p.Size, p.Y), new Point(p.X + p.Size, p.Y));
                        dc.DrawLine(pen, new Point(p.X, p.Y - p.Size), new Point(p.X, p.Y + p.Size));
                        dc.DrawEllipse(brush, null, new Point(p.X, p.Y), p.Size * 0.4, p.Size * 0.4);
                    }
                    else if (p.Type == "bubble")
                    {
                        var pen = new Pen(brush, 1.2);
                        pen.Freeze();
                        dc.DrawEllipse(null, pen, new Point(p.X, p.Y), p.Size, p.Size);
                    }
                    else if (p.Type == "glyph")
                    {
                        // Matrix code character; occasional flicker like scrolling code
                        if (_rand.NextDouble() < 0.05)
                        {
                            p.Glyph = MatrixGlyphs[_rand.Next(MatrixGlyphs.Length)];
                        }
                        var text = new FormattedText(
                            p.Glyph,
                            System.Globalization.CultureInfo.InvariantCulture,
                            FlowDirection.LeftToRight,
                            new Typeface(new FontFamily("Consolas"), FontStyles.Normal, FontWeights.Bold, FontStretches.Normal),
                            Math.Max(8, p.Size),
                            brush,
                            VisualTreeHelper.GetDpi(this).PixelsPerDip);
                        dc.DrawText(text, new Point(p.X - text.Width / 2, p.Y - text.Height / 2));
                    }
                    else
                    {
                        dc.DrawEllipse(brush, null, new Point(p.X, p.Y), p.Size, p.Size);
                    }
                }
            }
        }

        private static Color HsvToRgb(double h, double s, double v)
        {
            int hi = Convert.ToInt32(Math.Floor(h / 60)) % 6;
            double f = h / 60 - Math.Floor(h / 60);
            v *= 255;
            byte vByte = Convert.ToByte(v);
            byte p = Convert.ToByte(v * (1 - s));
            byte q = Convert.ToByte(v * (1 - f * s));
            byte t = Convert.ToByte(v * (1 - (1 - f) * s));

            return hi switch
            {
                0 => Color.FromRgb(vByte, t, p),
                1 => Color.FromRgb(q, vByte, p),
                2 => Color.FromRgb(p, vByte, t),
                3 => Color.FromRgb(p, q, vByte),
                4 => Color.FromRgb(t, p, vByte),
                _ => Color.FromRgb(vByte, p, q)
            };
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int X; public int Y; }

        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    }
}