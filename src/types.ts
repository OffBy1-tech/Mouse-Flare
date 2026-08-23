import { ParticleFxConfig } from './types/fxEditor';

export type FxPreset = 
  | 'fluid-simulation'
  | 'spark-trail'
  | 'glow-pulse'
  | 'comet-trail'
  | 'bubbles'
  | 'fireflies'
  | 'star-dust'
  | 'lightning'
  | 'rainbow'
  | 'plasma'
  | 'matrix-rain'
  | 'fire-flame'
  | 'neon-cyber'
  | 'magic-dust'
  | 'galaxy'
  | 'minimal-beacon'
  | 'custom-fx'
  | 'fluid-smoke'
  | 'neon-fluid'
  | 'cosmic-vortex'
  | 'ink-diffusion';

export type FlarePreset = 
  | 'solar-flare'
  | 'sonar-radar'
  | 'neon-beacon'
  | 'quantum-shockwave'
  | 'supernova'
  | 'fluid-vortex-burst';

export type ColorPreset = 
  | 'amber'
  | 'cyan'
  | 'emerald'
  | 'violet'
  | 'gold'
  | 'white'
  | 'crimson'
  | 'custom';

export interface AppSettings {
  enabled: boolean;
  startWithWindows: boolean;
  enablePassiveFx: boolean;
  passiveFx: FxPreset;
  findMouseFx: FlarePreset;
  hotkey: string;
  intensity: number; // 0.5 to 2.0
  particleDensity: number; // 1 to 10
  trailLength: number; // 10 to 60
  animationSpeed: number; // 0.5 to 2.0
  colorPreset: ColorPreset;
  customColor: string;
  quickSwatches: string[]; // 8 user-editable swatches shared with the color pickers
  minMovementThreshold: number; // px
  idleBurst: boolean;
  monitorCrossingFx: boolean;
  reducedMotion: boolean;
  soundFx: boolean;
  fpsLimit: 60 | 120 | 0; // 0 = uncapped
  showDiagnostics: boolean;
  multiMonitorMode: boolean;
  desktopBackground: 'windows11-dark' | 'busy-editor' | 'dense-sheets' | 'multitasking' | 'light-workspace';
  // Fluid Simulation Controls (Pavel DoGreat inspired)
  fluidVorticity: number; // 0.1 to 2.0 (curling force)
  fluidDissipation: number; // 0.90 to 0.99 (smoke trail persistence)
  fluidBloom: boolean; // luminescent glowing dye
  fluidRainbowDye: boolean; // chromatic multi-hue cycling dye
  // Updates & Release Validation
  autoCheckUpdates: boolean;
  checkIntervalHours: number; // 6, 24, 72, or 0 for manual
  notifyOnUpdate: boolean;
  lastCheckedTimestamp?: number;
  // Custom Particle FX Designer
  customFxConfig?: ParticleFxConfig;
}

export interface MousePosition {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  vx: number;
  vy: number;
  speed: number;
  timestamp: number;
  monitorId: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  initialSize: number;
  alpha: number;
  initialAlpha: number;
  color: string;
  hue?: number;
  life: number;
  maxLife: number;
  decay: number;
  type: string;
  rotation?: number;
  rotationSpeed?: number;
  extra?: any;
}

export interface FlareRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  lineWidth: number;
  progress: number; // 0 to 1
  type: FlarePreset;
}

export interface FlareEvent {
  id: string;
  x: number;
  y: number;
  timestamp: number;
  preset: FlarePreset;
  color: string;
  durationMs: number;
}
