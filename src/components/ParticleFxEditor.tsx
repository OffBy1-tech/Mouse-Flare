import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ParticleFxConfig, ParticleShape, BlendMode, EmissionPattern, ColorMode, SizeCurve } from '../types/fxEditor';
import { DEFAULT_FX_PRESETS } from '../data/defaultFxPresets';
import { CustomFxRenderer } from '../engine/customFxRenderer';
import { soundEngine } from '../engine/sound';
import {
  Sparkles,
  Flame,
  Zap,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Save,
  Copy,
  Check,
  Download,
  Upload,
  Plus,
  Trash2,
  Eye,
  Grid,
  Maximize2,
  Code2,
  Layers,
  Palette,
  Wind,
  CircleDot,
  Compass,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface ParticleFxEditorProps {
  onApplyToCursor?: (config: ParticleFxConfig) => void;
  onClose?: () => void;
  currentActiveConfigId?: string;
}

type SandboxBackground = 'matrix-grid' | 'deep-void' | 'slate-modern' | 'blueprint' | 'light-canvas';
type AutoMotionMode = 'none' | 'figure-8' | 'spiral' | 'orbit' | 'burst-strobe';

export const ParticleFxEditor: React.FC<ParticleFxEditorProps> = ({
  onApplyToCursor,
  onClose,
  currentActiveConfigId,
}) => {
  // Preset list with local storage persistence
  const [customPresets, setCustomPresets] = useState<ParticleFxConfig[]>(() => {
    try {
      const saved = localStorage.getItem('mouseflare_custom_fx_presets');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const allPresets = useMemo(() => {
    return [...DEFAULT_FX_PRESETS, ...customPresets];
  }, [customPresets]);

  // Selected config state
  const [activeConfig, setActiveConfig] = useState<ParticleFxConfig>(() => {
    return DEFAULT_FX_PRESETS[0];
  });

  // Editor sub-tab
  const [editorTab, setEditorTab] = useState<'emitter' | 'shape' | 'physics' | 'colors' | 'export'>('emitter');

  // Sandbox testing stage state
  const [stageBg, setStageBg] = useState<SandboxBackground>('matrix-grid');
  const [autoMotion, setAutoMotion] = useState<AutoMotionMode>('figure-8');
  const [autoMotionSpeed, setAutoMotionSpeed] = useState<number>(1.0);
  const [isPaused, setIsPaused] = useState(false);
  const [showGridOverlay, setShowGridOverlay] = useState(true);

  // Status telemetry
  const [telemetry, setTelemetry] = useState({ count: 0, fps: 60, frameTime: 0.1 });
  const [copiedCodeType, setCopiedCodeType] = useState<string | null>(null);
  const [appliedToast, setAppliedToast] = useState(false);
  const [importJsonOpen, setImportJsonOpen] = useState(false);
  const [jsonInputText, setJsonInputText] = useState('');
  const [savePresetName, setSavePresetName] = useState('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  // Canvas ref & renderer
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderer = useMemo(() => new CustomFxRenderer(), []);
  const animFrameRef = useRef<number>(0);
  const motionTimeRef = useRef<number>(0);
  const stagePointerRef = useRef({ x: 300, y: 200, isHovering: false });

  // Update field helper
  const updateField = <K extends keyof ParticleFxConfig>(field: K, value: ParticleFxConfig[K]) => {
    setActiveConfig((prev) => ({ ...prev, [field]: value }));
  };

  // Switch active preset
  const handleSelectPreset = (presetId: string) => {
    const found = allPresets.find((p) => p.id === presetId);
    if (found) {
      setActiveConfig({ ...found });
      renderer.clear();
      soundEngine.playClick();
    }
  };

  // Save as Custom Preset
  const handleSaveCustomPreset = () => {
    const name = savePresetName.trim() || `${activeConfig.name} (Copy)`;
    const newId = `custom-${Date.now()}`;
    const newPreset: ParticleFxConfig = {
      ...activeConfig,
      id: newId,
      name,
      category: 'custom',
      isCustom: true,
      icon: activeConfig.icon || '✨',
      description: `Custom designed particle effect: ${name}`,
    };

    const updated = [newPreset, ...customPresets.filter((p) => p.id !== activeConfig.id)];
    setCustomPresets(updated);
    try {
      localStorage.setItem('mouseflare_custom_fx_presets', JSON.stringify(updated));
    } catch (e) {}

    setActiveConfig(newPreset);
    setSaveModalOpen(false);
    setSavePresetName('');
    soundEngine.playClick();
  };

  // Delete Custom Preset
  const handleDeletePreset = (id: string) => {
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    try {
      localStorage.setItem('mouseflare_custom_fx_presets', JSON.stringify(updated));
    } catch (e) {}
    if (activeConfig.id === id) {
      setActiveConfig(DEFAULT_FX_PRESETS[0]);
    }
    soundEngine.playClick();
  };

  // Apply to cursor
  const handleApplyToCursor = () => {
    if (onApplyToCursor) {
      onApplyToCursor(activeConfig);
      setAppliedToast(true);
      soundEngine.playFlare();
      setTimeout(() => setAppliedToast(false), 2500);
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    const original = DEFAULT_FX_PRESETS.find((p) => p.id === activeConfig.id) || DEFAULT_FX_PRESETS[0];
    setActiveConfig({ ...original });
    renderer.clear();
    soundEngine.playClick();
  };

  // Canvas render animation loop
  useEffect(() => {
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    const renderLoop = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // Handle Auto Motion Generation if user isn't actively moving mouse on stage
      if (!stagePointerRef.current.isHovering && autoMotion !== 'none' && !isPaused) {
        motionTimeRef.current += 0.02 * autoMotionSpeed;
        const t = motionTimeRef.current;
        let simX = width / 2;
        let simY = height / 2;

        if (autoMotion === 'figure-8') {
          simX = width / 2 + Math.sin(t) * (width * 0.3);
          simY = height / 2 + Math.sin(t * 2) * (height * 0.22);
        } else if (autoMotion === 'spiral') {
          const r = (Math.sin(t * 0.5) * 0.5 + 0.5) * (Math.min(width, height) * 0.35) + 20;
          simX = width / 2 + Math.cos(t * 2) * r;
          simY = height / 2 + Math.sin(t * 2) * r;
        } else if (autoMotion === 'orbit') {
          const r = Math.min(width, height) * 0.28;
          simX = width / 2 + Math.cos(t * 2.5) * r;
          simY = height / 2 + Math.sin(t * 2.5) * r;
        } else if (autoMotion === 'burst-strobe') {
          simX = width / 2;
          simY = height / 2;
          if (Math.floor(t * 10) % 20 === 0) {
            renderer.triggerBurst(simX, simY, activeConfig, Math.round(activeConfig.spawnBurstOnClick * 0.6));
          }
        }

        stagePointerRef.current.x = simX;
        stagePointerRef.current.y = simY;
        renderer.onMove(simX, simY, activeConfig);
      }

      // Clear Canvas with chosen background
      ctx.clearRect(0, 0, width, height);

      if (stageBg === 'matrix-grid') {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, width, height);

        if (showGridOverlay) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 1;
          const gridSize = 32;
          ctx.beginPath();
          for (let x = 0; x < width; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
          }
          for (let y = 0; y < height; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
          }
          ctx.stroke();
        }
      } else if (stageBg === 'deep-void') {
        ctx.fillStyle = '#030303';
        ctx.fillRect(0, 0, width, height);
      } else if (stageBg === 'slate-modern') {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#18181b');
        grad.addColorStop(1, '#09090b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else if (stageBg === 'blueprint') {
        ctx.fillStyle = '#082f49';
        ctx.fillRect(0, 0, width, height);
        if (showGridOverlay) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += 24) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = 0; y < height; y += 24) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }
      } else if (stageBg === 'light-canvas') {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, height);
        if (showGridOverlay) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += 24) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = 0; y < height; y += 24) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }
      }

      // Render physics particles
      if (!isPaused) {
        renderer.render(
          ctx,
          width,
          height,
          activeConfig,
          stagePointerRef.current.x,
          stagePointerRef.current.y
        );
      }

      // Draw active cursor target point
      ctx.save();
      ctx.strokeStyle = activeConfig.primaryColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(stagePointerRef.current.x, stagePointerRef.current.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(stagePointerRef.current.x, stagePointerRef.current.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // FPS tracking
      frameCount++;
      if (time - fpsTimer >= 500) {
        setTelemetry({
          count: renderer.activeCount,
          fps: Math.round((frameCount * 1000) / (time - fpsTimer)),
          frameTime: renderer.frameTimeMs,
        });
        frameCount = 0;
        fpsTimer = time;
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [activeConfig, autoMotion, autoMotionSpeed, isPaused, stageBg, showGridOverlay, renderer]);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const handleResize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = Math.max(300, Math.floor(rect.width));
      canvas.height = Math.max(260, Math.floor(rect.height));
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  // Stage Mouse Events
  const handleStageMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    stagePointerRef.current = { x, y, isHovering: true };
    renderer.onMove(x, y, activeConfig);
  };

  const handleStageMouseLeave = () => {
    stagePointerRef.current.isHovering = false;
  };

  const handleStageClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    renderer.triggerBurst(x, y, activeConfig);
    soundEngine.playFlare();
  };

  // Color Palette Quick-Picks
  const COLOR_PALETTES = [
    { name: 'Solar Amber', primary: '#f59e0b', secondary: '#fbbf24', accent: '#ffffff' },
    { name: 'Cyber Cyan', primary: '#06b6d4', secondary: '#38bdf8', accent: '#e0f2fe' },
    { name: 'Amethyst', primary: '#8b5cf6', secondary: '#ec4899', accent: '#38bdf8' },
    { name: 'Emerald', primary: '#10b981', secondary: '#34d399', accent: '#a7f3d0' },
    { name: 'Sakura Pink', primary: '#f472b6', secondary: '#fbcfe8', accent: '#ffffff' },
    { name: 'Ice Frost', primary: '#38bdf8', secondary: '#93c5fd', accent: '#ffffff' },
    { name: 'Crimson Fury', primary: '#ef4444', secondary: '#f97316', accent: '#fef08a' },
    { name: 'Arcane Gold', primary: '#eab308', secondary: '#f59e0b', accent: '#fef08a' },
  ];

  const SHAPES: { id: ParticleShape; label: string; icon: string }[] = [
    { id: 'glow-disc', label: 'Glow Disc', icon: '✨' },
    { id: 'sparkle-star', label: 'Star', icon: '⭐' },
    { id: 'circle', label: 'Circle', icon: '⚪' },
    { id: 'shard-crystal', label: 'Crystal', icon: '🔷' },
    { id: 'plasma-orb', label: 'Plasma Orb', icon: '🔮' },
    { id: 'lightning-bolt', label: 'Lightning', icon: '⚡' },
    { id: 'smoke-puff', label: 'Smoke', icon: '💨' },
    { id: 'bubble', label: 'Bubble', icon: '🫧' },
    { id: 'sakura-petal', label: 'Petal', icon: '🌸' },
    { id: 'rune', label: 'Rune', icon: '💠' },
    { id: 'ring', label: 'Ring', icon: '⭕' },
    { id: 'heart', label: 'Heart', icon: '❤️' },
    { id: 'diamond', label: 'Diamond', icon: '💎' },
  ];

  // The native apps import FX Designer JSON directly (CustomFx.swift /
  // CustomFx.cs render it in the overlay), so the "native code" panes now
  // explain that flow instead of emitting paste-in stubs.
  const generateCSharpCode = () => {
    return `// ${activeConfig.name} — run it natively on Windows:
//   1. Click "Copy JSON" above
//   2. In Mouseflare: Settings -> FX Studio
//   3. Click "Import Custom FX (JSON from clipboard)"
// The config is rendered by the native engine (src/native/windows/Core/CustomFx.cs)
// and persists with your settings.`;
  };

  const generateSwiftCode = () => {
    return `// ${activeConfig.name} — run it natively on macOS:
//   1. Click "Copy JSON" above
//   2. In Mouseflare: Settings -> FX Studio
//   3. Click "Import Custom FX (JSON from clipboard)"
//      (or: Mouseflare --import-fx <file.json>)
// The config is rendered by the native engine (src/native/macos/Sources/CustomFx.swift)
// and persists with your settings.`;
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeType(type);
    soundEngine.playClick();
    setTimeout(() => setCopiedCodeType(null), 2000);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInputText);
      if (parsed && parsed.name && parsed.shape) {
        const imported: ParticleFxConfig = {
          ...DEFAULT_FX_PRESETS[0],
          ...parsed,
          id: `custom-imported-${Date.now()}`,
          isCustom: true,
          category: 'custom',
        };
        setCustomPresets((prev) => [imported, ...prev]);
        setActiveConfig(imported);
        setImportJsonOpen(false);
        setJsonInputText('');
        soundEngine.playClick();
      }
    } catch (err) {
      alert('Invalid JSON config format. Please check the structure.');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-neutral-950 text-neutral-100 font-sans select-none overflow-hidden">
      {/* Top Header & Preset Bar */}
      <div className="h-14 bg-neutral-900/90 border-b border-neutral-800 px-4 flex items-center justify-between z-20 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg text-white font-bold text-sm">
              {activeConfig.icon || '✨'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-neutral-100">{activeConfig.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-neutral-800 text-amber-400 border border-neutral-700">
                  {activeConfig.category}
                </span>
                {activeConfig.isCustom && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Custom Preset
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 truncate max-w-md hidden sm:block">
                {activeConfig.description}
              </p>
            </div>
          </div>
        </div>

        {/* Preset Switcher & Primary Actions */}
        <div className="flex items-center gap-2">
          {/* Preset Selector Dropdown */}
          <div className="relative">
            <select
              value={activeConfig.id}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer font-medium"
            >
              <optgroup label="🌟 Curated Built-in Archetypes">
                {DEFAULT_FX_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </optgroup>
              {customPresets.length > 0 && (
                <optgroup label="💾 My Custom Creations">
                  {customPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.icon} {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <button
            onClick={() => {
              setSavePresetName(`${activeConfig.name} Custom`);
              setSaveModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-medium transition-all cursor-pointer"
            title="Save as a new custom preset"
          >
            <Save className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Save Custom</span>
          </button>

          {activeConfig.isCustom && (
            <button
              onClick={() => handleDeletePreset(activeConfig.id)}
              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs transition-all cursor-pointer"
              title="Delete this custom preset"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Primary Action: Apply to Cursor */}
          <button
            onClick={handleApplyToCursor}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
            title="Apply this particle effect directly to your active mouse cursor!"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Apply to Mouse</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 text-xs"
              title="Close Editor"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Applied Confirmation Toast */}
      {appliedToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-neutral-950 px-4 py-2 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in duration-150">
          <CheckCircle2 className="w-4 h-4" />
          <span>"{activeConfig.name}" is now active on your mouse cursor!</span>
        </div>
      )}

      {/* Main Workspace (Split Sandbox Stage + Parameter Controls) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT / CENTER: Interactive Physics Testing Stage */}
        <div className="lg:w-7/12 flex flex-col border-b lg:border-b-0 lg:border-r border-neutral-800 bg-neutral-950 relative min-h-[320px] lg:min-h-0">
          {/* Stage Controls Toolbar */}
          <div className="h-10 bg-neutral-900/60 border-b border-neutral-800 px-3 flex items-center justify-between text-xs text-neutral-300">
            {/* Auto Motion Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-400 hidden sm:inline">Motion Test:</span>
              {(
                [
                  { id: 'figure-8', label: 'Figure-8' },
                  { id: 'spiral', label: 'Spiral' },
                  { id: 'orbit', label: 'Orbit' },
                  { id: 'burst-strobe', label: 'Strobe' },
                  { id: 'none', label: 'Manual' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setAutoMotion(m.id)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                    autoMotion === m.id
                      ? 'bg-neutral-800 text-amber-300 font-bold border border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Stage Backdrop Switcher & Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px]"
                title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => renderer.clear()}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px]"
                title="Clear stage particles"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Backdrop selector */}
              <select
                value={stageBg}
                onChange={(e) => setStageBg(e.target.value as SandboxBackground)}
                className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-[11px] rounded px-1.5 py-0.5"
              >
                <option value="matrix-grid">Dark Grid</option>
                <option value="deep-void">Deep Void</option>
                <option value="slate-modern">Slate Acrylic</option>
                <option value="blueprint">Blueprint Cyan</option>
                <option value="light-canvas">Light Theme</option>
              </select>
            </div>
          </div>

          {/* Interactive Canvas Sandbox */}
          <div className="relative flex-1 w-full h-full overflow-hidden cursor-crosshair">
            <canvas
              ref={canvasRef}
              onMouseMove={handleStageMouseMove}
              onMouseLeave={handleStageMouseLeave}
              onClick={handleStageClick}
              className="w-full h-full block"
            />

            {/* Sandbox Hint Overlay */}
            <div className="absolute top-3 left-3 pointer-events-none bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-lg px-2.5 py-1 text-[10px] text-neutral-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Move mouse to emit trail • Click stage to blast burst flare</span>
            </div>

            {/* Live Telemetry Hud */}
            <div className="absolute bottom-3 right-3 pointer-events-none bg-neutral-900/90 backdrop-blur border border-neutral-800 rounded-xl px-3 py-1.5 text-[11px] font-mono text-neutral-300 flex items-center gap-3 shadow-xl">
              <div>
                <span className="text-neutral-500">Particles: </span>
                <strong className="text-amber-400">{telemetry.count}</strong>
              </div>
              <div>
                <span className="text-neutral-500">FPS: </span>
                <strong className="text-emerald-400">{telemetry.fps}</strong>
              </div>
              <div>
                <span className="text-neutral-500">Frame: </span>
                <strong className="text-blue-400">{telemetry.frameTime}ms</strong>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Modular Parameter Controls & Customizer Tabs */}
        <div className="lg:w-5/12 flex flex-col bg-neutral-900/50 overflow-hidden">
          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-1 p-2 bg-neutral-900 border-b border-neutral-800 text-xs overflow-x-auto">
            {(
              [
                { id: 'emitter', label: 'Emitter', icon: <Compass className="w-3.5 h-3.5" /> },
                { id: 'shape', label: 'Shape & Optics', icon: <Sparkles className="w-3.5 h-3.5" /> },
                { id: 'physics', label: 'Physics & Forces', icon: <Wind className="w-3.5 h-3.5" /> },
                { id: 'colors', label: 'Colors & Life', icon: <Palette className="w-3.5 h-3.5" /> },
                { id: 'export', label: 'Code & Share', icon: <Code2 className="w-3.5 h-3.5" /> },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setEditorTab(t.id);
                  soundEngine.playClick();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
                  editorTab === t.id
                    ? 'bg-neutral-800 text-amber-300 border border-neutral-700 font-bold shadow'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-neutral-300">
            {/* TAB 1: EMITTER & SPAWNING */}
            {editorTab === 'emitter' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-200 block mb-1.5">
                    Emission Flow Pattern
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'trail', label: 'Movement Trail', icon: '〰️' },
                        { id: 'radial-burst', label: 'Radial Burst', icon: '💥' },
                        { id: 'vortex-spiral', label: 'Vortex Swirl', icon: '🌀' },
                        { id: 'fountain', label: 'Fountain Spray', icon: '⛲' },
                        { id: 'orbit', label: 'Centripetal Orbit', icon: '🪐' },
                        { id: 'directional-cone', label: 'Directional Cone', icon: '🎯' },
                      ] as const
                    ).map((pat) => (
                      <button
                        key={pat.id}
                        onClick={() => updateField('emissionPattern', pat.id)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                          activeConfig.emissionPattern === pat.id
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/50 font-bold shadow'
                            : 'bg-neutral-800/40 text-neutral-300 border-neutral-700/60 hover:bg-neutral-800'
                        }`}
                      >
                        <span className="text-base">{pat.icon}</span>
                        <span className="text-[11px] leading-tight">{pat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spawn Rates */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-3.5">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-neutral-200">Spawn Rate on Cursor Move</span>
                      <span className="font-mono text-amber-400">{activeConfig.spawnRateOnMove} particles/step</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="1"
                      value={activeConfig.spawnRateOnMove}
                      onChange={(e) => updateField('spawnRateOnMove', Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-neutral-200">Spawn Burst Count (on Click)</span>
                      <span className="font-mono text-amber-400">{activeConfig.spawnBurstOnClick} particles</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="2"
                      value={activeConfig.spawnBurstOnClick}
                      onChange={(e) => updateField('spawnBurstOnClick', Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-neutral-200">Cursor Velocity Inheritance</span>
                      <span className="font-mono text-amber-400">{Math.round(activeConfig.velocityInheritance * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={activeConfig.velocityInheritance}
                      onChange={(e) => updateField('velocityInheritance', Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>

                {/* Direction & Spread Angles */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-neutral-200">Emission Angle</span>
                      <span className="font-mono text-amber-400">{activeConfig.emissionAngle}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={activeConfig.emissionAngle}
                      onChange={(e) => updateField('emissionAngle', Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-neutral-200">Emission Spread Arc</span>
                      <span className="font-mono text-amber-400">{activeConfig.emissionSpread}°</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="360"
                      step="10"
                      value={activeConfig.emissionSpread}
                      onChange={(e) => updateField('emissionSpread', Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SHAPE & OPTICS */}
            {editorTab === 'shape' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-200 block mb-1.5">
                    Particle Geometry Shape
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {SHAPES.map((sh) => (
                      <button
                        key={sh.id}
                        onClick={() => updateField('shape', sh.id)}
                        className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeConfig.shape === sh.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold shadow'
                            : 'bg-neutral-800/40 text-neutral-300 border-neutral-700/60 hover:bg-neutral-800'
                        }`}
                      >
                        <span className="text-xl">{sh.icon}</span>
                        <span className="text-[10px] leading-tight truncate w-full">{sh.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Blend Mode */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-2">
                  <span className="font-semibold text-neutral-200 block">Composite Blend Mode</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'lighter', label: 'Additive Glow (Lighter)' },
                      { id: 'source-over', label: 'Solid Alpha (Normal)' },
                      { id: 'screen', label: 'Screen Luminescence' },
                    ].map((b) => (
                      <button
                        key={b.id}
                        onClick={() => updateField('blendMode', b.id as BlendMode)}
                        className={`px-2 py-1.5 rounded-lg border text-center text-[11px] transition-all cursor-pointer ${
                          activeConfig.blendMode === b.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Glow Bloom */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-neutral-200">Luminescent Glow Bloom</div>
                      <div className="text-[11px] text-neutral-400">Renders high-intensity optical halo blur.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={activeConfig.glowBloom}
                      onChange={(e) => updateField('glowBloom', e.target.checked)}
                      className="rounded bg-neutral-700 border-neutral-600 text-amber-500 focus:ring-amber-500 h-4 w-4"
                    />
                  </div>

                  {activeConfig.glowBloom && (
                    <div>
                      <div className="flex justify-between mb-1 text-[11px]">
                        <span className="text-neutral-300">Glow Blur Radius</span>
                        <span className="font-mono text-amber-400">{activeConfig.glowRadius}px</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="30"
                        step="1"
                        value={activeConfig.glowRadius}
                        onChange={(e) => updateField('glowRadius', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PHYSICS & FORCE FIELDS */}
            {editorTab === 'physics' && (
              <div className="space-y-4">
                {/* Speed Range */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-3">
                  <div className="font-semibold text-neutral-200">Initial Velocity Speed (Min / Max)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Min Speed</span>
                        <span className="font-mono text-amber-400">{activeConfig.initialSpeedMin}</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="6"
                        step="0.2"
                        value={activeConfig.initialSpeedMin}
                        onChange={(e) => updateField('initialSpeedMin', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Max Speed</span>
                        <span className="font-mono text-amber-400">{activeConfig.initialSpeedMax}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="12"
                        step="0.5"
                        value={activeConfig.initialSpeedMax}
                        onChange={(e) => updateField('initialSpeedMax', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Gravity Vector */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-3">
                  <div className="font-semibold text-neutral-200">Gravity &amp; Wind Vector</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Gravity Y (Fall/Rise)</span>
                        <span className="font-mono text-amber-400">{activeConfig.gravityY}</span>
                      </div>
                      <input
                        type="range"
                        min="-1.5"
                        max="1.5"
                        step="0.05"
                        value={activeConfig.gravityY}
                        onChange={(e) => updateField('gravityY', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Wind X (Horizontal)</span>
                        <span className="font-mono text-amber-400">{activeConfig.gravityX}</span>
                      </div>
                      <input
                        type="range"
                        min="-1.5"
                        max="1.5"
                        step="0.05"
                        value={activeConfig.gravityX}
                        onChange={(e) => updateField('gravityX', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Fluid Drag & Turbulence */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-neutral-200">Air Resistance / Drag</span>
                      <span className="font-mono text-amber-400">{Math.round(activeConfig.drag * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.85"
                      max="0.99"
                      step="0.01"
                      value={activeConfig.drag}
                      onChange={(e) => updateField('drag', Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-neutral-200">Turbulence / Curl Noise Jitter</span>
                      <span className="font-mono text-amber-400">{activeConfig.turbulence}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.2"
                      value={activeConfig.turbulence}
                      onChange={(e) => updateField('turbulence', Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-neutral-200">Vortex / Pointer Centripetal Attraction</span>
                      <span className="font-mono text-amber-400">{activeConfig.vortexAttraction}</span>
                    </div>
                    <input
                      type="range"
                      min="-3"
                      max="3"
                      step="0.2"
                      value={activeConfig.vortexAttraction}
                      onChange={(e) => updateField('vortexAttraction', Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: COLORS & LIFETIME */}
            {editorTab === 'colors' && (
              <div className="space-y-4">
                {/* Color Mode */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-2">
                  <span className="font-semibold text-neutral-200 block">Color Progression Mode</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'gradient-lifetime', label: 'Gradient over Lifetime' },
                      { id: 'rainbow-cycle', label: 'Rainbow Spectrum Cycle' },
                      { id: 'speed-responsive', label: 'Speed Velocity Gradient' },
                      { id: 'single', label: 'Single Monochromatic' },
                    ].map((cm) => (
                      <button
                        key={cm.id}
                        onClick={() => updateField('colorMode', cm.id as ColorMode)}
                        className={`p-2 rounded-lg border text-left text-[11px] transition-all cursor-pointer ${
                          activeConfig.colorMode === cm.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                        }`}
                      >
                        {cm.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instant Palette Presets */}
                <div>
                  <label className="text-xs font-semibold text-neutral-200 block mb-1.5">
                    Quick Color Palettes
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {COLOR_PALETTES.map((pal) => (
                      <button
                        key={pal.name}
                        onClick={() => {
                          updateField('primaryColor', pal.primary);
                          updateField('secondaryColor', pal.secondary);
                          updateField('accentColor', pal.accent);
                        }}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <div className="flex gap-1">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pal.primary }} />
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pal.secondary }} />
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pal.accent }} />
                        </div>
                        <span className="text-[9px] text-neutral-300 truncate w-full text-center">{pal.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Color Pickers */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-neutral-300 block mb-1">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeConfig.primaryColor}
                        onChange={(e) => updateField('primaryColor', e.target.value)}
                        className="w-7 h-7 rounded border border-neutral-700 cursor-pointer bg-transparent"
                      />
                      <span className="font-mono text-[10px] text-neutral-400">{activeConfig.primaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-neutral-300 block mb-1">Secondary</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeConfig.secondaryColor}
                        onChange={(e) => updateField('secondaryColor', e.target.value)}
                        className="w-7 h-7 rounded border border-neutral-700 cursor-pointer bg-transparent"
                      />
                      <span className="font-mono text-[10px] text-neutral-400">{activeConfig.secondaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-neutral-300 block mb-1">Accent Core</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeConfig.accentColor}
                        onChange={(e) => updateField('accentColor', e.target.value)}
                        className="w-7 h-7 rounded border border-neutral-700 cursor-pointer bg-transparent"
                      />
                      <span className="font-mono text-[10px] text-neutral-400">{activeConfig.accentColor}</span>
                    </div>
                  </div>
                </div>

                {/* Size & Scaling Curves */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-3">
                  <div className="font-semibold text-neutral-200">Particle Size Evolution</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Start</span>
                        <span className="font-mono text-amber-400">{activeConfig.startSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        step="1"
                        value={activeConfig.startSize}
                        onChange={(e) => updateField('startSize', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Peak</span>
                        <span className="font-mono text-amber-400">{activeConfig.peakSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="40"
                        step="1"
                        value={activeConfig.peakSize}
                        onChange={(e) => updateField('peakSize', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>End</span>
                        <span className="font-mono text-amber-400">{activeConfig.endSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={activeConfig.endSize}
                        onChange={(e) => updateField('endSize', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-neutral-300 block mb-1">Scale Curve Easing</label>
                    <select
                      value={activeConfig.sizeCurve}
                      onChange={(e) => updateField('sizeCurve', e.target.value as SizeCurve)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-neutral-200"
                    >
                      <option value="grow-shrink">Grow to Peak then Shrink</option>
                      <option value="linear-shrink">Linear Shrink to Zero</option>
                      <option value="pop-fade">Pop Instantly then Fade</option>
                      <option value="constant">Constant Diameter</option>
                    </select>
                  </div>
                </div>

                {/* Lifetime Range */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-3">
                  <div className="font-semibold text-neutral-200">Lifetime Duration (Frames)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Min Life</span>
                        <span className="font-mono text-amber-400">{activeConfig.lifetimeMin}f</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        step="5"
                        value={activeConfig.lifetimeMin}
                        onChange={(e) => updateField('lifetimeMin', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Max Life</span>
                        <span className="font-mono text-amber-400">{activeConfig.lifetimeMax}f</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="120"
                        step="5"
                        value={activeConfig.lifetimeMax}
                        onChange={(e) => updateField('lifetimeMax', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: CODE & EXPORT */}
            {editorTab === 'export' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-neutral-200">JSON Preset Configuration</div>
                      <div className="text-[11px] text-neutral-400">Complete portable particle specification.</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(JSON.stringify(activeConfig, null, 2), 'json')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-[11px] font-medium border border-neutral-700"
                      >
                        {copiedCodeType === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCodeType === 'json' ? 'Copied JSON!' : 'Copy JSON'}</span>
                      </button>
                      <button
                        onClick={() => setImportJsonOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium border border-neutral-700"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Import JSON</span>
                      </button>
                    </div>
                  </div>

                  <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-[10px] font-mono text-neutral-300 max-h-40 overflow-y-auto leading-relaxed">
                    {JSON.stringify(activeConfig, null, 2)}
                  </pre>
                </div>

                {/* Windows C# Code */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-200 text-xs">Windows C# (.NET 8 WPF) Snippet</span>
                    <button
                      onClick={() => handleCopy(generateCSharpCode(), 'csharp')}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-blue-300 text-[11px] border border-neutral-700"
                    >
                      {copiedCodeType === 'csharp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCodeType === 'csharp' ? 'Copied C#!' : 'Copy C#'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[10px] font-mono text-neutral-300 max-h-28 overflow-y-auto">
                    {generateCSharpCode()}
                  </pre>
                </div>

                {/* macOS Swift Code */}
                <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-200 text-xs">macOS Swift 5.9 (AppKit) Snippet</span>
                    <button
                      onClick={() => handleCopy(generateSwiftCode(), 'swift')}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-purple-300 text-[11px] border border-neutral-700"
                    >
                      {copiedCodeType === 'swift' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCodeType === 'swift' ? 'Copied Swift!' : 'Copy Swift'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[10px] font-mono text-neutral-300 max-h-28 overflow-y-auto">
                    {generateSwiftCode()}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Preset Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
              <Save className="w-5 h-5 text-amber-400" />
              <span>Save Custom Particle FX Preset</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Save your current particle physics, shape, and optical configuration to your browser library.
            </p>
            <div>
              <label className="text-xs text-neutral-300 block mb-1 font-semibold">Preset Name</label>
              <input
                type="text"
                value={savePresetName}
                onChange={(e) => setSavePresetName(e.target.value)}
                placeholder="e.g. Hyperdrive Nova Spark"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomPreset}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import JSON Modal */}
      {importJsonOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-400" />
              <span>Import Particle FX Configuration</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Paste a valid ParticleFxConfig JSON object below to import it into your studio.
            </p>
            <textarea
              rows={8}
              value={jsonInputText}
              onChange={(e) => setJsonInputText(e.target.value)}
              placeholder='Paste JSON config here, e.g. { "name": "My Effect", "shape": "sparkle-star", ... }'
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs font-mono text-neutral-200 focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setImportJsonOpen(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleImportJson}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow"
              >
                Import Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper: Hex color to RGB string
function hexToRgbString(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '245, 158, 11';
}
