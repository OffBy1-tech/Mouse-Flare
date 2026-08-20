import React, { useState, useEffect } from 'react';
import { AppSettings, ColorPreset, FlarePreset, FxPreset } from '../types';
import { NATIVE_SOURCE_FILES } from '../data/nativeSource';
import { ParticleFxEditor } from './ParticleFxEditor';
import { downloadWindowsNativeZip, downloadMacNativeZip, downloadCrossPlatformZip } from '../utils/nativeDownloader';
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
  Monitor, 
  Activity, 
  Code2, 
  Check, 
  Copy, 
  X, 
  Minus, 
  Square,
  Zap, 
  RotateCcw,
  Palette,
  Download,
  FolderArchive,
  Save,
  CheckCircle2,
  Undo2,
  RefreshCw,
  ArrowUpCircle,
  ShieldCheck,
  Clock,
  ExternalLink,
  Cpu,
  AlertCircle,
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

export type TabType = 'general' | 'fx-studio' | 'fx-designer' | 'behavior' | 'diagnostics' | 'native-code' | 'updates';

import { DEFAULT_SETTINGS } from '../data/defaultSettings';

export const SettingsWindow: React.FC<SettingsWindowProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  onTriggerFlare,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'fx-studio');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'windows' | 'macos'>('all');
  const [selectedCodeIndex, setSelectedCodeIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [downloadingType, setDownloadingType] = useState<'windows' | 'macos' | 'universal' | null>(null);

  // Update check states
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<number>(() => settings.lastCheckedTimestamp || Date.now() - 1000 * 60 * 60 * 4);
  const [selectedReleaseChannel, setSelectedReleaseChannel] = useState<'stable' | 'beta'>(settings.updateChannel || 'stable');

  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Sync initial tab if passed from outside (e.g. clicking notification banner)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Initial check on mount if autoCheckUpdates is enabled and haven't checked recently
  useEffect(() => {
    if (settings.autoCheckUpdates && !updateResult) {
      checkNativeBuildUpdates(CURRENT_BUILD_INFO.version, settings.updateChannel || 'stable').then((res) => {
        setUpdateResult(res);
      });
    }
  }, []);

  const handlePerformUpdateCheck = async (channelOverride?: 'stable' | 'beta') => {
    const channel = channelOverride || settings.updateChannel || selectedReleaseChannel;
    setIsCheckingUpdates(true);
    soundEngine.playClick();
    try {
      const result = await checkNativeBuildUpdates(CURRENT_BUILD_INFO.version, channel);
      setUpdateResult(result);
      const now = Date.now();
      setLastCheckTime(now);
      updateDraft({ lastCheckedTimestamp: now, updateChannel: channel });
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

  // Settings apply (and persist, via App) immediately — there is no separate
  // draft copy, so changes made elsewhere (tray, workspace switcher) can never
  // be clobbered by a stale save.
  const updateDraft = (partial: Partial<AppSettings>) => {
    setSaveStatus(null);
    onUpdateSettings(partial);
  };

  const handleSaveAndApply = () => {
    setSaveStatus('Saved & Applied!');
    soundEngine.playToggle(true);
    setTimeout(() => {
      setSaveStatus(null);
    }, 3000);
  };

  const handleResetDefaults = () => {
    updateDraft(DEFAULT_SETTINGS);
    setSaveStatus('Reset to Defaults');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const filteredFiles = NATIVE_SOURCE_FILES.filter((f) => {
    if (platformFilter === 'all') return true;
    return f.platform === platformFilter;
  });

  const activeFile = filteredFiles[selectedCodeIndex] || filteredFiles[0] || NATIVE_SOURCE_FILES[0];

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownload = async (type: 'windows' | 'macos' | 'universal') => {
    setDownloadingType(type);
    try {
      if (type === 'windows') await downloadWindowsNativeZip();
      else if (type === 'macos') await downloadMacNativeZip();
      else await downloadCrossPlatformZip();
    } finally {
      setDownloadingType(null);
    }
  };

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
        updateDraft({ hotkey: keys.join('+') });
        setIsRecordingHotkey(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      <div 
        className="w-full max-w-4xl h-[660px] bg-neutral-900/95 border border-neutral-700/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl flex flex-col overflow-hidden pointer-events-auto text-neutral-100 select-none animate-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDownHotkey}
        tabIndex={0}
      >
        {/* Title Bar */}
        <div className="h-11 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img src="/app-logo.png" alt="Mouseflare logo" className="w-5 h-5 rounded-md shadow" />
            <span className="text-xs font-semibold tracking-wide text-neutral-200">
              Mouseflare Settings &amp; Preferences
            </span>
            {saveStatus && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {saveStatus}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 -mr-1">
            <button
              onClick={handleSaveAndApply}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow transition-all active:scale-95 mr-2"
              title="Save and persist current selections"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Apply &amp; Save</span>
            </button>

            <button 
              onClick={onClose}
              className="w-8 h-8 rounded hover:bg-red-500/80 hover:text-white flex items-center justify-center text-neutral-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body (Sidebar + Content) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-56 bg-neutral-950/60 border-r border-neutral-800/80 p-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 px-3 py-1">
                Navigation
              </div>

              <button
                onClick={() => setActiveTab('general')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'general'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-neutral-300 hover:bg-white/5'
                }`}
              >
                <Flame className="w-4 h-4 text-amber-400" />
                <span>General</span>
              </button>

              <button
                onClick={() => setActiveTab('fx-studio')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'fx-studio'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-neutral-300 hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>FX Studio</span>
              </button>

              <button
                onClick={() => setActiveTab('fx-designer')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'fx-designer'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow'
                    : 'text-neutral-300 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>FX Designer</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  NEW
                </span>
              </button>

              <button
                onClick={() => setActiveTab('behavior')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'behavior'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-neutral-300 hover:bg-white/5'
                }`}
              >
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Behavior &amp; Monitors</span>
              </button>

              <button
                onClick={() => setActiveTab('diagnostics')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'diagnostics'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-neutral-300 hover:bg-white/5'
                }`}
              >
                <Activity className="w-4 h-4 text-violet-400" />
                <span>Diagnostics</span>
              </button>

              <button
                onClick={() => setActiveTab('native-code')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'native-code'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-neutral-300 hover:bg-white/5'
                }`}
              >
                <Code2 className="w-4 h-4 text-blue-400" />
                <span>Native Desktop Apps</span>
              </button>

              <button
                onClick={() => setActiveTab('updates')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'updates'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-neutral-300 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw className={`w-4 h-4 text-amber-400 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                  <span>Check for Updates</span>
                </div>
                {updateResult?.hasUpdate ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-bold border border-amber-500/50 animate-pulse">
                    v{updateResult.latestVersion}
                  </span>
                ) : (
                  <span className="text-[9px] text-neutral-400">
                    v{CURRENT_BUILD_INFO.version}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Actions in Sidebar */}
            <div className="pt-3 border-t border-neutral-800 space-y-2">
              <button
                onClick={onTriggerFlare}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs shadow-lg transition-all active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Test Flare Now</span>
              </button>

              <button
                onClick={handleResetDefaults}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-[11px] transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-neutral-900/60">
            {/* TAB 1: GENERAL */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-neutral-100">General Configuration</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Control primary startup, hotkeys, and master switches.
                  </p>
                </div>

                <div className="grid gap-3">
                  {/* Master Switch */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
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
                          updateDraft({ enabled: e.target.checked });
                          soundEngine.playToggle(e.target.checked);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>

                  {/* Passive FX Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
                    <div>
                      <div className="font-semibold text-sm text-neutral-200">Enable Passive Trail FX</div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        Renders subtle momentary particles behind the pointer while moving.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enablePassiveFx}
                        onChange={(e) => updateDraft({ enablePassiveFx: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>

                  {/* Global Hotkey Configuration */}
                  <div className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-neutral-200">Find Mouse Global Hotkey</div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          Press this shortcut anywhere in your OS to trigger the signature flare.
                        </div>
                      </div>
                      <button
                        onClick={() => setIsRecordingHotkey(!isRecordingHotkey)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
                          isRecordingHotkey
                            ? 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse'
                            : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-amber-500/50'
                        }`}
                      >
                        {isRecordingHotkey ? 'Press keys now...' : settings.hotkey}
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-800 text-xs">
                      <span className="text-neutral-400">Presets:</span>
                      {['Ctrl+Shift+F', 'Ctrl+Space', 'Alt+M', 'F1'].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => updateDraft({ hotkey: preset })}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                            settings.hotkey === preset
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                              : 'bg-neutral-800/80 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sound FX & Startup */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
                      <div>
                        <div className="font-semibold text-xs text-neutral-200">Start with OS</div>
                        <div className="text-[11px] text-neutral-400">Launch in tray upon system login.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.startWithWindows}
                        onChange={(e) => updateDraft({ startWithWindows: e.target.checked })}
                        className="rounded bg-neutral-700 border-neutral-600 text-amber-500 focus:ring-amber-500 h-4 w-4"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
                      <div>
                        <div className="font-semibold text-xs text-neutral-200">Acoustic Beacon Chime</div>
                        <div className="text-[11px] text-neutral-400">Subtle synth chime on flare trigger.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.soundFx}
                        onChange={(e) => updateDraft({ soundFx: e.target.checked })}
                        className="rounded bg-neutral-700 border-neutral-600 text-amber-500 focus:ring-amber-500 h-4 w-4"
                      />
                    </div>
                  </div>

                  {/* Quick Software Updates Card in General Tab */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-neutral-800/60 to-neutral-900 border border-neutral-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                        <RefreshCw className={`w-4 h-4 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-neutral-200">Software Updates &amp; Build Status</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                            v{CURRENT_BUILD_INFO.version}
                          </span>
                          {updateResult?.hasUpdate && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
                              v{updateResult.latestVersion} Available
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">
                          {updateResult?.hasUpdate
                            ? `Latest ${settings.updateChannel} build (v${updateResult.latestVersion}) is ready to download from GitHub Releases.`
                            : `Current installed version is validated against release feed (checked ${formatTimeAgo(lastCheckTime)}).`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handlePerformUpdateCheck()}
                        disabled={isCheckingUpdates}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdates ? 'animate-spin text-amber-400' : ''}`} />
                        <span>{isCheckingUpdates ? 'Checking...' : 'Check Now'}</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('updates')}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>View Release Notes</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: FX STUDIO */}
            {activeTab === 'fx-studio' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-neutral-100">FX Studio &amp; Customizer</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Select particle styles, active flare animations, color palettes, and dynamics. Click any item to select and preview.
                  </p>
                </div>

                {/* Passive FX Style Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-neutral-200">
                      Passive Movement FX (Movement Trail)
                    </label>
                    <span className="text-[11px] text-amber-400 font-mono">
                      Selected: <strong className="capitalize">{settings.passiveFx.replace('-', ' ')}</strong>
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: 'fluid-simulation', label: 'Fluid Simulation', desc: 'Velocity-based dissipation & Navier-Stokes curl vortices' },
                        { id: 'fluid-smoke', label: 'Fluid Smoke Swirl', desc: 'Pavel DoGreat style swirling dye vortices' },
                        { id: 'neon-fluid', label: 'Neon Fluid Dye', desc: 'Ultra-vivid fluorescent luminescent fluid stream' },
                        { id: 'cosmic-vortex', label: 'Cosmic Liquid', desc: 'Deep galactic vortices with star sparkles' },
                        { id: 'ink-diffusion', label: 'Ink Diffusion', desc: 'Organic watercolor plumes in water' },
                        { id: 'spark-trail', label: 'Spark Trail', desc: 'Golden kinetic embers with gravity decay' },
                        { id: 'glow-pulse', label: 'Glow Pulse', desc: 'Soft luminous aura around cursor' },
                        { id: 'comet-trail', label: 'Comet Trail', desc: 'High-speed blazing ribbon tail' },
                        { id: 'bubbles', label: 'Bubbles', desc: 'Floating translucent glowing orbs' },
                        { id: 'fireflies', label: 'Fireflies', desc: 'Organic bioluminescent drifters' },
                        { id: 'star-dust', label: 'Star Dust', desc: 'Twinkling 4-point celestial stars' },
                        { id: 'lightning', label: 'Lightning Arc', desc: 'Electric dynamic micro arcs' },
                        { id: 'rainbow', label: 'Rainbow Wave', desc: 'Prismatic chromatic color shifts' },
                        { id: 'plasma', label: 'Plasma Field', desc: 'Ionized energetic vortex rings' },
                        { id: 'matrix-rain', label: 'Matrix Rain', desc: 'Cascading green code glyphs' },
                        { id: 'fire-flame', label: 'Fire & Flame', desc: 'Blazing embers with upward buoyancy' },
                        { id: 'neon-cyber', label: 'Neon Cyber', desc: 'Electric cyan-magenta arcade pulses' },
                        { id: 'magic-dust', label: 'Magic Dust', desc: 'Enchanted pastel shimmer sparkles' },
                        { id: 'galaxy', label: 'Galaxy Supernova', desc: 'Deep-space stars & nebula dust' },
                        { id: 'minimal-beacon', label: 'Minimalist Beacon', desc: 'Single subtle tracking dot' },
                      ] as { id: FxPreset; label: string; desc: string }[]
                    ).map((item) => {
                      const isSelected = settings.passiveFx === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => updateDraft({ passiveFx: item.id })}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[76px] cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-500/50 shadow-[0_0_18px_rgba(245,158,11,0.25)]'
                              : 'bg-neutral-800/40 border-neutral-700/60 hover:bg-neutral-800/80 hover:border-neutral-500'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 w-full">
                            <div className={`font-bold text-xs ${isSelected ? 'text-amber-300' : 'text-neutral-200'}`}>
                              {item.label}
                            </div>
                            {isSelected && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500 text-neutral-950 font-bold text-[9px] uppercase tracking-wider shrink-0 shadow">
                                <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-1 leading-tight">{item.desc}</div>
                        </button>
                      );
                    })}
                  </div>
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
                        { id: 'solar-flare', label: 'Solar Flare', desc: 'Central sunburst with expanding shockwave rings' },
                        { id: 'fluid-vortex-burst', label: 'Fluid Vortex Burst', desc: 'Pavel DoGreat radial swirling shockwave & dye rays' },
                        { id: 'sonar-radar', label: 'Sonar Radar', desc: 'Tactical concentric rings & crosshair targeting' },
                        { id: 'neon-beacon', label: 'Neon Beacon', desc: 'Glowing pillar pulse with high-contrast bloom' },
                        { id: 'quantum-shockwave', label: 'Quantum Wave', desc: 'Distortion wave & chromatic aberration debris' },
                        { id: 'supernova', label: 'Supernova', desc: 'Intense flash core & starry explosion burst' },
                      ] as { id: FlarePreset; label: string; desc: string }[]
                    ).map((item) => {
                      const isSelected = settings.findMouseFx === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            updateDraft({ findMouseFx: item.id });
                            onTriggerFlare();
                          }}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[76px] cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-500/50 shadow-[0_0_18px_rgba(6,182,212,0.25)]'
                              : 'bg-neutral-800/40 border-neutral-700/60 hover:bg-neutral-800/80 hover:border-neutral-500'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 w-full">
                            <div className={`font-bold text-xs ${isSelected ? 'text-cyan-300' : 'text-neutral-200'}`}>
                              {item.label}
                            </div>
                            {isSelected && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500 text-neutral-950 font-bold text-[9px] uppercase tracking-wider shrink-0 shadow">
                                <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-1 leading-tight">{item.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Theme Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-neutral-200">
                      Color Palette &amp; Signature Glow
                    </label>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      Selected: <strong className="text-amber-400 capitalize">{settings.colorPreset}</strong>
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
                          onClick={() => updateDraft({ colorPreset: pal.id })}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-neutral-800 border-white text-white shadow-lg ring-2 ring-white/30 font-bold'
                              : 'bg-neutral-800/40 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-500'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full shadow-inner ring-1 ring-white/20"
                            style={{ backgroundColor: pal.color }}
                          />
                          <span>{pal.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fine-Tuning Sliders */}
                <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300 font-medium">FX Intensity:</span>
                      <span className="text-amber-400 font-mono font-bold">{settings.intensity}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings.intensity}
                      onChange={(e) => updateDraft({ intensity: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 bg-neutral-700 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300 font-medium">Particle Density:</span>
                      <span className="text-amber-400 font-mono font-bold">{settings.particleDensity} / 10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={settings.particleDensity}
                      onChange={(e) => updateDraft({ particleDensity: parseInt(e.target.value) })}
                      className="w-full accent-amber-500 bg-neutral-700 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300 font-medium">Animation Speed:</span>
                      <span className="text-amber-400 font-mono font-bold">{settings.animationSpeed}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings.animationSpeed}
                      onChange={(e) => updateDraft({ animationSpeed: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 bg-neutral-700 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300 font-medium">Min Movement Threshold:</span>
                      <span className="text-amber-400 font-mono font-bold">{settings.minMovementThreshold} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={settings.minMovementThreshold}
                      onChange={(e) => updateDraft({ minMovementThreshold: parseInt(e.target.value) })}
                      className="w-full accent-amber-500 bg-neutral-700 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Fluid Simulation Controls (Pavel DoGreat Inspired) */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-850 to-neutral-900 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.08)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-neutral-100 flex items-center gap-2">
                          Fluid Dynamics &amp; Vorticity Engine
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono uppercase tracking-wider font-semibold">
                            Pavel DoGreat Style
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Navier-Stokes vorticity curl, turbulent smoke diffusion &amp; glowing neon dye
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        updateDraft({
                          passiveFx: 'fluid-smoke',
                          findMouseFx: 'fluid-vortex-burst',
                          fluidVorticity: 1.8,
                          fluidDissipation: 0.97,
                          fluidBloom: true,
                          fluidRainbowDye: true,
                        });
                        onTriggerFlare();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                      title="Activate Pavel DoGreat fluid style preset"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Quick Test Fluid Burst</span>
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 pt-1">
                    {/* Vorticity / Swirl Curl */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-300 font-medium">Vorticity (Curl Spin Strength):</span>
                        <span className="text-cyan-400 font-mono font-bold">{(settings.fluidVorticity ?? 1.5).toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        value={settings.fluidVorticity ?? 1.5}
                        onChange={(e) => updateDraft({ fluidVorticity: parseFloat(e.target.value) })}
                        className="w-full accent-cyan-400 bg-neutral-700 h-1.5 rounded-lg appearance-none cursor-pointer"
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
                        onChange={(e) => updateDraft({ fluidDissipation: parseFloat(e.target.value) })}
                        className="w-full accent-cyan-400 bg-neutral-700 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t border-neutral-800">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/60 border border-neutral-700/60">
                      <div>
                        <div className="font-semibold text-xs text-neutral-200">Luminescent Glowing Bloom</div>
                        <div className="text-[10px] text-neutral-400">Additive blend mode for intense neon glow</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.fluidBloom !== false}
                        onChange={(e) => updateDraft({ fluidBloom: e.target.checked })}
                        className="rounded bg-neutral-700 border-neutral-600 text-cyan-500 focus:ring-cyan-500 h-4 w-4"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/60 border border-neutral-700/60">
                      <div>
                        <div className="font-semibold text-xs text-neutral-200">Chromatic Rainbow Dye Cycle</div>
                        <div className="text-[10px] text-neutral-400">Cycles vivid spectrum hues as mouse moves</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.fluidRainbowDye === true}
                        onChange={(e) => updateDraft({ fluidRainbowDye: e.target.checked })}
                        className="rounded bg-neutral-700 border-neutral-600 text-cyan-500 focus:ring-cyan-500 h-4 w-4"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BEHAVIOR & MONITORS */}
            {/* TAB: PARTICLE FX DESIGNER */}
            {activeTab === 'fx-designer' && (
              <div className="h-full flex flex-col -m-6">
                <ParticleFxEditor
                  currentActiveConfigId={settings.customFxConfig?.id}
                  onApplyToCursor={(customConfig) => {
                    updateDraft({
                      passiveFx: 'custom-fx',
                      customFxConfig: customConfig,
                      enablePassiveFx: true,
                    });
                    onTriggerFlare();
                  }}
                />
              </div>
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
                  <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
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
                        onChange={(e) => updateDraft({ idleBurst: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>

                  {/* Multi-Monitor Crossing Shockwave */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
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
                        onChange={(e) => updateDraft({ monitorCrossingFx: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>

                  {/* Multi-Monitor Simulation Mode */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
                    <div>
                      <div className="font-semibold text-sm text-neutral-200">Multi-Monitor Display Arena</div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        Simulates dual 4K/1440p monitors with negative coordinate spaces and seamless border traversal.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.multiMonitorMode}
                        onChange={(e) => updateDraft({ multiMonitorMode: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>

                  {/* Reduced Motion Mode */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
                    <div>
                      <div className="font-semibold text-sm text-neutral-200">Accessibility: Reduced Motion</div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        Replaces particle sprays with a single clean, high-contrast locator beacon.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.reducedMotion}
                        onChange={(e) => updateDraft({ reducedMotion: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
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
                    <span className="text-[11px] text-amber-400 font-mono">
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
                          onClick={() => updateDraft({ desktopBackground: scenario.id })}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-500/50 shadow-lg text-white font-semibold'
                              : 'bg-neutral-800/40 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-500'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className={`font-semibold text-xs ${isSelected ? 'text-amber-300' : 'text-neutral-200'}`}>
                              {scenario.label}
                            </div>
                            {isSelected && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500 text-neutral-950 font-bold text-[9px] uppercase">
                                <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-1">{scenario.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Diagnostic HUD Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
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
                      onChange={(e) => updateDraft({ showDiagnostics: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 5: NATIVE DESKTOP APPS (WINDOWS & MACOS) */}
            {activeTab === 'native-code' && (
              <div className="space-y-4">
                {/* Platform Download Cards */}
                <div className="grid sm:grid-cols-2 gap-3">
                  {/* Windows Native Card */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 to-neutral-900 border border-blue-500/30 shadow-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          Windows 10 / 11
                        </span>
                        <span className="text-[11px] text-neutral-400">.NET 8 WPF / Direct2D</span>
                      </div>
                      <h3 className="text-sm font-bold text-neutral-100">Windows System Tray App</h3>
                      <p className="text-xs text-neutral-300 mt-1">
                        Includes custom flame tray icon, live Settings Window (<code className="text-amber-400 font-mono">SettingsWindow.xaml</code>), and 1-click <code className="text-amber-400 font-mono">build.bat</code>.
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownload('windows')}
                      disabled={downloadingType !== null}
                      className="mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-all active:scale-95 w-full cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>{downloadingType === 'windows' ? 'Packaging Windows ZIP...' : 'Download Windows App (.zip)'}</span>
                    </button>
                  </div>

                  {/* macOS Native Card */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-950/40 to-neutral-900 border border-purple-500/30 shadow-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          macOS (Universal)
                        </span>
                        <span className="text-[11px] text-neutral-400">Swift 5.9 / AppKit</span>
                      </div>
                      <h3 className="text-sm font-bold text-neutral-100">macOS Menu Bar App</h3>
                      <p className="text-xs text-neutral-300 mt-1">
                        Native status bar menu item, transparent floating overlay window across displays, global hotkey (⌘+Shift+F), and <code className="text-amber-400 font-mono">build.sh</code>.
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownload('macos')}
                      disabled={downloadingType !== null}
                      className="mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow transition-all active:scale-95 w-full cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>{downloadingType === 'macos' ? 'Packaging macOS ZIP...' : 'Download macOS App (.zip)'}</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Copy Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400 mr-1">Platform:</span>
                    {(
                      [
                        { id: 'all', label: 'All Files' },
                        { id: 'windows', label: 'Windows (C#)' },
                        { id: 'macos', label: 'macOS (Swift)' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPlatformFilter(p.id);
                          setSelectedCodeIndex(0);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          platformFilter === p.id
                            ? 'bg-neutral-800 text-amber-300 border border-neutral-700 font-semibold'
                            : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload('universal')}
                      disabled={downloadingType !== null}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all shadow cursor-pointer"
                      title="Download cross-platform package containing both Windows and macOS source code"
                    >
                      <FolderArchive className="w-3.5 h-3.5" />
                      <span>{downloadingType === 'universal' ? 'Packaging...' : 'Download Both (.zip)'}</span>
                    </button>

                    <button
                      onClick={() => handleCopyCode(activeFile.code)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 text-xs font-medium transition-all shadow cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied File!' : 'Copy Code'}</span>
                    </button>
                  </div>
                </div>

                {/* File Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-neutral-800">
                  {filteredFiles.map((file, idx) => (
                    <button
                      key={file.name}
                      onClick={() => setSelectedCodeIndex(idx)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                        activeFile.name === file.name
                          ? 'bg-neutral-800 text-amber-300 border border-neutral-700 font-semibold'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                      }`}
                    >
                      {file.name}
                    </button>
                  ))}
                </div>

                {/* File description */}
                <div className="text-xs text-neutral-400 font-mono bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800">
                  <span className="text-neutral-200 font-semibold">Path: </span>
                  {activeFile.path} — {activeFile.description}
                </div>

                {/* Code Viewer */}
                <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 font-mono text-xs text-neutral-300 overflow-x-auto max-h-[220px] leading-relaxed">
                  <pre>{activeFile.code}</pre>
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
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
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
                        ? 'bg-gradient-to-br from-amber-950/40 via-neutral-900 to-neutral-950 border-amber-500/40 shadow-amber-500/5' 
                        : 'bg-gradient-to-br from-emerald-950/30 via-neutral-900 to-neutral-950 border-emerald-500/40 shadow-emerald-500/5'
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
                              <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
                                hasUpdate ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}>
                                {targetRelease.channel}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-300 mt-1 max-w-xl leading-relaxed">
                              {hasUpdate 
                                ? targetRelease.title 
                                : `You are currently running the latest verified ${selectedReleaseChannel} build. All physics and stability patches are applied.`}
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
                              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                              <span>View v{targetRelease.version} on GitHub</span>
                            </a>

                            <div className="flex gap-1.5">
                              <a
                                href={targetRelease.downloadUrls.windows}
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-blue-300 border border-neutral-700 text-[11px] font-medium transition-all text-center"
                              >
                                Win ({targetRelease.fileSizes.windowsZip})
                              </a>
                              <a
                                href={targetRelease.downloadUrls.macOS}
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-purple-300 border border-neutral-700 text-[11px] font-medium transition-all text-center"
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

                {/* Live Release Feed header + channel selector */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Release Feed — live from GitHub Releases</span>
                  </h3>
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      onClick={() => {
                        setSelectedReleaseChannel('stable');
                        handlePerformUpdateCheck('stable');
                      }}
                      className={`px-2.5 py-0.5 rounded-lg font-medium text-xs transition-all ${
                        selectedReleaseChannel === 'stable'
                          ? 'bg-neutral-800 text-amber-300 border border-neutral-700 font-bold'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Stable
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReleaseChannel('beta');
                        handlePerformUpdateCheck('beta');
                      }}
                      className={`px-2.5 py-0.5 rounded-lg font-medium text-xs transition-all ${
                        selectedReleaseChannel === 'beta'
                          ? 'bg-neutral-800 text-purple-300 border border-neutral-700 font-bold'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Beta (rolling dev)
                    </button>
                  </div>
                </div>

                {/* Itemized Changelog & Requirements */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Changelog */}
                  <div className="p-4 rounded-xl bg-neutral-800/30 border border-neutral-700/60 flex flex-col justify-between">
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

                    <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Channel: <strong className="text-neutral-200 capitalize">{selectedReleaseChannel}</strong></span>
                      <span>Target: <strong className="text-neutral-200">Apple Silicon / Intel / x64</strong></span>
                    </div>
                  </div>

                  {/* Automated Update Cadence Configuration */}
                  <div className="p-4 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-3.5">
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
                        onChange={(e) => updateDraft({ autoCheckUpdates: e.target.checked })}
                        className="rounded bg-neutral-700 border-neutral-600 text-amber-500 focus:ring-amber-500 h-4 w-4"
                      />
                    </div>

                    {/* Frequency */}
                    <div className="space-y-1 pt-2 border-t border-neutral-800">
                      <label className="text-xs text-neutral-300 font-medium flex items-center justify-between">
                        <span>Check Frequency</span>
                        <span className="text-[11px] text-amber-400 font-mono">
                          {settings.checkIntervalHours === 0 ? 'Manual Only' : `Every ${settings.checkIntervalHours} Hours`}
                        </span>
                      </label>
                      <select
                        value={settings.checkIntervalHours}
                        onChange={(e) => updateDraft({ checkIntervalHours: Number(e.target.value) })}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value={6}>Every 6 Hours (High Frequency)</option>
                        <option value={24}>Every 24 Hours (Daily - Recommended)</option>
                        <option value={72}>Every 72 Hours (Weekly)</option>
                        <option value={0}>Manual Checks Only</option>
                      </select>
                    </div>

                    {/* Notification Alert Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                      <div>
                        <div className="font-semibold text-xs text-neutral-200">In-App Upgrade Notifications</div>
                        <div className="text-[11px] text-neutral-400">Show notification bar when an update is available.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.notifyOnUpdate}
                        onChange={(e) => updateDraft({ notifyOnUpdate: e.target.checked })}
                        className="rounded bg-neutral-700 border-neutral-600 text-amber-500 focus:ring-amber-500 h-4 w-4"
                      />
                    </div>

                    {/* Minimum OS Requirements */}
                    <div className="pt-2 border-t border-neutral-800 text-[11px] text-neutral-400 space-y-1">
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
                    <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Security &amp; Package Verification</span>
                        </span>
                        <a
                          href={release.downloadUrls.checksums}
                          className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700"
                        >
                          Download SHA256SUMS.txt
                        </a>
                      </div>

                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Every release ships SHA-256 checksums, and stable releases are additionally
                        minisign-signed. Verify a download against the project's public key:
                      </p>

                      <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800 text-xs font-mono">
                        <span className="text-neutral-300 text-[10px] truncate">{minisignCmd}</span>
                        <button
                          onClick={() => handleCopyChecksum(minisignCmd, 'minisign')}
                          className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-300 shrink-0 ml-2"
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

        {/* Footer */}
        <div className="h-14 bg-neutral-950/90 border-t border-neutral-800/80 flex items-center justify-between px-6 text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Mouseflare Engine: <strong className="text-neutral-200">60+ FPS Ready</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSaveAndApply}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Apply &amp; Save</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors cursor-pointer text-xs"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
