using System;
using System.Runtime.InteropServices;
using System.Windows.Interop;

namespace Mouseflare.Core
{
    [Flags]
    public enum KeyModifiers
    {
        None = 0,
        Alt = 1,
        Control = 2,
        Shift = 4,
        Windows = 8
    }

    public sealed class HotkeyManager : IDisposable
    {
        private const int WM_HOTKEY = 0x0312;
        private readonly HwndSource? _source;
        private readonly IntPtr _hwnd;
        private readonly int _hotkeyId = 9001;
        private bool _registered;

        public event Action? HotkeyPressed;

        /// <summary>False when the last (re)registration was rejected, e.g. because another app owns the combo.</summary>
        public bool IsRegistered => _registered;

        public HotkeyManager(IntPtr windowHandle, KeyModifiers modifiers, uint vkKey)
        {
            _hwnd = windowHandle;
            _source = HwndSource.FromHwnd(windowHandle);
            _source?.AddHook(HwndHook);

            _registered = RegisterHotKey(_hwnd, _hotkeyId, (uint)modifiers, vkKey);
        }

        /// <summary>
        /// Swaps the registered combo. Returns false (leaving no combo registered)
        /// when the OS rejects the new one — callers should surface that to the user.
        /// </summary>
        public bool Reregister(KeyModifiers modifiers, uint vkKey)
        {
            if (_registered)
            {
                UnregisterHotKey(_hwnd, _hotkeyId);
            }
            _registered = RegisterHotKey(_hwnd, _hotkeyId, (uint)modifiers, vkKey);
            return _registered;
        }

        /// <summary>
        /// Parses a display combo like "Ctrl + Shift + F", "Alt+M", or "F1" into
        /// modifier flags and a virtual-key code. Returns false for unsupported keys.
        /// </summary>
        public static bool TryParseCombo(string combo, out KeyModifiers modifiers, out uint vkKey)
        {
            modifiers = KeyModifiers.None;
            vkKey = 0;
            if (string.IsNullOrWhiteSpace(combo)) return false;

            foreach (string rawPart in combo.ToUpperInvariant().Split('+'))
            {
                string part = rawPart.Trim();
                switch (part)
                {
                    case "":
                        continue;
                    case "CTRL":
                    case "CONTROL":
                        modifiers |= KeyModifiers.Control;
                        continue;
                    case "SHIFT":
                        modifiers |= KeyModifiers.Shift;
                        continue;
                    case "ALT":
                        modifiers |= KeyModifiers.Alt;
                        continue;
                    case "WIN":
                    case "WINDOWS":
                        modifiers |= KeyModifiers.Windows;
                        continue;
                }

                // Main key: letters, digits, F1-F12, Space
                if (part.Length == 1 && part[0] >= 'A' && part[0] <= 'Z')
                {
                    vkKey = (uint)part[0]; // VK_A..VK_Z match ASCII
                }
                else if (part.Length == 1 && part[0] >= '0' && part[0] <= '9')
                {
                    vkKey = (uint)part[0]; // VK_0..VK_9 match ASCII
                }
                else if (part.Length is 2 or 3 && part[0] == 'F' && int.TryParse(part.Substring(1), out int fn) && fn is >= 1 and <= 12)
                {
                    vkKey = (uint)(0x70 + fn - 1); // VK_F1 = 0x70
                }
                else if (part == "SPACE")
                {
                    vkKey = 0x20; // VK_SPACE
                }
                else
                {
                    return false;
                }
            }

            return vkKey != 0;
        }

        private IntPtr HwndHook(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            if (msg == WM_HOTKEY && wParam.ToInt32() == _hotkeyId)
            {
                HotkeyPressed?.Invoke();
                handled = true;
            }
            return IntPtr.Zero;
        }

        public void Dispose()
        {
            _source?.RemoveHook(HwndHook);
            if (_registered)
            {
                UnregisterHotKey(_hwnd, _hotkeyId);
            }
        }

        [DllImport("user32.dll")]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll")]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    }
}
