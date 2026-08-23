import { ColorPreset, FlarePreset, FxPreset } from '../types';

// Catalog of the demo panel's Effects tab chip grids — moved verbatim from
// the FX Studio tab of the (now removed) native-style settings window.

export const PASSIVE_PRESETS: { id: FxPreset; label: string; desc: string }[] = [
  { id: 'fluid-simulation', label: 'Fluid Simulation', desc: 'Velocity dissipation model' },
  { id: 'fluid-smoke', label: 'Fluid Smoke Swirl', desc: 'Billowing dye vortices' },
  { id: 'neon-fluid', label: 'Neon Fluid Dye', desc: 'Luminescent fluid glow' },
  { id: 'cosmic-vortex', label: 'Cosmic Liquid', desc: 'Galactic chromatic swirls' },
  { id: 'ink-diffusion', label: 'Ink Diffusion', desc: 'Organic watercolor plumes' },
  { id: 'spark-trail', label: 'Spark Trail', desc: 'Golden kinetic embers' },
  { id: 'glow-pulse', label: 'Glow Pulse', desc: 'Soft luminous aura trail' },
  { id: 'comet-trail', label: 'Comet Tail', desc: 'Aerodynamic ribbon' },
  { id: 'bubbles', label: 'Bubbles', desc: 'Translucent spheres' },
  { id: 'fireflies', label: 'Fireflies', desc: 'Organic bioluminescence' },
  { id: 'star-dust', label: 'Star Dust', desc: 'Twinkling 4-point stars' },
  { id: 'lightning', label: 'Lightning Arc', desc: 'Electric micro plasma' },
  { id: 'rainbow', label: 'Rainbow Wave', desc: 'Chromatic color shifts' },
  { id: 'plasma', label: 'Plasma Field', desc: 'Ionized energy rings' },
  { id: 'matrix-rain', label: 'Matrix Rain', desc: 'Cascading green code glyphs' },
  { id: 'fire-flame', label: 'Fire & Flame', desc: 'Blazing buoyant embers' },
  { id: 'neon-cyber', label: 'Neon Cyber', desc: 'Electric cyan-magenta pulses' },
  { id: 'magic-dust', label: 'Magic Dust', desc: 'Enchanted pastel shimmer' },
  { id: 'galaxy', label: 'Galaxy Supernova', desc: 'Deep-space stars & nebula' },
  { id: 'minimal-beacon', label: 'Minimalist Beacon', desc: 'Single subtle tracking dot' },
  { id: 'custom-fx', label: 'Custom FX', desc: 'Imported from the FX Designer' },
];

export const FLARE_PRESETS: { id: FlarePreset; label: string; desc: string }[] = [
  { id: 'solar-flare', label: 'Solar Flare', desc: 'Concentric shockwaves' },
  { id: 'fluid-vortex-burst', label: 'Fluid Vortex Burst', desc: 'Radial dye shockwave' },
  { id: 'sonar-radar', label: 'Sonar Radar', desc: 'Radar rings & reticle' },
  { id: 'neon-beacon', label: 'Neon Beacon', desc: 'Dual high-contrast rings' },
  { id: 'quantum-shockwave', label: 'Quantum Wave', desc: 'Relativistic expanding wave' },
  { id: 'supernova', label: 'Supernova', desc: 'Starry flash explosion' },
];

export const COLOR_PALETTES: { id: ColorPreset; label: string; color: string }[] = [
  { id: 'amber', label: 'Amber Flare', color: '#f59e0b' },
  { id: 'cyan', label: 'Cyber Cyan', color: '#06b6d4' },
  { id: 'emerald', label: 'Emerald Glow', color: '#10b981' },
  { id: 'violet', label: 'Electric Violet', color: '#8b5cf6' },
  { id: 'gold', label: 'Solar Gold', color: '#eab308' },
  { id: 'white', label: 'Pure White', color: '#ffffff' },
  { id: 'crimson', label: 'Crimson Fire', color: '#ef4444' },
];
