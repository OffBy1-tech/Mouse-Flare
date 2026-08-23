import React from 'react';
import { AppSettings } from '../types';
import { Sparkles } from 'lucide-react';

interface DesktopSimulatorProps {
  settings: AppSettings;
  onOpenSettings: () => void;
  onTriggerFlare: (e: React.MouseEvent) => void;
}

export const DesktopSimulator: React.FC<DesktopSimulatorProps> = ({
  settings,
  onOpenSettings,
}) => {
  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-neutral-950 text-neutral-100"
      onContextMenu={(e) => {
        // Prevent default context menu on desktop to feel like native OS
        e.preventDefault();
      }}
    >
      {/* Background Graphic / Wallpaper */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-neutral-950 to-blue-950/30">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Desktop Icon */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 transition-colors w-20 text-center group"
        >
          <img
            src={`${import.meta.env.BASE_URL}app-logo.png`}
            alt="Mouseflare"
            className="w-11 h-11 rounded-xl shadow-lg group-hover:scale-105 transition-transform"
          />
          <span className="text-xs font-medium text-white/90 drop-shadow truncate w-full">Mouseflare</span>
        </button>
      </div>

      {/* Interactive Helper Banner at Top */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-neutral-900/90 border border-neutral-700/80 shadow-xl backdrop-blur-md text-xs text-neutral-200">
          <span className="flex items-center gap-1.5 font-medium text-amber-400">
            <Sparkles className="w-3.5 h-3.5" />
            Mouseflare Active:
          </span>
          <span className="text-neutral-300">Move mouse for passive FX or press</span>
          <kbd className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-100 font-mono text-[11px] shadow">
            {settings.hotkey}
          </kbd>
          <span className="text-neutral-400">to Flare</span>
        </div>
      </div>
    </div>
  );
};
