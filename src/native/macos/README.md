# Mouseflare — Native macOS Menu Bar Application

Mouseflare for macOS is a lightweight status bar utility built in pure Swift and AppKit. It creates a transparent click-through floating overlay across all connected Mac displays and tracks your cursor in real time.

## 🚀 How to Run Natively on macOS

### 1. Requirements
- macOS 13.0 (Ventura) or later (Apple Silicon or Intel)
- Xcode Command Line Tools (`xcode-select --install` in Terminal)

### 2. Build & Launch in 1 Step
1. Open Terminal in the extracted folder.
2. Run:
   ```bash
   chmod +x build.sh
   ./build.sh
   ```
3. Mouseflare compiles with Swift Package Manager, applies local code signature, and starts the Menu Bar agent with live terminal logs.

### 3. Usage & Features
- **Menu Bar**: Look for the **✨** icon in the top right menu bar. Click it to trigger Find Mouse, open **Settings & FX Studio**, or toggle effects.
- **Settings & FX Studio**: A full dark-themed settings window (matching the Windows build) with sidebar navigation — General, FX Studio, Behavior & Monitors, and Diagnostics. Pick from 20 passive trail presets, 6 Find Mouse flare animations, 7 color palettes (plus custom hex), and tune physics sliders live. Launch with `Mouseflare --settings` to open it directly.
- **Global Hotkey**: Press **`⌘ + Shift + F`** (configurable: `⌃ + Space`, `⌥ + M`, or `F1`) from any application to blast a beacon shockwave directly at your cursor.
- **Shake to Find**: Rapidly shake the mouse to trigger the flare automatically.
- **Auto-Update**: Versioned builds quietly check GitHub Releases every 6 hours (toggle in Settings → General) and offer one-click, minisign-verified updates from the menu bar ("Check for Updates…"). Dev builds built from source never self-update. `Mouseflare --verify <file> <file.minisig>` checks any download against the release key.
- **Immediate Tracking**: The engine tracks your cursor via ultra-low-latency 120Hz polling alongside native AppKit event monitors without needing complex terminal permissions.
