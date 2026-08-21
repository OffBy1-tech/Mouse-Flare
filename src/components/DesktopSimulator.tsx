import React, { useState } from 'react';
import { AppSettings } from '../types';
import { 
  Folder, 
  Terminal, 
  Code2, 
  FileSpreadsheet, 
  Chrome, 
  Settings, 
  Sparkles, 
  Maximize2, 
  Minimize2, 
  X,
  Search,
  Layers,
  Monitor,
  CheckCircle2,
  FileCode,
  LayoutGrid
} from 'lucide-react';

interface DesktopSimulatorProps {
  settings: AppSettings;
  onOpenSettings: () => void;
  onTriggerFlare: (e: React.MouseEvent) => void;
}

export const DesktopSimulator: React.FC<DesktopSimulatorProps> = ({
  settings,
  onOpenSettings,
  onTriggerFlare,
}) => {
  const [activeWindow, setActiveWindow] = useState<'code' | 'sheets' | 'browser' | null>('code');

  return (
    <div 
      className={`relative w-full h-full overflow-hidden select-none transition-colors duration-500 ${
        settings.desktopBackground === 'light-workspace' 
          ? 'bg-neutral-200 text-neutral-800' 
          : 'bg-neutral-950 text-neutral-100'
      }`}
      onContextMenu={(e) => {
        // Prevent default context menu on desktop to feel like native OS
        e.preventDefault();
      }}
    >
      {/* Background Graphic / Wallpaper */}
      {settings.desktopBackground === 'windows11-dark' && (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-neutral-950 to-blue-950/30">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {settings.desktopBackground === 'light-workspace' && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-neutral-200 to-slate-200">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {/* Multi-Monitor Split Line (if enabled) */}
      {settings.multiMonitorMode && (
        <div className="absolute inset-0 pointer-events-none flex">
          {/* Monitor 1 */}
          <div className="w-1/2 h-full border-r-2 border-neutral-700/60 relative">
            <div className="absolute top-3 left-4 bg-neutral-900/80 backdrop-blur-md px-2.5 py-1 rounded border border-neutral-700 text-[11px] font-mono text-neutral-400">
              Display 1 (Primary • 2560×1440 • 125% DPI)
            </div>
          </div>
          {/* Monitor 2 */}
          <div className="w-1/2 h-full relative">
            <div className="absolute top-3 left-4 bg-neutral-900/80 backdrop-blur-md px-2.5 py-1 rounded border border-neutral-700 text-[11px] font-mono text-neutral-400">
              Display 2 (Extended • 1920×1080 • 100% DPI)
            </div>
          </div>
        </div>
      )}

      {/* Desktop Icons Grid */}
      <div className="absolute top-4 left-4 grid grid-flow-col grid-rows-6 gap-3 z-10">
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 transition-colors w-20 text-center group"
        >
          <img
            src="/app-logo.png"
            alt="Mouseflare"
            className="w-11 h-11 rounded-xl shadow-lg group-hover:scale-105 transition-transform"
          />
          <span className="text-xs font-medium text-white/90 drop-shadow truncate w-full">Mouseflare</span>
        </button>

        <button
          onClick={() => setActiveWindow('code')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 transition-colors w-20 text-center group"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Code2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs font-medium text-white/90 drop-shadow truncate w-full">VS Code</span>
        </button>

        <button
          onClick={() => setActiveWindow('sheets')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 transition-colors w-20 text-center group"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs font-medium text-white/90 drop-shadow truncate w-full">Finance.xlsx</span>
        </button>

        <button
          onClick={() => setActiveWindow('browser')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 transition-colors w-20 text-center group"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Chrome className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs font-medium text-white/90 drop-shadow truncate w-full">Browser</span>
        </button>
      </div>

      {/* Desktop Workspace Windows for Scenario Testing */}
      <div className="absolute inset-0 p-8 pt-12 pb-16 flex items-center justify-center z-10 pointer-events-none">
        
        {/* Scenario 1: VS Code Editor Window */}
        {(settings.desktopBackground === 'busy-editor' || activeWindow === 'code') && (
          <div className="w-full max-w-3xl h-[420px] bg-neutral-900/95 border border-neutral-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto backdrop-blur-md">
            {/* Window Title Bar */}
            <div className="h-9 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between px-3">
              <div className="flex items-center gap-2 text-xs text-neutral-300">
                <Code2 className="w-4 h-4 text-blue-400" />
                <span className="font-medium">ParticleEngine.ts — Mouseflare (Workspace)</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-3 h-3 rounded-full bg-yellow-500/80 hover:opacity-80" />
                <button className="w-3 h-3 rounded-full bg-green-500/80 hover:opacity-80" />
                <button onClick={() => setActiveWindow(null)} className="w-3 h-3 rounded-full bg-red-500/80 hover:opacity-80" />
              </div>
            </div>

            {/* Code Content simulating visual noise */}
            <div className="flex-1 flex overflow-hidden font-mono text-xs">
              {/* Sidebar */}
              <div className="w-44 bg-neutral-950/60 border-r border-neutral-800 p-2.5 space-y-1 text-neutral-400">
                <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Explorer</div>
                <div className="text-neutral-200 flex items-center gap-1.5 bg-neutral-800/60 px-1.5 py-1 rounded">
                  <FileCode className="w-3.5 h-3.5 text-blue-400" /> ParticleEngine.ts
                </div>
                <div className="flex items-center gap-1.5 px-1.5 py-1">
                  <FileCode className="w-3.5 h-3.5 text-amber-400" /> MouseTracker.cs
                </div>
                <div className="flex items-center gap-1.5 px-1.5 py-1">
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" /> HotkeyHook.cs
                </div>
              </div>

              {/* Code Lines */}
              <div className="flex-1 p-4 bg-neutral-900/90 overflow-y-auto space-y-1 leading-relaxed text-neutral-300">
                <div className="text-neutral-500">// Mouseflare — High Performance Windows Particle System</div>
                <div><span className="text-purple-400">export class</span> <span className="text-yellow-300">ParticleEngine</span> {'{'}</div>
                <div className="pl-4"><span className="text-blue-400">private</span> particles: <span className="text-emerald-400">Particle[]</span> = [];</div>
                <div className="pl-4"><span className="text-blue-400">private</span> rings: <span className="text-emerald-400">FlareRing[]</span> = [];</div>
                <div className="pl-4"><span className="text-blue-400">public</span> <span className="text-yellow-300">triggerFindMouse</span>(x: <span className="text-emerald-400">number</span>, y: <span className="text-emerald-400">number</span>) {'{'}</div>
                <div className="pl-8 text-neutral-400">// Generates signature expanding shockwaves and radial bursts</div>
                <div className="pl-8"><span className="text-purple-400">this</span>.rings.push({'{'} radius: <span className="text-orange-300">4</span>, maxRadius: <span className="text-orange-300">80</span>, alpha: <span className="text-orange-300">1.0</span> {'}'});</div>
                <div className="pl-8"><span className="text-blue-400">for</span> (<span className="text-purple-400">let</span> i = <span className="text-orange-300">0</span>; i &lt; <span className="text-orange-300">32</span>; i++) {'{'}</div>
                <div className="pl-12"><span className="text-purple-400">this</span>.particles.push({'{'} vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed {'}'});</div>
                <div className="pl-8">{'}'}</div>
                <div className="pl-4">{'}'}</div>
                <div>{'}'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Scenario 2: Dense Spreadsheet Window */}
        {(settings.desktopBackground === 'dense-sheets' || activeWindow === 'sheets') && (
          <div className="w-full max-w-3xl h-[420px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
            <div className="h-9 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-3">
              <div className="flex items-center gap-2 text-xs text-neutral-300">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">Enterprise_Q3_Financial_Forecast.xlsx</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveWindow(null)} className="w-3 h-3 rounded-full bg-red-500/80 hover:opacity-80" />
              </div>
            </div>
            <div className="flex-1 p-3 overflow-auto bg-neutral-950 font-mono text-[11px]">
              <table className="w-full text-left border-collapse border border-neutral-800">
                <thead>
                  <tr className="bg-neutral-800/80 text-neutral-300">
                    <th className="p-1.5 border border-neutral-700">ID</th>
                    <th className="p-1.5 border border-neutral-700">Account</th>
                    <th className="p-1.5 border border-neutral-700">Q1 Budget</th>
                    <th className="p-1.5 border border-neutral-700">Q2 Actual</th>
                    <th className="p-1.5 border border-neutral-700">Variance %</th>
                    <th className="p-1.5 border border-neutral-700">Status</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-400">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="hover:bg-neutral-900">
                      <td className="p-1.5 border border-neutral-800">#409{i}</td>
                      <td className="p-1.5 border border-neutral-800 text-neutral-200">Cloud Infrastructure Scale-Up</td>
                      <td className="p-1.5 border border-neutral-800">$142,500.00</td>
                      <td className="p-1.5 border border-neutral-800">$138,210.45</td>
                      <td className="p-1.5 border border-neutral-800 text-emerald-400">+3.01%</td>
                      <td className="p-1.5 border border-neutral-800 text-neutral-300">Validated</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
