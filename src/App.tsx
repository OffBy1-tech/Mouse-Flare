import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppSettings } from './types';
import { ParticleEngine } from './engine/particleEngine';
import { soundEngine } from './engine/sound';
import { OverlayCanvas } from './components/OverlayCanvas';
import { DesktopSimulator } from './components/DesktopSimulator';
import { DemoPanel } from './components/DemoPanel';
import { FindMouseChallengeModal } from './components/FindMouseChallengeModal';
import { Zap, Maximize2, Minimize2, Download } from 'lucide-react';

import { DEFAULT_SETTINGS } from './data/defaultSettings';

const RELEASES_URL = 'https://github.com/OffBy1-tech/Mouse-Flare/releases/latest';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('mouseflare_settings');
      if (saved) {
        const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        // The vorticity range shrank in 0.7.x (0.2–3.0 → 0.1–2.0); clamp legacy values
        merged.fluidVorticity = Math.min(2.0, Math.max(0.1, merged.fluidVorticity ?? 0.85));
        return merged;
      }
    } catch (e) {}
    return DEFAULT_SETTINGS;
  });

  const [showChallenge, setShowChallenge] = useState(false);
  const [isFullscreenOverlay, setIsFullscreenOverlay] = useState(false);

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
            <img
              src={`${import.meta.env.BASE_URL}app-logo.png`}
              alt="Mouseflare logo"
              className="w-5 h-5 rounded shadow"
            />
            <span>Mouseflare</span>
            <span className="text-[10px] text-amber-400/90 font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              Browser Demo
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
          {/* Download Native App Links */}
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 font-medium text-xs transition-colors"
            title="Download the native macOS app"
          >
            <Download className="w-3.5 h-3.5" />
            <span>macOS</span>
          </a>
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 font-medium text-xs transition-colors"
            title="Download the native Windows app"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Windows</span>
          </a>

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
            <span className="hidden sm:inline">{isFullscreenOverlay ? 'Exit Fullscreen' : 'Fullscreen'}</span>
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
        </div>
      </header>

      {/* Main Desktop Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Desktop Environment */}
        <DesktopSimulator
          settings={settings}
          // The demo has no settings window to open — clicking the desktop
          // icon is a no-op; the demo panel is always available at the right.
          onOpenSettings={() => {}}
          onTriggerFlare={(e) => triggerFindMouseFlare(e.clientX, e.clientY)}
        />

        {/* Global Click-through Transparent FX Overlay Canvas */}
        <OverlayCanvas settings={settings} engine={engine} />

        {/* Right-side Demo Panel */}
        <DemoPanel
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onTriggerFlare={() => triggerFindMouseFlare()}
          onLaunchChallenge={() => setShowChallenge(true)}
        />

        {/* Find My Mouse Benchmark Challenge */}
        {showChallenge && (
          <FindMouseChallengeModal
            settings={settings}
            onTriggerFlare={() => triggerFindMouseFlare()}
            onClose={() => setShowChallenge(false)}
          />
        )}
      </main>
    </div>
  );
}
