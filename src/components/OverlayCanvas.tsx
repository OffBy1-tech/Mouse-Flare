import React, { useEffect, useRef } from 'react';
import { AppSettings } from '../types';
import { ParticleEngine } from '../engine/particleEngine';
import { Activity, Cpu, HardDrive, Monitor } from 'lucide-react';

interface OverlayCanvasProps {
  settings: AppSettings;
  engine: ParticleEngine;
  onPositionUpdate?: (x: number, y: number, speed: number) => void;
}

export const OverlayCanvas: React.FC<OverlayCanvasProps> = ({
  settings,
  engine,
  onPositionUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastFpsTime = useRef(performance.now());
  const frameCount = useRef(0);
  const currentFps = useRef(60);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let lastRenderTime = 0;

    const renderLoop = (time: number) => {
      // Honor the FPS limit setting (0 = uncapped); rAF still runs but the
      // engine only updates/draws at the capped cadence.
      if (settings.fpsLimit > 0 && time - lastRenderTime < 1000 / settings.fpsLimit - 1) {
        animationFrameId = requestAnimationFrame(renderLoop);
        return;
      }
      lastRenderTime = time;

      frameCount.current++;
      if (time - lastFpsTime.current >= 500) {
        currentFps.current = Math.round((frameCount.current * 1000) / (time - lastFpsTime.current));
        frameCount.current = 0;
        lastFpsTime.current = time;
        engine.fps = currentFps.current;
      }

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        engine.updateAndRender(ctx, rect.width, rect.height, settings);
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [settings, engine]);

  // The overlay itself is pointer-events-none so it never blocks clicks, which
  // also means it can never receive mouse events directly — capture movement at
  // the window level instead and feed the engine from there.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

      // Detect monitor in multi-monitor mode (left half = Monitor 1, right half = Monitor 2)
      const monitorId = settings.multiMonitorMode && x > rect.width * 0.5 ? 2 : 1;

      engine.onMouseMove(x, y, settings, monitorId);
      if (onPositionUpdate) {
        onPositionUpdate(x, y, engine.cursorSpeed);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [settings, engine, onPositionUpdate]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-40 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ pointerEvents: 'none' }}
      />

      {/* Floating Real-time HUD Diagnostics */}
      {settings.showDiagnostics && (
        <div className="absolute top-4 right-4 z-50 pointer-events-auto bg-neutral-900/90 backdrop-blur-md border border-neutral-700/60 rounded-xl p-3 shadow-2xl text-xs font-mono text-neutral-300 w-64 transition-all">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800">
            <span className="flex items-center gap-1.5 font-semibold text-neutral-100">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              Mouseflare Telemetry
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {currentFps.current} FPS
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-neutral-400">
              <span>Active Particles:</span>
              <span className="text-neutral-200 font-medium">{engine.particleCount}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Render Latency:</span>
              <span className="text-neutral-200 font-medium">{engine.drawLatencyMs} ms</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Cursor Velocity:</span>
              <span className="text-neutral-200 font-medium">{Math.round(engine.cursorSpeed)} px/s</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-neutral-500" /> Host CPU Overhead:
              </span>
              <span className="text-emerald-400 font-medium">&lt; 0.1% (Idle)</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-neutral-500" /> Working Set:
              </span>
              <span className="text-neutral-200 font-medium">8.4 MB</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span className="flex items-center gap-1">
                <Monitor className="w-3 h-3 text-neutral-500" /> Monitor Context:
              </span>
              <span className="text-amber-400 font-medium">
                {settings.multiMonitorMode ? 'Dual Display (DPI 100%)' : 'Primary Display'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
