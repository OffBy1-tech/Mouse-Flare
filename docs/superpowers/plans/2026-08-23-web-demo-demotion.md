# Web Demo Demotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demote the web build to a small GitHub Pages showcase demo, with the shared FX preset data promoted to a canonical repo-root `data/` file feeding all three platforms.

**Architecture:** One canonical `data/default-fx-presets.json`; web re-exports it, a generator script rewrites the embedded literals in both native `DefaultFxPresets` files (with a CI `--check`). The web app collapses to: desktop playground + overlay engine + a right-side `DemoPanel` (Effects / FX Designer / Challenge) + a top bar with download CTAs. A Pages workflow deploys `dist/` on pushes to main.

**Tech Stack:** React 19 + Vite + TS (bun), Node script for generation, GitHub Actions Pages deploy. Verification: `bun run lint`, `bun run build`, Playwright (headless Chromium at `~/Library/Caches/ms-playwright/chromium_headless_shell-1228/...`), `swift build`, `dotnet build -p:EnableWindowsTargeting=true`.

**Spec:** `docs/superpowers/specs/2026-08-23-web-demo-demotion-design.md`

## Global Constraints

- Work in a dedicated worktree on branch `web-demo-demotion` (sibling path, `bun install` after creating). Bash cwd resets between calls — prefix with `cd`.
- Never include Claude session links in commits; plain `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` is allowed.
- Native behavior must not change: the regenerated preset literals must parse to the same 9 archetypes; `swift build` and the Windows cross-compile must pass after every task that touches `src/native/**`.
- Kept demo settings keys (spec §B): `enabled, enablePassiveFx, passiveFx, findMouseFx, hotkey (static display), colorPreset, customColor, quickSwatches, customFxConfig, fluidVorticity, fluidDissipation, fluidBloom, fluidRainbowDye, intensity, particleDensity, trailLength, animationSpeed, minMovementThreshold, idleBurst, monitorCrossingFx, fpsLimit, multiMonitorMode, desktopBackground, soundFx` (engine-consumed; no UI). Deleted keys: `startWithWindows, autoCheckUpdates, lastCheckedTimestamp, notifyOnUpdate, showDiagnostics` — plus any key tsc reports as orphaned after the deletions.
- Download CTAs link to `https://github.com/OffBy1-tech/Mouse-Flare/releases/latest` (plain anchors, no API calls).
- Kill any stale listener on port 3000 before Playwright runs: `kill $(lsof -tnP -iTCP:3000 -sTCP:LISTEN) 2>/dev/null`.

---

### Task 1: Canonical preset data + generator

**Files:**
- Create: `data/default-fx-presets.json`
- Create: `scripts/generate-fx-presets.mjs`
- Modify: `src/data/defaultFxPresets.ts` (becomes a re-export), `tsconfig.json` (`resolveJsonModule`), `package.json` (script), `src/native/macos/Sources/DefaultFxPresets.swift` + `src/native/windows/Core/DefaultFxPresets.cs` (markers + regenerated literal), `.github/workflows/release-build.yml` (drift check step)

**Interfaces:**
- Consumes: nothing.
- Produces: `data/default-fx-presets.json` (array of 9 preset objects, pretty-printed, 2-space indent); `DEFAULT_FX_PRESETS: ParticleFxConfig[]` export unchanged for web consumers; `bun run generate:presets` and `bun run generate:presets --check`.

- [ ] **Step 1: Extract the canonical JSON from the Swift literal** (it is already pure JSON and provably what natives parse):

```bash
cd <worktree> && node -e "
const fs = require('fs');
const swift = fs.readFileSync('src/native/macos/Sources/DefaultFxPresets.swift','utf8');
const m = swift.match(/##\"(\[.*\])\"##/s);
if (!m) throw new Error('literal not found');
const data = JSON.parse(m[1]);
if (data.length !== 9) throw new Error('expected 9 presets, got ' + data.length);
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/default-fx-presets.json', JSON.stringify(data, null, 2) + '\n');
console.log('wrote', data.length, 'presets');
"
```

Expected: `wrote 9 presets`.

- [ ] **Step 2: Re-export from web.** Replace the entire body of `src/data/defaultFxPresets.ts` with:

```ts
import { ParticleFxConfig } from '../types/fxEditor';
import raw from '../../data/default-fx-presets.json';

// Canonical preset data lives in data/default-fx-presets.json — shared with
// both native apps via scripts/generate-fx-presets.mjs.
export const DEFAULT_FX_PRESETS: ParticleFxConfig[] = raw as ParticleFxConfig[];
```

Add `"resolveJsonModule": true` to `compilerOptions` in `tsconfig.json`. Run `bun run lint` — expected clean. (If the JSON's literal string fields fail the `ParticleFxConfig` union types under the cast, use `raw as unknown as ParticleFxConfig[]` — the runtime data is unchanged.)

- [ ] **Step 3: Add generation markers to both native files.** In `DefaultFxPresets.swift`, wrap the `let json = ##"[…]"##` line:

```swift
        // GENERATED-PRESETS-BEGIN (run `bun run generate:presets` after editing data/default-fx-presets.json)
        let json = ##"[…existing literal unchanged…]"##
        // GENERATED-PRESETS-END
```

In `DefaultFxPresets.cs`, wrap the raw-string literal block:

```csharp
            // GENERATED-PRESETS-BEGIN (run `bun run generate:presets` after editing data/default-fx-presets.json)
            const string json = """
[…existing literal unchanged…]
""";
            // GENERATED-PRESETS-END
```

Update both files' header comments from "GENERATED from src/data/defaultFxPresets.ts" to "GENERATED from data/default-fx-presets.json".

- [ ] **Step 4: Write `scripts/generate-fx-presets.mjs`:**

```js
#!/usr/bin/env node
// Regenerates the embedded preset literals in both native DefaultFxPresets
// files from data/default-fx-presets.json. `--check` verifies instead.
import { readFileSync, writeFileSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const DATA = 'data/default-fx-presets.json';

// Match the historical literal format: minified, ", "-separated, ": " after
// keys, non-ASCII escaped as \uXXXX (so the emoji icons survive any editor).
const escapeNonAscii = (s) =>
  s.replace(/[\u007f-\uffff]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
const presets = JSON.parse(readFileSync(DATA, 'utf8'));
const literal = escapeNonAscii(
  JSON.stringify(presets, null, 1).replace(/\n\s*/g, ' ').replace(/ \]$/, ']').replace(/^\[ /, '[')
);

const targets = [
  {
    file: 'src/native/macos/Sources/DefaultFxPresets.swift',
    render: (json) => `        let json = ##"${json}"##`,
  },
  {
    file: 'src/native/windows/Core/DefaultFxPresets.cs',
    render: (json) => `            const string json = """\n${json}\n""";`,
  },
];

let dirty = false;
for (const { file, render } of targets) {
  const src = readFileSync(file, 'utf8');
  const begin = src.indexOf('GENERATED-PRESETS-BEGIN');
  const end = src.indexOf('GENERATED-PRESETS-END');
  if (begin === -1 || end === -1) {
    console.error(`${file}: GENERATED-PRESETS markers not found — refusing to write.`);
    process.exit(2);
  }
  const beginLineEnd = src.indexOf('\n', begin) + 1;
  const endLineStart = src.lastIndexOf('\n', end);
  const current = src.slice(beginLineEnd, endLineStart);
  const next = render(literal);
  if (current === next) continue;
  dirty = true;
  if (CHECK) {
    console.error(`${file}: embedded presets differ from ${DATA} (run \`bun run generate:presets\`).`);
  } else {
    writeFileSync(file, src.slice(0, beginLineEnd) + next + src.slice(endLineStart));
    console.log(`${file}: regenerated.`);
  }
}
if (CHECK && dirty) process.exit(1);
if (!dirty) console.log('presets in sync.');
```

Add to `package.json` scripts: `"generate:presets": "node scripts/generate-fx-presets.mjs"`.

- [ ] **Step 5: Run and verify.**

```bash
cd <worktree> && bun run generate:presets && bun run generate:presets --check && (cd src/native/macos && swift build 2>&1 | tail -1) && (cd src/native/windows && dotnet build Mouseflare.csproj -p:EnableWindowsTargeting=true --nologo -v q 2>&1 | grep -c "0 Error")
```

Expected: first run may print "regenerated" (format normalization), `--check` then prints `presets in sync.`, Swift `Build complete!`, dotnet `1`. Spot-check failure mode: append `X` to the Swift literal, confirm `--check` exits 1 with the file named, then re-run `generate:presets` to restore.

- [ ] **Step 6: Wire the CI check.** In `.github/workflows/release-build.yml`, in the ubuntu "Checksums & release" job, add as the first step after checkout:

```yaml
      - name: Verify preset data is in sync
        run: node scripts/generate-fx-presets.mjs --check
```

- [ ] **Step 7: Commit** — `git add -A && git commit -m "Canonical FX preset data in data/, with native generator + CI drift check"` (plus the co-author trailer).

---

### Task 2: Demo shell — DemoPanel, App rewrite, deletions

**Files:**
- Create: `src/components/DemoPanel.tsx`, `src/data/presetCatalog.ts`
- Modify: `src/App.tsx`, `src/components/OverlayCanvas.tsx` (remove HUD), `src/types.ts` + `src/data/defaultSettings.ts` (trim keys), `src/components/FxDesigner.tsx` (no change expected — verify props suffice)
- Delete: `src/components/SettingsWindow.tsx`, `src/components/OnboardingDialog.tsx`, `src/components/WindowsTaskbar.tsx`, `src/utils/nativeDownloader.ts`, `src/utils/updateChecker.ts`, `src/data/nativeSource.ts`

**Interfaces:**
- Consumes: `FxDesigner` props `{ currentConfig?, onApplyToCursor?, onStatus?, quickSwatches? }`; `NeonColorPicker` props `{ title, initial, swatches, onLive, onDone, onCancel }`; `FindMouseChallengeModal` existing props (read them at `src/components/FindMouseChallengeModal.tsx` before wiring).
- Produces: `DemoPanel` component:

```ts
interface DemoPanelProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onTriggerFlare: () => void;
  onLaunchChallenge: () => void;
}
```

- [ ] **Step 1: Create `src/data/presetCatalog.ts`.** Move (verbatim) the three array literals currently inlined in `src/components/SettingsWindow.tsx`: the 21-entry passive list (search `fluid-simulation` in the passive grid), the 6-entry flare list (search `solar-flare`), and the 7-entry palette list (search `Amber Flare`). Export as:

```ts
import { ColorPreset, FlarePreset, FxPreset } from '../types';
export const PASSIVE_PRESETS: { id: FxPreset; label: string; desc: string }[] = [/* moved literal */];
export const FLARE_PRESETS: { id: FlarePreset; label: string; desc: string }[] = [/* moved literal */];
export const COLOR_PALETTES: { id: ColorPreset; label: string; color: string }[] = [/* moved literal */];
```

- [ ] **Step 2: Create `src/components/DemoPanel.tsx`.** A fixed right-side panel (~w-[380px], full height, `neon-frame`-style, collapsible via a chevron button) with a two-tab strip (`Effects` / `FX Designer`), a `Find-Mouse Challenge` launcher button, download CTAs, and a status line at the bottom (persistent, native model, default `Ready — every change previews live on the playground.`). Structure:

```tsx
export const DemoPanel: React.FC<DemoPanelProps> = ({ settings, onUpdateSettings, onTriggerFlare, onLaunchChallenge }) => {
  const [tab, setTab] = useState<'effects' | 'designer'>('effects');
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState('Ready — every change previews live on the playground.');
  const quickSwatches = settings.quickSwatches ?? DEFAULT_SETTINGS.quickSwatches;
  // Effects tab: PASSIVE_PRESETS chip grid (2-col, compact, Active ring on
  // settings.passiveFx), FLARE_PRESETS chips (click also onTriggerFlare()),
  // COLOR_PALETTES chips + Custom Hex chip + NeonColorPicker wiring copied
  // from the deleted SettingsWindow custom-color card (same handlers:
  // openCustomColorPicker/beginSwatchEdit/finishColorPicker, but calling
  // onUpdateSettings directly — the demo has no draft domain).
  // Designer tab: <FxDesigner currentConfig={settings.customFxConfig}
  //   onApplyToCursor={(c) => onUpdateSettings({ passiveFx: 'custom-fx', customFxConfig: c, enablePassiveFx: true })}
  //   onStatus={setStatus} quickSwatches={quickSwatches} />
  //   plus a one-line pitch: "Design here, then Copy JSON and import it in the desktop app's FX Designer."
  // Footer: status line (emerald dot + status), challenge button, and two
  // download anchors:
  //   <a href="https://github.com/OffBy1-tech/Mouse-Flare/releases/latest" target="_blank" rel="noreferrer">Download for macOS</a> / …Windows
};
```

Write it out fully (the chip markup is the same pattern as the deleted SettingsWindow grids; selection statuses call `setStatus(\`Selected Passive FX: ${label}\`)` etc. — no "Apply & Save" suffixes, the demo applies instantly).

- [ ] **Step 3: Rewrite `src/App.tsx`.** Keep: settings state + localStorage persistence + vorticity clamp, `ParticleEngine`, `mouseCoords`, `triggerFindMouseFlare`, global mousemove + hotkey keydown listeners, fullscreen toggle, `DesktopSimulator`, `OverlayCanvas`, `FindMouseChallengeModal` state. Remove: `isSettingsOpen`/`settingsInitialTab`, onboarding state + dialog, `showNativeModal`, download menu/state/handlers, update checker state + banner + imports, `WindowsTaskbar`. Top bar becomes: logo + `Mouseflare` + tagline, the 4 scene buttons (unchanged), spacer, `Flare ({settings.hotkey})` button, `Fullscreen` toggle, and the two release-page download links (same anchors as the panel). Mount `<DemoPanel …/>` after `OverlayCanvas`. Logo `src` uses `` `${import.meta.env.BASE_URL}app-logo.png` `` (Task 3 depends on this).

- [ ] **Step 4: Delete the six files** listed above (`git rm`). Remove the HUD block from `OverlayCanvas.tsx` (the `showDiagnostics`-gated "Mouseflare Telemetry" panel and its imports). Trim `src/types.ts` `AppSettings` and `src/data/defaultSettings.ts` to exactly the kept-keys list in Global Constraints; delete `TabType` if it lived in SettingsWindow (it did — no remaining importers).

- [ ] **Step 5: Chase the compiler.** `bun run lint` and fix every orphaned import/reference until clean, then `bun run build` — expected `✓ built`. Deleting is done when `grep -rn "SettingsWindow\|OnboardingDialog\|WindowsTaskbar\|nativeDownloader\|nativeSource\|updateChecker" src/` returns nothing.

- [ ] **Step 6: Playwright smoke.** With a fresh dev server (kill port 3000 first): assert the panel renders both tabs, a passive chip click updates the Active ring, a flare chip click runs without error, the designer tab renders `Preset:` and Copy JSON, the challenge button opens the modal, and both download anchors have `href` containing `/releases/latest`. Screenshot for the record.

- [ ] **Step 7: Commit** — `"Web: demote to showcase demo (DemoPanel; settings window and simulator chrome removed)"` + trailer.

---

### Task 3: GitHub Pages deployment

**Files:**
- Modify: `vite.config.ts`
- Create: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Base path.** In `vite.config.ts` add `base: process.env.PAGES_BASE ?? '/'` to the config object. Verify no remaining root-absolute asset URLs: `grep -rn '"/app-logo\|src="/' src/ index.html` — fix stragglers with `import.meta.env.BASE_URL` (JSX) or relative paths (index.html uses `./`-relative or `%BASE_URL%` — Vite rewrites `/`-rooted refs in index.html automatically, so only JSX string literals need fixing).

- [ ] **Step 2: Workflow.** Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy demo to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: PAGES_BASE=/Mouse-Flare/ bun run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Verify locally.** `PAGES_BASE=/Mouse-Flare/ bun run build && grep -o '/Mouse-Flare/assets/[^"]*' dist/index.html | head -3` — expected: prefixed asset URLs. Plain `bun run build` still yields `/assets/…`.

- [ ] **Step 4: Commit** — `"Deploy the demo to GitHub Pages on main pushes"` + trailer.

---

### Task 4: Docs and contract

**Files:**
- Modify: `README.md`, `package.json` (description)
- Assistant-side: memory rule update; audit-artifact footnote

- [ ] **Step 1: README.** Rewrite the framing: the product is the two native apps; add near the top a "**[Try the live demo](https://offby1-tech.github.io/Mouse-Flare/)** — the FX engine and designer running in your browser; the real overlay ships in the desktop apps." Update the Repository Structure table row for `src/` to "Showcase demo (React + Vite) — hosted on GitHub Pages; also home of the canonical FX preset data consumed by both native apps." Add a `data/` row. Remove challenge/simulator marketing from the intro if it implies a full simulator.

- [ ] **Step 2: package.json** description → `"Mouseflare — never lose your cursor. Native Windows & macOS apps, with a browser demo of the FX engine."`

- [ ] **Step 3 (assistant):** Update the saved memory rule `ui-changes-apply-to-all-three-platforms` → two-way (macOS ↔ Windows) with the demo explicitly exempt; add a footnote line to the parity-audit artifact's method note saying web rows are demo-exempt as of this change.

- [ ] **Step 4: Commit** — `"Docs: reposition web as the hosted demo; native apps are the product"` + trailer.

---

### Task 5: Verification & wrap-up

- [ ] `bun run lint`; `bun run build`; `PAGES_BASE=/Mouse-Flare/ bun run build`.
- [ ] `bun run generate:presets --check` → `presets in sync.`
- [ ] `swift build` and `dotnet build … -p:EnableWindowsTargeting=true` still pass.
- [ ] Full Playwright pass on the built demo (`bun run preview` on a free port): repeat Task 2 Step 6 assertions plus a designer round-trip (pick preset → Copy JSON succeeds).
- [ ] Merge `web-demo-demotion` → main (worktree removed, branch deleted), push. The push triggers `deploy-pages.yml`; watch it (`gh run watch`) and then confirm `https://offby1-tech.github.io/Mouse-Flare/` serves the demo (Pages source is already set to GitHub Actions).
