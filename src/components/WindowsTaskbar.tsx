import React, { useState, useEffect } from 'react';
import { AppSettings, FlarePreset } from '../types';
import { 
  Settings as SettingsIcon,
  Check, 
  Power, 
  Volume2, 
  Wifi, 
  ChevronUp, 
  Search, 
  LayoutGrid, 
  Sparkles, 
  Code2, 
  FileSpreadsheet, 
  HelpCircle,
  Trophy,
  Compass,
  RefreshCw
} from 'lucide-react';
import { soundEngine } from '../engine/sound';

interface WindowsTaskbarProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  onTriggerFlare: () => void;
  onOpenChallenge: () => void;
  isSettingsOpen: boolean;
}

export const WindowsTaskbar: React.FC<WindowsTaskbarProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
  onTriggerFlare,
  onOpenChallenge,
  isSettingsOpen,
}) => {
  const [trayMenuOpen, setTrayMenuOpen] = useState(false);
  const [fxSubmenuOpen, setFxSubmenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(
        d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) +
        '\n' +
        d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleEnabled = () => {
    const next = !settings.enabled;
    onUpdateSettings({ enabled: next });
    soundEngine.playToggle(next);
  };

  return (
    <div className="relative z-50">
      {/* System Tray Context Menu (Right Click or Left Click on Tray Icon) */}
      {trayMenuOpen && (
        <div 
          className="fixed inset-0 z-50"
          onClick={() => {
            setTrayMenuOpen(false);
            setFxSubmenuOpen(false);
          }}
        >
          <div 
            className="absolute bottom-14 right-8 w-64 bg-neutral-900/95 border border-neutral-700/80 rounded-xl shadow-2xl backdrop-blur-xl p-1.5 text-xs text-neutral-200 divide-y divide-neutral-800/80 animate-in fade-in slide-in-from-bottom-2 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Brand */}
            <div className="px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-neutral-100">
                <img src="/app-logo.png" alt="Mouseflare logo" className="w-5 h-5 rounded" />
                <span>Mouseflare v2.4.0</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${settings.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                {settings.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            {/* Main Tray Actions */}
            <div className="py-1 space-y-0.5">
              <button
                onClick={() => {
                  onTriggerFlare();
                  setTrayMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors text-left text-amber-400 font-medium"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Find Mouse Now
                </span>
                <kbd className="text-[10px] bg-neutral-800/90 px-1.5 py-0.5 rounded text-neutral-400 border border-neutral-700 font-mono">
                  {settings.hotkey}
                </kbd>
              </button>

              <button
                onClick={toggleEnabled}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors text-left"
              >
                <span>Enabled</span>
                {settings.enabled && <Check className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                onClick={() => onUpdateSettings({ enablePassiveFx: !settings.enablePassiveFx })}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors text-left"
              >
                <span>Passive Trail FX</span>
                {settings.enablePassiveFx && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>

            {/* Settings & Extras */}
            <div className="py-1 space-y-0.5">
              <button
                onClick={() => {
                  onOpenChallenge();
                  setTrayMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors text-left text-neutral-200"
              >
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span>Cursor Finding Challenge</span>
              </button>

              <button
                onClick={() => {
                  onOpenSettings();
                  setTrayMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors text-left text-neutral-200"
              >
                <SettingsIcon className="w-4 h-4 text-neutral-400" />
                <span>Settings...</span>
              </button>

              <button
                onClick={() => {
                  onOpenSettings();
                  setTrayMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors text-left text-neutral-200"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  <span>Check for Updates...</span>
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">v2.5.2</span>
              </button>

              <button
                onClick={() => {
                  onUpdateSettings({ startWithWindows: !settings.startWithWindows });
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors text-left text-neutral-300"
              >
                <span>Start with Windows</span>
                {settings.startWithWindows && <Check className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                onClick={() => {
                  onUpdateSettings({ enabled: false });
                  setTrayMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors text-left"
              >
                <Power className="w-4 h-4" />
                <span>Exit Mouseflare</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Windows 11 Taskbar Bar */}
      <div className="h-12 w-full bg-neutral-900/90 border-t border-neutral-700/60 backdrop-blur-2xl flex items-center justify-between px-3 select-none">
        
        {/* Left Side: Windows Weather / Widget pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-xs text-neutral-300">
            <span className="text-amber-400 font-medium">72°F</span>
            <span className="text-neutral-400 hidden sm:inline">Sunny • Windows 11</span>
          </div>
        </div>

        {/* Center: Windows 11 Centered App Icons */}
        <div className="flex items-center gap-1.5">
          {/* Start Menu Button */}
          <button className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
            <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
              <div className="bg-blue-400 rounded-xs" />
              <div className="bg-blue-400 rounded-xs" />
              <div className="bg-blue-400 rounded-xs" />
              <div className="bg-blue-400 rounded-xs" />
            </div>
          </button>

          {/* Search Icon */}
          <button className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-neutral-300">
            <Search className="w-4 h-4" />
          </button>

          {/* Mouseflare App Taskbar Button */}
          <button
            onClick={onOpenSettings}
            className={`w-9 h-9 rounded-lg flex items-center justify-center relative transition-all ${
              isSettingsOpen ? 'bg-white/15' : 'hover:bg-white/10'
            }`}
            title="Mouseflare Settings"
          >
            <img src="/app-logo.png" alt="Mouseflare" className="w-6 h-6 rounded-md shadow-md" />
            {/* Active Indicator Bar */}
            <div className="absolute bottom-0.5 w-4 h-0.5 bg-amber-400 rounded-full" />
          </button>
        </div>

        {/* Right Side: System Tray */}
        <div className="flex items-center gap-1 text-neutral-300 text-xs">
          {/* Tray Overflow Arrow */}
          <button className="w-7 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-neutral-400">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* MOUSEFLARE SYSTEM TRAY ICON */}
          <button
            onClick={() => setTrayMenuOpen(!trayMenuOpen)}
            onContextMenu={(e) => {
              e.preventDefault();
              setTrayMenuOpen(true);
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center relative transition-all ${
              trayMenuOpen ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'hover:bg-white/10 text-neutral-200'
            }`}
            title={`Mouseflare \u2014 ${settings.hotkey} to Find Mouse`}
          >
            <img
              src="/app-logo.png"
              alt="Mouseflare tray"
              className={`w-4 h-4 rounded-sm ${settings.enabled ? '' : 'grayscale opacity-50'}`}
            />
            {/* Live active glow pulse dot */}
            {settings.enabled && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            )}
          </button>

          {/* Quick System Icons: Wifi, Volume, Battery */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors text-neutral-300">
            <Wifi className="w-3.5 h-3.5" />
            <Volume2 className="w-3.5 h-3.5" />
          </div>

          {/* Clock */}
          <div className="px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors text-right font-mono text-[11px] leading-tight text-neutral-300">
            {currentTime.split('\n')[0] || '11:32 AM'}
          </div>
        </div>
      </div>
    </div>
  );
};
