using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace Mouseflare.Tray
{
    public sealed class TrayIconManager : IDisposable
    {
        private readonly NotifyIcon _notifyIcon;

        public event Action? OpenSettingsRequested;
        public event Action? FindMouseRequested;
        public event Action<bool>? EnabledToggled;
        public event Action? ExitRequested;
        public event Action? CheckUpdatesRequested;

        private readonly ToolStripMenuItem _updateActionItem;
        private readonly ToolStripSeparator _updateActionSeparator;
        private Action? _updateAction;

        public TrayIconManager(bool initialEnabled = true)
        {
            Icon appIcon = LoadAppLogoIcon() ?? CreateProceduralFlameIcon();

            _notifyIcon = new NotifyIcon
            {
                Icon = appIcon,
                Text = "Mouseflare (Active - Ctrl+Shift+F to Flare)",
                Visible = true
            };

            var contextMenu = new ContextMenuStrip();

            // Updater state item (hidden until an update is available/staged)
            _updateActionItem = new ToolStripMenuItem("") { Visible = false };
            _updateActionItem.Click += (s, e) => _updateAction?.Invoke();
            _updateActionSeparator = new ToolStripSeparator { Visible = false };
            contextMenu.Items.Add(_updateActionItem);
            contextMenu.Items.Add(_updateActionSeparator);

            var findItem = new ToolStripMenuItem("⚡ Find Mouse (Ctrl+Shift+F)");
            findItem.Click += (s, e) => FindMouseRequested?.Invoke();
            contextMenu.Items.Add(findItem);

            contextMenu.Items.Add(new ToolStripSeparator());

            var settingsItem = new ToolStripMenuItem("⚙ Preferences / Settings...");
            settingsItem.Click += (s, e) => OpenSettingsRequested?.Invoke();
            contextMenu.Items.Add(settingsItem);

            var checkUpdatesItem = new ToolStripMenuItem("Check for Updates...");
            checkUpdatesItem.Click += (s, e) => CheckUpdatesRequested?.Invoke();
            contextMenu.Items.Add(checkUpdatesItem);

            var enableItem = new ToolStripMenuItem("✓ Enable Cursor FX") { Checked = initialEnabled, CheckOnClick = true };
            enableItem.CheckedChanged += (s, e) => EnabledToggled?.Invoke(enableItem.Checked);
            contextMenu.Items.Add(enableItem);

            contextMenu.Items.Add(new ToolStripSeparator());
            
            var exitItem = new ToolStripMenuItem("Exit Mouseflare");
            exitItem.Click += (s, e) => ExitRequested?.Invoke();
            contextMenu.Items.Add(exitItem);

            _notifyIcon.ContextMenuStrip = contextMenu;
            _notifyIcon.DoubleClick += (s, e) => OpenSettingsRequested?.Invoke();
        }

        /// <summary>
        /// Shows an updater action at the top of the tray menu ("Update to vX...",
        /// "Restart to Update..."), or hides it when text is null. Pass
        /// enabled=false for passive status text (e.g. "Downloading...").
        /// </summary>
        public void SetUpdateAction(string? text, Action? onClick, bool enabled = true)
        {
            _updateAction = onClick;
            _updateActionItem.Text = text ?? "";
            _updateActionItem.Enabled = enabled && onClick != null;
            _updateActionItem.Visible = text != null;
            _updateActionSeparator.Visible = text != null;
        }

        private static Icon? LoadAppLogoIcon()
        {
            try
            {
                string path = System.IO.Path.Combine(AppContext.BaseDirectory, "Assets", "app-logo.png");
                if (!System.IO.File.Exists(path)) return null;
                using var source = new Bitmap(path);
                using var bmp = new Bitmap(source, new Size(32, 32));
                IntPtr hIcon = bmp.GetHicon();
                return Icon.FromHandle(hIcon);
            }
            catch
            {
                return null; // Fall back to the procedural flame
            }
        }

        private static Icon CreateProceduralFlameIcon()
        {
            using var bmp = new Bitmap(32, 32);
            using var g = Graphics.FromImage(bmp);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.Transparent);

            // Outer flame
            using (var outerBrush = new LinearGradientBrush(
                new Rectangle(4, 2, 24, 28),
                Color.FromArgb(255, 245, 158, 11),
                Color.FromArgb(255, 220, 38, 38),
                LinearGradientMode.Vertical))
            {
                var path = new GraphicsPath();
                path.AddBezier(16, 2, 26, 12, 28, 22, 16, 30);
                path.AddBezier(16, 30, 4, 22, 6, 12, 16, 2);
                g.FillPath(outerBrush, path);
            }

            // Inner core
            using (var coreBrush = new SolidBrush(Color.FromArgb(255, 254, 240, 138)))
            {
                var corePath = new GraphicsPath();
                corePath.AddBezier(16, 10, 22, 18, 22, 24, 16, 28);
                corePath.AddBezier(16, 28, 10, 24, 10, 18, 16, 10);
                g.FillPath(coreBrush, corePath);
            }

            IntPtr hIcon = bmp.GetHicon();
            return Icon.FromHandle(hIcon);
        }

        public void Dispose()
        {
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
        }
    }
}