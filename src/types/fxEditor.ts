export type ParticleShape = 
  | 'circle' 
  | 'sparkle-star' 
  | 'glow-disc' 
  | 'ring' 
  | 'shard-crystal' 
  | 'plasma-orb' 
  | 'smoke-puff' 
  | 'lightning-bolt' 
  | 'bubble' 
  | 'heart'
  | 'sakura-petal'
  | 'diamond'
  | 'rune';

export type BlendMode = 'source-over' | 'lighter' | 'screen' | 'color-dodge';

export type EmissionPattern = 
  | 'trail' 
  | 'radial-burst' 
  | 'vortex-spiral' 
  | 'fountain' 
  | 'orbit' 
  | 'directional-cone';

export type ColorMode = 
  | 'single' 
  | 'gradient-lifetime' 
  | 'rainbow-cycle' 
  | 'speed-responsive' 
  | 'multi-palette';

export type SizeCurve = 
  | 'linear-shrink' 
  | 'grow-shrink' 
  | 'constant' 
  | 'pop-fade';

export interface ColorStop {
  offset: number; // 0 to 1
  color: string;
}

export interface ParticleFxConfig {
  id: string;
  name: string;
  category: 'elemental' | 'cyber' | 'cosmic' | 'nature' | 'magic' | 'custom';
  description: string;
  author?: string;
  icon: string;
  isCustom?: boolean;
  
  // Emission & Spawning
  emissionPattern: EmissionPattern;
  spawnRateOnMove: number; // particles spawned per movement step (1 to 20)
  spawnBurstOnClick: number; // particles spawned on click (0 to 60)
  spawnRateIdle: number; // particles spawned per idle frame (0 to 5)
  emissionAngle: number; // 0 to 360 deg
  emissionSpread: number; // 0 to 360 deg
  velocityInheritance: number; // 0 to 1 (how much cursor velocity is imparted)
  
  // Particle Geometry & Shape
  shape: ParticleShape;
  blendMode: BlendMode;
  glowBloom: boolean;
  glowRadius: number; // 0 to 30px
  
  // Physics & Movement
  initialSpeedMin: number; // px/frame (0 to 15)
  initialSpeedMax: number;
  gravityX: number; // -3 to 3 (horizontal wind)
  gravityY: number; // -3 to 3 (vertical gravity: >0 falls, <0 rises)
  drag: number; // 0.85 to 1.0 (friction / air resistance)
  turbulence: number; // 0 to 5 (curl noise / Brownian jitter)
  vortexAttraction: number; // -3 to 3 (spiral pull towards or away from cursor)
  rotationSpeedMin: number; // deg/frame
  rotationSpeedMax: number;
  
  // Lifetime & Size
  lifetimeMin: number; // frames (10 to 120)
  lifetimeMax: number;
  startSize: number; // px (1 to 40)
  peakSize: number; // px
  endSize: number; // px
  sizeCurve: SizeCurve;
  
  // Colors & Transparency
  colorMode: ColorMode;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  colorStops?: ColorStop[];
  rainbowSpeed: number; // 0 to 10
  startAlpha: number; // 0 to 1
  peakAlpha: number; // 0 to 1
  endAlpha: number; // 0 to 1
  
  // Sound
  soundOnSpawn?: boolean;
}

export interface CustomParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  startSize: number;
  peakSize: number;
  endSize: number;
  alpha: number;
  startAlpha: number;
  peakAlpha: number;
  endAlpha: number;
  color: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  hue: number;
  life: number;
  maxLife: number;
  shape: ParticleShape;
  rotation: number;
  rotationSpeed: number;
  turbulenceSeed: number;
  orbitAngle?: number;
  orbitRadius?: number;
  extra?: any;
}
