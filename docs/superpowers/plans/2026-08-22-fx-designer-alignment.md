# FX Designer Alignment Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish issue #2 — make the web FX Designer tab visually and structurally indistinguishable from the rest of the settings window.

**Architecture:** Three small, sequential changes to the web settings UI: rename the editor component to `FxDesigner` (matching the tab and native counterparts), lift its status messages to the settings window's existing title-bar pill via a new `onStatus` callback prop (mirroring native macOS), and align spacing/labels/slider styles with the FX Studio tab. No engine, type, or native changes.

**Tech Stack:** React 19 + TypeScript + Tailwind 4 (Vite, Bun as package manager). No test framework exists in this repo — the verify cycle is `bun run lint` (tsc --noEmit) and `bun run build`, plus a visual check in the dev server.

**Spec:** `docs/superpowers/specs/2026-08-22-fx-designer-alignment-design.md`

## Global Constraints

- Work in a dedicated git worktree on branch `fx-designer-alignment` (create via the superpowers:using-git-worktrees skill; sibling path e.g. `../Mouse-Flare-fx-designer-alignment`). Run `bun install` in the worktree once after creating it. The Bash tool's cwd resets between calls — prefix commands with `cd <worktree> &&`.
- Never include Claude session links in any commit message. Plain `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (no URL) is allowed.
- Web only: touch `src/components/ParticleFxEditor.tsx` (→ `FxDesigner.tsx`) and `src/components/SettingsWindow.tsx`. Do NOT rename `ParticleFxConfig` or `src/types/fxEditor.ts`; do NOT touch `src/native/**` or `src/engine/**`.
- After every task: `bun run lint` must exit clean (no output, exit 0).

---

### Task 1: Rename ParticleFxEditor → FxDesigner

**Files:**
- Rename: `src/components/ParticleFxEditor.tsx` → `src/components/FxDesigner.tsx`
- Modify: `src/components/FxDesigner.tsx` (identifier renames)
- Modify: `src/components/SettingsWindow.tsx:4` (import), `src/components/SettingsWindow.tsx:959-971` (JSX usage)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `FxDesigner` React component exported from `src/components/FxDesigner.tsx` with props interface `FxDesignerProps { currentConfig?: ParticleFxConfig; onApplyToCursor?: (config: ParticleFxConfig) => void; }`. Tasks 2–3 edit this file under its new name.

- [ ] **Step 1: git mv the file**

```bash
cd <worktree> && git mv src/components/ParticleFxEditor.tsx src/components/FxDesigner.tsx
```

- [ ] **Step 2: Rename the identifiers inside FxDesigner.tsx**

In `src/components/FxDesigner.tsx`, change the props interface (currently line 13):

```tsx
// before
interface ParticleFxEditorProps {
// after
interface FxDesignerProps {
```

and the component declaration (currently line 125):

```tsx
// before
export const ParticleFxEditor: React.FC<ParticleFxEditorProps> = ({ currentConfig, onApplyToCursor }) => {
// after
export const FxDesigner: React.FC<FxDesignerProps> = ({ currentConfig, onApplyToCursor }) => {
```

- [ ] **Step 3: Update SettingsWindow.tsx**

Import (line 4):

```tsx
// before
import { ParticleFxEditor } from './ParticleFxEditor';
// after
import { FxDesigner } from './FxDesigner';
```

JSX usage (lines 959–971) — only the tag name changes:

```tsx
{/* TAB: FX DESIGNER */}
{activeTab === 'fx-designer' && (
  <FxDesigner
    currentConfig={settings.customFxConfig}
    onApplyToCursor={(customConfig) => {
      updateFxDraft({
        passiveFx: 'custom-fx',
        customFxConfig: customConfig,
        enablePassiveFx: true,
      });
    }}
  />
)}
```

(The comment above the block currently reads `{/* TAB: PARTICLE FX DESIGNER */}` — update it to `{/* TAB: FX DESIGNER */}` as shown. There is also a stray `{/* TAB 3: BEHAVIOR & MONITORS */}` comment directly above it at line 958 that belongs to the behavior block below; leave it where the behavior block is or delete the duplicate — the behavior JSX starts at `{activeTab === 'behavior' &&`.)

- [ ] **Step 4: Verify no stale references and typecheck**

```bash
cd <worktree> && grep -rn "ParticleFxEditor" src/ ; bun run lint
```

Expected: grep prints nothing (exit 1), lint prints nothing (exit 0).

- [ ] **Step 5: Commit**

```bash
cd <worktree> && git add -A src/components && git commit -m "refactor: rename ParticleFxEditor to FxDesigner to match tab and native counterparts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Lift status messages to the title-bar pill via onStatus

**Files:**
- Modify: `src/components/FxDesigner.tsx` (props, remove local status state, call onStatus)
- Modify: `src/components/SettingsWindow.tsx` (status handler + prop wiring)

**Interfaces:**
- Consumes: `FxDesigner` / `FxDesignerProps` from Task 1.
- Produces: `FxDesignerProps` gains `onStatus?: (message: string) => void`. `SettingsWindow` owns all status display; `FxDesigner` has no status state.

- [ ] **Step 1: Add onStatus to FxDesignerProps and remove local status state**

In `src/components/FxDesigner.tsx`:

```tsx
interface FxDesignerProps {
  currentConfig?: ParticleFxConfig;
  onApplyToCursor?: (config: ParticleFxConfig) => void;
  onStatus?: (message: string) => void;
}
```

Component signature:

```tsx
export const FxDesigner: React.FC<FxDesignerProps> = ({ currentConfig, onApplyToCursor, onStatus }) => {
```

Delete this block entirely (currently lines 145–151):

```tsx
const [status, setStatusText] = useState<string | null>(null);
const statusTimer = useRef<number | undefined>(undefined);
const setStatus = (message: string) => {
  setStatusText(message);
  window.clearTimeout(statusTimer.current);
  statusTimer.current = window.setTimeout(() => setStatusText(null), 4000);
};
```

Replace every `setStatus(` call with `onStatus?.(` — there are 7: in `loadPreset`, `handleSaveToLibrary`, `handleDeletePreset`, `handleCopyJson`, and three in `handleImportClipboard` (success + two ⚠️ warnings). Message strings are unchanged.

Make the hint line static (currently line 245):

```tsx
// before
<p className="text-xs text-neutral-400 mt-0.5">{status ?? HINT}</p>
// after
<p className="text-xs text-neutral-400 mt-0.5">{HINT}</p>
```

Finally, `useRef` is no longer used in this file — trim the React import:

```tsx
import React, { useState, useMemo } from 'react';
```

- [ ] **Step 2: Wire onStatus in SettingsWindow**

In `src/components/SettingsWindow.tsx`, add next to the existing `saveStatus` state (after line 117, `const [saveStatus, setSaveStatus] = useState<string | null>(null);`):

```tsx
// FX Designer statuses (save/load/import feedback) surface in the same
// title-bar pill; the timer is cleared so rapid actions don't cut each
// other short.
const fxStatusTimer = useRef<number | undefined>(undefined);
const showFxStatus = (message: string) => {
  setSaveStatus(message);
  window.clearTimeout(fxStatusTimer.current);
  fxStatusTimer.current = window.setTimeout(() => setSaveStatus(null), 3000);
};
```

(`useRef` is already imported in this file.)

Pass the prop in the FX Designer JSX block:

```tsx
{activeTab === 'fx-designer' && (
  <FxDesigner
    currentConfig={settings.customFxConfig}
    onApplyToCursor={(customConfig) => {
      updateFxDraft({
        passiveFx: 'custom-fx',
        customFxConfig: customConfig,
        enablePassiveFx: true,
      });
    }}
    onStatus={showFxStatus}
  />
)}
```

- [ ] **Step 3: Typecheck**

```bash
cd <worktree> && bun run lint
```

Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
cd <worktree> && git add src/components/FxDesigner.tsx src/components/SettingsWindow.tsx && git commit -m "refactor: surface FX Designer status in the title-bar pill via onStatus

Mirrors the native macOS FxDesignerView.onStatus callback; the hint line
under the header is static again, matching native.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Align spacing, labels, and slider styles with the other tabs

**Files:**
- Modify: `src/components/FxDesigner.tsx` (className changes only — no logic)

**Interfaces:**
- Consumes: `FxDesigner` from Tasks 1–2.
- Produces: nothing new — purely visual.

- [ ] **Step 1: Apply the className changes**

All in `src/components/FxDesigner.tsx`:

1. Root wrapper (top of the returned JSX):

```tsx
// before
<div className="space-y-4 text-xs text-neutral-300">
// after
<div className="space-y-6 text-xs text-neutral-300">
```

2. Popup (select) labels inside the `POPUP_SPECS.map`:

```tsx
// before
<label className="text-[10px] text-neutral-500 block mb-1">{spec.label}</label>
// after
<label className="text-[11px] text-neutral-400 block mb-1">{spec.label}</label>
```

3. Colors + glow card:

```tsx
// before
<div className="p-3.5 rounded-xl neon-card flex flex-wrap items-center gap-4">
// after
<div className="p-4 rounded-xl neon-card flex flex-wrap items-center gap-4">
```

4. Sliders card:

```tsx
// before
<div className="p-3.5 rounded-xl neon-card grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
// after
<div className="p-4 rounded-xl neon-card grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
```

5. Each slider row inside `SLIDER_SPECS.map` adopts the FX Studio pattern:

```tsx
// before
<div key={spec.field}>
  <div className="flex justify-between mb-1">
    <span className="text-neutral-300">{spec.label}</span>
    <span className="font-mono text-violet-300">{spec.fmt(config[spec.field])}</span>
  </div>
  <input
    type="range"
    min={spec.min}
    max={spec.max}
    step={spec.step}
    value={config[spec.field]}
    onChange={(e) => applyEdit({ [spec.field]: Number(e.target.value) } as Partial<ParticleFxConfig>)}
    className="neon-range w-full"
  />
</div>

// after
<div key={spec.field} className="space-y-1.5">
  <div className="flex justify-between text-xs">
    <span className="text-neutral-300 font-medium">{spec.label}</span>
    <span className="text-violet-300 font-mono font-bold">{spec.fmt(config[spec.field])}</span>
  </div>
  <input
    type="range"
    min={spec.min}
    max={spec.max}
    step={spec.step}
    value={config[spec.field]}
    onChange={(e) => applyEdit({ [spec.field]: Number(e.target.value) } as Partial<ParticleFxConfig>)}
    className="w-full neon-range bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
  />
</div>
```

- [ ] **Step 2: Typecheck and build**

```bash
cd <worktree> && bun run lint && bun run build
```

Expected: lint silent; build ends with `✓ built in …` and exit 0.

- [ ] **Step 3: Commit**

```bash
cd <worktree> && git add src/components/FxDesigner.tsx && git commit -m "style: align FX Designer spacing, labels, and sliders with the other settings tabs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Visual verification in the running app

**Files:**
- None modified — verification only.

**Interfaces:**
- Consumes: the complete feature from Tasks 1–3.
- Produces: evidence the pass is done (screenshots or observed checklist), gating merge.

- [ ] **Step 1: Start the dev server**

```bash
cd <worktree> && bun run dev
```

Expected: Vite banner with `Local: http://localhost:3000/`. Run it in the background.

- [ ] **Step 2: Verify in the browser** (use browser tooling if available; otherwise ask the user to eyeball it)

Open `http://localhost:3000`, open the settings window, and check against this list, comparing side by side with the FX Studio tab:

- FX Designer tab renders; header reads "FX Designer" with the static hint line beneath.
- Section rhythm matches other tabs (visibly more air between sections than before; cards have the same padding as FX Studio's cards).
- Slider rows look identical in style to FX Studio's "Fine-Tuning" sliders: medium-weight labels, bold violet mono values, thicker `h-1.5` track with rounded ends.
- Pick an archetype from the dropdown → emerald pill appears in the title bar reading "Loaded archetype: … — previewing live on your cursor", and disappears after ~3s.
- Click Save → pill shows `Saved "…" to your preset library`; a custom preset appears in the dropdown under "My Custom Presets"; the Delete (trash) button appears; clicking it shows the deletion pill.
- Click Copy JSON → pill confirms; click Import Clipboard immediately after → pill shows `Imported: …`. Then copy unrelated text to the clipboard and Import again → pill shows the ⚠️ warning.
- Apply & Save button still commits the draft (pill: "Saved & Applied!"); closing the window without saving reverts the cursor FX.

- [ ] **Step 3: Stop the dev server**

Kill the background dev-server task.

- [ ] **Step 4: Report**

If anything on the checklist fails, fix it (smallest change that passes), re-verify, and amend/commit as appropriate before proceeding to merge.

---

## Wrap-up (post-plan, via superpowers:finishing-a-development-branch)

After all tasks pass and the branch is merged to `main` (and the worktree removed), close the issue:

```bash
cd '/Users/jason/Projects/ob1/open source/Mouse-Flare' && gh issue close 2 --comment "Done in two stages:

- The neon restyle rework (e04b461…d7bd4f3) already rewrote the editor from the ~1,400-line AI Studio port down to ~390 lines, aligned its layout with the native designers, and removed the sandbox backgrounds / auto-motion modes entirely — the editor now previews live on the real cursor.
- This pass finished the rest: renamed ParticleFxEditor → FxDesigner to match the tab and native counterparts (FxDesignerView.swift / FxDesignerPanel), lifted status messages to the settings window's title-bar pill via an onStatus callback (mirroring native macOS), and aligned spacing, card padding, select labels, and slider styles with the FX Studio tab.

Design spec: docs/superpowers/specs/2026-08-22-fx-designer-alignment-design.md"
```
