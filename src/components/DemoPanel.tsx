import React, { useState } from 'react';
import { AppSettings, ColorPreset } from '../types';
import { FxDesigner } from './FxDesigner';
import { NeonColorPicker } from './NeonColorPicker';
import { PASSIVE_PRESETS, FLARE_PRESETS, COLOR_PALETTES } from '../data/presetCatalog';
import { DEFAULT_SETTINGS } from '../data/defaultSettings';
import { Check, ChevronLeft, ChevronRight, Sparkles, Wand2, Trophy, Download } from 'lucide-react';

interface DemoPanelProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onTriggerFlare: () => void;
  onLaunchChallenge: () => void;
}

const READY_STATUS = 'Ready — every change previews live on the playground.';
const RELEASES_URL = 'https://github.com/OffBy1-tech/Mouse-Flare/releases/latest';

export const DemoPanel: React.FC<DemoPanelProps> = ({
  settings,
  onUpdateSettings,
  onTriggerFlare,
  onLaunchChallenge,
}) => {
  const [tab, setTab] = useState<'effects' | 'designer'>('effects');
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState(READY_STATUS);
  const quickSwatches = settings.quickSwatches ?? DEFAULT_SETTINGS.quickSwatches;

  // Native-style color picker for the custom color and quick-swatch edits —
  // the same handler pattern as the (now removed) settings window's custom
  // color card, but calling onUpdateSettings directly (the demo has no
  // draft domain to commit or revert).
  const [colorPicker, setColorPicker] = useState<{
    title: string;
    initial: string;
    prior: string;
    priorPreset: ColorPreset;
    swatchIndex: number | null;
  } | null>(null);

  const openCustomColorPicker = () =>
    setColorPicker({
      title: 'Custom Color',
      initial: settings.customColor,
      prior: settings.customColor,
      priorPreset: settings.colorPreset,
      swatchIndex: null,
    });

  const beginSwatchEdit = (index: number) =>
    setColorPicker({
      title: `Quick Color ${index + 1}`,
      initial: quickSwatches[index],
      prior: settings.customColor,
      priorPreset: settings.colorPreset,
      swatchIndex: index,
    });

  const finishColorPicker = (hex: string | null) => {
    if (!colorPicker) return;
    if (hex === null) {
      // Cancel: restore both the color and the palette selection that were
      // live before the picker opened (onLive may have flipped to 'custom').
      onUpdateSettings({ customColor: colorPicker.prior, colorPreset: colorPicker.priorPreset });
    } else if (colorPicker.swatchIndex !== null) {
      const next = [...quickSwatches];
      next[colorPicker.swatchIndex] = hex;
      onUpdateSettings({ quickSwatches: next, customColor: hex, colorPreset: 'custom' });
    } else {
      onUpdateSettings({ customColor: hex, colorPreset: 'custom' });
    }
    setColorPicker(null);
  };

  if (collapsed) {
    return (
      <div className="absolute top-1/2 right-0 -translate-y-1/2 z-30">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center w-8 h-16 rounded-l-xl bg-[#120a20] border border-r-0 border-violet-500/30 shadow-2xl text-violet-200/80 hover:text-violet-100 transition-colors"
          title="Expand demo panel"
          aria-label="Expand demo panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-0 right-0 z-30 h-full w-[380px] flex flex-col bg-[#120a20] border-l border-violet-500/25 shadow-2xl pointer-events-auto">
      {/* Header */}
      <div className="h-11 shrink-0 bg-[#0a0512]/80 border-b border-violet-500/25 flex items-center justify-between px-4">
        <span className="text-xs font-semibold tracking-wide text-neutral-200">Live Demo Panel</span>
        <button
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center text-neutral-400 transition-colors"
          title="Collapse demo panel"
          aria-label="Collapse demo panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tab strip */}
      <div className="flex shrink-0 border-b border-violet-500/20 px-2 pt-2 gap-1">
        <button
          onClick={() => setTab('effects')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-all ${
            tab === 'effects' ? 'neon-nav-active font-semibold' : 'text-violet-100/70 hover:bg-violet-400/10'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Effects
        </button>
        <button
          onClick={() => setTab('designer')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-all ${
            tab === 'designer' ? 'neon-nav-active font-semibold' : 'text-violet-100/70 hover:bg-violet-400/10'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          FX Designer
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {tab === 'effects' ? (
          <>
            {/* Passive FX */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-200">Passive Trail FX</label>
                <span className="text-[11px] text-violet-300 font-mono capitalize">
                  {settings.passiveFx.replace('-', ' ')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PASSIVE_PRESETS.map((item) => {
                  const isSelected = settings.passiveFx === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onUpdateSettings({ passiveFx: item.id });
                        setStatus(`Selected Passive FX: ${item.label}`);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col gap-0.5 min-h-[62px] cursor-pointer ${
                        isSelected ? 'neon-selected' : 'neon-card neon-card-hover'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 w-full">
                        <div className={`font-bold text-[11px] leading-tight ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                          {item.label}
                        </div>
                        {isSelected && (
                          <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-white/20 border border-white/50 text-white font-bold text-[8px] uppercase tracking-wider shrink-0 shadow">
                            <Check className="w-2 h-2 stroke-[3]" /> Active
                          </span>
                        )}
                      </div>
                      <div className={`text-[9.5px] leading-tight ${isSelected ? 'text-indigo-100/85' : 'text-neutral-400'}`}>
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flare FX */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-200">Find-Mouse Flare</label>
                <span className="text-[11px] text-cyan-400 font-mono capitalize">
                  {settings.findMouseFx.replace('-', ' ')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FLARE_PRESETS.map((item) => {
                  const isSelected = settings.findMouseFx === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onUpdateSettings({ findMouseFx: item.id });
                        onTriggerFlare();
                        setStatus(`Selected Flare: ${item.label} (previewing)`);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col gap-0.5 min-h-[62px] cursor-pointer ${
                        isSelected ? 'neon-selected-cyan' : 'neon-card neon-card-hover'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 w-full">
                        <div className={`font-bold text-[11px] leading-tight ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                          {item.label}
                        </div>
                        {isSelected && (
                          <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-white/20 border border-white/50 text-white font-bold text-[8px] uppercase tracking-wider shrink-0 shadow">
                            <Check className="w-2 h-2 stroke-[3]" /> Active
                          </span>
                        )}
                      </div>
                      <div className={`text-[9.5px] leading-tight ${isSelected ? 'text-indigo-100/85' : 'text-neutral-400'}`}>
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color palette */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-200">Color Palette</label>
                <span className="text-[11px] text-neutral-400 font-mono capitalize">{settings.colorPreset}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PALETTES.map((pal) => {
                  const isSelected = settings.colorPreset === pal.id;
                  return (
                    <button
                      key={pal.id}
                      onClick={() => {
                        onUpdateSettings({ colorPreset: pal.id });
                        setStatus(`Selected Color: ${pal.label}`);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] transition-all cursor-pointer ${
                        isSelected ? 'neon-selected text-white font-bold' : 'neon-card neon-card-hover text-neutral-300'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shadow-inner ring-1 ring-white/20"
                        style={{ backgroundColor: pal.color }}
                      />
                      <span>{pal.label}</span>
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={openCustomColorPicker}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] transition-all cursor-pointer ${
                    settings.colorPreset === 'custom'
                      ? 'neon-selected text-white font-bold'
                      : 'neon-card neon-card-hover text-neutral-300'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shadow-inner ring-1 ring-white/20"
                    style={{ backgroundColor: settings.customColor }}
                  />
                  <span>Custom Hex</span>
                  {settings.colorPreset === 'custom' && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </button>
              </div>

              {/* Quick swatches */}
              <div className="mt-3 p-2.5 rounded-xl neon-card flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-neutral-400">Quick:</span>
                {quickSwatches.map((hex, i) => (
                  <button
                    key={i}
                    onClick={() => onUpdateSettings({ customColor: hex, colorPreset: 'custom' })}
                    onDoubleClick={() => beginSwatchEdit(i)}
                    className="w-[18px] h-[18px] rounded-full ring-1 ring-white/20 hover:ring-white/60 transition-shadow cursor-pointer"
                    style={{ backgroundColor: hex }}
                    title="Click to use this color • double-click to edit it"
                    aria-label={`Quick swatch ${i + 1}: ${hex}`}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-neutral-400 leading-snug">
              Design here, then Copy JSON and import it in the desktop app's FX Designer.
            </p>
            <FxDesigner
              currentConfig={settings.customFxConfig}
              onApplyToCursor={(config) =>
                onUpdateSettings({ passiveFx: 'custom-fx', customFxConfig: config, enablePassiveFx: true })
              }
              onStatus={setStatus}
              quickSwatches={quickSwatches}
            />
          </div>
        )}
      </div>

      {colorPicker && (
        <NeonColorPicker
          title={colorPicker.title}
          initial={colorPicker.initial}
          swatches={quickSwatches}
          onLive={(hex) => onUpdateSettings({ customColor: hex, colorPreset: 'custom' })}
          onDone={(hex) => finishColorPicker(hex)}
          onCancel={() => finishColorPicker(null)}
        />
      )}

      {/* Footer: status line (persistent, native model) + challenge + downloads */}
      <div className="shrink-0 border-t border-violet-500/20">
        <div className="h-9 flex items-center gap-2.5 px-4 text-[11px] text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="truncate">{status}</span>
        </div>
        <div className="p-3 pt-0 space-y-2">
          <button
            onClick={onLaunchChallenge}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl neon-btn-primary font-bold text-xs transition-all active:scale-95 cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Find-Mouse Challenge</span>
          </button>
          <div className="flex items-center gap-2">
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-200 text-[11px] font-medium border border-white/10 transition-all"
            >
              <Download className="w-3 h-3" />
              Download for macOS
            </a>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-200 text-[11px] font-medium border border-white/10 transition-all"
            >
              <Download className="w-3 h-3" />
              Download for Windows
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
