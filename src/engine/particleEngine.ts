import { AppSettings, ColorPreset, FlarePreset, FxPreset, Particle, FlareRing } from '../types';
import { FluidSimulationEngine } from './fluidSimulation';
import { CustomFxRenderer } from './customFxRenderer';

export const COLOR_MAP: Record<ColorPreset, { primary: string; secondary: string; glow: string; rgb: string }> = {
  amber: { primary: '#f59e0b', secondary: '#fbbf24', glow: 'rgba(245, 158, 11, 0.4)', rgb: '245, 158, 11' },
  cyan: { primary: '#06b6d4', secondary: '#38bdf8', glow: 'rgba(6, 182, 212, 0.4)', rgb: '6, 182, 212' },
  emerald: { primary: '#10b981', secondary: '#34d399', glow: 'rgba(16, 185, 129, 0.4)', rgb: '16, 185, 129' },
  violet: { primary: '#8b5cf6', secondary: '#a78bfa', glow: 'rgba(139, 92, 246, 0.4)', rgb: '139, 92, 246' },
  gold: { primary: '#eab308', secondary: '#fef08a', glow: 'rgba(234, 179, 8, 0.4)', rgb: '234, 179, 8' },
  white: { primary: '#f8fafc', secondary: '#e2e8f0', glow: 'rgba(248, 250, 252, 0.5)', rgb: '248, 250, 252' },
  crimson: { primary: '#ef4444', secondary: '#f87171', glow: 'rgba(239, 68, 68, 0.4)', rgb: '239, 68, 68' },
  custom: { primary: '#f59e0b', secondary: '#fbbf24', glow: 'rgba(245, 158, 11, 0.4)', rgb: '245, 158, 11' },
};

export class ParticleEngine {
  private particles: Particle[] = [];
  private rings: FlareRing[] = [];
  private history: { x: number; y: number; time: number }[] = [];
  private maxParticles = 350;
  private lastX = 0;
  private lastY = 0;
  private lastTime = 0;
  private lastMoveTime = 0;

  // Frame-equivalent timing (see customFxRenderer): presets are authored in
  // 60fps frame units, so each update advances by dt*60 instead of a fixed 1.
  // Keeps effect duration identical at 60/120/144Hz; dt is clamped so a stall
  // can't teleport particles or expire the whole population at once.
  private static readonly referenceHz = 60;
  private static readonly maxDeltaSeconds = 0.1;
  private lastUpdateTime = performance.now();
  private densityBudget = 0;
  private isIdle = true;
  private globalHue = 0;
  public fluidEngine: FluidSimulationEngine;

  // Katakana + digits pool for the Matrix Rain digital-rain preset
  static readonly MATRIX_GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789Z:・.=*+-<>¦|'.split('');

  public customFxRenderer = new CustomFxRenderer();

  public fps = 60;
  public particleCount = 0;
  public drawLatencyMs = 0.2;
  public cursorSpeed = 0;

  constructor() {
    this.lastTime = performance.now();
    this.lastMoveTime = performance.now();
    this.fluidEngine = new FluidSimulationEngine();
  }

  public getColors(settings: AppSettings) {
    if (settings.colorPreset === 'custom' && settings.customColor) {
      const hex = settings.customColor;
      const r = parseInt(hex.slice(1, 3), 16) || 0;
      const g = parseInt(hex.slice(3, 5), 16) || 0;
      const b = parseInt(hex.slice(5, 7), 16) || 0;
      const lighten = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.35));
      return {
        primary: hex,
        secondary: `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`,
        glow: `rgba(${r}, ${g}, ${b}, 0.4)`,
        rgb: `${r}, ${g}, ${b}`,
      };
    }
    return COLOR_MAP[settings.colorPreset] || COLOR_MAP.amber;
  }

  public onMouseMove(
    x: number,
    y: number,
    settings: AppSettings
  ) {
    if (!settings.enabled) return;

    const now = performance.now();
    const dt = Math.max(1, now - this.lastTime);
    const idleDuration = now - this.lastMoveTime;
    let dx = x - this.lastX;
    let dy = y - this.lastY;
    let dist = Math.hypot(dx, dy);

    // If the mouse was idle (> 300ms) or teleported (> 150px gap),
    // smoothly re-anchor the baseline position so it doesn't streak particles across the entire screen.
    if (idleDuration > 300 || dist > 150) {
      // Optional: if Wake-From-Idle Burst is explicitly toggled on by the user, trigger a small local burst at the new point
      if (settings.idleBurst && idleDuration > 2000) {
        this.spawnIdleBurst(x, y, settings);
      }

      this.lastX = x;
      this.lastY = y;
      this.lastTime = now;
      this.lastMoveTime = now;
      this.history = [{ x, y, time: now }];
      this.cursorSpeed = 0;
      return;
    }

    this.cursorSpeed = (dist / dt) * 1000; // px per second

    this.lastMoveTime = now;
    this.lastX = x;
    this.lastY = y;
    this.lastTime = now;

    // Track history for comet/lightning trails
    this.history.unshift({ x, y, time: now });
    if (this.history.length > 25) {
      this.history.pop();
    }

    // Movement threshold check
    if (dist < settings.minMovementThreshold) return;
    if (!settings.enablePassiveFx) return;

    const colors = this.getColors(settings);
    // Distance-proportional emission with a carried remainder: flooring to a
    // minimum of 1 per event made a 1000Hz mouse emit ~8x a 125Hz one.
    this.densityBudget += settings.particleDensity * (dist / 15);
    const density = Math.min(Math.floor(this.densityBudget), 40);
    this.densityBudget -= density;
    if (density <= 0) return;
    const intensity = settings.intensity;

    this.spawnPassiveParticles(x, y, dx, dy, dist, settings, colors, density, intensity);
  }

  private spawnPassiveParticles(
    x: number,
    y: number,
    dx: number,
    dy: number,
    dist: number,
    settings: AppSettings,
    colors: { primary: string; secondary: string; glow: string; rgb: string },
    density: number,
    intensity: number
  ) {
    const fx = settings.passiveFx;

    switch (fx) {
      case 'spark-trail': {
        const count = Math.min(6, density);
        for (let i = 0; i < count; i++) {
          if (this.particles.length >= this.maxParticles) break;
          const angle = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 1.2;
          const speed = (Math.random() * 2 + 1) * intensity;
          this.particles.push({
            x: x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * 8,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed + 0.4, // slight gravity
            size: (Math.random() * 2.8 + 1.5) * intensity,
            initialSize: 3,
            alpha: 0.95,
            initialAlpha: 0.95,
            color: Math.random() > 0.3 ? colors.primary : colors.secondary,
            life: 0,
            maxLife: (Math.random() * 20 + 18) / settings.animationSpeed,
            decay: 0.045 * settings.animationSpeed,
            type: 'spark',
          });
        }
        break;
      }

      case 'glow-pulse': {
        if (Math.random() < 0.4) {
          this.particles.push({
            x,
            y,
            vx: 0,
            vy: 0,
            size: (12 + Math.min(30, dist * 0.5)) * intensity,
            initialSize: 12,
            alpha: 0.45,
            initialAlpha: 0.45,
            color: colors.glow,
            life: 0,
            maxLife: 15 / settings.animationSpeed,
            decay: 0.06 * settings.animationSpeed,
            type: 'glow',
          });
        }
        break;
      }

      case 'comet-trail': {
        const count = Math.min(8, density * 1.5);
        for (let i = 0; i < count; i++) {
          if (this.particles.length >= this.maxParticles) break;
          const progress = i / count;
          const interpX = x - dx * progress;
          const interpY = y - dy * progress;
          this.particles.push({
            x: interpX + (Math.random() - 0.5) * 4,
            y: interpY + (Math.random() - 0.5) * 4,
            vx: -dx * 0.08 + (Math.random() - 0.5) * 0.5,
            vy: -dy * 0.08 + (Math.random() - 0.5) * 0.5,
            size: (4 - progress * 2.5) * intensity,
            initialSize: 4,
            alpha: 0.9 * (1 - progress * 0.4),
            initialAlpha: 0.9,
            color: progress < 0.3 ? '#ffffff' : colors.primary,
            life: 0,
            maxLife: (Math.random() * 15 + 12) / settings.animationSpeed,
            decay: 0.065 * settings.animationSpeed,
            type: 'comet',
          });
        }
        break;
      }

      case 'bubbles': {
        if (Math.random() < 0.6) {
          this.particles.push({
            x: x + (Math.random() - 0.5) * 12,
            y: y + (Math.random() - 0.5) * 12,
            vx: (Math.random() - 0.5) * 1.2,
            vy: -Math.random() * 1.8 - 0.5, // float upward
            size: (Math.random() * 5 + 3) * intensity,
            initialSize: 4,
            alpha: 0.7,
            initialAlpha: 0.7,
            color: colors.secondary,
            life: 0,
            maxLife: (Math.random() * 30 + 25) / settings.animationSpeed,
            decay: 0.03 * settings.animationSpeed,
            type: 'bubble',
            extra: { wobble: Math.random() * Math.PI * 2 },
          });
        }
        break;
      }

      case 'fireflies': {
        if (Math.random() < 0.5) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 1.2 + 0.3;
          this.particles.push({
            x: x + (Math.random() - 0.5) * 14,
            y: y + (Math.random() - 0.5) * 14,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: (Math.random() * 3.5 + 2) * intensity,
            initialSize: 3,
            alpha: 0.85,
            initialAlpha: 0.85,
            color: colors.primary,
            life: 0,
            maxLife: (Math.random() * 40 + 30) / settings.animationSpeed,
            decay: 0.025 * settings.animationSpeed,
            type: 'firefly',
            extra: { phase: Math.random() * 10, freq: Math.random() * 0.1 + 0.05 },
          });
        }
        break;
      }

      case 'star-dust': {
        if (Math.random() < 0.7) {
          this.particles.push({
            x: x + (Math.random() - 0.5) * 16,
            y: y + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            size: (Math.random() * 4 + 2) * intensity,
            initialSize: 4,
            alpha: 0.95,
            initialAlpha: 0.95,
            color: Math.random() > 0.4 ? '#ffffff' : colors.secondary,
            life: 0,
            maxLife: (Math.random() * 24 + 18) / settings.animationSpeed,
            decay: 0.04 * settings.animationSpeed,
            type: 'star',
            rotation: Math.random() * Math.PI,
            rotationSpeed: (Math.random() - 0.5) * 0.15,
          });
        }
        break;
      }

      case 'lightning': {
        if (this.history.length > 2 && Math.random() < 0.6) {
          const prev = this.history[Math.min(4, this.history.length - 1)];
          this.particles.push({
            x,
            y,
            vx: 0,
            vy: 0,
            size: 2 * intensity,
            initialSize: 2,
            alpha: 0.9,
            initialAlpha: 0.9,
            color: colors.primary,
            life: 0,
            maxLife: 10 / settings.animationSpeed,
            decay: 0.1 * settings.animationSpeed,
            type: 'arc',
            extra: { fromX: prev.x, fromY: prev.y, jitterX: (Math.random() - 0.5) * 16, jitterY: (Math.random() - 0.5) * 16 },
          });
        }
        break;
      }

      case 'rainbow': {
        this.globalHue = (this.globalHue + 4) % 360;
        const color = `hsl(${this.globalHue}, 90%, 65%)`;
        this.particles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: -dx * 0.05 + (Math.random() - 0.5) * 0.8,
          vy: -dy * 0.05 + (Math.random() - 0.5) * 0.8,
          size: (Math.random() * 3 + 2) * intensity,
          initialSize: 3,
          alpha: 0.9,
          initialAlpha: 0.9,
          color,
          hue: this.globalHue,
          life: 0,
          maxLife: 20 / settings.animationSpeed,
          decay: 0.05 * settings.animationSpeed,
          type: 'spark',
        });
        break;
      }

      case 'plasma': {
        for (let i = 0; i < 2; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distOffset = Math.random() * 8 + 4;
          this.particles.push({
            x: x + Math.cos(angle) * distOffset,
            y: y + Math.sin(angle) * distOffset,
            vx: -Math.sin(angle) * 1.5 * intensity,
            vy: Math.cos(angle) * 1.5 * intensity,
            size: (Math.random() * 3.2 + 1.8) * intensity,
            initialSize: 3,
            alpha: 0.85,
            initialAlpha: 0.85,
            color: colors.primary,
            life: 0,
            maxLife: 16 / settings.animationSpeed,
            decay: 0.06 * settings.animationSpeed,
            type: 'plasma',
          });
        }
        break;
      }

      case 'matrix-rain': {
        // Digital rain: green code glyphs cascade downward from the cursor's wake.
        // Keeps its fixed Matrix-green identity regardless of the color palette.
        const count = Math.min(4, density);
        for (let i = 0; i < count; i++) {
          if (this.particles.length >= this.maxParticles) break;
          const isHead = Math.random() < 0.25;
          this.particles.push({
            x: x - dx * Math.random() + (Math.random() - 0.5) * 14,
            y: y - dy * Math.random() + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() * 2.4 + 1.6) * intensity, // constant downward cascade
            size: (Math.random() * 4 + 9) * intensity, // font size in px
            initialSize: 11,
            alpha: isHead ? 1.0 : 0.85,
            initialAlpha: isHead ? 1.0 : 0.85,
            color: isHead ? '#DCFCE7' : '#22C55E',
            life: 0,
            maxLife: (Math.random() * 24 + 22) / settings.animationSpeed,
            decay: 0.03 * settings.animationSpeed,
            type: 'glyph',
            extra: {
              char: ParticleEngine.MATRIX_GLYPHS[Math.floor(Math.random() * ParticleEngine.MATRIX_GLYPHS.length)],
              flicker: Math.random() * 0.08 + 0.02,
            },
          });
        }
        break;
      }

      case 'fire-flame': {
        // Classic fire: fixed flame palette with upward buoyancy
        const fireColors = ['#FDBA13', '#F97316', '#DC2626'];
        const count = Math.min(6, density);
        for (let i = 0; i < count; i++) {
          if (this.particles.length >= this.maxParticles) break;
          const angle = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 1.2;
          const speed = (Math.random() * 1.8 + 0.8) * intensity;
          this.particles.push({
            x: x + (Math.random() - 0.5) * 6,
            y: y + (Math.random() - 0.5) * 6,
            vx: Math.cos(angle) * speed * 0.5,
            vy: Math.sin(angle) * speed * 0.5 - (Math.random() * 1.4 + 0.5), // buoyant rise
            size: (Math.random() * 3.2 + 2.0) * intensity,
            initialSize: 3,
            alpha: 0.95,
            initialAlpha: 0.95,
            color: fireColors[Math.floor(Math.random() * fireColors.length)],
            life: 0,
            maxLife: (Math.random() * 18 + 14) / settings.animationSpeed,
            decay: 0.05 * settings.animationSpeed,
            type: 'spark',
          });
        }
        break;
      }

      case 'neon-cyber': {
        // Fixed electric cyan / magenta / blue arcade palette
        const neonColors = ['#00F2FF', '#F200F2', '#3B82F6'];
        const count = Math.min(5, density);
        for (let i = 0; i < count; i++) {
          if (this.particles.length >= this.maxParticles) break;
          const angle = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 0.6;
          const speed = (Math.random() * 2.2 + 1.4) * intensity;
          this.particles.push({
            x: x + (Math.random() - 0.5) * 4,
            y: y + (Math.random() - 0.5) * 4,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: (Math.random() * 2.6 + 1.6) * intensity,
            initialSize: 3,
            alpha: 0.95,
            initialAlpha: 0.95,
            color: neonColors[Math.floor(Math.random() * neonColors.length)],
            life: 0,
            maxLife: (Math.random() * 16 + 12) / settings.animationSpeed,
            decay: 0.055 * settings.animationSpeed,
            type: 'spark',
          });
        }
        break;
      }

      case 'magic-dust': {
        // Enchanted pastel shimmer drifting in all directions
        const magicColors = ['#D97FFF', '#FFD84D', '#66CCFF'];
        const count = Math.min(5, density);
        for (let i = 0; i < count; i++) {
          if (this.particles.length >= this.maxParticles) break;
          const drift = Math.random() * Math.PI * 2;
          const speed = (Math.random() * 1.6 + 0.5) * intensity;
          this.particles.push({
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx: Math.cos(drift) * speed,
            vy: Math.sin(drift) * speed - 0.3, // gentle float
            size: (Math.random() * 3.0 + 1.4) * intensity,
            initialSize: 2.5,
            alpha: 1.0,
            initialAlpha: 1.0,
            color: magicColors[Math.floor(Math.random() * magicColors.length)],
            life: 0,
            maxLife: (Math.random() * 26 + 18) / settings.animationSpeed,
            decay: 0.035 * settings.animationSpeed,
            type: Math.random() < 0.3 ? 'star' : 'spark',
            rotation: Math.random() * Math.PI,
            rotationSpeed: (Math.random() - 0.5) * 0.15,
          });
        }
        break;
      }

      case 'galaxy': {
        // Deep-space starfield: violet/blue nebula dust with white star sparkles
        const nebulaColors = ['#8B5CF6', '#3B82F6', '#1E1B4B'];
        const count = Math.min(5, density);
        for (let i = 0; i < count; i++) {
          if (this.particles.length >= this.maxParticles) break;
          const isStar = Math.random() < 0.35;
          const drift = Math.random() * Math.PI * 2;
          const speed = (Math.random() * 1.2 + 0.3) * intensity;
          this.particles.push({
            x: x - dx * Math.random() * 0.6 + (Math.random() - 0.5) * 12,
            y: y - dy * Math.random() * 0.6 + (Math.random() - 0.5) * 12,
            vx: Math.cos(drift) * speed,
            vy: Math.sin(drift) * speed,
            size: isStar ? (Math.random() * 3.5 + 2.0) * intensity : (Math.random() * 2.2 + 1.2) * intensity,
            initialSize: 2.5,
            alpha: isStar ? 1.0 : 0.7,
            initialAlpha: isStar ? 1.0 : 0.7,
            color: isStar ? '#FFFFFF' : nebulaColors[Math.floor(Math.random() * nebulaColors.length)],
            life: 0,
            maxLife: (Math.random() * 28 + 20) / settings.animationSpeed,
            decay: 0.03 * settings.animationSpeed,
            type: isStar ? 'star' : 'spark',
            rotation: Math.random() * Math.PI,
            rotationSpeed: (Math.random() - 0.5) * 0.1,
          });
        }
        break;
      }

      case 'minimal-beacon': {
        // Restrained single tracking dot — the quietest preset
        if (Math.random() < 0.5) {
          this.particles.push({
            x,
            y,
            vx: 0,
            vy: 0,
            size: (Math.random() * 1.5 + 2.5) * intensity,
            initialSize: 3,
            alpha: 0.5,
            initialAlpha: 0.5,
            color: colors.primary,
            life: 0,
            maxLife: 12 / settings.animationSpeed,
            decay: 0.06 * settings.animationSpeed,
            type: 'spark',
          });
        }
        break;
      }

      case 'custom-fx': {
        if (settings.customFxConfig) {
          this.customFxRenderer.onMove(x, y, settings.customFxConfig);
        }
        break;
      }

      case 'fluid-simulation':
      case 'fluid-smoke':
      case 'neon-fluid':
      case 'cosmic-vortex':
      case 'ink-diffusion': {
        this.fluidEngine.injectFluidStroke(
          x,
          y,
          dx,
          dy,
          dist,
          settings,
          colors.primary,
          colors.secondary,
          fx
        );
        break;
      }
    }
  }

  // Trigger Find Mouse signature flare
  public triggerFindMouse(x: number, y: number, settings: AppSettings) {
    // Custom FX Designer effects join the flare with their own burst
    if (settings.passiveFx === 'custom-fx' && settings.customFxConfig) {
      this.customFxRenderer.triggerBurst(x, y, settings.customFxConfig);
    }
    const colors = this.getColors(settings);
    const intensity = settings.intensity;
    const preset = settings.findMouseFx;

    // Handle Pavel DoGreat style Fluid Vortex Burst
    if (preset === 'fluid-vortex-burst') {
      this.fluidEngine.triggerFluidVortexBurst(x, y, settings, colors.primary);
      return;
    }

    // 1. Expanding rings
    const ringCount = preset === 'sonar-radar' ? 3 : 2;
    for (let i = 0; i < ringCount; i++) {
      this.rings.push({
        x,
        y,
        radius: 6,
        maxRadius: (preset === 'supernova' ? 120 : preset === 'quantum-shockwave' ? 95 : 80) * intensity + i * 25,
        alpha: 0.95 - i * 0.2,
        color: i === 0 ? '#ffffff' : colors.primary,
        lineWidth: 3.5 - i * 0.8,
        progress: -i * 0.15, // staggered start
        type: preset,
      });
    }

    // 2. Flare particle burst
    const count = Math.round((preset === 'supernova' ? 45 : preset === 'quantum-shockwave' ? 36 : 28) * intensity);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = (Math.random() * 6 + 3.5) * intensity;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (Math.random() * 4.5 + 2.5) * intensity,
        initialSize: 4,
        alpha: 1.0,
        initialAlpha: 1.0,
        color: Math.random() > 0.3 ? colors.primary : '#ffffff',
        life: 0,
        maxLife: (Math.random() * 35 + 30) / settings.animationSpeed,
        decay: 0.028 * settings.animationSpeed,
        type: 'flare-burst',
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    // 3. Central bright beacon flash
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 40 * intensity,
      initialSize: 40,
      alpha: 1.0,
      initialAlpha: 1.0,
      color: '#ffffff',
      life: 0,
      maxLife: 18 / settings.animationSpeed,
      decay: 0.06 * settings.animationSpeed,
      type: 'beacon-flash',
    });
  }

  // Wake-from-idle burst
  private spawnIdleBurst(x: number, y: number, settings: AppSettings) {
    const colors = this.getColors(settings);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = Math.random() * 3 + 1.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 * settings.intensity,
        initialSize: 3,
        alpha: 0.9,
        initialAlpha: 0.9,
        color: colors.secondary,
        life: 0,
        maxLife: 20 / settings.animationSpeed,
        decay: 0.05 * settings.animationSpeed,
        type: 'spark',
      });
    }
  }

  // Monitor crossing FX

  // Update physics & render to HTML5 Canvas
  public updateAndRender(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings
  ) {
    const startTime = performance.now();
    const elapsedSeconds = Math.min(
      ParticleEngine.maxDeltaSeconds,
      Math.max(0, (startTime - this.lastUpdateTime) / 1000)
    );
    const fe = elapsedSeconds * ParticleEngine.referenceHz;
    this.lastUpdateTime = startTime;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!settings.enabled) {
      this.particles = [];
      this.rings = [];
      this.fluidEngine.reset();
      this.particleCount = 0;
      return;
    }

    ctx.save();

    // 0. Render Fluid Simulation (Smooth glowing smoke & vortices)
    this.fluidEngine.updateAndRender(ctx, width, height, settings);

    // 1. Render & Update Flare Rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.progress += 0.035 * settings.animationSpeed * fe;

      if (ring.progress >= 1) {
        this.rings.splice(i, 1);
        continue;
      }

      if (ring.progress < 0) continue; // staggered delay

      const curRadius = ring.maxRadius * Math.sin(ring.progress * Math.PI * 0.5);
      const curAlpha = Math.max(0, ring.alpha * (1 - ring.progress));

      ctx.save();
      ctx.globalAlpha = curAlpha;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.lineWidth * (1 - ring.progress * 0.6);

      // Distinct visuals per flare preset
      if (ring.type === 'sonar-radar') {
        // Radar circle
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, curRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        const crosshairLen = curRadius * 1.3;
        ctx.beginPath();
        ctx.moveTo(ring.x - crosshairLen, ring.y);
        ctx.lineTo(ring.x + crosshairLen, ring.y);
        ctx.moveTo(ring.x, ring.y - crosshairLen);
        ctx.lineTo(ring.x, ring.y + crosshairLen);
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (ring.type === 'quantum-shockwave') {
        // Double segmented ring
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, curRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, curRadius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ring.type === 'neon-beacon') {
        // Glow effect
        ctx.shadowColor = ring.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, curRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Default Solar Flare / Supernova smooth bloom
        ctx.shadowColor = ring.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, curRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 2. Render & Update Particles
    // trailLength (10-60, default 25) scales particle lifetime globally:
    // longer trails age and fade slower, shorter trails faster.
    const trailScale = Math.min(2.4, Math.max(0.4, settings.trailLength / 25));
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += fe / trailScale;
      p.alpha -= (p.decay * fe) / trailScale;

      if (p.alpha <= 0 || p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * fe;
      p.y += p.vy * fe;

      // Type-specific physics & rendering
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.type === 'spark' || p.type === 'flare-burst') {
        const sparkDrag = Math.pow(0.94, fe);
        p.vx *= sparkDrag;
        p.vy *= sparkDrag;
        const curSize = p.size * (p.alpha / p.initialAlpha);

        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, curSize), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'glow' || p.type === 'beacon-flash') {
        const curSize = p.size * (1 + (1 - p.alpha) * 0.5);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, curSize);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, curSize, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'star') {
        if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
          p.rotation += p.rotationSpeed * fe;
        }
        const s = p.size * (p.alpha / p.initialAlpha);
        ctx.translate(p.x, p.y);
        if (p.rotation) ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        // Draw 4-point star
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.25, -s * 0.25);
        ctx.lineTo(s, 0);
        ctx.lineTo(s * 0.25, s * 0.25);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.25, s * 0.25);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-s * 0.25, -s * 0.25);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'bubble') {
        if (p.extra) {
          p.extra.wobble += 0.1 * fe;
          p.x += Math.sin(p.extra.wobble) * 0.4 * fe;
        }
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.type === 'firefly') {
        if (p.extra) {
          p.extra.phase += p.extra.freq * fe;
          p.vx += Math.sin(p.extra.phase) * 0.15 * fe;
          p.vy += Math.cos(p.extra.phase) * 0.15 * fe;
        }
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'glyph' && p.extra) {
        // Occasional character flicker, like scrolling code
        if (Math.random() < p.extra.flicker) {
          p.extra.char = ParticleEngine.MATRIX_GLYPHS[Math.floor(Math.random() * ParticleEngine.MATRIX_GLYPHS.length)];
        }
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#22C55E';
        ctx.shadowBlur = 8;
        ctx.font = `bold ${Math.max(8, p.size)}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.extra.char, p.x, p.y);
      } else if (p.type === 'arc' && p.extra) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(p.extra.fromX, p.extra.fromY);
        const midX = (p.extra.fromX + p.x) / 2 + p.extra.jitterX;
        const midY = (p.extra.fromY + p.y) / 2 + p.extra.jitterY;
        ctx.lineTo(midX, midY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        // Generic circle
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();

    if (settings.passiveFx === 'custom-fx' && settings.customFxConfig) {
      this.customFxRenderer.render(ctx, width, height, settings.customFxConfig, this.lastX, this.lastY);
    }

    this.particleCount = this.particles.length + this.rings.length + this.fluidEngine.getDyeCount() + this.customFxRenderer.activeCount;
    this.drawLatencyMs = Math.round((performance.now() - startTime) * 100) / 100;
  }
}
