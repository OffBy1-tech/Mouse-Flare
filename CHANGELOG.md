# Changelog

All notable releases of Mouseflare. Generated from [GitHub Releases](https://github.com/OffBy1-tech/Mouse-Flare/releases).

## Mouseflare v0.7.0 (2026-08-23)

Stable release v0.7.0 (commit de67f1b37814e2a132dbb31392c41db2e01fc281).

## What's new

Mouseflare 0.7.0 — FX Designer preset library

### ✨ Added
- **FX Designer preset library, now on all three platforms**: Save stores your current design as a reusable preset (shown with a ★ in the Preset dropdown) and a Delete button removes it — the native macOS and Windows designers previously had no way to save at all. The library persists instantly and survives closing the window without Apply & Save.

### 🎨 Changed
- Native FX Designers restyled to match the web designer: the colors/glow row and the slider grid sit in card containers, and all designer text is 2pt larger.
- "Archetype" is now "Preset" throughout the FX Designer on every platform.
- General tab reworded and regrouped on all platforms: "Launch on startup" (was "Start with OS"), "Play Sound on Flare" (was "Acoustic Beacon Chime", now directly under the master switch), and "Flare hotkey" (was "Find Mouse Global Hotkey").
- Web settings brought in line with the native apps: FX Studio header/subtext now match, the duplicate title-bar Apply & Save is gone (the footer button remains), "Done / Close" is now "Close", and web-only cards were removed (Software Updates in General; Multi-Monitor Display Arena and Reduced Motion in Behavior).
- Web FX Designer finished its styling pass (#2): spacing, labels, and sliders match the other settings tabs, and its status messages surface in the settings title-bar pill like everything else.

### 🐛 Fixed
- FX Designer: reopening the settings window no longer shows a blank Preset dropdown — the preset you applied is re-selected.
- FX Designer: Save can no longer silently overwrite an existing saved preset via re-imported JSON — imported configs always get a fresh identity, and overwriting only happens on the preset actually loaded from the library.


## Verify your download

```
88dbffdd7dd4631b859ecdd2dac9e49cde57d748d06c5db2f908fba236be8ca8  Mouseflare-macOS.zip
02fb9be257d08f3d597779f19a01cc787cbc4b36e148684bb6f3b804280e90ca  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.6.5 (2026-08-21)

## Mouseflare 0.6.5 — True ClearType on Windows

### 🐛 Fixed
- **Windows**: text sharpness, definitively. The settings and color-picker windows moved from transparent layered windows (where Windows disables ClearType entirely) to opaque native-chrome windows, and dropdown lists open as opaque popups — so all text now renders with real subpixel ClearType instead of grayscale smoothing.

### 🎨 Changed
- The soft violet glow around the window and dropdown edges is replaced by the standard system drop shadow; the gradient borders and all interior styling are unchanged. Windows 11 rounds the corners natively; Windows 10 shows square corners.

## Mouseflare v0.6.4 (2026-08-21)

## Mouseflare 0.6.4 — Crisp Text on Windows

### 🐛 Fixed
- **Windows**: remaining soft/thin text — most visible in dropdown lists and the small version line. The transparent window style had ClearType disabled entirely; subpixel text rendering is now explicitly re-enabled over the app's opaque surfaces, in both windows and inside dropdown popups, with pixel-snapped popup layout.

## Mouseflare v0.6.3 (2026-08-21)

## Mouseflare 0.6.3 — Windows FX Hang Fix

### 🐛 Fixed
- **Windows**: multi-second hangs (and the fallback to flat rendering) with color-cycling custom effects like Chromatic Rainbow Rush. The FX sprite cache was keyed on particle color, so a cycling hue rebuilt GPU bitmaps hundreds of times per second until Windows refused. Sprites are now cached color-free and tinted per particle — a rainbow design uses one cached sprite instead of one per hue — with hard caps on sprite size and per-frame bitmap creation so no design can stall the app.

### ✨ Improved
- Rainbow and gradient custom effects on Windows render with exact per-particle color (no more quantization banding).

## Mouseflare v0.6.2 (2026-08-21)

## Mouseflare 0.6.2 — Windows Stability

### 🐛 Fixed
- **Windows**: repeated crashes with custom FX active. The 0.6.0 pixel compositor ran inside the frame-render callback, where a single failure (such as a graphics-environment hiccup during sprite creation) took the whole app down — and again every frame after relaunch while the same design was active. The compositor is now fully fail-safed: any fault falls back to plain rendering for the session instead of crashing, and its inputs are hardened against runaway or malformed custom-FX configs.

### 🩺 Added
- **Windows crash log**: unhandled errors are now recorded to `%AppData%\Mouseflare\crash.log` (with a per-launch marker), so if anything still goes wrong, the log tells us exactly what.

## Mouseflare v0.6.1 (2026-08-21)

## Mouseflare 0.6.1 — macOS Layout Hotfix

### 🐛 Fixed
- **macOS**: checking for updates could blow the settings window up far wider than the screen. Release-note text was allowed to dictate the window's width through Auto Layout; runtime text labels in the Updates tab can no longer push the window's size, changelog bullets now wrap fully (matching the web), and the window is hard-clamped to its designed 940×680.

## Mouseflare v0.6.0 (2026-08-21)

## Mouseflare 0.6.0 — Hover Polish & True Additive FX on Windows

### 🖱️ Hover states everywhere
- Every button on all three platforms now responds to the mouse with one shared language: quiet buttons brighten their violet border with a faint glow and a slight lift, primary gradient buttons glow warmer, and selected items stay stable under the pointer.
- macOS buttons gained hover for the first time (with reduced-motion support); Windows' inline-styled buttons (nav, preset cards, chips, swatches) join the already-hovering templated controls; the web filled its last few gaps.

### 🌟 Windows custom FX: real additive blending and glow bloom (#1)
- FX Designer configs using `lighter`, `screen`, or `color-dodge` blends — and glow bloom — now render on Windows through a new pixel compositor instead of falling back to flat compositing. Additive-heavy designs like **Cyberpunk Surge** finally match the web simulator and macOS.
- Plain designs keep the original fast path, and the compositor tracks the particle cloud with dirty-region updates to stay light at full frame rate.

### 🔍 Crisp text on Windows
- Fixed blurry, ghosted text throughout the settings window — most visibly on dropdowns. Glow effects were rasterizing the text they wrapped (including the window frame's own glow, which softened every label in the app); glows now live on dedicated carrier elements behind the content, with pixel-snapped layout on both windows.

## Mouseflare v0.5.0 (2026-08-21)

## Mouseflare 0.5.0 — Neon Settings & Smarter Saves

### ✨ Neon settings UI on all three platforms
- Complete synthwave restyle of the settings experience: deep-space grounds, violet/blue/magenta gradient borders and glows, and glowing gradient pills for selected items — consistent across the web simulator, macOS, and Windows.
- Fully custom controls everywhere, replacing stock OS chrome: templated WPF controls on Windows (dropdowns, buttons, sliders, checkboxes, scrollbars), hand-built AppKit controls on macOS (popups, switches, sliders), and an accessible custom dropdown on the web with full keyboard support.
- The Windows color picker window now matches the theme.

### 💾 Preview vs. save, finally sane
- FX Studio and FX Designer changes preview live on your cursor but only stick when you click **Apply & Save** — closing the window without saving reverts to what you had.
- General and Behavior & Monitors settings save instantly the moment they change; the Apply & Save button now appears only on the FX tabs.
- Windows: opening the FX Designer tab no longer hijacks your passive effect.

### 🧪 FX Designer parity
- The web designer was rebuilt to match the native layout — archetype picker, parameter popups, the full slider grid — with the same live-on-cursor preview the native apps have.

### 🔄 A real Updates tab on macOS and Windows
- Status card showing installed vs. latest version, when you last checked, and one-click install when an update is available.
- Itemized changelog pulled from actual GitHub release notes.
- Configurable check cadence: every 6 / 24 / 72 hours, or manual only.
- The beta channel concept has been retired; updates follow stable releases.

### ⌨️ Custom hotkeys on macOS
- Click the hotkey combo in Settings to record any modifier combination — no longer limited to the four presets.

### 🥚 One more thing
- The Diagnostics tab is now hidden. Click the version text in the settings sidebar five times to find it.

## Mouseflare v0.4.0 (2026-08-20)

Stable release v0.4.0 (commit f9ce324239a007218d41e619e7e6e4a5d4e3d72c).

## What's new

The FX Designer

- Design your own particle effects: a new FX Designer tab in Settings with 13 shapes, 6 emission patterns, full physics (gravity, wind, drag, turbulence, vortex), lifetime curves, and 5 color modes — previewing live on your actual cursor as you tune
- 9 built-in archetypes to start from, from Solar Plasma Flare to Chromatic Rainbow Rush
- Designs travel as JSON: copy from any platform (web simulator, macOS, Windows) and import on any other via the clipboard (macOS also supports --import-fx <file.json>)
- Your creation becomes the Custom FX preset, persists with settings, and bursts along with Find Mouse flares


## Verify your download

```
4ff0c87fc42e4bb832fd411a943edabe21a67b645362d85d3ffeaa37551f1a86  Mouseflare-macOS.zip
34c00e125694ecd84cfb04198a3946de521c2cc1cf84787ee1eef7b4e25473dc  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.3.5 (2026-08-20)

Stable release v0.3.5 (commit 06ee3df1ef094a4c89d177f8a15bfc67c0f7fb97).

## What's new

Behavior settings cleanup

- Fixed Wake-From-Idle Burst never firing on macOS
- Removed the Shake-to-Find and Reduced Motion options


## Verify your download

```
d1d18b3d75393255cead33a34fa232f98720f1b7d60bffe71f9d0eb5637d9186  Mouseflare-macOS.zip
deddd3ed921011c83a2672372d08773e5f921e77b743868adeca92b32101b6ed  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.3.4 (2026-08-20)

Stable release v0.3.4 (commit 4de36df7dfabf9d849643ee6345796a1325c44a7).

## What's new

White version text

- The version label above Test Flare Now is now white for readability


## Verify your download

```
b45c98a0fa9e1d3dd96013a993b446cc144df64dcef50079f9c3110958cb5ce6  Mouseflare-macOS.zip
10fd7274f0cbded9cbec8ef4652a05ed76ccf0d76fe299461b3d5fb248cc3cbb  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.3.3 (2026-08-20)

Stable release v0.3.3 (commit a841822fbb3cb09404430ebd9bbc05090c3b1984).

## What's new

Smarter quick swatches

- Click a quick swatch to use its color — the active swatch now shows a selection ring
- Double-click a swatch to edit the color that lives there
- Three more quick swatches (8 total); the hex field applies on Enter


## Verify your download

```
339931b355cf608243ded2970bf531eab0113958d33de459cab0beecfbf18b5d  Mouseflare-macOS.zip
a27f39185e21c0e31a004fb8a6fffda6805ba3c503d619d6382cca2a9ff58e0f  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.3.2 (2026-08-20)

Stable release v0.3.2 (commit 45621891565fab7ffdbd840b361cc0be992dc5ea).

## What's new

Settings that stick

- Windows: settings now save automatically (on window close, exit, and before updates) — no more losing preferences across restarts or updates
- Windows: fixed the color picker's Done/Cancel buttons being cut off


## Verify your download

```
b56f88b160b363077fa5168cc26e5c5cc36d7d4161941bdac4cf8069b37e8629  Mouseflare-macOS.zip
287db3162e785555a34e099e382579e021bddf2e260c98dc1de44678757588f2  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.3.1 (2026-08-20)

Stable release v0.3.1 (commit a10c9a40a6f65bebcbccc28daf95586158d49471).

## What's new

Fluid controls on Windows & UI polish

- Windows: new Fluid Dynamics & Vorticity Engine section — vorticity and smoke-persistence sliders now shape the fluid presets, matching macOS
- Cleaner settings title bar; the installed version now shows in the sidebar on both platforms


## Verify your download

```
860645433ca0458ed4d0da42353bf8ee55c293bb7586cab9c7dcd9a28069c10d  Mouseflare-macOS.zip
a2c084574d32fc09d6601a33d3df5834e33a8c018a089605276d40f26721850c  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.3.0 (2026-08-20)

Stable release v0.3.0 (commit 8f169b5f667c1cb10e5dd9466ae0e4c14dbe7b77).

## What's new

Color picker

- New popup color picker: hue ring + brightness disc, live preview on your cursor FX, eyedropper, hex entry, and old/new comparison
- Quick color swatches are now editable — click any swatch to pick the color that lives there (persisted across restarts)
- Settings added in future updates no longer reset existing preferences on macOS


## Verify your download

```
cbf2caab169ed25f5f78aaa0f6fb0f1b7da3c37b63e15bd7651e9b83857e4498  Mouseflare-macOS.zip
14718689ca8506a03f1ff1f1969be54b1c212db0a92abe4791d338bf785b26d3  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.2.4 (2026-08-20)

Stable release v0.2.4 (commit 6f2bceb51decf48e78d54f86e6be72e30ae6ec73).

## What's new

Reliable Windows updates

- Windows: self-update no longer fails with 'file in use' when debug symbols are loaded — every file is renamed aside rather than overwritten, with rollback on failure


## Verify your download

```
3377009d1a7f168e6a6eb809662dd63f4d0c719db9b9c2901b320da99ecb35f3  Mouseflare-macOS.zip
2dc73c2e00c9db20e98bda603439341b1836f587175945c63008edf6aa5e9d4e  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.2.3 (2026-08-20)

Stable release v0.2.3 (commit cf7ab9adcc1699e63e92e6ed9809c3bf5c289289).

## What's new

Fix Settings window crash on Windows

- Windows: opening Settings no longer crashes with a XAML parse error (single-file publish could not resolve the logo image; it is now an embedded resource)
- Windows: settings-window failures now show a readable error dialog instead of the unhandled-exception dialog


## Verify your download

```
bd2db33dabd1cc39aa13a6a7a168dd62d5994a7b8bce1b2516e8531450595879  Mouseflare-macOS.zip
4bf3ffac0c3c09bb69e4ddc3cd4f9559c39b0df0562e7555719c9b6bcd56199e  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.2.2 (2026-08-20)

Stable release v0.2.2 (commit 7d781de1221260149afc6a35c679fe6bb2a16268).

## What's new

Live effect previews while Settings is open

- macOS: cursor FX no longer vanish behind the Settings window — pick a preset and see it instantly, right over the window


## Verify your download

```
585e2403db0380a22892b766e58c620a7c2e9d95ad8bef19de1e1ded7d0a955e  Mouseflare-macOS.zip
ae55b7dec9a7982cc09fbe77f01764232ec0633cf71695b3761f5447f00fd1e3  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.2.1 (2026-08-19)

Stable release v0.2.1 (commit 541c10830912e2e8aeca72b1c6dad34f23b23829).

## What's new

App icon & first-launch fixes

- Mouseflare.app now has a proper Finder/Dock icon (previously showed the blank generic icon)
- Corrected first-launch instructions for macOS 15+: use `xattr -dr com.apple.quarantine Mouseflare.app` or System Settings → Privacy & Security → Open Anyway (the old right-click → Open bypass no longer works)


## Verify your download

```
9447e7e1ea349f3bed2c4f8cb27e2e5760419e4797b0ccc859c568d86d821748  Mouseflare-macOS.zip
9c2e6c12499b8b7651b52ecb27be01c8a4835e03a55df805fd4daae777447526  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS** (universal, macOS 13+): not notarized yet, so Gatekeeper blocks the first launch. Unzip, then: `xattr -dr com.apple.quarantine Mouseflare.app && open Mouseflare.app` (or use System Settings → Privacy & Security → Open Anyway). Needed once per download; the app's own auto-updates are not quarantined.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.2.0 (2026-08-19)

Stable release v0.2.0 (commit 67ac73bfae1bfe3dbbdef7599a1ea962c8615fbd).

## What's new

Auto-update arrives

- Mouseflare now updates itself: both apps quietly check GitHub Releases every 6 hours and offer one-click updates from the macOS menu bar / Windows system tray
- Every update is cryptographically verified (minisign, Ed25519) against the project's signing key before a single byte is unpacked
- New "Automatic Update Checks" toggle in Settings → General, showing the installed version
- macOS: built-in signature checking for any download via `Mouseflare --verify <file> <file.minisig>`
- Web simulator now shows live release data from GitHub instead of demo content


## Verify your download

```
6b34b6f7311b427c844f1146577cf50d03561694aeaa3ae081e8e8e11a3fc7bd  Mouseflare-macOS.zip
dbb0f1190e4fcec703d736695df87336dae7ffc942e9f32e30a30a941040b945  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS**: unzip and launch Mouseflare.app (universal, macOS 13+). Ad-hoc signed, not notarized: on first launch, right-click the app and choose Open.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).

## Mouseflare v0.1.0 (2026-08-19)

Stable release v0.1.0 (commit 05864d20f68aa3dc85191bcf585dac192b8f0b10).

## Verify your download

```
68f3e643ee86f03b7883c246a3f06461f4e7bf4f3b2ae19e52200b0b4cfb0292  Mouseflare-macOS.zip
1be0dbb984f8d45df3f244ba8fdaa8f85f8912ae65085e644ad9d6e25eeddbfd  Mouseflare-Windows.zip
```

Artifacts are minisign-signed ([public key](https://github.com/OffBy1-tech/Mouse-Flare/blob/main/minisign.pub)):

```
minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw
```

- **macOS**: unzip and launch Mouseflare.app (universal, macOS 13+). Ad-hoc signed, not notarized: on first launch, right-click the app and choose Open.
- **Windows**: requires the free [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0).
