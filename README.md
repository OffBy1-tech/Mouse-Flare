<div align="center">

<img src="./assets/app-logo.png" alt="Mouseflare Logo" width="120" height="120" />

# 🌟 Mouseflare 🌟
*Never lose your mouse cursor again.*

> **"Where the #@!* is my mouse?!"** → *hotkey* → **"Ah, there it is."**

An open source project by [Off By 1](https://github.com/OffBy1-tech) — [OffBy1-tech/Mouse-Flare](https://github.com/OffBy1-tech/Mouse-Flare).

---

</div>

## 🚀 What is Mouseflare?
Mouseflare is a lightweight desktop utility for **Windows and macOS** that makes your mouse pointer impossible to lose. It renders short-lived, GPU-friendly visual effects that follow the cursor as it moves, and a configurable global hotkey fires a high-visibility "flare" at the cursor's exact position when you need to find it *right now*.

Effects render on a transparent, click-through overlay: they never intercept clicks, steal focus, or slow down mouse movement. Multi-monitor setups — mixed resolutions, mixed DPI scaling, arbitrary arrangements — are a first-class requirement, not an afterthought.

The product is the two native apps below. **[Try the live demo](https://offby1-tech.github.io/Mouse-Flare/)** — the FX engine and designer running in your browser; the real overlay ships in the desktop apps.

---

## ⚡ How It Works

```text
[Mouse Moves]  ---> 🌌 Passive Visibility (Subtle particle trails follow your movement)
[Press Hotkey] ---> 💥 Active Discovery     (A bright, instant flare erupts at the cursor)
```

1. **Passive visibility:** Subtle particle FX (spark trails, glow pulses, fluid smoke) trail the cursor during normal use, making it easy to track without being distracting.
2. **Active discovery:** Press the Find Mouse hotkey from any application and a bright flare (expanding rings, particle burst, rapid fade) erupts at the cursor's current position, then disappears within about a second.

---

## 📦 Repository Structure

| Path | Component | What it is |
| :--- | :--- | :--- |
| 🌐 `src/` | **Showcase Demo** | The FX playground, designer, and find-mouse challenge (React + Vite) — hosted on GitHub Pages. |
| 🪟 `src/native/windows/` | **Windows App** | Native C# / .NET 8 system-tray utility with global hotkeys and transparent overlay. |
| 🍎 `src/native/macos/` | **macOS App** | Native Swift / AppKit menu bar agent managing overlays across all displays. |
| 🗂️ `data/` | **Shared FX Presets** | `default-fx-presets.json` — the canonical FX Designer preset library consumed by the web demo and both native apps. |
| ⚙️ `scripts/` | **Preset Generator** | `generate-fx-presets.mjs` — regenerates the native-embedded preset literals from `data/default-fx-presets.json` (`bun run generate:presets`). |
| 📄 `docs/` | **Documentation** | Contains the full product requirements document (`mouseflare-prd.md`). |

---

## 🎨 Visual Effects Library

Everything is tunable: intensity, particle density, trail length, animation speed, custom colors, minimum movement thresholds, idle-burst behavior, monitor-crossing effects, reduced motion, sound FX, and FPS limits.

<details>
<summary>🔮 <b>Click to expand the full Effects Checklist</b></summary>

### Passive FX Presets
*   Spark Trail / Glow Pulse / Comet Trail
*   Bubbles / Fireflies / Star Dust
*   Lightning Arc / Rainbow Wave / Plasma Field
*   Fluid Simulation / Fluid Smoke Swirl / Neon Fluid Dye
*   Cosmic Liquid / Ink Diffusion / Matrix Rain
*   Fire & Flame / Neon Cyber / Magic Dust
*   Galaxy Supernova / Minimalist Beacon

### Find Mouse Flares
*   Solar Flare / Sonar Radar / Neon Beacon
*   Quantum Shockwave / Supernova / Fluid Vortex Burst
</details>

---

## 💾 Download & Verification

Prebuilt apps for every push to `main` are published on the [latest development build](https://github.com/OffBy1-tech/Mouse-Flare/releases/tag/latest) release: `Mouseflare-macOS.zip` (universal .app for Apple Silicon + Intel, macOS 13+) and `Mouseflare-Windows.zip` (x64, requires free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0)).

### 🔍 Integrity Check
Verify your download against the `SHA256SUMS.txt` published alongside the zips:

```bash
# macOS (with the zip and SHA256SUMS.txt in the same folder)
shasum -a 256 -c SHA256SUMS.txt

# Windows
certutil -hashfile Mouseflare-Windows.zip SHA256
```

Stable (versioned) releases additionally carry [minisign](https://jedisct1.github.io/minisign/) signatures verifiable against the repo's [`minisign.pub`](minisign.pub):
```bash
minisign -Vm Mouseflare-macOS.zip -p minisign.pub
```

### 🍏 macOS Gatekeeper Note
The macOS app is ad-hoc signed but not notarized yet, so Gatekeeper blocks the first launch. After verifying your download, strip the quarantine flag and open:
```bash
xattr -dr com.apple.quarantine Mouseflare.app
open Mouseflare.app
```
*(Alternatively: attempt launch → System Settings → Privacy & Security → Click "Open Anyway".)*

---

## 🛠️ Developer Setup & Execution

### 🌐 1. Web Demo
**Prerequisites:** Node.js or Bun
```bash
git clone https://github.com/OffBy1-tech/Mouse-Flare.git
cd Mouse-Flare
npm install    # or: bun install
npm run dev    # or: bun run dev
```
👉 Open http://localhost:3000 (No API keys required). This is the same showcase demo published at [offby1-tech.github.io/Mouse-Flare](https://offby1-tech.github.io/Mouse-Flare/): the FX playground, Effects panel, FX Designer (Copy JSON to import presets into the desktop apps), and the Find Mouse challenge.

### 🪟 2. Native Windows App
**Prerequisites:** Windows 10 (1903+) / 11, [.NET 8.0 SDK](https://dotnet.microsoft.com/download)
```cmd
cd src/native/windows
build.bat        # or: ./publish.ps1 in PowerShell
```
👉 **Hotkey:** Press `Ctrl + Shift + F` anywhere. Right-click the system tray icon for settings. See [`src/native/windows/README.md`](src/native/windows/README.md).

### 🍎 3. Native macOS App
**Prerequisites:** macOS 13+ (Ventura), Xcode Command Line Tools (`xcode-select --install`)
```bash
cd src/native/macos
chmod +x build.sh
./build.sh
```
👉 **Hotkey:** Press `⌘ + Shift + F` anywhere. Look for the ✨ icon in your menu bar. See [`src/native/macos/README.md`](src/native/macos/README.md).

---

## 🧠 Design Principles

*   **⚡ Instant:** Near-zero lag between physical mouse movement and FX rendering.
*   **🔋 Lightweight:** Near-zero CPU impact when idle; strict limits on particle lifetimes.
*   **🛡️ Non-intrusive:** Effects fade rapidly, never steal focus, and never block mouse clicks.
*   **🔒 Private:** Fully local operations. No networks, no telemetry, no tracking.
*   **🎯 Restrained:** Built to help you find your pointer, not to act as a generic theme platform.

---

## 📈 Status & Contributing

Early development. The initial app was prototyped with Google AI Studio and is being actively developed into polished native utilities. Contributions, issue reports, and feedback are always welcome.

## 📄 License

[MIT](LICENSE) © Off By 1
