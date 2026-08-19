import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppSettings, FlarePreset } from './types';
import { ParticleEngine } from './engine/particleEngine';
import { soundEngine } from './engine/sound';
import { OverlayCanvas } from './components/OverlayCanvas';
import { DesktopSimulator } from './components/DesktopSimulator';
import { WindowsTaskbar } from './components/WindowsTaskbar';
import { SettingsWindow, TabType } from './components/SettingsWindow';
import { OnboardingDialog } from './components/OnboardingDialog';
import { FindMouseChallengeModal } from './components/FindMouseChallengeModal';
import { downloadWindowsNativeZip, downloadMacNativeZip, downloadCrossPlatformZip } from './utils/nativeDownloader';
import {
  CURRENT_BUILD_INFO,
  checkNativeBuildUpdates,
  UpdateCheckResult,
  isNewerVersion
} from './utils/updateChecker';
import { 
  Sparkles, 
  Zap, 
  Monitor, 
  Sliders, 
  Layers, 
  Activity,
  Maximize2,
  Minimize2,
  Download,
  Terminal,
  HelpCircle,
  X,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  FolderArchive,
  ArrowUpCircle,
  RefreshCw
} from 'lucide-react';

import { DEFAULT_SETTINGS } from './data/defaultSettings';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('mouseflare_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {}
    return DEFAULT_SETTINGS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [settingsInitialTab, setSettingsInitialTab] = useState<TabType | undefined>('fx-studio');
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('mouseflare_onboarded');
  });
  const [showChallenge, setShowChallenge] = useState(false);
  const [showNativeModal, setShowNativeModal] = useState(false);
  const [isFullscreenOverlay, setIsFullscreenOverlay] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [downloadingType, setDownloadingType] = useState<'windows' | 'macos' | 'universal' | null>(null);

  // Background update check state
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false);

  // Check for updates on mount if enabled
  useEffect(() => {
    if (settings.autoCheckUpdates) {
      checkNativeBuildUpdates(CURRENT_BUILD_INFO.version, settings.updateChannel || 'stable').then((res) => {
        setUpdateInfo(res);
      });
    }
  }, [settings.autoCheckUpdates, settings.updateChannel]);

  // Core Engine instance
  const engine = useMemo(() => new ParticleEngine(), []);
  const mouseCoords = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Save settings on update
  const handleUpdateSettings = (newPartial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...newPartial };
      try {
        localStorage.setItem('mouseflare_settings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleDismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('mouseflare_onboarded', 'true');
  };

  const handleDownload = async (type: 'windows' | 'macos' | 'universal') => {
    setDownloadingType(type);
    setDownloadMenuOpen(false);
    try {
      if (type === 'windows') await downloadWindowsNativeZip();
      else if (type === 'macos') await downloadMacNativeZip();
      else await downloadCrossPlatformZip();
    } finally {
      setDownloadingType(null);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreenOverlay(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreenOverlay(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreenOverlay(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Trigger Find Mouse flare at position
  const triggerFindMouseFlare = (customX?: number, customY?: number) => {
    if (!settings.enabled) return;
    const x = customX ?? mouseCoords.current.x;
    const y = customY ?? mouseCoords.current.y;

    engine.triggerFindMouse(x, y, settings);
    if (settings.soundFx) {
      soundEngine.playFlare(settings.findMouseFx);
    }
  };

  // Listen to mouse movement coordinates at the window level
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      mouseCoords.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  // Global Keyboard Hotkey listener for Find Mouse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // Parse the stored combo into modifiers + main key and require an exact
      // match on the event's modifier state, so e.g. Ctrl+Shift+F1 never
      // aliases to Ctrl+Shift+F and arbitrary recorded combos work.
      const parts = settings.hotkey
        .toUpperCase()
        .split('+')
        .map((p) => p.trim())
        .filter(Boolean);
      const modifierNames = ['CTRL', 'SHIFT', 'ALT', 'META', 'CMD'];
      const mainKey = parts.find((p) => !modifierNames.includes(p)) ?? '';
      const eventKey = e.key === ' ' ? 'SPACE' : e.key.toUpperCase();

      const match =
        mainKey !== '' &&
        eventKey === mainKey &&
        e.ctrlKey === parts.includes('CTRL') &&
        e.shiftKey === parts.includes('SHIFT') &&
        e.altKey === parts.includes('ALT') &&
        e.metaKey === (parts.includes('META') || parts.includes('CMD'));

      if (match) {
        e.preventDefault();
        triggerFindMouseFlare();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings, triggerFindMouseFlare]);

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden flex flex-col bg-neutral-950 text-neutral-100 font-sans"
      onMouseMove={(e) => {
        mouseCoords.current = { x: e.clientX, y: e.clientY };
      }}
    >
      {/* Top Quick-Switcher Control Bar for Fast Demonstration */}
      <header className="h-10 bg-neutral-950/90 border-b border-neutral-800/80 px-4 flex items-center justify-between z-30 select-none text-xs backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-neutral-100">
            <img src="/app-logo.png" alt="Mouseflare logo" className="w-5 h-5 rounded shadow" />
            <span>Mouseflare</span>
            <span className="text-[10px] text-amber-400/90 font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              Windows &amp; macOS Utility
            </span>
          </div>

          <div className="h-4 w-px bg-neutral-800 hidden sm:block" />

          {/* Quick Scenario Buttons */}
          <div className="hidden lg:flex items-center gap-1 text-neutral-400">
            <span className="text-[11px] mr-1">Workspace:</span>
            {(
              [
                { id: 'windows11-dark', label: 'Windows 11' },
                { id: 'busy-editor', label: 'Code Editor' },
                { id: 'dense-sheets', label: 'Dense Excel' },
                { id: 'light-workspace', label: 'Light Theme' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                onClick={() => handleUpdateSettings({ desktopBackground: s.id })}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  settings.desktopBackground === s.id
                    ? 'bg-neutral-800 text-amber-300 font-medium border border-neutral-700'
                    : 'hover:text-neutral-200 hover:bg-neutral-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Download Native App Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
              disabled={downloadingType !== null}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all active:scale-95"
              title="Download native desktop applications"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {downloadingType ? `Packaging ${downloadingType}...` : 'Download Native App'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {downloadMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setDownloadMenuOpen(false)} 
                />
                <div className="absolute right-0 mt-1.5 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-50 p-1.5 text-xs text-neutral-200 divide-y divide-neutral-800 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-1 space-y-1">
                    <button
                      onClick={() => handleDownload('windows')}
                      className="w-full flex flex-col items-start px-2.5 py-2 rounded-lg hover:bg-blue-600/20 hover:text-blue-200 transition-colors text-left group"
                    >
                      <div className="flex items-center justify-between w-full font-semibold text-blue-300">
                        <span>Windows App (.zip)</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 border border-blue-500/30">.NET 8</span>
                      </div>
                      <span className="text-[11px] text-neutral-400 mt-0.5">WPF, Tray Icon, Settings UI & build.bat</span>
                    </button>

                    <button
                      onClick={() => handleDownload('macos')}
                      className="w-full flex flex-col items-start px-2.5 py-2 rounded-lg hover:bg-purple-600/20 hover:text-purple-200 transition-colors text-left group"
                    >
                      <div className="flex items-center justify-between w-full font-semibold text-purple-300">
                        <span>macOS App (.zip)</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 border border-purple-500/30">Swift 5.9</span>
                      </div>
                      <span className="text-[11px] text-neutral-400 mt-0.5">AppKit Menu Bar, Overlay & build.sh</span>
                    </button>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => handleDownload('universal')}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-amber-300 transition-colors text-left font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                        <span>Universal Suite (Both)</span>
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">ZIP</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Fullscreen Overlay Test Mode */}
          <button
            onClick={toggleFullscreen}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
              isFullscreenOverlay
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
            }`}
            title="Expand Mouseflare across your entire physical monitor"
          >
            {isFullscreenOverlay ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreenOverlay ? 'Exit Fullscreen' : 'Fullscreen Monitor Mode'}</span>
          </button>

          {/* Find Mouse Flare Button */}
          <button
            onClick={() => triggerFindMouseFlare()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-all active:scale-95"
            title="Trigger Find Mouse Flare"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Flare ({settings.hotkey})</span>
          </button>

          {/* Settings Window Toggle */}
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
              isSettingsOpen
                ? 'bg-neutral-800 text-neutral-100 border-neutral-700'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Notification Banner when an Update is Available */}
      {updateInfo?.hasUpdate && settings.notifyOnUpdate && !updateBannerDismissed && (
        <div className="bg-gradient-to-r from-amber-500/20 via-neutral-900 to-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between z-20 backdrop-blur text-xs select-none animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
              <ArrowUpCircle className="w-3.5 h-3.5" />
            </div>
            <span className="text-neutral-200">
              <strong className="text-amber-300">Mouseflare v{updateInfo.latestVersion}</strong> is now available on GitHub Releases ({updateInfo.release.releaseDate}).
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSettingsInitialTab('updates');
                setIsSettingsOpen(true);
              }}
              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] transition-all shadow cursor-pointer"
            >
              View Release Notes
            </button>
            <a
              href={updateInfo.release.downloadUrls.releasePage}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] border border-neutral-700 transition-colors"
            >
              Get v{updateInfo.latestVersion}
            </a>
            <button
              onClick={() => setUpdateBannerDismissed(true)}
              className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Desktop Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Desktop Environment */}
        <DesktopSimulator
          settings={settings}
          onOpenSettings={() => {
            setSettingsInitialTab('fx-studio');
            setIsSettingsOpen(true);
          }}
          onTriggerFlare={(e) => triggerFindMouseFlare(e.clientX, e.clientY)}
        />

        {/* Global Click-through Transparent FX Overlay Canvas */}
        <OverlayCanvas
          settings={settings}
          engine={engine}
        />

        {/* Windows 11 Settings Window */}
        {isSettingsOpen && (
          <SettingsWindow
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onClose={() => setIsSettingsOpen(false)}
            onTriggerFlare={() => triggerFindMouseFlare()}
            initialTab={settingsInitialTab}
          />
        )}

        {/* Onboarding Dialog (First run) */}
        {showOnboarding && (
          <OnboardingDialog
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onDismiss={handleDismissOnboarding}
            onTriggerFlare={() => triggerFindMouseFlare()}
          />
        )}

        {/* Find My Mouse Benchmark Challenge */}
        {showChallenge && (
          <FindMouseChallengeModal
            settings={settings}
            onTriggerFlare={() => triggerFindMouseFlare()}
            onClose={() => setShowChallenge(false)}
          />
        )}
      </main>

      {/* Windows 11 Taskbar with System Tray & Status */}
      <WindowsTaskbar
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTriggerFlare={() => triggerFindMouseFlare()}
        onOpenChallenge={() => setShowChallenge(true)}
        isSettingsOpen={isSettingsOpen}
      />
    </div>
  );
}

