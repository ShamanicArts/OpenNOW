import type { ShaderDefinition } from '../types.js';

export const shader_chromatic: ShaderDefinition = {
  id: 'chromatic',
  name: 'Chromatic Aberration',
  category: 'color',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Aberration', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Pulse', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Aberration Scale', uniform: 'aberrationScale', type: 'float', min: 0.0, max: 0.2, default: 0.05, step: 0.005 },
      { name: 'Edge Boost', uniform: 'edgeBoost', type: 'float', min: 0.0, max: 2.0, default: 0.5, step: 0.05 },
      { name: 'Bass Gain', uniform: 'bassGain', type: 'float', min: 0.0, max: 4.0, default: 2.0, step: 0.1 },
      { name: 'Low Gain', uniform: 'lowGain', type: 'float', min: 0.0, max: 2.0, default: 0.5, step: 0.05 },
    ],
  fragmentBody: `
    vec2 center = vec2(0.5, 0.5);
    vec2 dir = vUv - center;
    float dist = length(dir);
    
    float baseAberr = param1 * aberrationScale;
    float pulse = 1.0 + param2 * sin(time * speed);
    // Audio-reactive: bass boosts aberration
    float audioMod = 1.0 + audioBass * bassGain + audioLow * lowGain;
    float aberration = intensity * baseAberr * pulse * audioMod;
    
    // Stronger aberration at edges
    aberration *= (edgeBoost + dist);
    
    float r = texture2D(map, vUv + dir * aberration).r;
    float g = texture2D(map, vUv).g;
    float b = texture2D(map, vUv - dir * aberration).b;
    
    gl_FragColor = vec4(r, g, b, 1.0);
  
`,
};
