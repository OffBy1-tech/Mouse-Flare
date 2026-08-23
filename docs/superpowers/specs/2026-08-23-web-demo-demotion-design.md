# Web demotion to a Pages-hosted showcase demo — design

**Date:** 2026-08-23
**Status:** Approved

## Context

The web build began as the Google AI Studio prototype and grew into a full
replica of the native settings experience. It is not deployed anywhere, it
cannot perform the product's actual job (a browser cannot overlay the real
cursor), and the three-way parity contract makes every UI change cost 3×.
After the parity batches, the native apps are self-sufficient (native FX
Designer has full parity including Save and the color picker), so the web
build's remaining value is as a **showcase demo** and as the canonical home
of shared FX preset data.

Decision: demote the web build to a small GitHub Pages demo; move the shared
preset data to a repo-root `data/` directory; retire the parity rule to
two-way (macOS ↔ Windows).

## A. Canonical data directory

- New file `data/default-fx-presets.json`: the 9 built-in FX Designer
  archetypes, extracted verbatim from `src/data/defaultFxPresets.ts` (which
  is today hand-duplicated as JSON string literals inside
  `src/native/macos/Sources/DefaultFxPresets.swift` and
  `src/native/windows/Core/DefaultFxPresets.cs`).
- **Web**: `src/data/defaultFxPresets.ts` becomes a thin typed re-export of
  the JSON (`import presets from '../../data/default-fx-presets.json'`).
  Enable `resolveJsonModule` in tsconfig if not already on.
- **Natives**: new `scripts/generate-fx-presets.mjs` reads the JSON and
  rewrites the embedded JSON literal in both native files between
  `// GENERATED-PRESETS-BEGIN/END` style markers, preserving each file's
  literal syntax (Swift `##"…"##` raw string, C# `"""…"""` raw string) and
  the existing unicode-escaped, minified single-line format. Exposed as
  `bun run generate:presets`; `--check` mode exits non-zero when the
  embedded literals do not match the JSON (wired into
  `.github/workflows/release-build.yml` as an early step).
- Scope: only the shared preset library moves. `src/data/defaultSettings.ts`
  stays (web-demo-shaped); native defaults stay inline in their platforms.

## B. Demo composition

Single-screen showcase, roughly: desktop playground + overlay engine + a
compact right-side demo panel + top bar.

**Stays:**
- `engine/` (particle, fluid, customFx, sound), `OverlayCanvas` (HUD
  removed), `DesktopSimulator` (scene switcher stays), `FxDesigner`,
  `NeonColorPicker`, `NeonSelect`, `FindMouseChallengeModal`.
- Top bar (simplified): logo, scene switcher, `Flare (hotkey)` button,
  **Download for macOS / Windows** buttons linking to
  `https://github.com/OffBy1-tech/Mouse-Flare/releases/latest`.
- Demo panel with three sections:
  1. **Effects** — passive trail preset chips, flare preset chips, color
     palette chips + custom color (NeonColorPicker), no fine-tuning sliders
     (the designer provides depth; the native apps own tuning).
  2. **FX Designer** — the existing component, framed as "design here →
     Copy JSON → import into the desktop app".
  3. **Find-Mouse Challenge** — the existing game, launched from the panel.

**Deleted:**
- `SettingsWindow.tsx` (all tabs), `OnboardingDialog`, `WindowsTaskbar`
  (simulated tray), telemetry HUD in `OverlayCanvas`, update checker +
  update banner, `nativeDownloader.ts` + `nativeSource.ts` (source
  browsing/zips — CTAs point at GitHub Releases instead), and every
  `AppSettings` key only those surfaces used (hotkey recording, updates
  fields, diagnostics, startWithWindows, soundFx toggle UI, etc. — the
  demo keeps: passiveFx, findMouseFx, colorPreset, customColor,
  quickSwatches, enablePassiveFx, customFxConfig, the fluid keys, and the
  engine-consumed tuning values intensity / particleDensity /
  animationSpeed / minMovementThreshold at their defaults; `hotkey` stays
  as a static display string for the Flare button and challenge copy — no
  recording UI).
- localStorage keeps only the demo state + the designer's custom preset
  library (existing `mouseflare_custom_fx_presets` key unchanged).

## C. GitHub Pages deployment

- `vite.config.ts`: `base` becomes `process.env.PAGES_BASE ?? '/'`; the
  workflow builds with `PAGES_BASE=/Mouse-Flare/`.
- Absolute asset references (`/app-logo.png`) become base-aware via
  `import.meta.env.BASE_URL`.
- New `.github/workflows/deploy-pages.yml`: on push to `main` (and
  `workflow_dispatch`): checkout → setup bun → `bun install` →
  `PAGES_BASE=/Mouse-Flare/ bun run build` → `actions/upload-pages-artifact`
  (dist) → `actions/deploy-pages` with the standard `pages: write` /
  `id-token: write` permissions and environment `github-pages`.
- Manual step for the maintainer afterward: repo Settings → Pages → Source →
  GitHub Actions.

## D. Contract and docs

- Parity rule retires to **two-way**: macOS ↔ Windows must match; the web
  demo is exempt (showcase only, changes at its own pace). The assistant's
  saved memory rule is updated to say exactly this.
- README rewritten: the product is the two native apps; the demo is linked
  as "Try it in your browser" (`https://offby1-tech.github.io/Mouse-Flare/`);
  repository-structure table updated; web-simulator marketing framing
  removed.
- `package.json` description updated to match the new framing.
- The parity-audit artifact gets a footnote that web rows are demo-exempt
  going forward.

## E. Error handling

- Generator: refuses to write when markers are missing (clear error naming
  the file); `--check` prints a diff-sized summary on mismatch.
- Demo: releases links are plain anchors (no API calls, nothing to fail);
  localStorage reads stay wrapped in try/catch as today.

## F. Verification

- `bun run lint` and `bun run build` (with and without `PAGES_BASE`).
- `bun run generate:presets --check` passes; deliberately corrupting a
  literal makes it fail (spot check during implementation).
- Playwright pass over the built demo: scenes switch, trail/flare/color
  chips apply, designer opens + Copy JSON works, challenge launches,
  download links point at releases.
- `swift build` and the Windows cross-compile still pass (native files are
  regenerated byte-compatibly; behavior unchanged).

## Out of scope

- Native app changes beyond the regenerated preset literals.
- Custom domain, analytics, or SEO for the demo.
- Deleting the web git history (the demotion is a normal commit).
