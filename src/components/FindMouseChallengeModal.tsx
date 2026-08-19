import React, { useState, useEffect, useRef } from 'react';
import { AppSettings } from '../types';
import { Trophy, Zap, Clock, Play, RotateCcw, X, CheckCircle2, Sparkles } from 'lucide-react';

interface FindMouseChallengeModalProps {
  settings: AppSettings;
  onTriggerFlare: () => void;
  onClose: () => void;
}

export const FindMouseChallengeModal: React.FC<FindMouseChallengeModalProps> = ({
  settings,
  onTriggerFlare,
  onClose,
}) => {
  const [gameState, setGameState] = useState<'idle' | 'running' | 'completed'>('idle');
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 });
  const [startTime, setStartTime] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [attempts, setAttempts] = useState<{ withFlare: number; withoutFlare?: number }>({ withFlare: 0 });

  const arenaRef = useRef<HTMLDivElement | null>(null);

  const startTest = () => {
    // Generate random target within the arena
    const randomX = Math.floor(Math.random() * 70) + 15;
    const randomY = Math.floor(Math.random() * 70) + 15;
    setTargetPos({ x: randomX, y: randomY });
    setStartTime(performance.now());
    setGameState('running');
  };

  const handleTargetClick = () => {
    if (gameState !== 'running') return;
    const duration = Math.round(performance.now() - startTime);
    setElapsedMs(duration);
    setGameState('completed');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm pointer-events-auto select-none">
      <div className="w-full max-w-xl bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden text-neutral-100 p-6 space-y-4">
        {/* Title Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100">Find My Mouse Benchmark</h2>
              <p className="text-[11px] text-neutral-400">Test how fast you locate your cursor in high visual noise</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Test Arena Area with Visual Noise */}
        <div
          ref={arenaRef}
          className="relative h-64 rounded-xl border border-neutral-700/80 overflow-hidden bg-neutral-950 flex items-center justify-center cursor-crosshair"
        >
          {/* Dense visual background text and icons to simulate UI clutter */}
          <div className="absolute inset-0 p-4 opacity-25 font-mono text-[10px] text-neutral-400 select-none overflow-hidden leading-tight pointer-events-none">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i}>
                var thread_{i} = ProcessTask(0x8004{i}, "STATUS_OK", flags: 0x{i}FF09); // [Buffer {i}1024]
              </div>
            ))}
          </div>

          {gameState === 'idle' && (
            <div className="relative z-10 text-center space-y-3 p-4">
              <p className="text-xs text-neutral-300 max-w-xs mx-auto">
                When you start, a target will appear hidden in the clutter. Use <kbd className="px-1 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-amber-400">{settings.hotkey}</kbd> or mouse movement to find your cursor and click the target!
              </p>
              <button
                onClick={startTest}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition-all"
              >
                Start Benchmark
              </button>
            </div>
          )}

          {gameState === 'running' && (
            <>
              {/* Target */}
              <button
                onClick={handleTargetClick}
                style={{ top: `${targetPos.y}%`, left: `${targetPos.x}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-emerald-500/80 hover:bg-emerald-400 text-neutral-950 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse transition-transform active:scale-90 z-20"
              >
                <CheckCircle2 className="w-5 h-5 text-neutral-950" />
              </button>

              <div className="absolute top-2 left-3 bg-neutral-900/80 px-2 py-1 rounded text-[11px] font-mono text-neutral-300 border border-neutral-700">
                Press <strong className="text-amber-400">{settings.hotkey}</strong> to send Flare!
              </div>
            </>
          )}

          {gameState === 'completed' && (
            <div className="relative z-10 text-center space-y-3 p-4 animate-in zoom-in-95">
              <div className="text-3xl font-extrabold text-amber-400 font-mono">
                {elapsedMs} ms
              </div>
              <p className="text-xs text-neutral-300">
                Cursor located and target clicked in <strong className="text-emerald-400">{(elapsedMs / 1000).toFixed(2)}s</strong>!
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={startTest}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
