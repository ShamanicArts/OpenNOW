/**
 * Shader Registry - dynamic shader modules (ported 1:1 from prior implementation)
 */

import type { ShaderDefinition } from './types.js';

import { shader_none } from './definitions/none.js';
import { shader_chromatic } from './definitions/chromatic.js';
import { shader_glitch } from './definitions/glitch.js';
import { shader_vhs } from './definitions/vhs.js';
import { shader_psychedelic } from './definitions/psychedelic.js';
import { shader_ripple } from './definitions/ripple.js';
import { shader_pixelate_static } from './definitions/pixelate-static.js';
import { shader_rgb_split } from './definitions/rgb-split.js';
import { shader_wave } from './definitions/wave.js';
import { shader_posterize } from './definitions/posterize.js';
import { shader_trail } from './definitions/trail.js';
import { shader_trail_dissolve } from './definitions/trail-dissolve.js';
import { shader_edge_glow } from './definitions/edge-glow.js';
import { shader_edge_trails } from './definitions/edge-trails.js';
import { shader_luma_feedback } from './definitions/luma-feedback.js';
import { shader_neon_edge } from './definitions/neon-edge.js';
import { shader_datamosh } from './definitions/datamosh.js';
import { shader_fluid_smoke } from './definitions/fluid-smoke.js';
import { shader_pixel_sort } from './definitions/pixel-sort.js';
import { shader_fractal_echo } from './definitions/fractal-echo.js';
import { shader_time_smear } from './definitions/time-smear.js';
import { shader_optical_flow } from './definitions/optical-flow.js';
import { shader_kaleidoscope } from './definitions/kaleidoscope.js';

export const BASE_GLSL_UTILS = `
// Shared helpers can be added here when needed.
`;

export const SHADER_DEFINITIONS: Record<string, ShaderDefinition> = {
  'none': shader_none,
  'chromatic': shader_chromatic,
  'glitch': shader_glitch,
  'vhs': shader_vhs,
  'psychedelic': shader_psychedelic,
  'ripple': shader_ripple,
  'pixelate-static': shader_pixelate_static,
  'rgb-split': shader_rgb_split,
  'wave': shader_wave,
  'posterize': shader_posterize,
  'trail': shader_trail,
  'trail-dissolve': shader_trail_dissolve,
  'edge-glow': shader_edge_glow,
  'edge-trails': shader_edge_trails,
  'luma-feedback': shader_luma_feedback,
  'neon-edge': shader_neon_edge,
  'datamosh': shader_datamosh,
  'fluid-smoke': shader_fluid_smoke,
  'pixel-sort': shader_pixel_sort,
  'fractal-echo': shader_fractal_echo,
  'time-smear': shader_time_smear,
  'optical-flow': shader_optical_flow,
  'kaleidoscope': shader_kaleidoscope,
};

export function getAllShaderIds(): string[] { return Object.keys(SHADER_DEFINITIONS); }
export function getShader(id: string): ShaderDefinition | undefined { return SHADER_DEFINITIONS[id]; }
export function getShadersByCategory(category: ShaderDefinition['category']): ShaderDefinition[] {
  return Object.values(SHADER_DEFINITIONS).filter((s) => s.category === category);
}
export function getFeedbackShaders(): ShaderDefinition[] {
  return Object.values(SHADER_DEFINITIONS).filter((s) => s.usesFeedback);
}
