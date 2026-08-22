# FX Designer alignment pass — design

**Date:** 2026-08-22
**Issue:** [#2 — Styling pass on the web FX Designer editor](https://github.com/OffBy1-tech/Mouse-Flare/issues/2)
**Status:** Approved

## Context

Issue #2 was filed against the original ~1,400-line AI Studio port of
`ParticleFxEditor.tsx` (v0.4.0, commit `146c913`). The neon-restyle work that
followed (`e04b461` → `d7bd4f3`, Aug 21) already rewrote the editor down to
~390 lines, aligned its layout to the native designers, and removed the
sandbox preview / auto-motion modes entirely — the editor now previews live on
the real cursor. That covers the issue's third bullet and most of the first
two.

This pass finishes the remaining drift so the FX Designer tab is
indistinguishable from the rest of the settings window, then closes #2.

## Scope

Web only. `src/components/ParticleFxEditor.tsx` and its integration in
`src/components/SettingsWindow.tsx`. Native apps, engine code, and the
`ParticleFxConfig` type are untouched.

## Changes

### 1. Rename component to FxDesigner

- `git mv src/components/ParticleFxEditor.tsx src/components/FxDesigner.tsx`
- `ParticleFxEditor` → `FxDesigner`; `ParticleFxEditorProps` → `FxDesignerProps`
- Update the import and JSX usage in `SettingsWindow.tsx`

Rationale: the tab is labeled "FX Designer" and the native counterparts are
`FxDesignerView.swift` (macOS) and `FxDesignerPanel` (Windows). The
`ParticleFxConfig` type and `src/types/fxEditor.ts` keep their names — they
are shared with the engine and serialized presets, not UI-convention drift.

### 2. Lift status messages to the title-bar pill

- New optional prop on `FxDesigner`: `onStatus?: (message: string) => void`,
  mirroring the native macOS `FxDesignerView.onStatus` callback.
- All existing status calls (load archetype, save, delete, copy JSON, import,
  import warnings) go through `onStatus`.
- `SettingsWindow` passes a handler that sets its existing `saveStatus`
  title-bar pill with the same timeout pattern used elsewhere (~3s).
- The editor drops its local status state and timer. The hint line under the
  header becomes static (native parity — the hint never doubled as a status
  line there).
- Accepted trade-off: warning messages ("⚠️ Clipboard…") render in the emerald
  pill; the ⚠️ prefix carries the tone. No second pill variant.

### 3. Visual alignment with the other tabs

- Top-level section rhythm: `space-y-4` → `space-y-6` (internals stay dense).
- Cards: `p-3.5` → `p-4`.
- Slider rows adopt the FX Studio pattern: `space-y-1.5` per row, labels
  `text-neutral-300 font-medium`, values `text-violet-300 font-mono font-bold`,
  range input `w-full neon-range bg-white/10 h-1.5 rounded-lg appearance-none
  cursor-pointer`.
- Popup (select) labels: `text-[10px] text-neutral-500` →
  `text-[11px] text-neutral-400` sub-label convention.
- Header action buttons already match the secondary-button convention
  (`bg-white/5 hover:bg-white/10 border border-white/10`) — unchanged.

### 4. Simplification audit

The port's unused complexity (sandbox backgrounds, auto-motion modes) was
already removed. The only remaining cleanup is the status plumbing in §2.
Nothing else is vestigial.

## Error handling

Unchanged: localStorage reads/writes stay wrapped in try/catch; clipboard
import failures surface via `onStatus` warnings.

## Verification

- `tsc` / production build passes.
- Run the web app; compare FX Designer tab against FX Studio side by side
  (spacing, card padding, slider look, label weights).
- Exercise load-archetype, save, delete, copy JSON, and import (valid +
  invalid clipboard) and confirm each shows the title-bar pill.

## Wrap-up

- Work on a feature branch in a dedicated worktree.
- Close #2 with a comment summarizing what the neon rework already covered
  and what this pass finished.
