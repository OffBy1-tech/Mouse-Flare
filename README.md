# Mouseflare

**Never lose your mouse cursor again.**

Mouseflare is a lightweight desktop utility for **Windows and macOS** that makes your mouse pointer impossible to lose. It renders short-lived, GPU-friendly visual effects that follow the cursor as it moves, and a configurable global hotkey fires a high-visibility "flare" at the cursor's exact position when you need to find it *right now*.

> **"Where's my mouse?"** → hotkey → **"There it is."**

An open source project by [Off By 1](https://github.com/OffBy1-tech) — [OffBy1-tech/Mouse-Flare](https://github.com/OffBy1-tech/Mouse-Flare).

## How it works

Mouseflare combines two ideas:

1. **Passive visibility** — subtle particle FX (spark trails, glow pulses, fluid smoke, and more) trail the cursor during normal use, making it easy to track without being distracting.
2. **Active discovery** — press the Find Mouse hotkey from any application and a bright flare (expanding rings, particle burst, rapid fade) erupts at the cursor's current position, then disappears within about a second.

Effects render on a transparent, click-through overlay: they never intercept clicks, steal focus, or slow down mouse movement. Multi-monitor setups — mixed resolutions, mixed DPI scaling, arbitrary arrangements — are a first-class requirement, not an afterthought.

## What's in this repo

| Path | What it is |
|---|---|
| `src/` | An interactive **web-based simulator** (React + Vite + TypeScript) — a simulated desktop where you can try every effect, tweak settings, and play the Find Mouse challenge in your browser |
| `src/native/windows/` | The **native Windows app** (C# / .NET 8) — system-tray utility with global hotkey, transparent overlay, and settings window |
| `src/native/macos/` | The **native macOS app** (Swift / AppKit) — menu bar agent with the same overlay and hotkey behavior across all connected displays |
| `docs/mouseflare-prd.md` | The full product requirements document |

The web simulator and the native apps share the same effect designs and settings model, so the simulator doubles as a live preview of what the desktop apps do.

## Effects

**Passive FX presets:** Spark Trail, Glow Pulse, Comet Trail, Bubbles, Fireflies, Star Dust, Lightning Arc, Rainbow Wave, Plasma Field, Fluid Simulation, Fluid Smoke Swirl, Neon Fluid Dye, Cosmic Liquid, Ink Diffusion, Matrix Rain, Fire & Flame, Neon Cyber, Magic Dust, Galaxy Supernova, Minimalist Beacon.

**Find Mouse flares:** Solar Flare, Sonar Radar, Neon Beacon, Quantum Shockwave, Supernova, Fluid Vortex Burst.

Everything is tunable: intensity, particle density, trail length, animation speed, color presets (or a custom color), minimum movement threshold, idle-burst behavior, monitor-crossing effects, reduced motion, sound FX, and FPS limits.

## Running the web simulator

**Prerequisites:** Node.js (or Bun)

```bash
git clone https://github.com/OffBy1-tech/Mouse-Flare.git
cd Mouse-Flare
npm install    # or: bun install
npm run dev    # or: bun run dev
```

Then open http://localhost:3000. No API keys or environment variables are needed.

## Running natively on Windows

**Prerequisites:** Windows 10 (1903+) or 11, and the [.NET 8.0 SDK](https://dotnet.microsoft.com/download)

```
cd src/native/windows
build.bat        # or: ./publish.ps1 in PowerShell
```

This compiles and launches `Mouseflare.exe` in your system tray. Press **`Ctrl + Shift + F`** anywhere to trigger Find Mouse; right-click the tray icon for settings. See [`src/native/windows/README.md`](src/native/windows/README.md) for details.

## Running natively on macOS

**Prerequisites:** macOS 13 (Ventura) or later, Xcode Command Line Tools (`xcode-select --install`)

```bash
cd src/native/macos
chmod +x build.sh
./build.sh
```

This builds with Swift Package Manager and starts the menu bar agent (look for the ✨ icon). Press **`⌘ + Shift + F`** from any app to trigger Find Mouse. See [`src/native/macos/README.md`](src/native/macos/README.md) for details.

## Design principles

- **Instant** — no perceptible delay between mouse movement and FX.
- **Lightweight** — near-zero CPU when idle; bounded particle counts and animation lifetimes during FX. If it's ever prettier-effects vs. system responsiveness, responsiveness wins.
- **Non-intrusive** — effects fade fast, never block clicks, and never steal focus.
- **Private** — fully local. No network connection, no telemetry, no accounts, no data collection. Cursor position lives only transiently in memory.
- **Restrained** — the product is the moment of finding your mouse, not a desktop effects platform.

The full vision, requirements, and roadmap live in the [PRD](docs/mouseflare-prd.md).

## Status

Early development. The initial app was prototyped with Google AI Studio and is being developed into polished native utilities for both platforms. Contributions and feedback are welcome.

## License

[MIT](LICENSE) © Off By 1
