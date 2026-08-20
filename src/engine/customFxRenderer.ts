import { ParticleFxConfig, CustomParticle, ParticleShape } from '../types/fxEditor';

export class CustomFxRenderer {
  private particles: CustomParticle[] = [];
  private maxParticles = 500;
  private globalHue = 0;
  private lastX = 0;
  private lastY = 0;
  private lastTime = performance.now();
  private cursorVx = 0;
  private cursorVy = 0;
  private cursorSpeed = 0;

  public activeCount = 0;
  public fps = 60;
  public frameTimeMs = 0;

  // Clear all particles
  public clear() {
    this.particles = [];
    this.activeCount = 0;
  }

  // Spawn on pointer movement
  public onMove(x: number, y: number, config: ParticleFxConfig, forceSpawnCount?: number) {
    const now = performance.now();
    const dt = Math.max(1, now - this.lastTime);
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dist = Math.hypot(dx, dy);

    this.cursorVx = (dx / dt) * 16.6; // normalized px per frame
    this.cursorVy = (dy / dt) * 16.6;
    this.cursorSpeed = (dist / dt) * 1000;

    this.lastX = x;
    this.lastY = y;
    this.lastTime = now;

    if (dist < 0.5 && !forceSpawnCount) return;

    const count = forceSpawnCount ?? config.spawnRateOnMove;
    for (let i = 0; i < count; i++) {
      this.spawnSingleParticle(x, y, dx, dy, config, false);
    }
  }

  // Spawn on Click Burst / Flare
  public triggerBurst(x: number, y: number, config: ParticleFxConfig, customCount?: number) {
    const count = customCount ?? config.spawnBurstOnClick;
    for (let i = 0; i < count; i++) {
      this.spawnSingleParticle(x, y, 0, 0, config, true);
    }
  }

  // Spawn Idle emission
  public onIdle(x: number, y: number, config: ParticleFxConfig) {
    if (config.spawnRateIdle <= 0) return;
    if (Math.random() < config.spawnRateIdle * 0.3) {
      this.spawnSingleParticle(x, y, 0, 0, config, false);
    }
  }

  private spawnSingleParticle(
    x: number,
    y: number,
    dx: number,
    dy: number,
    config: ParticleFxConfig,
    isBurst: boolean
  ) {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift(); // FIFO drop oldest particle
    }

    const pattern = isBurst ? 'radial-burst' : config.emissionPattern;
    let angle = 0;
    let speed = Math.random() * (config.initialSpeedMax - config.initialSpeedMin) + config.initialSpeedMin;

    if (isBurst) {
      speed *= 1.4;
      angle = Math.random() * Math.PI * 2;
    } else {
      switch (pattern) {
        case 'radial-burst':
          angle = Math.random() * Math.PI * 2;
          break;

        case 'vortex-spiral':
          angle = Math.random() * Math.PI * 2;
          break;

        case 'fountain': {
          const baseAngle = ((config.emissionAngle - 90) * Math.PI) / 180;
          const spreadRad = (config.emissionSpread * Math.PI) / 180;
          angle = baseAngle + (Math.random() - 0.5) * spreadRad;
          break;
        }

        case 'directional-cone': {
          const baseAngle = (config.emissionAngle * Math.PI) / 180;
          const spreadRad = (config.emissionSpread * Math.PI) / 180;
          angle = baseAngle + (Math.random() - 0.5) * spreadRad;
          break;
        }

        case 'orbit':
          angle = Math.random() * Math.PI * 2;
          break;

        case 'trail':
        default:
          // Emit slightly behind movement direction + random spread
          if (Math.hypot(dx, dy) > 0.1) {
            const moveAngle = Math.atan2(dy, dx);
            angle = moveAngle + Math.PI + (Math.random() - 0.5) * ((config.emissionSpread * Math.PI) / 180);
          } else {
            angle = Math.random() * Math.PI * 2;
          }
          break;
      }
    }

    // Velocity inheritance
    let vx = Math.cos(angle) * speed + this.cursorVx * config.velocityInheritance * 0.15;
    let vy = Math.sin(angle) * speed + this.cursorVy * config.velocityInheritance * 0.15;

    // Jitter lifetime
    const maxLife = Math.round(
      Math.random() * (config.lifetimeMax - config.lifetimeMin) + config.lifetimeMin
    );

    // Initial color calculation
    this.globalHue = (this.globalHue + config.rainbowSpeed * 0.5) % 360;

    let initialColor = config.primaryColor;
    if (config.colorMode === 'rainbow-cycle') {
      initialColor = `hsl(${this.globalHue}, 90%, 60%)`;
    }

    const rotationSpeed =
      Math.random() * (config.rotationSpeedMax - config.rotationSpeedMin) + config.rotationSpeedMin;

    this.particles.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx,
      vy,
      size: config.startSize,
      startSize: config.startSize,
      peakSize: config.peakSize,
      endSize: config.endSize,
      alpha: config.startAlpha,
      startAlpha: config.startAlpha,
      peakAlpha: config.peakAlpha,
      endAlpha: config.endAlpha,
      color: initialColor,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      accentColor: config.accentColor,
      hue: this.globalHue,
      life: 0,
      maxLife,
      shape: config.shape,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed,
      turbulenceSeed: Math.random() * 100,
      orbitAngle: angle,
      orbitRadius: Math.random() * 20 + 10,
    });
  }

  // Update physics & render
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: ParticleFxConfig,
    cursorX: number = width / 2,
    cursorY: number = height / 2
  ) {
    const t0 = performance.now();

    ctx.save();
    ctx.globalCompositeOperation = config.blendMode;

    const gravityX = config.gravityX * 0.1;
    const gravityY = config.gravityY * 0.1;
    const drag = config.drag;
    const turbulence = config.turbulence;
    const vortexAttraction = config.vortexAttraction;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += 1;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      const progress = p.life / p.maxLife; // 0 to 1

      // 1. Gravity & Forces
      p.vx += gravityX;
      p.vy += gravityY;

      // 2. Drag / Air friction
      p.vx *= drag;
      p.vy *= drag;

      // 3. Turbulence / Curl Noise Jitter
      if (turbulence > 0) {
        const time = (p.life + p.turbulenceSeed) * 0.1;
        p.vx += Math.sin(time) * turbulence * 0.15;
        p.vy += Math.cos(time * 0.8) * turbulence * 0.15;
      }

      // 4. Vortex Attraction (Spin towards/around cursor)
      if (vortexAttraction !== 0) {
        const toCursorX = cursorX - p.x;
        const toCursorY = cursorY - p.y;
        const dist = Math.hypot(toCursorX, toCursorY);
        if (dist > 5 && dist < 300) {
          const normX = toCursorX / dist;
          const normY = toCursorY / dist;
          // Perpendicular tangential vector for orbit + centripetal pull
          const tanX = -normY;
          const tanY = normX;
          p.vx += (tanX * vortexAttraction * 0.8 + normX * 0.2);
          p.vy += (tanY * vortexAttraction * 0.8 + normY * 0.2);
        }
      }

      // Step position
      p.x += p.vx;
      p.y += p.vy;

      // Rotation
      p.rotation += p.rotationSpeed;

      // 5. Size Curve Evaluation
      switch (config.sizeCurve) {
        case 'grow-shrink':
          if (progress < 0.3) {
            p.size = p.startSize + (p.peakSize - p.startSize) * (progress / 0.3);
          } else {
            p.size = p.peakSize - (p.peakSize - p.endSize) * ((progress - 0.3) / 0.7);
          }
          break;

        case 'linear-shrink':
          p.size = p.startSize + (p.endSize - p.startSize) * progress;
          break;

        case 'pop-fade':
          p.size = progress < 0.15 ? p.peakSize : p.startSize * (1 - progress);
          break;

        case 'constant':
        default:
          p.size = p.startSize;
          break;
      }
      p.size = Math.max(0.2, p.size);

      // 6. Alpha / Opacity Curve Evaluation
      if (progress < 0.2) {
        p.alpha = p.startAlpha + (p.peakAlpha - p.startAlpha) * (progress / 0.2);
      } else {
        p.alpha = p.peakAlpha - (p.peakAlpha - p.endAlpha) * ((progress - 0.2) / 0.8);
      }
      p.alpha = Math.max(0, Math.min(1, p.alpha));

      // 7. Color Interpolation over Lifetime
      let currentColor = p.color;
      if (config.colorMode === 'gradient-lifetime') {
        if (progress < 0.5) {
          currentColor = interpolateHexColor(config.primaryColor, config.secondaryColor, progress / 0.5);
        } else {
          currentColor = interpolateHexColor(config.secondaryColor, config.accentColor, (progress - 0.5) / 0.5);
        }
      } else if (config.colorMode === 'rainbow-cycle') {
        const h = (p.hue + progress * 120) % 360;
        currentColor = `hsl(${h}, 90%, 60%)`;
      } else if (config.colorMode === 'speed-responsive') {
        const speedRatio = Math.min(1, this.cursorSpeed / 1200);
        currentColor = interpolateHexColor(config.primaryColor, config.accentColor, speedRatio);
      }

      // 8. Render Shape to Canvas
      this.drawShape(ctx, p, currentColor, config);
    }

    ctx.restore();

    this.activeCount = this.particles.length;
    this.frameTimeMs = Math.round((performance.now() - t0) * 100) / 100;
  }

  private drawShape(
    ctx: CanvasRenderingContext2D,
    p: CustomParticle,
    color: string,
    config: ParticleFxConfig
  ) {
    ctx.save();
    ctx.globalAlpha = p.alpha;

    if (config.glowBloom && config.glowRadius > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = config.glowRadius * (p.size / 6);
    }

    ctx.translate(p.x, p.y);
    if (p.rotation !== 0) {
      ctx.rotate(p.rotation);
    }

    const s = p.size;

    switch (p.shape) {
      case 'circle': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.5, s), 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'glow-disc': {
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, s * 1.5));
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, s * 1.5), 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'sparkle-star': {
        ctx.fillStyle = color;
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
        break;
      }

      case 'ring': {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, s * 0.25);
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'shard-crystal': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.2);
        ctx.lineTo(s * 0.6, -s * 0.2);
        ctx.lineTo(s * 0.4, s * 1.0);
        ctx.lineTo(-s * 0.4, s * 1.0);
        ctx.lineTo(-s * 0.6, -s * 0.2);
        ctx.closePath();
        ctx.fill();

        // Inner facet highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.2);
        ctx.lineTo(s * 0.6, -s * 0.2);
        ctx.lineTo(0, s * 1.0);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'plasma-orb': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();

        // Core highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-s * 0.25, -s * 0.25, s * 0.35, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'smoke-puff': {
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
        grad.addColorStop(0, color);
        grad.addColorStop(0.6, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'lightning-bolt': {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.2, s * 0.2);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 0.6, -s);
        ctx.lineTo(0, -s * 0.2);
        ctx.lineTo(-s * 0.3, 0);
        ctx.lineTo(s * 0.6, s);
        ctx.stroke();
        break;
      }

      case 'bubble': {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, s * 0.15);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Specular glint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(-s * 0.35, -s * 0.35, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'sakura-petal': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.bezierCurveTo(s * 0.8, -s * 0.8, s * 0.8, s * 0.6, 0, s);
        ctx.bezierCurveTo(-s * 0.8, s * 0.6, -s * 0.8, -s * 0.8, 0, -s);
        ctx.fill();
        break;
      }

      case 'rune': {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.2, s * 0.15);
        // Outer diamond
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s, 0);
        ctx.closePath();
        ctx.stroke();

        // Inner cross
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.6);
        ctx.lineTo(0, s * 0.6);
        ctx.moveTo(-s * 0.6, 0);
        ctx.lineTo(s * 0.6, 0);
        ctx.stroke();
        break;
      }

      case 'heart': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.4);
        ctx.bezierCurveTo(-s * 0.8, -s * 0.4, -s * 0.8, -s * 0.9, 0, -s * 0.3);
        ctx.bezierCurveTo(s * 0.8, -s * 0.9, s * 0.8, -s * 0.4, 0, s * 0.4);
        ctx.fill();
        break;
      }

      case 'diamond': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }

      default: {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }
}

// Helper: Hex color interpolation
function interpolateHexColor(c1: string, c2: string, factor: number): string {
  const f = Math.max(0, Math.min(1, factor));
  const rgb1 = hexToRgb(c1) || { r: 245, g: 158, b: 11 };
  const rgb2 = hexToRgb(c2) || { r: 251, g: 191, b: 36 };

  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * f);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * f);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * f);

  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  }
  return null;
}
