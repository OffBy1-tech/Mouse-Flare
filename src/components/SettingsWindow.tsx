import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, ColorPreset, FlarePreset, FxPreset } from '../types';
import { FxDesigner } from './FxDesigner';
import { DEFAULT_FX_PRESETS } from '../data/defaultFxPresets';
import { NeonSelect } from './NeonSelect';
import {
  CURRENT_BUILD_INFO,
  checkNativeBuildUpdates,
  formatTimeAgo,
  UpdateCheckResult,
  FALLBACK_RELEASE,
  isNewerVersion
} from '../utils/updateChecker';
import { 
  Flame, 
  Sparkles, 
  Sliders, 
  Activity, 
  Check, 
  X, 
  Zap, 
  RotateCcw,
  Palette,
  Download,
  Save,
  Upload,
  CheckCircle2,
  RefreshCw,
  ArrowUpCircle,
  ShieldCheck,
  Clock,
  FileCheck2,
  Bell
} from 'lucide-react';
import { soundEngine } from '../engine/sound';

interface SettingsWindowProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClose: () => void;
  onTriggerFlare: () => void;
  initialTab?: TabType;
}

export type TabType = 'general' | 'fx-studio' | 'fx-designer' | 'behavior' | 'diagnostics' | 'updates';

// Native status model: one persistent footer status line, overwritten by
// every action (no auto-clear), idling on this ready text.
const READY_STATUS = 'Ready. FX changes preview live \u2014 click Apply & Save to keep them.';

import { DEFAULT_SETTINGS } from '../data/defaultSettings';

// The settings keys the FX Studio and FX Designer tabs can write — the "FX
// draft" domain that Apply & Save commits and close-without-apply reverts.
const pickFxDraft = (s: AppSettings): Partial<AppSettings> => ({
  passiveFx: s.passiveFx,
  findMouseFx: s.findMouseFx,
  colorPreset: s.colorPreset,
  customColor: s.customColor,
  quickSwatches: s.quickSwatches,
  intensity: s.intensity,
  particleDensity: s.particleDensity,
  animationSpeed: s.animationSpeed,
  minMovementThreshold: s.minMovementThreshold,
  fluidVorticity: s.fluidVorticity,
  fluidDissipation: s.fluidDissipation,
  fluidBloom: s.fluidBloom,
  fluidRainbowDye: s.fluidRainbowDye,
  enablePassiveFx: s.enablePassiveFx,
  customFxConfig: s.customFxConfig,
});

export const SettingsWindow: React.FC<SettingsWindowProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  onTriggerFlare,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'fx-studio');
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);

  // Diagnostics is a hidden section: click the sidebar version text 5 times
  // to reveal it (session-only — the window unmounts on close, re-hiding it).
  const [diagnosticsUnlocked, setDiagnosticsUnlocked] = useState(false);
  const versionClicksRef = useRef(0);
  const handleVersionClick = () => {
    if (diagnosticsUnlocked) return;
    versionClicksRef.current += 1;
    const remaining = 5 - versionClicksRef.current;
    if (remaining <= 0) {
      setDiagnosticsUnlocked(true);
      setActiveTab('diagnostics');
      soundEngine.playToggle(true);
      setSaveStatus('Diagnostics unlocked');
    } else if (versionClicksRef.current >= 3) {
      setSaveStatus(`${remaining} more ${remaining === 1 ? 'click' : 'clicks'} to unlock Diagnostics`);
    }
  };

  // Update check states
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<number>(() => settings.lastCheckedTimestamp || Date.now() - 1000 * 60 * 60 * 4);

  const [saveStatus, setSaveStatus] = useState<string>(READY_STATUS);

  // FX Designer statuses (save/load/import feedback) surface in the same
  // title-bar pill; the timer is cleared so rapid actions don't cut each
  // other short.
  const showFxStatus = (message: string) => setSaveStatus(message);

  // FX Studio shortcut mirroring the native "Import Custom FX" button — the
  // full editor lives in the FX Designer tab.
  const handleImportCustomFx = async () => {
    const invalid = '\u26a0\ufe0f Clipboard does not contain a valid FX Designer config. Use Copy JSON in the FX Designer.';
    try {
      const parsed = JSON.parse(await navigator.clipboard.readText());
      if (!parsed || !parsed.name || !parsed.shape) {
        showFxStatus(invalid);
        return;
      }
      updateFxDraft({
        passiveFx: 'custom-fx',
        customFxConfig: {
          ...DEFAULT_FX_PRESETS[0],
          ...parsed,
          id: `custom-imported-${Date.now()}`,
          isCustom: true,
          category: 'custom',
        },
        enablePassiveFx: true,
      });
      showFxStatus(`Imported custom FX: ${parsed.name} \u2022 Apply & Save to keep`);
    } catch (err) {
      showFxStatus(invalid);
    }
  };

  // Custom color + editable quick swatches (parity with the native pickers)
  const quickSwatches = settings.quickSwatches ?? DEFAULT_SETTINGS.quickSwatches;
  const [hexDraft, setHexDraft] = useState(settings.customColor);
  useEffect(() => setHexDraft(settings.customColor), [settings.customColor]);
  const applyHexDraft = () => {
    const m = hexDraft.trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (m) {
      updateFxDraft({ customColor: `#${m[1].toUpperCase()}`, colorPreset: 'custom' });
    } else {
      showFxStatus('\u26a0\ufe0f Invalid hex code. Please enter e.g. #FF5500 or #00FFCC');
      setHexDraft(settings.customColor);
    }
  };
  const editingSwatchRef = useRef(-1);
  const swatchEditInputRef = useRef<HTMLInputElement>(null);
  const beginSwatchEdit = (index: number) => {
    editingSwatchRef.current = index;
    if (swatchEditInputRef.current) {
      swatchEditInputRef.current.value = quickSwatches[index];
      swatchEditInputRef.current.click();
    }
  };
  const commitSwatchEdit = (hex: string) => {
    const index = editingSwatchRef.current;
    if (index < 0) return;
    const next = [...quickSwatches];
    next[index] = hex.toUpperCase();
    editingSwatchRef.current = -1;
    updateFxDraft({ quickSwatches: next, customColor: next[index], colorPreset: 'custom' });
  };

  // Sync initial tab if passed from outside (e.g. clicking notification banner)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Initial check on mount if autoCheckUpdates is enabled and haven't checked recently
  useEffect(() => {
    if (settings.autoCheckUpdates && !updateResult) {
      checkNativeBuildUpdates(CURRENT_BUILD_INFO.version).then((res) => {
        setUpdateResult(res);
      });
    }
  }, []);

  const handlePerformUpdateCheck = async () => {
    setIsCheckingUpdates(true);
    soundEngine.playClick();
    try {
      const result = await checkNativeBuildUpdates(CURRENT_BUILD_INFO.version);
      setUpdateResult(result);
      const now = Date.now();
      setLastCheckTime(now);
      updateInstant({ lastCheckedTimestamp: now });
      if (result.hasUpdate) {
        soundEngine.playToggle(true);
      }
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleCopyChecksum = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedChecksum(id);
    setTimeout(() => setCopiedChecksum(null), 2500);
  };

  // Two settings domains:
  // - Instant (General, Behavior, Diagnostics, Updates): applies and persists
  //   the moment a control changes; no Apply & Save involved.
  // - FX draft (FX Studio, FX Designer): previews live on the cursor, but only
  //   Apply & Save commits it. Closing the window with an uncommitted draft
  //   reverts the FX keys to the snapshot taken when the window opened.
  const fxSnapshotRef = useRef<Partial<AppSettings>>(pickFxDraft(settings));
  const fxDirtyRef = useRef(false);

  const updateInstant = (partial: Partial<AppSettings>) => {
    // Keys shared with the FX draft (e.g. enablePassiveFx from the General
    // toggle) are folded into the snapshot so a later revert keeps this change.
    for (const key of Object.keys(fxSnapshotRef.current) as (keyof AppSettings)[]) {
      if (key in partial) {
        fxSnapshotRef.current = { ...fxSnapshotRef.current, [key]: partial[key] };
      }
    }
    onUpdateSettings(partial);
  };

  const updateFxDraft = (partial: Partial<AppSettings>) => {
    fxDirtyRef.current = true;
    onUpdateSettings(partial);
  };

  const handleSaveAndApply = () => {
    fxSnapshotRef.current = pickFxDraft(settings);
    fxDirtyRef.current = false;
    setSaveStatus('Saved & Applied!');
    soundEngine.playToggle(true);
  };

  const handleClose = () => {
    if (fxDirtyRef.current) {
      onUpdateSettings(fxSnapshotRef.current);
    }
    onClose();
  };

  const handleResetDefaults = () => {
    // Reset is an explicit action available on every tab (including ones with
    // no Apply & Save button), so it commits both domains immediately instead
    // of leaving the FX portion as a revertible draft. updateInstant folds the
    // FX keys into the snapshot, re-baselining it to the defaults.
    updateInstant({ ...DEFAULT_SETTINGS });
    fxDirtyRef.current = false;
    setSaveStatus('Reset to Defaults');
  };

  // Apply & Save only concerns the FX draft domain, so it only shows on those tabs.
  const isFxTab = activeTab === 'fx-studio' || activeTab === 'fx-designer';

  const handleKeyDownHotkey = (e: React.KeyboardEvent) => {
    if (!isRecordingHotkey) return;
    e.preventDefault();

    const keys: string[] = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.shiftKey) keys.push('Shift');
    if (e.altKey) keys.push('Alt');

    const key = e.key === ' ' ? 'SPACE' : e.key.toUpperCase();
    if (!['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) {
      keys.push(key);
      if (keys.length > 0) {
        updateInstant({ hotkey: keys.join('+') });
        setIsRecordingHotkey(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      <div 
        className="neon-frame w-full max-w-4xl h-[660px] flex flex-col overflow-hidden pointer-events-auto text-neutral-100 select-none animate-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDownHotkey}
        tabIndex={0}
      >
        {/* Title Bar */}
        <div className="h-11 bg-[#0a0512]/80 border-b border-violet-500/25 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img src="/app-logo.png" alt="Mouseflare logo" className="w-5 h-5 rounded-md shadow" />
            <span className="text-xs font-semibold tracking-wide text-neutral-200">Mouseflare</span>
            <span className="text-xs text-neutral-500">&nbsp;&mdash; Settings &amp; FX Studio</span>
          </div>

          <div className="flex items-center gap-1.5 -mr-1">
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded hover:bg-red-500/80 hover:text-white flex items-center justify-center text-neutral-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body (Sidebar + Content) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-56 bg-[#0d0618]/70 border-r border-violet-500/20 p-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-violet-300/60 px-3 py-1">
                Navigation
              </div>

              <button
                onClick={() => setActiveTab('general')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'general'
                    ? 'neon-nav-active font-semibold'
                    : 'text-violet-100/70 hover:bg-violet-400/10'
                }`}
              >
                <Flame className="w-4 h-4 text-amber-400" />
                <span>General</span>
              </button>

              <button
                onClick={() => setActiveTab('fx-studio')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'fx-studio'
                    ? 'neon-nav-active font-semibold'
                    : 'text-violet-100/70 hover:bg-violet-400/10'
                }`}
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>FX Studio</span>
              </button>

              <button
                onClick={() => setActiveTab('fx-designer')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'fx-designer'
                    ? 'neon-nav-active font-semibold'
                    : 'text-violet-100/70 hover:bg-violet-400/10'
                }`}
              >
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>FX Designer</span>
              </button>

              <button
                onClick={() => setActiveTab('behavior')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'behavior'
                    ? 'neon-nav-active font-semibold'
                    : 'text-violet-100/70 hover:bg-violet-400/10'
                }`}
              >
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Behavior &amp; Monitors</span>
              </button>

              {diagnosticsUnlocked && (
                <button
                  onClick={() => setActiveTab('diagnostics')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    activeTab === 'diagnostics'
                      ? 'neon-nav-active font-semibold'
                      : 'text-violet-100/70 hover:bg-violet-400/10'
                  }`}
                >
                  <Activity className="w-4 h-4 text-violet-400" />
                  <span>Diagnostics</span>
                </button>
              )}

                            <button
                onClick={() => setActiveTab('updates')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'updates'
                    ? 'neon-nav-active font-semibold'
                    : 'text-violet-100/70 hover:bg-violet-400/10'
                }`}
              >
                <RefreshCw className={`w-4 h-4 text-amber-400 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                <span>Check for Updates</span>
              </button>
            </div>

            {/* Quick Actions in Sidebar */}
            <div className="pt-3 border-t border-violet-500/20 space-y-2">
              <div
                onClick={handleVersionClick}
                className="text-center text-[10px] text-neutral-500 select-none"
              >
                Mouseflare v{CURRENT_BUILD_INFO.version}
              </div>
              <button
                onClick={onTriggerFlare}
                className="neon-btn-primary w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Test Flare Now</span>
              </button>

            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#120a20]/60">
            {/* TAB 1: GENERAL */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-neutral-100">General Configuration</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Control master switches, global hotkey shortcut, and startup behavior.
                  </p>
                </div>

                <div className="grid gap-3">
                  {/* Master Switch */}
                  <div className="flex items-center justify-between p-4 rounded-xl neon-card">
                    <div>
                      <div className="font-semibold text-sm text-neutral-200">Enable Mouseflare</div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        Global toggle for all cursor tracking, passive trail effects, and active flares.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enabled}
                        onChange={(e) => {
                          updateInstant({ enabled: e.target.checked });
                          soundEngine.playToggle(e.target.checked);
                        }}
                        className="sr-only peer"
                      />
                      <div className="neon-switch w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                    </label>
                  </div>

                  {/* Sound on Flare */}
                  <div className="flex items-center justify-between p-4 rounded-xl neon-card">
                    <div>
                      <div className="font-semibold text-sm text-neutral-200">Play Sound on Flare</div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        Subtle synth chime on flare trigger.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.soundFx}
                        onChange={(e) => updateInstant({ soundFx: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="neon-switch w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                    </label>
                  </div>

                  {/* Passive FX Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl neon-card">
                    <div>
                      <div className="font-semibold text-sm text-neutral-200">Enable Passive Trail FX</div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        Renders particle trails behind pointer while moving.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enablePassiveFx}
                        onChange={(e) => updateInstant({ enablePassiveFx: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="neon-switch w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                    </label>
                  </div>

                  {/* Global Hotkey Configuration */}
                  <div className="p-4 rounded-xl neon-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-neutral-200">Flare hotkey</div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          Press this shortcut anywhere in your OS to trigger the signature flare. Click the combo to record your own.
                        </div>
                      </div>
                      <button
                        onClick={() => setIsRecordingHotkey(!isRecordingHotkey)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
                          isRecordingHotkey
                            ? 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse'
                            : 'bg-white/5 text-neutral-200 border-white/10 hover:border-violet-400/60'
                        }`}
                      >
                        {isRecordingHotkey ? 'Press keys now...' : settings.hotkey}
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10 text-xs">
                      <span className="text-neutral-400">Presets:</span>
                      {['Ctrl+Shift+F', 'Ctrl+Space', 'Alt+M', 'F1'].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => updateInstant({ hotkey: preset })}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                            settings.hotkey === preset
                              ? 'bg-violet-500/20 text-violet-200 border-violet-400/50 font-bold'
                              : 'bg-white/5 text-neutral-400 border-white/10 hover:text-neutral-200'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Startup */}
                  <div className="flex items-center justify-between p-4 rounded-xl neon-card">
                    <div className="font-semibold text-sm text-neutral-200">Launch on startup</div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.startWithWindows}
                        onChange={(e) => updateInstant({ startWithWindows: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="neon-switch w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                    </label>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 2: FX STUDIO */}
            {activeTab === 'fx-studio' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-neutral-100">FX Studio &amp; Particle Customizer</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Configure movement trails, signature flare shockwaves, color palettes, and physics.
                  </p>
                </div>

                {/* Passive FX Style Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-neutral-200">
                      Passive Movement FX (Trail Styles)
                    </label>
                    <span className="text-[11px] text-violet-300 font-mono">
                      Selected: <strong className="capitalize">{settings.passiveFx.replace('-', ' ')}</strong>
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: 'fluid-simulation', label: 'Fluid Simulation', desc: 'Velocity dissipation model' },
                        { id: 'fluid-smoke', label: 'Fluid Smoke Swirl', desc: 'Billowing dye vortices' },
                        { id: 'neon-fluid', label: 'Neon Fluid Dye', desc: 'Luminescent fluid glow' },
                        { id: 'cosmic-vortex', label: 'Cosmic Liquid', desc: 'Galactic chromatic swirls' },
                        { id: 'ink-diffusion', label: 'Ink Diffusion', desc: 'Organic watercolor plumes' },
                        { id: 'spark-trail', label: 'Spark Trail', desc: 'Golden kinetic embers' },
                        { id: 'glow-pulse', label: 'Glow Pulse', desc: 'Soft luminous aura trail' },
                        { id: 'comet-trail', label: 'Comet Tail', desc: 'Aerodynamic ribbon' },
                        { id: 'bubbles', label: 'Bubbles', desc: 'Translucent spheres' },
                        { id: 'fireflies', label: 'Fireflies', desc: 'Organic bioluminescence' },
                        { id: 'star-dust', label: 'Star Dust', desc: 'Twinkling 4-point stars' },
                        { id: 'lightning', label: 'Lightning Arc', desc: 'Electric micro plasma' },
                        { id: 'rainbow', label: 'Rainbow Wave', desc: 'Chromatic color shifts' },
                        { id: 'plasma', label: 'Plasma Field', desc: 'Ionized energy rings' },
                        { id: 'matrix-rain', label: 'Matrix Rain', desc: 'Cascading green code glyphs' },
                        { id: 'fire-flame', label: 'Fire & Flame', desc: 'Blazing buoyant embers' },
                        { id: 'neon-cyber', label: 'Neon Cyber', desc: 'Electric cyan-magenta pulses' },
                        { id: 'magic-dust', label: 'Magic Dust', desc: 'Enchanted pastel shimmer' },
                        { id: 'galaxy', label: 'Galaxy Supernova', desc: 'Deep-space stars & nebula' },
                        { id: 'minimal-beacon', label: 'Minimalist Beacon', desc: 'Single subtle tracking dot' },
                        { id: 'custom-fx', label: 'Custom FX', desc: 'Imported from the FX Designer' },
                      ] as { id: FxPreset; label: string; desc: string }[]
                    ).map((item) => {
                      const isSelected = settings.passiveFx === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            updateFxDraft({ passiveFx: item.id });
                            setSaveStatus(`Selected Passive FX: ${item.label} \u2022 Apply & Save to keep`);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[76px] cursor-pointer ${
                            isSelected
                              ? 'neon-selected'
                              : 'neon-card neon-card-hover'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 w-full">
                            <div className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                              {item.label}
                            </div>
                            {isSelected && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/20 border border-white/50 text-white font-bold text-[9px] uppercase tracking-wider shrink-0 shadow">
                                <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] mt-1 leading-tight ${isSelected ? 'text-indigo-100/85' : 'text-neutral-400'}`}>{item.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleImportCustomFx}
                    className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-200 text-xs font-medium border border-white/10 transition-all cursor-pointer"
                    title="Import an FX Designer JSON config from your clipboard as the Custom FX preset"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Custom FX (JSON from clipboard)</span>
                  </button>
                </div>

                {/* Find Mouse Flare Preset Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-neutral-200">
                      Active "Find Mouse" Flare Animation
                    </label>
                    <span className="text-[11px] text-cyan-400 font-mono">
                      Selected: <strong className="capitalize">{settings.findMouseFx.replace('-', ' ')}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: 'solar-flare', label: 'Solar Flare', desc: 'Concentric shockwaves' },
                        { id: 'fluid-vortex-burst', label: 'Fluid Vortex Burst', desc: 'Radial dye shockwave' },
                        { id: 'sonar-radar', label: 'Sonar Radar', desc: 'Radar rings & reticle' },
                        { id: 'neon-beacon', label: 'Neon Beacon', desc: 'Dual high-contrast rings' },
                        { id: 'quantum-shockwave', label: 'Quantum Wave', desc: 'Relativistic expanding wave' },
                        { id: 'supernova', label: 'Supernova', desc: 'Starry flash explosion' },
                      ] as { id: FlarePreset; label: string; desc: string }[]
                    ).map((item) => {
                      const isSelected = settings.findMouseFx === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            updateFxDraft({ findMouseFx: item.id });
                            onTriggerFlare();
                            setSaveStatus(`Selected Flare: ${item.label} (Previewing) \u2022 Apply & Save to keep`);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[76px] cursor-pointer ${
                            isSelected
                              ? 'neon-selected-cyan'
                              : 'neon-card neon-card-hover'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 w-full">
                            <div className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                              {item.label}
                            </div>
                            {isSelected && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/20 border border-white/50 text-white font-bold text-[9px] uppercase tracking-wider shrink-0 shadow">
                                <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] mt-1 leading-tight ${isSelected ? 'text-indigo-100/85' : 'text-neutral-400'}`}>{item.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Theme Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-neutral-200">
                      Color Palette &amp; Glow Signature
                    </label>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      Selected: <strong className="text-violet-300 capitalize">{settings.colorPreset}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {(
                      [
                        { id: 'amber', label: 'Amber Flare', color: '#f59e0b' },
                        { id: 'cyan', label: 'Cyber Cyan', color: '#06b6d4' },
                        { id: 'emerald', label: 'Emerald Glow', color: '#10b981' },
                        { id: 'violet', label: 'Electric Violet', color: '#8b5cf6' },
                        { id: 'gold', label: 'Solar Gold', color: '#eab308' },
                        { id: 'white', label: 'Pure White', color: '#ffffff' },
                        { id: 'crimson', label: 'Crimson Fire', color: '#ef4444' },
                      ] as { id: ColorPreset; label: string; color: string }[]
                    ).map((pal) => {
                      const isSelected = settings.colorPreset === pal.id;
                      return (
                        <button
                          key={pal.id}
                          onClick={() => {
                            updateFxDraft({ colorPreset: pal.id });
                            setSaveStatus(`Color: ${pal.label} \u2022 Apply & Save to keep`);
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'neon-selected text-white font-bold'
                              : 'neon-card neon-card-hover text-neutral-300'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full shadow-inner ring-1 ring-white/20"
                            style={{ backgroundColor: pal.color }}
                          />
                          <span>{pal.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => updateFxDraft({ colorPreset: 'custom' })}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                        settings.colorPreset === 'custom'
                          ? 'neon-selected text-white font-bold'
                          : 'neon-card neon-card-hover text-neutral-300'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shadow-inner ring-1 ring-white/20"
                        style={{ backgroundColor: settings.customColor }}
                      />
                      <span>Custom Hex</span>
                      {settings.colorPreset === 'custom' && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </button>
                  </div>

                  {/* Custom color + quick swatches (parity with native) */}
                  <div className="mt-3 p-3 rounded-xl neon-card flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-neutral-400">Custom Color:</span>
                    <input
                      type="color"
                      value={settings.customColor}
                      onChange={(e) => updateFxDraft({ customColor: e.target.value.toUpperCase(), colorPreset: 'custom' })}
                      className="w-6 h-6 rounded-full border border-white/20 hover:border-white/60 transition-colors cursor-pointer bg-transparent"
                      title="Click to open the color picker"
                    />
                    <input
                      type="text"
                      value={hexDraft}
                      onChange={(e) => setHexDraft(e.target.value)}
                      onBlur={applyHexDraft}
                      onKeyDown={(e) => e.key === 'Enter' && applyHexDraft()}
                      className="neon-input rounded-lg px-2.5 py-1.5 font-mono w-24"
                      aria-label="Custom color hex"
                    />
                    <div className="flex-1" />
                    <span className="text-neutral-400">Quick:</span>
                    {quickSwatches.map((hex, i) => (
                      <button
                        key={i}
                        onClick={() => updateFxDraft({ customColor: hex, colorPreset: 'custom' })}
                        onDoubleClick={() => beginSwatchEdit(i)}
                        className="w-[18px] h-[18px] rounded-full ring-1 ring-white/20 hover:ring-white/60 transition-shadow cursor-pointer"
                        style={{ backgroundColor: hex }}
                        title="Click to use this color \u2022 double-click to edit it"
                        aria-label={`Quick swatch ${i + 1}: ${hex}`}
                      />
                    ))}
                    <input
                      ref={swatchEditInputRef}
                      type="color"
                      className="sr-only"
                      onChange={(e) => commitSwatchEdit(e.target.value)}
                      aria-hidden="true"
                      tabIndex={-1}
                    />
                  </div>
                </div>

                {/* Fine-Tuning Sliders */}
                <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl neon-card">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300 font-medium">FX Intensity:</span>
                      <span className="text-violet-300 font-mono font-bold">{settings.intensity}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings.intensity}
                      onChange={(e) => updateFxDraft({ intensity: parseFloat(e.target.value) })}
                      className="w-full neon-range bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300 font-medium">Particle Density:</span>
                      <span className="text-violet-300 font-mono font-bold">{settings.particleDensity} / 10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={settings.particleDensity}
                      onChange={(e) => updateFxDraft({ particleDensity: parseInt(e.target.value) })}
                      className="w-full neon-range bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300 font-medium">Animation Speed:</span>
                      <span className="text-violet-300 font-mono font-bold">{settings.animationSpeed}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings.animationSpeed}
                      onChange={(e) => updateFxDraft({ animationSpeed: parseFloat(e.target.value) })}
                      className="w-full neon-range bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300 font-medium">Min Movement Threshold:</span>
                      <span className="text-violet-300 font-mono font-bold">{settings.minMovementThreshold} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={settings.minMovementThreshold}
                      onChange={(e) => updateFxDraft({ minMovementThreshold: parseInt(e.target.value) })}
                      className="w-full neon-range bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Fluid Simulation Controls (Pavel DoGreat Inspired) */}
                <div className="neon-card-cyan p-4 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-neutral-100">
                          Fluid Dynamics &amp; Vorticity Engine
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Navier-Stokes vorticity curl, turbulent smoke diffusion &amp; glowing neon dye
                        </div>
                      </div>
                    </div>

                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 pt-1">
                    {/* Vorticity / Swirl Curl */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-300 font-medium">Vorticity (Curl Spin Strength):</span>
                        <span className="text-cyan-400 font-mono font-bold">{(settings.fluidVorticity ?? 0.85).toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={settings.fluidVorticity ?? 0.85}
                        onChange={(e) => updateFxDraft({ fluidVorticity: parseFloat(e.target.value) })}
                        className="w-full neon-range-cyan bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Fluid Dissipation / Persistence */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-300 font-medium">Smoke Persistence (Dissipation):</span>
                        <span className="text-cyan-400 font-mono font-bold">{Math.round((settings.fluidDissipation ?? 0.96) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.90"
                        max="0.99"
                        step="0.01"
                        value={settings.fluidDissipation ?? 0.96}
                        onChange={(e) => updateFxDraft({ fluidDissipation: parseFloat(e.target.value) })}
                        className="w-full neon-range-cyan bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t border-white/10">
                    <div className="flex items-center justify-between p-2.5 rounded-lg neon-card">
                      <div>
                        <div className="font-semibold text-xs text-neutral-200">Luminescent Glowing Bloom</div>
                        <div className="text-[10px] text-neutral-400">Additive blend mode for intense neon glow</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.fluidBloom !== false}
                        onChange={(e) => updateFxDraft({ fluidBloom: e.target.checked })}
                        className="neon-check-cyan rounded h-4 w-4"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg neon-card">
                      <div>
                        <div className="font-semibold text-xs text-neutral-200">Chromatic Rainbow Dye Cycle</div>
                        <div className="text-[10px] text-neutral-400">Cycles vivid spectrum hues as mouse moves</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.fluidRainbowDye === true}
                        onChange={(e) => updateFxDraft({ fluidRainbowDye: e.target.checked })}
                        className="neon-check-cyan rounded h-4 w-4"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                onStatus={showFxStatus}
              />
            )}

            {activeTab === 'behavior' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-neutral-100">Adaptive Behavior &amp; Multi-Monitor</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Configure situational response triggers and display boundary detection.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Wake from idle burst */}
                  <div className="flex items-center justify-between p-4 rounded-xl neon-card">
                    <div>
                      <div className="font-semibold text-sm text-neutral-200">Wake-From-Idle Burst</div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        Emits a distinct spark burst when first moving the mouse after &gt;2 seconds of inactivity.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.idleBurst}
                        onChange={(e) => updateInstant({ idleBurst: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="neon-switch w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                    </label>
                  </div>

                  {/* Multi-Monitor Crossing Shockwave */}
                  <div className="flex items-center justify-between p-4 rounded-xl neon-card">
                    <div>
                      <div className="font-semibold text-sm text-neutral-200">Monitor-Crossing Transition FX</div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        Fires a subtle pulse when the cursor passes the boundary between multiple displays.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.monitorCrossingFx}
                        onChange={(e) => updateInstant({ monitorCrossingFx: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="neon-switch w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                    </label>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 4: DIAGNOSTICS & SCENARIOS */}
            {activeTab === 'diagnostics' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-neutral-100">Diagnostics &amp; Test Scenarios</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Test cursor location visibility across challenging desktop interfaces.
                  </p>
                </div>

                {/* Desktop Scenario Switcher */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-neutral-200">
                      Test Environment Scenario
                    </label>
                    <span className="text-[11px] text-violet-300 font-mono">
                      Selected: <strong className="capitalize">{settings.desktopBackground}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        { id: 'windows11-dark', label: 'Default Windows 11 Dark', desc: 'Standard clean desktop with wallpaper' },
                        { id: 'busy-editor', label: 'Busy Code Editor (VS Code)', desc: 'Dense code lines where cursors camouflage' },
                        { id: 'dense-sheets', label: 'Finance Spreadsheet (Excel)', desc: 'Grid lines and numbers testing high visual noise' },
                        { id: 'light-workspace', label: 'High Brightness Light Theme', desc: 'Tests white cursor contrast on light backgrounds' },
                      ] as const
                    ).map((scenario) => {
                      const isSelected = settings.desktopBackground === scenario.id;
                      return (
                        <button
                          key={scenario.id}
                          onClick={() => updateInstant({ desktopBackground: scenario.id })}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                            isSelected
                              ? 'neon-selected text-white font-semibold'
                              : 'neon-card neon-card-hover text-neutral-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className={`font-semibold text-xs ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                              {scenario.label}
                            </div>
                            {isSelected && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/20 border border-white/50 text-white font-bold text-[9px] uppercase">
                                <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] mt-1 ${isSelected ? 'text-indigo-100/85' : 'text-neutral-400'}`}>{scenario.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Diagnostic HUD Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl neon-card">
                  <div>
                    <div className="font-semibold text-sm text-neutral-200">Show On-Screen Diagnostic HUD</div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      Displays live FPS, particle count, render latency ms, and cursor velocity meter.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showDiagnostics}
                      onChange={(e) => updateInstant({ showDiagnostics: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="neon-switch w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 6: SOFTWARE UPDATES & RELEASE VALIDATION */}
            {activeTab === 'updates' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                      <span>Software Updates &amp; Release Feeds</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono font-medium">
                        Feed v2.5.2-Live
                      </span>
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Validate current local binary version against verified GitHub/Release metadata and download upgrades.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePerformUpdateCheck()}
                      disabled={isCheckingUpdates}
                      className="neon-btn-primary flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                      <span>{isCheckingUpdates ? 'Validating Release Hash...' : 'Check for Updates'}</span>
                    </button>
                  </div>
                </div>

                {/* Status Hero Card */}
                {(() => {
                  const targetRelease = updateResult?.release ?? FALLBACK_RELEASE;
                  const hasUpdate = updateResult ? updateResult.hasUpdate : isNewerVersion(CURRENT_BUILD_INFO.version, targetRelease.version);
                  
                  return (
                    <div className={`p-5 rounded-2xl border shadow-xl transition-all ${
                      hasUpdate 
                        ? 'bg-gradient-to-br from-amber-950/40 via-[#120a20] to-[#0a0512] border-amber-500/40 shadow-amber-500/5'
                        : 'bg-gradient-to-br from-emerald-950/30 via-[#120a20] to-[#0a0512] border-emerald-500/40 shadow-emerald-500/5'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                            hasUpdate ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          }`}>
                            {hasUpdate ? (
                              <ArrowUpCircle className="w-6 h-6 animate-bounce" />
                            ) : (
                              <CheckCircle2 className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-neutral-100">
                                {hasUpdate ? `Update Available: v${targetRelease.version}` : `Mouseflare is Up to Date (v${CURRENT_BUILD_INFO.version})`}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-300 mt-1 max-w-xl leading-relaxed">
                              {hasUpdate 
                                ? targetRelease.title 
                                : `You are currently running the latest verified stable build. All physics and stability patches are applied.`}
                            </p>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px] text-neutral-400">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                                <span>Checked: <strong>{formatTimeAgo(lastCheckTime)}</strong></span>
                              </span>
                              <span>•</span>
                              <span>Installed: <strong className="text-neutral-200 font-mono">v{CURRENT_BUILD_INFO.version}</strong></span>
                              <span>•</span>
                              <span>Latest: <strong className="text-amber-400 font-mono">v{targetRelease.version}</strong> ({targetRelease.releaseDate})</span>
                            </div>
                          </div>
                        </div>

                        {/* Direct Download Links (real GitHub Release assets) */}
                        {hasUpdate && (
                          <div className="flex sm:flex-col gap-2 shrink-0">
                            <a
                              href={targetRelease.downloadUrls.releasePage}
                              target="_blank"
                              rel="noreferrer"
                              className="neon-btn-primary flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                              <span>View v{targetRelease.version} on GitHub</span>
                            </a>

                            <div className="flex gap-1.5">
                              <a
                                href={targetRelease.downloadUrls.windows}
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-blue-300 border border-white/10 text-[11px] font-medium transition-all text-center"
                              >
                                Win ({targetRelease.fileSizes.windowsZip})
                              </a>
                              <a
                                href={targetRelease.downloadUrls.macOS}
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 border border-white/10 text-[11px] font-medium transition-all text-center"
                              >
                                Mac ({targetRelease.fileSizes.macOSZip})
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Itemized Changelog & Requirements */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Changelog */}
                  <div className="p-4 rounded-xl neon-card flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Itemized Changelog</span>
                      </h4>
                      <ul className="space-y-2 text-xs text-neutral-300">
                        {(updateResult?.release ?? FALLBACK_RELEASE).changelog.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 leading-relaxed">
                            <span className="text-amber-400 shrink-0 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-end text-[11px] text-neutral-400">
                      <span>Target: <strong className="text-neutral-200">Apple Silicon / Intel / x64</strong></span>
                    </div>
                  </div>

                  {/* Automated Update Cadence Configuration */}
                  <div className="p-4 rounded-xl neon-card space-y-3.5">
                    <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      <span>Update Cadence &amp; Preferences</span>
                    </h4>

                    {/* Auto-check Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-xs text-neutral-200">Automatic Background Checks</div>
                        <div className="text-[11px] text-neutral-400">Periodically query release manifest silently.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.autoCheckUpdates}
                        onChange={(e) => updateInstant({ autoCheckUpdates: e.target.checked })}
                        className="neon-check rounded h-4 w-4"
                      />
                    </div>

                    {/* Frequency */}
                    <div className="space-y-1 pt-2 border-t border-white/10">
                      <label className="text-xs text-neutral-300 font-medium flex items-center justify-between">
                        <span>Check Frequency</span>
                        <span className="text-[11px] text-violet-300 font-mono">
                          {settings.checkIntervalHours === 0 ? 'Manual Only' : `Every ${settings.checkIntervalHours} Hours`}
                        </span>
                      </label>
                      <NeonSelect
                        value={String(settings.checkIntervalHours)}
                        onChange={(v) => updateInstant({ checkIntervalHours: Number(v) })}
                        options={[
                          { value: '6', label: 'Every 6 Hours (High Frequency)' },
                          { value: '24', label: 'Every 24 Hours (Daily)' },
                          { value: '72', label: 'Every 72 Hours (Weekly)' },
                          { value: '0', label: 'Manual Checks Only' },
                        ]}
                        className="w-full px-3 py-1.5 text-xs"
                        ariaLabel="Check Frequency"
                      />
                    </div>

                    {/* Notification Alert Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <div>
                        <div className="font-semibold text-xs text-neutral-200">In-App Upgrade Notifications</div>
                        <div className="text-[11px] text-neutral-400">Show notification bar when an update is available.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.notifyOnUpdate}
                        onChange={(e) => updateInstant({ notifyOnUpdate: e.target.checked })}
                        className="neon-check rounded h-4 w-4"
                      />
                    </div>

                    {/* Minimum OS Requirements */}
                    <div className="pt-2 border-t border-white/10 text-[11px] text-neutral-400 space-y-1">
                      <div className="font-semibold text-neutral-300 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Minimum System Requirements:</span>
                      </div>
                      <div>• Windows: {(updateResult?.release ?? FALLBACK_RELEASE).minRequirements.windows}</div>
                      <div>• macOS: {(updateResult?.release ?? FALLBACK_RELEASE).minRequirements.macOS}</div>
                    </div>
                  </div>
                </div>

                {/* Package Integrity & Verification */}
                {(() => {
                  const release = updateResult?.release ?? FALLBACK_RELEASE;
                  const minisignCmd = `minisign -Vm Mouseflare-macOS.zip -P RWQV1L6pDRSw69B18smY6ny2RZpAecKvPvS48ImhiukQjEmN8lAqP3Mw`;
                  return (
                    <div className="p-4 rounded-xl bg-[#0a0512]/70 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Security &amp; Package Verification</span>
                        </span>
                        <a
                          href={release.downloadUrls.checksums}
                          className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-violet-300 border border-white/10"
                        >
                          Download SHA256SUMS.txt
                        </a>
                      </div>

                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Every release ships SHA-256 checksums, and stable releases are additionally
                        minisign-signed. Verify a download against the project's public key:
                      </p>

                      <div className="flex items-center justify-between p-2 rounded bg-[#0d0618] border border-white/10 text-xs font-mono">
                        <span className="text-neutral-300 text-[10px] truncate">{minisignCmd}</span>
                        <button
                          onClick={() => handleCopyChecksum(minisignCmd, 'minisign')}
                          className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-violet-300 shrink-0 ml-2"
                        >
                          {copiedChecksum === 'minisign' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Status bar + footer (native status model) */}
        <div className="h-9 bg-[#0a0512]/70 border-t border-violet-500/20 flex items-center gap-2.5 px-6 text-xs text-neutral-400 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="truncate">{saveStatus}</span>
        </div>
        <div className="h-14 bg-[#0a0512]/85 border-t border-violet-500/20 flex items-center justify-between px-6 text-xs text-neutral-400 shrink-0">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-violet-200/60 hover:text-violet-100 hover:bg-white/5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2.5">
            {isFxTab && (
              <button
                onClick={handleSaveAndApply}
                className="neon-btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Apply &amp; Save</span>
              </button>
            )}

            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-violet-100 font-medium transition-colors cursor-pointer text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
