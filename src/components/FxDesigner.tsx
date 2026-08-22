import React, { useState, useMemo } from 'react';
import { ParticleFxConfig } from '../types/fxEditor';
import { DEFAULT_FX_PRESETS } from '../data/defaultFxPresets';
import { soundEngine } from '../engine/sound';
import { Save, Copy, Upload, Trash2 } from 'lucide-react';
import { NeonSelect } from './NeonSelect';

// The FX Designer mirrors the native designers (macOS FxDesignerView / Windows
// FxDesignerPanel): archetype + name header, popup row, colors + glow row, and
// a two-column slider grid. Every change previews live on the cursor as an FX
// draft — Apply & Save commits it, closing the window reverts it.

interface FxDesignerProps {
  currentConfig?: ParticleFxConfig;
  onApplyToCursor?: (config: ParticleFxConfig) => void;
  onStatus?: (message: string) => void;
}

type NumberField = {
  [K in keyof ParticleFxConfig]: ParticleFxConfig[K] extends number ? K : never;
}[keyof ParticleFxConfig];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const one = (v: number) => v.toFixed(1);
const two = (v: number) => v.toFixed(2);
const whole = (v: number) => `${Math.round(v)}`;
const px = (v: number) => `${Math.round(v)} px`;
const deg = (v: number) => `${Math.round(v)}°`;

// Same specs, ranges, and ordering as the native slider grid.
const SLIDER_SPECS: { label: string; field: NumberField; min: number; max: number; step: number; fmt: (v: number) => string }[] = [
  { label: 'Spawn Rate (move)', field: 'spawnRateOnMove', min: 1, max: 20, step: 1, fmt: whole },
  { label: 'Burst Count (flare)', field: 'spawnBurstOnClick', min: 0, max: 60, step: 1, fmt: whole },
  { label: 'Emission Angle', field: 'emissionAngle', min: 0, max: 360, step: 1, fmt: deg },
  { label: 'Emission Spread', field: 'emissionSpread', min: 0, max: 360, step: 1, fmt: deg },
  { label: 'Velocity Inheritance', field: 'velocityInheritance', min: 0, max: 1, step: 0.01, fmt: pct },
  { label: 'Glow Radius', field: 'glowRadius', min: 0, max: 30, step: 1, fmt: px },
  { label: 'Speed Min', field: 'initialSpeedMin', min: 0, max: 15, step: 0.1, fmt: one },
  { label: 'Speed Max', field: 'initialSpeedMax', min: 0, max: 15, step: 0.1, fmt: one },
  { label: 'Wind (Gravity X)', field: 'gravityX', min: -3, max: 3, step: 0.1, fmt: one },
  { label: 'Gravity Y', field: 'gravityY', min: -3, max: 3, step: 0.1, fmt: one },
  { label: 'Drag', field: 'drag', min: 0.85, max: 1.0, step: 0.01, fmt: two },
  { label: 'Turbulence', field: 'turbulence', min: 0, max: 5, step: 0.1, fmt: one },
  { label: 'Vortex Attraction', field: 'vortexAttraction', min: -3, max: 3, step: 0.1, fmt: one },
  { label: 'Rainbow Speed', field: 'rainbowSpeed', min: 0, max: 10, step: 0.1, fmt: one },
  { label: 'Rotation Min', field: 'rotationSpeedMin', min: -10, max: 10, step: 0.1, fmt: one },
  { label: 'Rotation Max', field: 'rotationSpeedMax', min: -10, max: 10, step: 0.1, fmt: one },
  { label: 'Lifetime Min', field: 'lifetimeMin', min: 10, max: 120, step: 1, fmt: whole },
  { label: 'Lifetime Max', field: 'lifetimeMax', min: 10, max: 120, step: 1, fmt: whole },
  { label: 'Start Size', field: 'startSize', min: 1, max: 40, step: 1, fmt: px },
  { label: 'Peak Size', field: 'peakSize', min: 1, max: 40, step: 1, fmt: px },
  { label: 'End Size', field: 'endSize', min: 0, max: 40, step: 1, fmt: px },
  { label: 'Start Alpha', field: 'startAlpha', min: 0, max: 1, step: 0.01, fmt: pct },
  { label: 'Peak Alpha', field: 'peakAlpha', min: 0, max: 1, step: 0.01, fmt: pct },
  { label: 'End Alpha', field: 'endAlpha', min: 0, max: 1, step: 0.01, fmt: pct },
];

// Same popups and option lists as the native designers.
type PopupField = 'emissionPattern' | 'shape' | 'blendMode' | 'colorMode' | 'sizeCurve';
const POPUP_SPECS: { label: string; field: PopupField; options: { value: string; label: string }[] }[] = [
  {
    label: 'Emission',
    field: 'emissionPattern',
    options: [
      { value: 'trail', label: 'Trail' },
      { value: 'radial-burst', label: 'Radial Burst' },
      { value: 'vortex-spiral', label: 'Vortex Spiral' },
      { value: 'fountain', label: 'Fountain' },
      { value: 'orbit', label: 'Orbit' },
      { value: 'directional-cone', label: 'Directional Cone' },
    ],
  },
  {
    label: 'Shape',
    field: 'shape',
    options: [
      { value: 'circle', label: 'Circle' },
      { value: 'sparkle-star', label: 'Star' },
      { value: 'glow-disc', label: 'Glow Disc' },
      { value: 'ring', label: 'Ring' },
      { value: 'shard-crystal', label: 'Crystal' },
      { value: 'plasma-orb', label: 'Plasma Orb' },
      { value: 'smoke-puff', label: 'Smoke' },
      { value: 'lightning-bolt', label: 'Lightning' },
      { value: 'bubble', label: 'Bubble' },
      { value: 'heart', label: 'Heart' },
      { value: 'sakura-petal', label: 'Petal' },
      { value: 'diamond', label: 'Diamond' },
      { value: 'rune', label: 'Rune' },
    ],
  },
  {
    label: 'Blend',
    field: 'blendMode',
    options: [
      { value: 'source-over', label: 'Normal' },
      { value: 'lighter', label: 'Additive' },
      { value: 'screen', label: 'Screen' },
      { value: 'color-dodge', label: 'Color Dodge' },
    ],
  },
  {
    label: 'Color Mode',
    field: 'colorMode',
    options: [
      { value: 'single', label: 'Single' },
      { value: 'gradient-lifetime', label: 'Lifetime Gradient' },
      { value: 'rainbow-cycle', label: 'Rainbow Cycle' },
      { value: 'speed-responsive', label: 'Speed Responsive' },
    ],
  },
  {
    label: 'Size Curve',
    field: 'sizeCurve',
    options: [
      { value: 'linear-shrink', label: 'Linear Shrink' },
      { value: 'grow-shrink', label: 'Grow-Shrink' },
      { value: 'constant', label: 'Constant' },
      { value: 'pop-fade', label: 'Pop & Fade' },
    ],
  },
];

const HINT = 'Every change previews live on your cursor — click Apply & Save to keep it as the Custom FX preset.';

export const FxDesigner: React.FC<FxDesignerProps> = ({ currentConfig, onApplyToCursor, onStatus }) => {
  const [customPresets, setCustomPresets] = useState<ParticleFxConfig[]>(() => {
    try {
      const saved = localStorage.getItem('mouseflare_custom_fx_presets');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const allPresets = useMemo(() => [...DEFAULT_FX_PRESETS, ...customPresets], [customPresets]);

  // Seed from the saved Custom FX like the native designers; fall back to the
  // first archetype. Mounting alone applies nothing — the first edit does.
  const [config, setConfig] = useState<ParticleFxConfig>(() =>
    currentConfig ? { ...currentConfig } : { ...DEFAULT_FX_PRESETS[0] }
  );
  const [sourcePresetId, setSourcePresetId] = useState<string>(() =>
    allPresets.some((p) => p.id === config.id) ? config.id : ''
  );

  const applyEdit = (partial: Partial<ParticleFxConfig>) => {
    const next = { ...config, ...partial };
    setConfig(next);
    onApplyToCursor?.(next);
  };

  const loadPreset = (presetId: string) => {
    const found = allPresets.find((p) => p.id === presetId);
    if (!found) return;
    const next: ParticleFxConfig = found.isCustom
      ? { ...found }
      : { ...found, id: `custom-${Date.now()}` };
    setConfig(next);
    setSourcePresetId(presetId);
    onApplyToCursor?.(next);
    soundEngine.playClick();
    onStatus?.(`Loaded archetype: ${found.name} — previewing live on your cursor`);
  };

  const handleSaveToLibrary = () => {
    const name = config.name.trim() || 'Custom FX';
    const id = config.isCustom && customPresets.some((p) => p.id === config.id) ? config.id : `custom-${Date.now()}`;
    const preset: ParticleFxConfig = {
      ...config,
      id,
      name,
      category: 'custom',
      isCustom: true,
      icon: config.icon || '✨',
      description: `Custom designed particle effect: ${name}`,
    };
    const updated = [preset, ...customPresets.filter((p) => p.id !== id)];
    setCustomPresets(updated);
    try {
      localStorage.setItem('mouseflare_custom_fx_presets', JSON.stringify(updated));
    } catch (e) {}
    setConfig(preset);
    setSourcePresetId(id);
    soundEngine.playClick();
    onStatus?.(`Saved "${name}" to your preset library`);
  };

  const handleDeletePreset = () => {
    const target = customPresets.find((p) => p.id === sourcePresetId);
    if (!target) return;
    const updated = customPresets.filter((p) => p.id !== sourcePresetId);
    setCustomPresets(updated);
    try {
      localStorage.setItem('mouseflare_custom_fx_presets', JSON.stringify(updated));
    } catch (e) {}
    setSourcePresetId('');
    soundEngine.playClick();
    onStatus?.(`Deleted "${target.name}" from your preset library`);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    soundEngine.playClick();
    onStatus?.(`Copied ${config.name} as JSON — importable on any platform`);
  };

  const handleImportClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (parsed && parsed.name && parsed.shape) {
        const next: ParticleFxConfig = {
          ...DEFAULT_FX_PRESETS[0],
          ...parsed,
          id: `custom-imported-${Date.now()}`,
          isCustom: true,
          category: 'custom',
        };
        setConfig(next);
        setSourcePresetId('');
        onApplyToCursor?.(next);
        soundEngine.playClick();
        onStatus?.(`Imported: ${next.name}`);
      } else {
        onStatus?.('⚠️ Clipboard does not contain a valid FX Designer config.');
      }
    } catch (err) {
      onStatus?.('⚠️ Could not read clipboard — copy an FX Designer JSON first.');
    }
  };

  const selectedIsCustom = customPresets.some((p) => p.id === sourcePresetId);

  return (
    <div className="space-y-6 text-xs text-neutral-300">
      <div>
        <h2 className="text-lg font-bold text-neutral-100">FX Designer</h2>
        <p className="text-xs text-neutral-400 mt-0.5">{HINT}</p>
      </div>

      {/* Header: archetype picker, name, actions */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-neutral-400">Archetype:</label>
        <NeonSelect
          value={sourcePresetId}
          onChange={loadPreset}
          groups={[
            {
              label: 'Built-in Archetypes',
              options: DEFAULT_FX_PRESETS.map((p) => ({ value: p.id, label: `${p.icon} ${p.name}` })),
            },
            ...(customPresets.length > 0
              ? [
                  {
                    label: 'My Custom Presets',
                    options: customPresets.map((p) => ({ value: p.id, label: `${p.icon} ${p.name}` })),
                  },
                ]
              : []),
          ]}
          placeholder="Current draft"
          className="text-xs px-2.5 py-1.5 min-w-44"
          ariaLabel="Archetype"
        />

        <label className="text-neutral-400 ml-1">Name:</label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => applyEdit({ name: e.target.value || 'Custom FX' })}
          className="neon-input rounded-lg px-2.5 py-1.5 text-xs w-40"
        />

        <div className="flex-1" />

        <button
          onClick={handleSaveToLibrary}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 font-medium transition-all cursor-pointer"
          title="Save to your browser preset library"
        >
          <Save className="w-3.5 h-3.5 text-amber-400" />
          <span>Save</span>
        </button>
        {selectedIsCustom && (
          <button
            onClick={handleDeletePreset}
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
            title="Delete this custom preset from your library"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={handleCopyJson}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 font-medium transition-all cursor-pointer"
          title="Copy this config as JSON — importable on any platform"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copy JSON</span>
        </button>
        <button
          onClick={handleImportClipboard}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 font-medium transition-all cursor-pointer"
          title="Import an FX Designer JSON config from your clipboard"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import Clipboard</span>
        </button>
      </div>

      {/* Popups: pattern / shape / blend / color mode / size curve */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {POPUP_SPECS.map((spec) => (
          <div key={spec.field}>
            <label className="text-[11px] text-neutral-400 block mb-1">{spec.label}</label>
            <NeonSelect
              value={config[spec.field]}
              onChange={(v) => applyEdit({ [spec.field]: v } as Partial<ParticleFxConfig>)}
              options={spec.options}
              className="w-full px-2 py-1.5 text-[11px]"
              ariaLabel={spec.label}
            />
          </div>
        ))}
      </div>

      {/* Colors + glow */}
      <div className="p-4 rounded-xl neon-card flex flex-wrap items-center gap-4">
        <span className="text-neutral-400">Colors:</span>
        {(
          [
            { label: 'Primary', field: 'primaryColor' },
            { label: 'Secondary', field: 'secondaryColor' },
            { label: 'Accent', field: 'accentColor' },
          ] as const
        ).map((c) => (
          <label key={c.field} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="color"
              value={config[c.field]}
              onChange={(e) => applyEdit({ [c.field]: e.target.value })}
              className="w-5 h-5 rounded-full border border-white/20 hover:border-white/60 transition-colors cursor-pointer bg-transparent"
            />
            <span className="text-[11px] text-neutral-400">{c.label}</span>
          </label>
        ))}
        <div className="flex-1" />
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-neutral-400">Glow Bloom</span>
          <input
            type="checkbox"
            checked={config.glowBloom}
            onChange={(e) => applyEdit({ glowBloom: e.target.checked })}
            className="neon-check rounded h-4 w-4"
          />
        </label>
      </div>

      {/* Sliders (two per row) */}
      <div className="p-4 rounded-xl neon-card grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {SLIDER_SPECS.map((spec) => (
          <div key={spec.field} className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-300 font-medium">{spec.label}</span>
              <span className="text-violet-300 font-mono font-bold">{spec.fmt(config[spec.field])}</span>
            </div>
            <input
              type="range"
              min={spec.min}
              max={spec.max}
              step={spec.step}
              value={config[spec.field]}
              onChange={(e) => applyEdit({ [spec.field]: Number(e.target.value) } as Partial<ParticleFxConfig>)}
              className="w-full neon-range bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
