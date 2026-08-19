import { AppSettings, ColorPreset } from '../types';

export interface FluidDyeDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vorticity: number; // angular spin speed (curling)
  radius: number;
  maxRadius: number;
  growthRate: number;
  alpha: number;
  decay: number;
  color: string;
  hue: number;
  type: 'dye' | 'filament' | 'vortex-core' | 'sparkle';
  life: number;
  maxLife: number;
}

export interface FluidBurstShockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  expansionSpeed: number;
  alpha: number;
  hue: number;
  color: string;
  filaments: { angle: number; speed: number; spin: number; hue: number }[];
  life: number;
  maxLife: number;
}

export class FluidSimulationEngine {
  private dyes: FluidDyeDrop[] = [];
  private shockwaves: FluidBurstShockwave[] = [];
  private maxDyes = 450;
  private rainbowHue = 0;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: false });
    }
  }

  public reset() {
    this.dyes = [];
    this.shockwaves = [];
  }

  public getDyeCount(): number {
    return this.dyes.length;
  }

  // Inject fluid velocity and dye splats from cursor motion
  public injectFluidStroke(
    x: number,
    y: number,
    dx: number,
    dy: number,
    dist: number,
    settings: AppSettings,
    primaryColor: string,
    secondaryColor: string,
    preset: 'fluid-simulation' | 'fluid-smoke' | 'neon-fluid' | 'cosmic-vortex' | 'ink-diffusion'
  ) {
    if (dist < 0.5) return;

    this.rainbowHue = (this.rainbowHue + dist * 0.4) % 360;
    const intensity = settings.intensity || 1.0;
    const speedMultiplier = settings.animationSpeed || 1.0;
    const vorticityBase = (settings.fluidVorticity ?? 1.5);
    const dissipation = settings.fluidDissipation ?? 0.96;

    // Splat count scales smoothly with distance
    const splatCount = Math.min(10, Math.max(2, Math.round((dist / 9) * (settings.particleDensity || 5) * 0.55)));

    for (let i = 0; i < splatCount; i++) {
      if (this.dyes.length >= this.maxDyes) {
        this.dyes.shift(); // Remove oldest to maintain smooth 60-144 FPS
      }

      const interp = i / splatCount;
      const posX = x - dx * interp + (Math.random() - 0.5) * 4;
      const posY = y - dy * interp + (Math.random() - 0.5) * 4;

      // Color calculation based on preset & settings
      let dyeColor = primaryColor;
      let hueVal = this.rainbowHue;

      if (settings.fluidRainbowDye || preset === 'neon-fluid' || preset === 'fluid-simulation') {
        hueVal = (this.rainbowHue + i * 20 + (preset === 'neon-fluid' ? Math.random() * 40 : 0)) % 360;
        dyeColor = settings.fluidRainbowDye || preset === 'neon-fluid'
          ? `hsl(${hueVal}, 95%, ${preset === 'neon-fluid' ? '60%' : '56%'})`
          : primaryColor;
      } else if (preset === 'cosmic-vortex') {
        const cosmicHues = [270, 220, 310, 190]; // Purple, Electric Blue, Magenta, Cyan
        hueVal = cosmicHues[Math.floor(Math.random() * cosmicHues.length)] + (Math.random() - 0.5) * 20;
        dyeColor = `hsl(${hueVal}, 90%, 60%)`;
      } else if (preset === 'ink-diffusion') {
        dyeColor = Math.random() > 0.4 ? primaryColor : secondaryColor;
      } else {
        // fluid-smoke
        dyeColor = Math.random() > 0.3 ? primaryColor : secondaryColor;
      }

      if (preset === 'fluid-simulation') {
        // Navier-Stokes Dipole Vortex model: inject core stream + counter-rotating shear vortex pair
        const spinSign = i % 2 === 0 ? 1 : -1;
        const normalX = -dy / dist;
        const normalY = dx / dist;
        const offsetDist = (Math.random() * 8 + 2) * spinSign;

        // Core forward velocity + tangent shear
        const vx = (dx * 0.22 + normalX * offsetDist * 0.4 + (Math.random() - 0.5) * 1.0) * intensity;
        const vy = (dy * 0.22 + normalY * offsetDist * 0.4 + (Math.random() - 0.5) * 1.0) * intensity;

        const initialRadius = (Math.random() * 6 + 10) * intensity;
        const maxRadius = initialRadius * 3.8;

        this.dyes.push({
          x: posX + normalX * offsetDist,
          y: posY + normalY * offsetDist,
          vx,
          vy,
          vorticity: vorticityBase * spinSign * (Math.random() * 0.6 + 0.8) * speedMultiplier,
          radius: initialRadius,
          maxRadius,
          growthRate: 0.38 * speedMultiplier,
          alpha: 0.92,
          decay: (1 - dissipation) * 0.75 * speedMultiplier,
          color: dyeColor,
          hue: hueVal,
          type: 'dye',
          life: 0,
          maxLife: Math.round((50 / speedMultiplier) * (dissipation * 1.05)),
        });
      } else {
        // Standard fluid presets
        const spinSign = Math.random() > 0.5 ? 1 : -1;
        const tangentX = -dy * 0.35 * (vorticityBase * 0.8 * spinSign);
        const tangentY = dx * 0.35 * (vorticityBase * 0.8 * spinSign);

        const vx = (dx * 0.15 + tangentX + (Math.random() - 0.5) * 1.2) * intensity;
        const vy = (dy * 0.15 + tangentY + (Math.random() - 0.5) * 1.2) * intensity;

        const initialRadius = (preset === 'cosmic-vortex' ? 8 : preset === 'ink-diffusion' ? 14 : 10) * intensity;
        const maxRadius = initialRadius * (preset === 'ink-diffusion' ? 4.5 : 3.2);

        this.dyes.push({
          x: posX,
          y: posY,
          vx,
          vy,
          vorticity: (vorticityBase * spinSign + (Math.random() - 0.5) * 0.8) * speedMultiplier,
          radius: initialRadius,
          maxRadius,
          growthRate: (preset === 'ink-diffusion' ? 0.45 : 0.3) * speedMultiplier,
          alpha: preset === 'neon-fluid' ? 0.95 : 0.85,
          decay: (1 - dissipation) * (preset === 'neon-fluid' ? 0.7 : 0.85) * speedMultiplier,
          color: dyeColor,
          hue: hueVal,
          type: 'dye',
          life: 0,
          maxLife: Math.round((45 / speedMultiplier) * (dissipation * 1.05)),
        });

        // For cosmic vortex, add tiny glowing star sparkles caught in the fluid current
        if (preset === 'cosmic-vortex' && Math.random() < 0.35) {
          this.dyes.push({
            x: posX + (Math.random() - 0.5) * 12,
            y: posY + (Math.random() - 0.5) * 12,
            vx: vx * 1.4 + (Math.random() - 0.5) * 1.5,
            vy: vy * 1.4 + (Math.random() - 0.5) * 1.5,
            vorticity: vorticityBase * 1.8,
            radius: (Math.random() * 2 + 1.2) * intensity,
            maxRadius: 4 * intensity,
            growthRate: 0.05,
            alpha: 1.0,
            decay: 0.04 * speedMultiplier,
            color: '#ffffff',
            hue: 0,
            type: 'sparkle',
            life: 0,
            maxLife: 28,
          });
        }
      }
    }
  }

  // Trigger Pavel DoGreat style fluid vortex shockwave burst
  public triggerFluidVortexBurst(
    x: number,
    y: number,
    settings: AppSettings,
    primaryColor: string
  ) {
    const intensity = settings.intensity || 1.0;
    const speedMultiplier = settings.animationSpeed || 1.0;
    const filamentCount = 24;
    const filaments: { angle: number; speed: number; spin: number; hue: number }[] = [];

    for (let i = 0; i < filamentCount; i++) {
      const angle = (i / filamentCount) * Math.PI * 2;
      const speed = (Math.random() * 5 + 4) * intensity;
      const spin = (i % 2 === 0 ? 1 : -1) * (Math.random() * 1.5 + 1.2);
      const hue = (this.rainbowHue + i * (360 / filamentCount)) % 360;
      filaments.push({ angle, speed, spin, hue });

      // Spawn primary filament dye nodes
      for (let step = 1; step <= 3; step++) {
        const dist = step * 12 * intensity;
        const dyeHue = (this.rainbowHue + i * 15) % 360;
        const color = settings.fluidRainbowDye ? `hsl(${dyeHue}, 95%, 65%)` : primaryColor;

        this.dyes.push({
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist,
          vx: Math.cos(angle) * speed * (0.8 + step * 0.2),
          vy: Math.sin(angle) * speed * (0.8 + step * 0.2),
          vorticity: spin * (1.5 + step * 0.4),
          radius: (10 + step * 4) * intensity,
          maxRadius: (35 + step * 10) * intensity,
          growthRate: 0.5 * speedMultiplier,
          alpha: 0.95,
          decay: 0.022 * speedMultiplier,
          color,
          hue: dyeHue,
          type: 'filament',
          life: 0,
          maxLife: Math.round(55 / speedMultiplier),
        });
      }
    }

    // Add shockwave ring tracker
    this.shockwaves.push({
      x,
      y,
      radius: 8,
      maxRadius: 180 * intensity,
      expansionSpeed: 5.5 * speedMultiplier,
      alpha: 1.0,
      hue: this.rainbowHue,
      color: primaryColor,
      filaments,
      life: 0,
      maxLife: Math.round(40 / speedMultiplier),
    });

    // Central bright fluid core splat
    this.dyes.push({
      x,
      y,
      vx: 0,
      vy: 0,
      vorticity: 2.0,
      radius: 25 * intensity,
      maxRadius: 70 * intensity,
      growthRate: 1.2 * speedMultiplier,
      alpha: 1.0,
      decay: 0.035 * speedMultiplier,
      color: '#ffffff',
      hue: 0,
      type: 'vortex-core',
      life: 0,
      maxLife: Math.round(35 / speedMultiplier),
    });
  }

  // Update physics and render fluid simulation
  public updateAndRender(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings
  ) {
    if (this.dyes.length === 0 && this.shockwaves.length === 0) return;

    const dissipation = settings.fluidDissipation ?? 0.96;
    const speedMultiplier = settings.animationSpeed || 1.0;
    const enableBloom = settings.fluidBloom !== false;

    ctx.save();

    // Use additive blending ('lighter' or 'screen') for glowing neon fluid luminescent bloom
    if (enableBloom) {
      ctx.globalCompositeOperation = 'lighter';
    }

    // 1. Update & Render Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life++;
      sw.radius += sw.expansionSpeed;
      sw.alpha = Math.max(0, 1 - sw.life / sw.maxLife);

      if (sw.life >= sw.maxLife || sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = sw.alpha * 0.7;
      ctx.lineWidth = 2.5 * (1 - sw.life / sw.maxLife);

      // Swirling rainbow vortex filaments
      for (const fil of sw.filaments) {
        const filAngle = fil.angle + (fil.spin * sw.life * 0.04);
        const curX = sw.x + Math.cos(filAngle) * sw.radius;
        const curY = sw.y + Math.sin(filAngle) * sw.radius;

        ctx.strokeStyle = settings.fluidRainbowDye ? `hsl(${fil.hue}, 95%, 65%)` : sw.color;
        ctx.beginPath();
        ctx.moveTo(
          sw.x + Math.cos(filAngle - 0.15 * fil.spin) * (sw.radius * 0.7),
          sw.y + Math.sin(filAngle - 0.15 * fil.spin) * (sw.radius * 0.7)
        );
        ctx.lineTo(curX, curY);
        ctx.stroke();
      }

      // Shockwave outer ring
      ctx.strokeStyle = sw.color;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // 2. Update & Render Fluid Dyes (Smoke & Vortices)
    for (let i = this.dyes.length - 1; i >= 0; i--) {
      const dye = this.dyes[i];
      dye.life++;

      // Velocity-based dissipation physics model:
      const speed = Math.hypot(dye.vx, dye.vy);

      // 1. Vorticity curling force: curl angle scales dynamically with vorticity and speed
      const curlAngle = dye.vorticity * (0.045 + Math.min(0.04, speed * 0.006));
      const cosCurl = Math.cos(curlAngle);
      const sinCurl = Math.sin(curlAngle);
      const newVx = dye.vx * cosCurl - dye.vy * sinCurl;
      const newVy = dye.vx * sinCurl + dye.vy * cosCurl;

      // 2. Velocity-based dissipation: faster fluid shears & dampens velocity nonlinearly
      const velocityDamping = Math.pow(dissipation, 1.0 + Math.min(2.0, speed * 0.06));
      dye.vx = newVx * velocityDamping;
      dye.vy = newVy * velocityDamping;

      dye.x += dye.vx;
      dye.y += dye.vy;

      // 3. Dynamic volumetric expansion modulated by fluid speed
      if (dye.radius < dye.maxRadius) {
        dye.radius += dye.growthRate * (1.0 + Math.min(1.5, speed * 0.08));
      }

      // 4. Velocity-based alpha dissipation: fast shearing dye dissipates dynamically
      const alphaDecayMultiplier = 1.0 + Math.min(1.8, speed * 0.05);
      dye.alpha -= dye.decay * alphaDecayMultiplier;

      if (dye.life >= dye.maxLife || dye.alpha <= 0) {
        this.dyes.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, dye.alpha);

      if (dye.type === 'sparkle') {
        // High intensity micro-sparkle inside cosmic fluid
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(dye.x, dye.y, dye.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (dye.type === 'vortex-core') {
        // Core burst radial glow
        const grad = ctx.createRadialGradient(dye.x, dye.y, 0, dye.x, dye.y, dye.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, dye.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(dye.x, dye.y, dye.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Fluid Dye Plume / Smoke Puff (Soft Gaussian Radial Fade)
        const curRadius = Math.max(1, dye.radius);
        const grad = ctx.createRadialGradient(dye.x, dye.y, 0, dye.x, dye.y, curRadius);
        grad.addColorStop(0, dye.color);
        grad.addColorStop(0.45, dye.color);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(dye.x, dye.y, curRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }
}
