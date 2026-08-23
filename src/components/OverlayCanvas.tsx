import React, { useEffect, useRef } from 'react';
import { AppSettings } from '../types';
import { ParticleEngine } from '../engine/particleEngine';

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

      engine.onMouseMove(x, y, settings);
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
    </div>
  );
};
