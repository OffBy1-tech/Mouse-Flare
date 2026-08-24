# Frame-rate and poll-rate independence — design

**Date:** 2026-08-24
**Status:** Approved

## Problem

Every Mouseflare engine advances particles once per rendered frame and spawns
them once per mouse event. Both make the product's appearance depend on the
machine it runs on:

- **Frame rate**: on a 120 Hz display, particles age twice as fast as on
  60 Hz, so effects visibly last half as long. Aging sites: web
  `customFxRenderer` (`p.life += 1`) and `particleEngine` (`alpha -= decay`),
  macOS `CustomFx.swift:208` (`particles[i].life += 1`) and
  `OverlayView.swift:579` (`alpha -= decay`), Windows `CustomFx.cs:212`
  (`p.Life += 1`) and `TransparentOverlayWindow.cs` (`p.Alpha -= p.Decay`).
- **Input rate**: emission is per mouse event, so a 1000 Hz gaming mouse emits
  up to 8× the particles of a 125 Hz mouse. This also splits the two native
  apps: macOS polls a fixed 120 Hz timer (`MouseTracker.swift:30`) while the
  Windows low-level hook fires per hardware event, so the same preset has
  different density on each platform today.

## Constraint: stored units must not change

`lifetimeMin/Max` (15–80), `initialSpeedMin/Max`, `gravityX/Y`, and `drag` are
frame-referenced numbers living in `data/default-fx-presets.json`, the FX
Designer's sliders, users' saved preset libraries, and configs exchanged
between platforms via Copy JSON. Redefining them to seconds would silently
change every saved preset. The fix therefore keeps the units and changes only
how far each update advances them.

## Design

### Frame-equivalent advancement

Each engine's update computes elapsed wall-clock time and derives a scalar:

```
dt  = clamp(now - lastUpdate, 0, 0.1 seconds)   // 100 ms ceiling
fe  = dt * 60                                    // "frame equivalents"
```

`fe == 1` at 60 Hz, so current behavior at the reference rate is preserved
exactly; `fe == 0.5` at 120 Hz. Per-particle integration becomes:

| Today (per frame) | Becomes |
| :--- | :--- |
| `life += 1` | `life += fe` |
| `alpha -= decay` | `alpha -= decay * fe` |
| `x += vx` (and `y`) | `x += vx * fe` |
| `v += gravity` | `v += gravity * fe` |
| `v *= drag` | `v *= pow(drag, fe)` |
| curl / turbulence angle | `angle * fe` |

`drag` is multiplicative per frame, so it must be exponentiated rather than
multiplied — `pow(drag, fe)` is the only form that stays correct at any rate.

The 100 ms clamp bounds a stall (tab switch, breakpoint, sleep): without it a
multi-second `dt` would teleport particles across the screen and expire the
entire population in one tick.

### Time-budgeted emission

Emission stops counting events and accumulates a fractional budget while the
cursor is moving:

```
budget += spawnRateOnMove * fe
n       = min(floor(budget), 40)     // per-update cap
budget -= n
spawn n particles
```

The remainder carries across updates, so low rates still emit smoothly. The
cap prevents a `dt` spike from dumping a burst. Existing distance gating
(`dist < 0.5` early-return on web, equivalents on native) is unchanged, so a
stationary cursor still emits nothing.

Burst emission (`spawnBurstOnClick` on flare) is a one-shot count, not a rate,
and is deliberately left alone.

## Scope — six sites

| Platform | Passive/flare engine | Custom FX engine |
| :--- | :--- | :--- |
| Web | `src/engine/particleEngine.ts` | `src/engine/customFxRenderer.ts` |
| macOS | `Sources/OverlayView.swift` | `Sources/CustomFx.swift` |
| Windows | `UI/TransparentOverlayWindow.cs` | `Core/CustomFx.cs` |

`CustomFxCompositor.cs` is a sprite cache with no particle state and is not
touched.

## Error handling

- First update after start has no previous timestamp: seed `lastUpdate` at
  construction and treat a non-positive `dt` as `fe = 0` (no advancement, no
  emission) rather than a large jump.
- Clock going backwards (NTP correction, `Date` vs monotonic sources) is
  absorbed by the same `clamp(dt, 0, 0.1)`.

## Verification

- **Web (empirical)**: a harness drives the engine directly at simulated 60 Hz
  and 120 Hz step sizes and asserts that (a) a particle's wall-clock lifetime
  and (b) the particle count after one second of synthetic movement converge
  within a small tolerance across rates. Before the change these differ by
  roughly 2×; after, they should match. Also re-run the existing FPS harness to
  confirm no performance regression.
- **Natives (structural)**: `swift build` and the Windows cross-compile must
  pass, the CI packaged-app smoke test must stay green, and each native site
  must apply the identical formula from the table above. The frame loops cannot
  be instrumented from this environment, so native behavior is verified by
  construction and review, not measurement — this limitation is stated in the
  PR rather than glossed.

## Out of scope

- Converting stored preset units to seconds (would change saved presets).
- Distance-based emission (considered and rejected: it redefines "Spawn Rate
  (move)" and visibly changes every existing preset).
- The `fpsLimit` throttle in the web demo's render loop, which is orthogonal.

## Delivery

Branch `frame-rate-independence`, both fixes in a single PR against `main`,
with before/after measurements in the description.
