using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Effects;

namespace Mouseflare.UI
{
    /// <summary>
    /// Central palette for the neon/synthwave theme (mirrors the web app's
    /// src/index.css neon token layer). XAML carries the same values as
    /// literals; all code-behind styling goes through the frozen brushes and
    /// effects here so hues and glow intensity tune in one place.
    /// </summary>
    internal static class NeonTheme
    {
        // Grounds
        public static readonly Color Ground0 = Color.FromRgb(0x0A, 0x05, 0x12);
        public static readonly Color Ground1 = Color.FromRgb(0x12, 0x0A, 0x20);
        public static readonly Color Ground2 = Color.FromRgb(0x1A, 0x0F, 0x2E);
        public static readonly Color BorderTint = Color.FromRgb(0x2E, 0x1B, 0x4A);

        // Neon hues
        public static readonly Color Violet = Color.FromRgb(0xA8, 0x55, 0xF7);
        public static readonly Color Blue = Color.FromRgb(0x4F, 0x7C, 0xFF);
        public static readonly Color Magenta = Color.FromRgb(0xF0, 0x43, 0xC8);
        public static readonly Color Cyan = Color.FromRgb(0x2F, 0xD4, 0xF5);
        public static readonly Color Amber = Color.FromRgb(0xFF, 0xA6, 0x2E);

        // Quiet card
        public static readonly SolidColorBrush CardBackground = Solid(Ground2);
        public static readonly SolidColorBrush CardBorder = Solid(BorderTint);

        // Selected preset: filled glowing pill (the "Mars row" look)
        public static readonly LinearGradientBrush SelectedFill = Gradient(
            Color.FromArgb(0xC7, 0x4F, 0x7C, 0xFF),
            Color.FromArgb(0xB8, 0x8B, 0x5C, 0xF6),
            Color.FromArgb(0xA8, 0xA8, 0x55, 0xF7));
        public static readonly SolidColorBrush SelectedBorder = Solid(Color.FromArgb(0xE6, 0xBE, 0xA0, 0xFF));
        public static readonly LinearGradientBrush SelectedFillCyan = Gradient(
            Color.FromArgb(0xA6, 0x2F, 0xD4, 0xF5),
            Color.FromArgb(0xB8, 0x4F, 0x7C, 0xFF),
            Color.FromArgb(0x99, 0x8B, 0x5C, 0xF6));
        public static readonly SolidColorBrush SelectedBorderCyan = Solid(Color.FromArgb(0xE6, 0x96, 0xE6, 0xFF));

        // Sidebar nav active pill (dark fill, violet→magenta edge)
        public static readonly LinearGradientBrush NavActiveFill = Gradient(
            Color.FromArgb(0x61, 0x58, 0x28, 0x96),
            Color.FromArgb(0x61, 0x32, 0x19, 0x6E));
        public static readonly LinearGradientBrush NavActiveBorder = Gradient(Violet, Magenta);

        // Glows — frozen so one instance is safely shared by many elements.
        // Kept modest: WPF renders bitmap effects on the UI thread.
        public static readonly DropShadowEffect SelectedGlow = Glow(Color.FromRgb(0x6E, 0x5A, 0xFF), 14, 0.5);
        public static readonly DropShadowEffect SelectedGlowCyan = Glow(Color.FromRgb(0x3C, 0xB4, 0xFF), 14, 0.5);
        public static readonly DropShadowEffect NavGlow = Glow(Violet, 10, 0.4);

        private static SolidColorBrush Solid(Color color)
        {
            var brush = new SolidColorBrush(color);
            brush.Freeze();
            return brush;
        }

        private static LinearGradientBrush Gradient(params Color[] stops)
        {
            var brush = new LinearGradientBrush { StartPoint = new Point(0, 0), EndPoint = new Point(1, 1) };
            for (int i = 0; i < stops.Length; i++)
                brush.GradientStops.Add(new GradientStop(stops[i], stops.Length == 1 ? 0 : (double)i / (stops.Length - 1)));
            brush.Freeze();
            return brush;
        }

        private static DropShadowEffect Glow(Color color, double blurRadius, double opacity)
        {
            var effect = new DropShadowEffect { Color = color, BlurRadius = blurRadius, ShadowDepth = 0, Opacity = opacity };
            effect.Freeze();
            return effect;
        }
    }
}
