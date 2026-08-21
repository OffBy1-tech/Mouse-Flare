using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace Mouseflare.UI
{
    /// <summary>
    /// Popup color picker (mobile-style hue ring + saturation/brightness disc)
    /// used to edit the custom color and the quick swatches in the FX Studio.
    /// Mirrors the macOS ColorPickerPanel.
    /// </summary>
    public partial class ColorPickerWindow : Window
    {
        private const double Size = 280;
        private const double RingWidth = 26;
        private static double OuterR => Size / 2 - 2;
        private static double InnerR => OuterR - RingWidth;
        private static double DiscR => InnerR - 12;

        private double _hue;        // 0..360
        private double _sat = 1;    // 0..1
        private double _val = 1;    // 0..1

        private enum DragMode { None, Hue, Disc }
        private DragMode _drag = DragMode.None;
        private bool _sampling;

        /// <summary>Fired on every color change for live FX preview.</summary>
        public event Action<string>? LiveColorChanged;

        /// <summary>The confirmed hex, or null when cancelled.</summary>
        public string? ResultHex { get; private set; }

        public ColorPickerWindow(string title, string initialHex, string[] swatches)
        {
            InitializeComponent();
            txtTitle.Text = title;

            imgRing.Source = RenderRing();

            var initial = ParseHex(initialHex, Color.FromRgb(245, 158, 11));
            (_hue, _sat, _val) = RgbToHsv(initial);
            oldColorCircle.Fill = new SolidColorBrush(initial);

            foreach (string hex in swatches)
            {
                var swatchColor = ParseHex(hex, Colors.White);
                var swatch = new Ellipse
                {
                    Width = 28,
                    Height = 28,
                    Margin = new Thickness(0, 0, 8, 0),
                    Fill = new SolidColorBrush(swatchColor),
                    Stroke = new SolidColorBrush(Color.FromArgb(64, 255, 255, 255)),
                    StrokeThickness = 1,
                    Cursor = Cursors.Hand,
                };
                swatch.MouseLeftButtonDown += (s, e) =>
                {
                    (_hue, _sat, _val) = RgbToHsv(swatchColor);
                    RefreshAll(fireLive: true);
                    e.Handled = true;
                };
                // Hover: brighten the ring so the swatch reads as clickable
                swatch.MouseEnter += (s, e) =>
                {
                    swatch.Stroke = new SolidColorBrush(Color.FromArgb(230, 255, 255, 255));
                    swatch.StrokeThickness = 2;
                };
                swatch.MouseLeave += (s, e) =>
                {
                    swatch.Stroke = new SolidColorBrush(Color.FromArgb(64, 255, 255, 255));
                    swatch.StrokeThickness = 1;
                };
                pnlSwatches.Children.Add(swatch);
            }

            Loaded += (s, e) => RefreshAll(fireLive: false);
        }

        private Color CurrentColor => HsvToColor(_hue, _sat, _val);

        // ---- rendering ----

        private static WriteableBitmap RenderRing()
        {
            int size = (int)Size;
            var bmp = new WriteableBitmap(size, size, 96, 96, PixelFormats.Bgra32, null);
            var pixels = new byte[size * size * 4];
            double c = Size / 2;
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    double dx = x - c + 0.5, dy = y - c + 0.5;
                    double r = Math.Sqrt(dx * dx + dy * dy);
                    if (r < InnerR || r > OuterR) continue;
                    double deg = (Math.Atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                    var color = HsvToColor(deg, 1, 1);
                    int i = (y * size + x) * 4;
                    pixels[i] = color.B; pixels[i + 1] = color.G; pixels[i + 2] = color.R; pixels[i + 3] = 255;
                }
            }
            bmp.WritePixels(new Int32Rect(0, 0, size, size), pixels, size * 4, 0);
            return bmp;
        }

        private void RenderDisc()
        {
            int size = (int)Size;
            var bmp = new WriteableBitmap(size, size, 96, 96, PixelFormats.Bgra32, null);
            var pixels = new byte[size * size * 4];
            double c = Size / 2;
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    double dx = x - c + 0.5, dy = y - c + 0.5;
                    if (Math.Sqrt(dx * dx + dy * dy) > DiscR) continue;
                    double s = Clamp01((x - (c - DiscR)) / (DiscR * 2));
                    double v = Clamp01(1 - (y - (c - DiscR)) / (DiscR * 2));
                    var color = HsvToColor(_hue, s, v);
                    int i = (y * size + x) * 4;
                    pixels[i] = color.B; pixels[i + 1] = color.G; pixels[i + 2] = color.R; pixels[i + 3] = 255;
                }
            }
            bmp.WritePixels(new Int32Rect(0, 0, size, size), pixels, size * 4, 0);
            imgDisc.Source = bmp;
        }

        private void RefreshAll(bool fireLive)
        {
            RenderDisc();
            PositionHandles();
            var color = CurrentColor;
            var brush = new SolidColorBrush(color);
            newColorCircle.Fill = brush;
            arcPreview.Stroke = brush;
            hueHandle.Fill = new SolidColorBrush(HsvToColor(_hue, 1, 1));
            discHandle.Fill = brush;
            txtHex.Text = ToHex(color);
            if (fireLive) LiveColorChanged?.Invoke(ToHex(color));
        }

        private void PositionHandles()
        {
            double c = Size / 2;
            double midR = (OuterR + InnerR) / 2;
            double radians = _hue * Math.PI / 180;
            Canvas.SetLeft(hueHandle, c + Math.Cos(radians) * midR - hueHandle.Width / 2);
            Canvas.SetTop(hueHandle, c + Math.Sin(radians) * midR - hueHandle.Height / 2);

            double x = c - DiscR + _sat * DiscR * 2;
            double y = c - DiscR + (1 - _val) * DiscR * 2;
            double dx = x - c, dy = y - c;
            double dist = Math.Sqrt(dx * dx + dy * dy);
            if (dist > DiscR) { x = c + dx / dist * DiscR; y = c + dy / dist * DiscR; }
            Canvas.SetLeft(discHandle, x - discHandle.Width / 2);
            Canvas.SetTop(discHandle, y - discHandle.Height / 2);
        }

        // ---- wheel interaction ----

        private void OnWheelMouseDown(object sender, MouseButtonEventArgs e)
        {
            var p = e.GetPosition(wheelCanvas);
            double c = Size / 2;
            double dist = Math.Sqrt((p.X - c) * (p.X - c) + (p.Y - c) * (p.Y - c));
            if (dist <= DiscR + 6) _drag = DragMode.Disc;
            else if (dist >= InnerR - 6 && dist <= OuterR + 8) _drag = DragMode.Hue;
            else { _drag = DragMode.None; return; }
            wheelCanvas.CaptureMouse();
            ApplyPoint(p);
        }

        private void OnWheelMouseMove(object sender, MouseEventArgs e)
        {
            if (_drag == DragMode.None) return;
            ApplyPoint(e.GetPosition(wheelCanvas));
        }

        private void OnWheelMouseUp(object sender, MouseButtonEventArgs e)
        {
            _drag = DragMode.None;
            wheelCanvas.ReleaseMouseCapture();
        }

        private void ApplyPoint(Point p)
        {
            double c = Size / 2;
            if (_drag == DragMode.Hue)
            {
                _hue = (Math.Atan2(p.Y - c, p.X - c) * 180 / Math.PI + 360) % 360;
            }
            else if (_drag == DragMode.Disc)
            {
                _sat = Clamp01((p.X - (c - DiscR)) / (DiscR * 2));
                _val = Clamp01(1 - (p.Y - (c - DiscR)) / (DiscR * 2));
            }
            RefreshAll(fireLive: true);
        }

        // ---- hex entry ----

        private void OnHexKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key != Key.Enter) return;
            string hex = txtHex.Text.Trim();
            if (!hex.StartsWith("#")) hex = "#" + hex;
            try
            {
                if (ColorConverter.ConvertFromString(hex) is Color color)
                {
                    (_hue, _sat, _val) = RgbToHsv(color);
                    RefreshAll(fireLive: true);
                }
            }
            catch { }
        }

        // ---- eyedropper (screen sampling via mouse capture + GetPixel) ----

        private void OnEyedropper(object sender, RoutedEventArgs e)
        {
            _sampling = true;
            Mouse.OverrideCursor = Cursors.Cross;
            CaptureMouse();
            MouseMove += OnSampleMove;
            MouseLeftButtonDown += OnSampleClick;
        }

        private void OnSampleMove(object? sender, MouseEventArgs e)
        {
            if (!_sampling) return;
            var color = SampleScreenUnderCursor();
            newColorCircle.Fill = new SolidColorBrush(color);
            arcPreview.Stroke = new SolidColorBrush(color);
        }

        private void OnSampleClick(object? sender, MouseButtonEventArgs e)
        {
            if (!_sampling) return;
            e.Handled = true;
            EndSampling();
            (_hue, _sat, _val) = RgbToHsv(SampleScreenUnderCursor());
            RefreshAll(fireLive: true);
        }

        private void EndSampling()
        {
            _sampling = false;
            Mouse.OverrideCursor = null;
            ReleaseMouseCapture();
            MouseMove -= OnSampleMove;
            MouseLeftButtonDown -= OnSampleClick;
        }

        private static Color SampleScreenUnderCursor()
        {
            GetCursorPos(out POINT pt);
            IntPtr dc = GetDC(IntPtr.Zero);
            try
            {
                uint pixel = GetPixel(dc, pt.X, pt.Y); // COLORREF: 0x00BBGGRR
                return Color.FromRgb((byte)(pixel & 0xFF), (byte)((pixel >> 8) & 0xFF), (byte)((pixel >> 16) & 0xFF));
            }
            finally
            {
                ReleaseDC(IntPtr.Zero, dc);
            }
        }

        // ---- actions ----

        private void OnDone(object sender, RoutedEventArgs e)
        {
            if (_sampling) { EndSampling(); }
            ResultHex = ToHex(CurrentColor);
            DialogResult = true;
        }

        private void OnCancel(object sender, RoutedEventArgs e)
        {
            if (_sampling) { EndSampling(); }
            ResultHex = null;
            DialogResult = false;
        }

        // ---- color math ----

        private static double Clamp01(double v) => Math.Max(0, Math.Min(1, v));

        internal static string ToHex(Color c) => $"#{c.R:X2}{c.G:X2}{c.B:X2}";

        internal static Color ParseHex(string hex, Color fallback)
        {
            try
            {
                if (!hex.StartsWith("#")) hex = "#" + hex;
                if (ColorConverter.ConvertFromString(hex) is Color c) return c;
            }
            catch { }
            return fallback;
        }

        internal static Color HsvToColor(double h, double s, double v)
        {
            double c = v * s;
            double x = c * (1 - Math.Abs(h / 60 % 2 - 1));
            double m = v - c;
            (double r, double g, double b) = ((int)(h / 60) % 6) switch
            {
                0 => (c, x, 0.0),
                1 => (x, c, 0.0),
                2 => (0.0, c, x),
                3 => (0.0, x, c),
                4 => (x, 0.0, c),
                _ => (c, 0.0, x),
            };
            return Color.FromRgb((byte)Math.Round((r + m) * 255), (byte)Math.Round((g + m) * 255), (byte)Math.Round((b + m) * 255));
        }

        internal static (double H, double S, double V) RgbToHsv(Color color)
        {
            double r = color.R / 255.0, g = color.G / 255.0, b = color.B / 255.0;
            double max = Math.Max(r, Math.Max(g, b));
            double min = Math.Min(r, Math.Min(g, b));
            double delta = max - min;
            double h = 0;
            if (delta > 0)
            {
                if (max == r) h = 60 * ((g - b) / delta % 6);
                else if (max == g) h = 60 * ((b - r) / delta + 2);
                else h = 60 * ((r - g) / delta + 4);
            }
            if (h < 0) h += 360;
            return (h, max == 0 ? 0 : delta / max, max);
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int X; public int Y; }

        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll")]
        private static extern IntPtr GetDC(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

        [DllImport("gdi32.dll")]
        private static extern uint GetPixel(IntPtr hdc, int x, int y);
    }
}
