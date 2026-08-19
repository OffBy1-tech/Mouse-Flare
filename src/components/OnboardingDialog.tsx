import React from 'react';
import { AppSettings } from '../types';
import { Sparkles, Zap, Keyboard, Check, ArrowRight } from 'lucide-react';

interface OnboardingDialogProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onDismiss: () => void;
  onTriggerFlare: () => void;
}

export const OnboardingDialog: React.FC<OnboardingDialogProps> = ({
  settings,
  onUpdateSettings,
  onDismiss,
  onTriggerFlare,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden text-neutral-100 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <img src="/app-logo.png" alt="Mouseflare logo" className="w-12 h-12 rounded-2xl shadow-lg" />
          <div>
            <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
              Welcome to Mouseflare
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                v2.4.0
              </span>
            </h1>
            <p className="text-xs text-neutral-400">
              Never lose your mouse pointer on multi-monitor or 4K displays again.
            </p>
          </div>
        </div>

        {/* 2 Core Features Overview */}
        <div className="grid gap-3">
          {/* Feature 1: Passive FX */}
          <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-700/50 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-0.5">
              <div className="font-semibold text-neutral-200">1. Passive Movement FX</div>
              <div className="text-neutral-400 leading-relaxed">
                Tasteful, momentary sparks appear behind your cursor when moving, making it effortlessly trackable.
              </div>
            </div>
          </div>

          {/* Feature 2: Active Find Mouse Flare */}
          <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-700/50 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-0.5">
              <div className="font-semibold text-neutral-200">2. Instant Find Mouse Flare</div>
              <div className="text-neutral-400 leading-relaxed">
                Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-neutral-200">{settings.hotkey}</kbd> anytime to send up a high-visibility shockwave beacon.
              </div>
            </div>
          </div>
        </div>

        {/* Start with Windows quick checkbox */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/20 border border-neutral-800 text-xs">
          <span className="text-neutral-300">Start automatically with Windows</span>
          <input
            type="checkbox"
            checked={settings.startWithWindows}
            onChange={(e) => onUpdateSettings({ startWithWindows: e.target.checked })}
            className="rounded bg-neutral-700 border-neutral-600 text-amber-500 focus:ring-amber-500 h-4 w-4"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onTriggerFlare}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-amber-400 border border-neutral-700 flex items-center gap-1.5 transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Test Flare Now</span>
          </button>

          <button
            onClick={onDismiss}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
