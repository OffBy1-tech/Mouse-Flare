using System;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Interop;

namespace Mouseflare.UI
{
    /// <summary>
    /// Code-behind for the neon control templates. Exists so the ComboBox
    /// dropdown — now an opaque popup window for guaranteed ClearType — can
    /// get DWM-rounded corners on Windows 11 when it opens.
    /// </summary>
    public partial class NeonControls : ResourceDictionary
    {
        public NeonControls()
        {
            InitializeComponent();
        }

        private void NeonPopup_Opened(object? sender, EventArgs e)
        {
            if (sender is Popup { Child: { } child } &&
                PresentationSource.FromVisual(child) is HwndSource source)
            {
                DwmChrome.TryRoundCorners(source.Handle, small: true);
            }
        }
    }
}
