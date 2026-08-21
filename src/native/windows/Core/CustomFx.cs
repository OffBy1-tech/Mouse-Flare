using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;

namespace Mouseflare.Core
{
    /// <summary>
    /// Config for the web FX Designer's exported JSON (mirrors
    /// src/types/fxEditor.ts ParticleFxConfig; unknown/missing keys keep defaults).
    /// </summary>
    public sealed class CustomFxConfig
    {
        public string id { get; set; } = "custom";
        public string name { get; set; } = "Custom FX";

        public string emissionPattern { get; set; } = "trail";
        public double spawnRateOnMove { get; set; } = 3;
        public double spawnBurstOnClick { get; set; } = 24;
        public double emissionAngle { get; set; } = 0;
        public double emissionSpread { get; set; } = 60;
        public double velocityInheritance { get; set; } = 0.3;

        public string shape { get; set; } = "circle";
        public string blendMode { get; set; } = "source-over";
        public bool glowBloom { get; set; } = false;
        public double glowRadius { get; set; } = 8;

        public double initialSpeedMin { get; set; } = 1;
        public double initialSpeedMax { get; set; } = 4;
        public double gravityX { get; set; } = 0;
        public double gravityY { get; set; } = 0;
        public double drag { get; set; } = 0.95;
        public double turbulence { get; set; } = 0;
        public double vortexAttraction { get; set; } = 0;
        public double rotationSpeedMin { get; set; } = 0;
        public double rotationSpeedMax { get; set; } = 0;

        public double lifetimeMin { get; set; } = 20;
        public double lifetimeMax { get; set; } = 50;
        public double startSize { get; set; } = 4;
        public double peakSize { get; set; } = 6;
        public double endSize { get; set; } = 1;
        public string sizeCurve { get; set; } = "linear-shrink";

        public string colorMode { get; set; } = "single";
        public string primaryColor { get; set; } = "#F59E0B";
        public string secondaryColor { get; set; } = "#FBBF24";
        public string accentColor { get; set; } = "#FFFFFF";
        public double rainbowSpeed { get; set; } = 2;
        public double startAlpha { get; set; } = 1;
        public double peakAlpha { get; set; } = 1;
        public double endAlpha { get; set; } = 0;

        public static CustomFxConfig? FromJson(string json)
        {
            try
            {
                var config = JsonSerializer.Deserialize<CustomFxConfig>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    AllowTrailingCommas = true,
                });
                return string.IsNullOrWhiteSpace(config?.name) ? null : config;
            }
            catch
            {
                return null;
            }
        }
    }

    /// <summary>
    /// Native port of the web FX Designer engine (src/engine/customFxRenderer.ts).
    /// Plain designs render through the retained-mode DrawingContext; designs
    /// using blendMode "lighter"/"screen"/"color-dodge" or glow bloom route
    /// through CustomFxCompositor, which reproduces the canvas blend and
    /// shadow-blur semantics per pixel (issue #1).
    /// </summary>
    public sealed class CustomFxEngine
    {
        private sealed class P
        {
            public double X, Y, Vx, Vy, Size, Alpha, Hue, Life, MaxLife, Rotation, RotationSpeed, TurbulenceSeed;
        }

        private readonly List<P> _particles = new();
        private const int MaxParticles = 500;
        private readonly Random _rand = new();
        private readonly CustomFxCompositor _compositor = new();
        private double _globalHue;
        private double _cursorVx, _cursorVy, _cursorSpeed;
        private long _lastTime = Environment.TickCount64;

        public int ActiveCount => _particles.Count;

        public void Clear()
        {
            _particles.Clear();
            _compositor.Clear();
        }

        public void OnMove(double x, double y, double dx, double dy, CustomFxConfig config)
        {
            long now = Environment.TickCount64;
            double dt = Math.Max(1, now - _lastTime);
            _lastTime = now;
            double dist = Math.Sqrt(dx * dx + dy * dy);
            _cursorVx = dx / dt * 16.6;
            _cursorVy = dy / dt * 16.6;
            _cursorSpeed = dist / dt * 1000;

            if (dist < 0.5) return;
            for (int i = 0; i < (int)config.spawnRateOnMove; i++)
            {
                Spawn(x, y, dx, dy, config, isBurst: false);
            }
        }

        public void TriggerBurst(double x, double y, CustomFxConfig config)
        {
            for (int i = 0; i < (int)config.spawnBurstOnClick; i++)
            {
                Spawn(x, y, 0, 0, config, isBurst: true);
            }
        }

        private void Spawn(double x, double y, double dx, double dy, CustomFxConfig config, bool isBurst)
        {
            if (_particles.Count >= MaxParticles) _particles.RemoveAt(0);

            double speed = _rand.NextDouble() * (config.initialSpeedMax - config.initialSpeedMin) + config.initialSpeedMin;
            double angle;

            if (isBurst)
            {
                speed *= 1.4;
                angle = _rand.NextDouble() * Math.PI * 2;
            }
            else
            {
                switch (config.emissionPattern)
                {
                    case "radial-burst":
                    case "vortex-spiral":
                    case "orbit":
                        angle = _rand.NextDouble() * Math.PI * 2;
                        break;
                    case "fountain":
                        angle = (config.emissionAngle - 90) * Math.PI / 180
                              + (_rand.NextDouble() - 0.5) * (config.emissionSpread * Math.PI / 180);
                        break;
                    case "directional-cone":
                        angle = config.emissionAngle * Math.PI / 180
                              + (_rand.NextDouble() - 0.5) * (config.emissionSpread * Math.PI / 180);
                        break;
                    default: // trail
                        if (Math.Sqrt(dx * dx + dy * dy) > 0.1)
                        {
                            angle = Math.Atan2(dy, dx) + Math.PI
                                  + (_rand.NextDouble() - 0.5) * (config.emissionSpread * Math.PI / 180);
                        }
                        else
                        {
                            angle = _rand.NextDouble() * Math.PI * 2;
                        }
                        break;
                }
            }

            double inherit = config.velocityInheritance * 0.15;
            _globalHue = (_globalHue + config.rainbowSpeed * 0.5) % 360;

            _particles.Add(new P
            {
                X = x + (_rand.NextDouble() - 0.5) * 4,
                Y = y + (_rand.NextDouble() - 0.5) * 4,
                Vx = Math.Cos(angle) * speed + _cursorVx * inherit,
                Vy = Math.Sin(angle) * speed + _cursorVy * inherit,
                Size = config.startSize,
                Alpha = config.startAlpha,
                Hue = _globalHue,
                Life = 0,
                MaxLife = _rand.NextDouble() * (config.lifetimeMax - config.lifetimeMin) + config.lifetimeMin,
                Rotation = _rand.NextDouble() * Math.PI * 2,
                RotationSpeed = (_rand.NextDouble() * (config.rotationSpeedMax - config.rotationSpeedMin) + config.rotationSpeedMin) * Math.PI / 180,
                TurbulenceSeed = _rand.NextDouble() * 100,
            });
        }

        public void UpdateAndDraw(DrawingContext dc, CustomFxConfig config, double cursorX, double cursorY, double dpiScale = 1.0)
        {
            double gravityX = config.gravityX * 0.1;
            double gravityY = config.gravityY * 0.1;

            // Blend modes and glow bloom need per-pixel compositing; plain
            // designs keep the retained-mode path so they cannot regress.
            bool composited = CustomFxCompositor.Needed(config);
            if (composited) _compositor.BeginFrame();

            for (int i = _particles.Count - 1; i >= 0; i--)
            {
                var p = _particles[i];
                p.Life += 1;
                if (p.Life >= p.MaxLife) { _particles.RemoveAt(i); continue; }
                double progress = p.Life / p.MaxLife;

                p.Vx += gravityX;
                p.Vy += gravityY;
                p.Vx *= config.drag;
                p.Vy *= config.drag;

                if (config.turbulence > 0)
                {
                    double time = (p.Life + p.TurbulenceSeed) * 0.1;
                    p.Vx += Math.Sin(time) * config.turbulence * 0.15;
                    p.Vy += Math.Cos(time * 0.8) * config.turbulence * 0.15;
                }

                if (config.vortexAttraction != 0)
                {
                    double toX = cursorX - p.X, toY = cursorY - p.Y;
                    double dist = Math.Sqrt(toX * toX + toY * toY);
                    if (dist > 5 && dist < 300)
                    {
                        double normX = toX / dist, normY = toY / dist;
                        p.Vx += -normY * config.vortexAttraction * 0.8 + normX * 0.2;
                        p.Vy += normX * config.vortexAttraction * 0.8 + normY * 0.2;
                    }
                }

                p.X += p.Vx;
                p.Y += p.Vy;
                p.Rotation += p.RotationSpeed;

                p.Size = config.sizeCurve switch
                {
                    "grow-shrink" => progress < 0.3
                        ? config.startSize + (config.peakSize - config.startSize) * (progress / 0.3)
                        : config.peakSize - (config.peakSize - config.endSize) * ((progress - 0.3) / 0.7),
                    "pop-fade" => progress < 0.15 ? config.peakSize : config.startSize * (1 - progress),
                    "constant" => config.startSize,
                    _ => config.startSize + (config.endSize - config.startSize) * progress,
                };
                p.Size = Math.Max(0.2, p.Size);

                p.Alpha = progress < 0.2
                    ? config.startAlpha + (config.peakAlpha - config.startAlpha) * (progress / 0.2)
                    : config.peakAlpha - (config.peakAlpha - config.endAlpha) * ((progress - 0.2) / 0.8);
                p.Alpha = Math.Max(0, Math.Min(1, p.Alpha));

                Color color = CurrentColor(p, progress, config);
                if (composited)
                {
                    _compositor.AddParticle(p.X, p.Y, p.Size, p.Alpha, p.Rotation, color, config, dpiScale);
                }
                else
                {
                    DrawShape(dc, p, color, config);
                }
            }

            if (composited) _compositor.Present(dc, config, dpiScale);
        }

        private Color CurrentColor(P p, double progress, CustomFxConfig config)
        {
            switch (config.colorMode)
            {
                case "gradient-lifetime":
                    return progress < 0.5
                        ? Lerp(Parse(config.primaryColor), Parse(config.secondaryColor), progress / 0.5)
                        : Lerp(Parse(config.secondaryColor), Parse(config.accentColor), (progress - 0.5) / 0.5);
                case "rainbow-cycle":
                    return HsvToColor((p.Hue + progress * 120) % 360, 0.9, 0.95);
                case "speed-responsive":
                    return Lerp(Parse(config.primaryColor), Parse(config.accentColor), Math.Min(1, _cursorSpeed / 1200));
                default:
                    return Parse(config.primaryColor);
            }
        }

        private static Color Parse(string hex)
        {
            try
            {
                if (ColorConverter.ConvertFromString(hex.StartsWith("#") ? hex : "#" + hex) is Color c) return c;
            }
            catch { }
            return Color.FromRgb(245, 158, 11);
        }

        private static Color Lerp(Color a, Color b, double factor)
        {
            double f = Math.Max(0, Math.Min(1, factor));
            return Color.FromRgb(
                (byte)(a.R + (b.R - a.R) * f),
                (byte)(a.G + (b.G - a.G) * f),
                (byte)(a.B + (b.B - a.B) * f));
        }

        private static Color HsvToColor(double h, double s, double v)
        {
            double c = v * s;
            double x = c * (1 - Math.Abs(h / 60 % 2 - 1));
            double m = v - c;
            (double r, double g, double b) = ((int)(h / 60) % 6) switch
            {
                0 => (c, x, 0.0), 1 => (x, c, 0.0), 2 => (0.0, c, x),
                3 => (0.0, x, c), 4 => (x, 0.0, c), _ => (c, 0.0, x),
            };
            return Color.FromRgb((byte)((r + m) * 255), (byte)((g + m) * 255), (byte)((b + m) * 255));
        }

        private static void DrawShape(DrawingContext dc, P p, Color color, CustomFxConfig config)
        {
            dc.PushTransform(new TranslateTransform(p.X, p.Y));
            if (p.Rotation != 0) dc.PushTransform(new RotateTransform(p.Rotation * 180 / Math.PI));

            DrawShapeGeometry(dc, config.shape, p.Size, color, (byte)(p.Alpha * 255));

            if (p.Rotation != 0) dc.Pop();
            dc.Pop();
        }

        /// <summary>
        /// Draws one particle shape centered at the origin, unrotated. Shared
        /// by the retained-mode path (which wraps it in transforms) and the
        /// compositor's sprite rasterizer, so both render identical geometry.
        /// </summary>
        internal static void DrawShapeGeometry(DrawingContext dc, string shape, double s, Color color, byte alpha)
        {
            var brush = new SolidColorBrush(Color.FromArgb(alpha, color.R, color.G, color.B));
            brush.Freeze();

            switch (shape)
            {
                case "glow-disc":
                {
                    var grad = new RadialGradientBrush();
                    grad.GradientStops.Add(new GradientStop(Color.FromArgb(alpha, 255, 255, 255), 0));
                    grad.GradientStops.Add(new GradientStop(Color.FromArgb(alpha, color.R, color.G, color.B), 0.3));
                    grad.GradientStops.Add(new GradientStop(Color.FromArgb(0, color.R, color.G, color.B), 1));
                    grad.Freeze();
                    dc.DrawEllipse(grad, null, new Point(0, 0), s * 1.5, s * 1.5);
                    break;
                }
                case "sparkle-star":
                    dc.DrawGeometry(brush, null, Poly(
                        (0, -s), (s * 0.25, -s * 0.25), (s, 0), (s * 0.25, s * 0.25),
                        (0, s), (-s * 0.25, s * 0.25), (-s, 0), (-s * 0.25, -s * 0.25)));
                    break;
                case "ring":
                {
                    var pen = new Pen(brush, Math.Max(1, s * 0.25));
                    pen.Freeze();
                    dc.DrawEllipse(null, pen, new Point(0, 0), s, s);
                    break;
                }
                case "shard-crystal":
                    dc.DrawGeometry(brush, null, Poly(
                        (0, -s * 1.2), (s * 0.6, -s * 0.2), (s * 0.4, s), (-s * 0.4, s), (-s * 0.6, -s * 0.2)));
                    break;
                case "plasma-orb":
                {
                    dc.DrawEllipse(brush, null, new Point(0, 0), s, s);
                    var core = new SolidColorBrush(Color.FromArgb(alpha, 255, 255, 255));
                    core.Freeze();
                    dc.DrawEllipse(core, null, new Point(-s * 0.25, -s * 0.25), s * 0.35, s * 0.35);
                    break;
                }
                case "smoke-puff":
                {
                    var grad = new RadialGradientBrush();
                    grad.GradientStops.Add(new GradientStop(Color.FromArgb(alpha, color.R, color.G, color.B), 0));
                    grad.GradientStops.Add(new GradientStop(Color.FromArgb(alpha, color.R, color.G, color.B), 0.6));
                    grad.GradientStops.Add(new GradientStop(Color.FromArgb(0, color.R, color.G, color.B), 1));
                    grad.Freeze();
                    dc.DrawEllipse(grad, null, new Point(0, 0), s, s);
                    break;
                }
                case "lightning-bolt":
                {
                    var pen = new Pen(brush, Math.Max(1.2, s * 0.2)) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round };
                    pen.Freeze();
                    dc.DrawLine(pen, new Point(-s * 0.6, -s), new Point(0, -s * 0.2));
                    dc.DrawLine(pen, new Point(0, -s * 0.2), new Point(-s * 0.3, 0));
                    dc.DrawLine(pen, new Point(-s * 0.3, 0), new Point(s * 0.6, s));
                    break;
                }
                case "bubble":
                {
                    var pen = new Pen(brush, Math.Max(1, s * 0.15));
                    pen.Freeze();
                    var fill = new SolidColorBrush(Color.FromArgb((byte)(alpha * 0.08), 255, 255, 255));
                    fill.Freeze();
                    dc.DrawEllipse(fill, pen, new Point(0, 0), s, s);
                    var glint = new SolidColorBrush(Color.FromArgb((byte)(alpha * 0.7), 255, 255, 255));
                    glint.Freeze();
                    dc.DrawEllipse(glint, null, new Point(-s * 0.35, -s * 0.35), s * 0.2, s * 0.2);
                    break;
                }
                case "sakura-petal":
                case "heart":
                {
                    // Approximated with bezier geometry
                    var geo = new StreamGeometry();
                    using (var g = geo.Open())
                    {
                        if (shape == "sakura-petal")
                        {
                            g.BeginFigure(new Point(0, -s), true, true);
                            g.BezierTo(new Point(s * 0.8, -s * 0.8), new Point(s * 0.8, s * 0.6), new Point(0, s), true, false);
                            g.BezierTo(new Point(-s * 0.8, s * 0.6), new Point(-s * 0.8, -s * 0.8), new Point(0, -s), true, false);
                        }
                        else
                        {
                            g.BeginFigure(new Point(0, s * 0.4), true, true);
                            g.BezierTo(new Point(-s * 0.8, -s * 0.4), new Point(-s * 0.8, -s * 0.9), new Point(0, -s * 0.3), true, false);
                            g.BezierTo(new Point(s * 0.8, -s * 0.9), new Point(s * 0.8, -s * 0.4), new Point(0, s * 0.4), true, false);
                        }
                    }
                    geo.Freeze();
                    dc.DrawGeometry(brush, null, geo);
                    break;
                }
                case "rune":
                {
                    var pen = new Pen(brush, Math.Max(1.2, s * 0.15));
                    pen.Freeze();
                    dc.DrawGeometry(null, pen, Poly((0, -s), (s, 0), (0, s), (-s, 0)));
                    dc.DrawLine(pen, new Point(0, -s * 0.6), new Point(0, s * 0.6));
                    dc.DrawLine(pen, new Point(-s * 0.6, 0), new Point(s * 0.6, 0));
                    break;
                }
                case "diamond":
                    dc.DrawGeometry(brush, null, Poly((0, -s), (s * 0.7, 0), (0, s), (-s * 0.7, 0)));
                    break;
                default: // circle
                    dc.DrawEllipse(brush, null, new Point(0, 0), Math.Max(0.5, s), Math.Max(0.5, s));
                    break;
            }
        }

        private static StreamGeometry Poly(params (double X, double Y)[] points)
        {
            var geo = new StreamGeometry();
            using (var g = geo.Open())
            {
                g.BeginFigure(new Point(points[0].X, points[0].Y), true, true);
                for (int i = 1; i < points.Length; i++)
                {
                    g.LineTo(new Point(points[i].X, points[i].Y), true, false);
                }
            }
            geo.Freeze();
            return geo;
        }
    }
}
