using System;
using Microsoft.Win32;

namespace Mouseflare.Core
{
    /// <summary>
    /// "Launch on startup" via the per-user Run key — the Windows counterpart
    /// of the macOS build's SMAppService registration.
    /// </summary>
    public static class StartupRegistration
    {
        private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string ValueName = "Mouseflare";

        /// <summary>
        /// Registers or removes the startup entry. Re-applying while enabled
        /// refreshes the stored path (the app may have moved since last run).
        /// </summary>
        public static bool Apply(bool enabled)
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true)
                                ?? Registry.CurrentUser.CreateSubKey(RunKeyPath);
                if (key == null) return false;
                if (enabled)
                {
                    string? exe = Environment.ProcessPath;
                    if (string.IsNullOrEmpty(exe)) return false;
                    key.SetValue(ValueName, $"\"{exe}\"");
                }
                else
                {
                    key.DeleteValue(ValueName, throwOnMissingValue: false);
                }
                return true;
            }
            catch
            {
                return false; // Locked-down registry (e.g. policy) — surface via caller's status
            }
        }
    }
}
