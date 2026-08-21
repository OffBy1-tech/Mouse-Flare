using System;
using System.IO;
using System.Text;

namespace Mouseflare.Core
{
    /// <summary>
    /// Last-chance crash logging. Writes to %AppData%\Mouseflare\crash.log so
    /// field crashes leave evidence even when the process dies (including
    /// access violations from unsafe code, whose AppDomain handler still runs
    /// before the process is torn down).
    /// </summary>
    public static class CrashLog
    {
        private const long MaxBytes = 512 * 1024;

        private static string LogPath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Mouseflare",
            "crash.log");

        /// <summary>One line per launch, so the log shows crash-vs-start cadence.</summary>
        public static void NoteStartup()
        {
            Append($"---- Mouseflare v{Updater.Shared.CurrentVersion} started ({Environment.OSVersion}, .NET {Environment.Version}) ----");
        }

        public static void Write(string source, Exception? ex)
        {
            var sb = new StringBuilder();
            sb.Append(source).Append(": ");
            if (ex == null)
            {
                sb.Append("(no exception object)");
            }
            else
            {
                // Full chain, inner exceptions included
                sb.Append(ex.ToString());
            }
            Append(sb.ToString());
        }

        private static void Append(string message)
        {
            // Never let the crash logger itself take the process down.
            try
            {
                string path = LogPath;
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);

                // Cap growth: keep roughly the newest half when oversized.
                try
                {
                    var info = new FileInfo(path);
                    if (info.Exists && info.Length > MaxBytes)
                    {
                        string tail = File.ReadAllText(path);
                        File.WriteAllText(path, tail.Substring(tail.Length / 2));
                    }
                }
                catch { }

                File.AppendAllText(path, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}");
            }
            catch { }
        }
    }
}
