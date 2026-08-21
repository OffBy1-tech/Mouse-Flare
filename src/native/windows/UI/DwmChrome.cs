using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace Mouseflare.UI
{
    /// <summary>
    /// DWM corner rounding for the opaque chrome windows. The settings and
    /// picker windows dropped AllowsTransparency so ClearType works; DWM
    /// supplies the rounded corners instead. On Windows 10 the attribute is
    /// unknown and the call fails harmlessly — square corners are the
    /// accepted fallback.
    /// </summary>
    internal static class DwmChrome
    {
        private const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
        private const int DWMWCP_ROUND = 2;
        private const int DWMWCP_ROUNDSMALL = 3;

        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

        /// <summary>Round a window's corners; call from SourceInitialized.</summary>
        public static void RoundWindow(Window window) =>
            TryRoundCorners(new WindowInteropHelper(window).Handle, small: false);

        public static void TryRoundCorners(IntPtr hwnd, bool small)
        {
            if (hwnd == IntPtr.Zero) return;
            try
            {
                int pref = small ? DWMWCP_ROUNDSMALL : DWMWCP_ROUND;
                _ = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, ref pref, sizeof(int));
            }
            catch
            {
                // dwmapi unavailable or attribute unsupported (pre-Win11):
                // keep square corners.
            }
        }
    }
}
