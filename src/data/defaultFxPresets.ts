import { ParticleFxConfig } from '../types/fxEditor';
import raw from '../../data/default-fx-presets.json';

// Canonical preset data lives in data/default-fx-presets.json — shared with
// both native apps via scripts/generate-fx-presets.mjs.
export const DEFAULT_FX_PRESETS: ParticleFxConfig[] = raw as ParticleFxConfig[];
