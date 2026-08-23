import { AppSettings } from '../types';

// Single source of truth for factory defaults: used both to seed a fresh
// install (App.tsx) and by Settings > Reset Defaults, so the two can't drift.
export const DEFAULT_SETTINGS: AppSettings = {
  enabled: true,
  startWithWindows: false,
  enablePassiveFx: true,
  passiveFx: 'spark-trail',
  findMouseFx: 'solar-flare',
  hotkey: 'Ctrl+Shift+F',
  intensity: 1.0,
  particleDensity: 5,
  trailLength: 25,
  animationSpeed: 1.0,
  colorPreset: 'amber',
  customColor: '#f59e0b',
  quickSwatches: ['#FF007F', '#3B82F6', '#14B8A6', '#F97316', '#A855F7', '#EF4444', '#FACC15', '#22C55E'],
  minMovementThreshold: 2,
  idleBurst: true,
  monitorCrossingFx: true,
  reducedMotion: false,
  soundFx: true,
  fpsLimit: 60,
  showDiagnostics: true,
  multiMonitorMode: false,
  desktopBackground: 'windows11-dark',
  fluidVorticity: 0.85,
  fluidDissipation: 0.96,
  fluidBloom: true,
  fluidRainbowDye: false,
  autoCheckUpdates: true,
  checkIntervalHours: 24,
  notifyOnUpdate: true,
  lastCheckedTimestamp: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
};
