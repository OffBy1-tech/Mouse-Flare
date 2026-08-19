using System;
using System.IO;
using System.Text.Json;

namespace Mouseflare.Core
{
    /// <summary>
    /// Persisted user settings, mirroring the live TransparentOverlayWindow
    /// properties plus the global hotkey combo. Stored as JSON under
    /// %AppData%\Mouseflare\settings.json (the Windows counterpart of the
    /// macOS UserDefaults store and the web app's localStorage).
    /// </summary>
    public sealed class MouseflareSettings
    {
        public bool IsFxEnabled { get; set; } = true;
        public bool EnablePassiveFx { get; set; } = true;
        public string PassiveFxStyle { get; set; } = "spark-trail";
        public string FlareFxStyle { get; set; } = "solar-flare";
        public double IntensityMultiplier { get; set; } = 1.0;
        public double SparkDensityMultiplier { get; set; } = 1.0;
        public double AnimationSpeedMultiplier { get; set; } = 1.0;
        public double TrailLengthMultiplier { get; set; } = 1.0;
        public double MinMovementThreshold { get; set; } = 2.0;
        public string CurrentColorHex { get; set; } = "#F59E0B";
        public string SecondaryColorHex { get; set; } = "#FBBF24";
        public bool IdleBurstEnabled { get; set; } = true;
        public bool MonitorCrossingFxEnabled { get; set; } = true;
        public bool ShakeToFindEnabled { get; set; } = true;
        public bool ReducedMotion { get; set; } = false;
        public bool SoundFxEnabled { get; set; } = true;
        public string Hotkey { get; set; } = "Ctrl + Shift + F";
    }

    public static class SettingsStore
    {
        private static string SettingsPath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Mouseflare",
            "settings.json");

        public static MouseflareSettings? Load()
        {
            try
            {
                if (!File.Exists(SettingsPath)) return null;
                return JsonSerializer.Deserialize<MouseflareSettings>(File.ReadAllText(SettingsPath));
            }
            catch
            {
                return null; // Corrupt or unreadable settings fall back to defaults
            }
        }

        public static bool Save(MouseflareSettings settings)
        {
            try
            {
                string dir = Path.GetDirectoryName(SettingsPath)!;
                Directory.CreateDirectory(dir);
                File.WriteAllText(SettingsPath, JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true }));
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
