import type { ShaderDefinition } from '../types.js';

export const shader_ripple: ShaderDefinition = {
  id: 'ripple',
  name: 'Ripple',
  category: 'distortion',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Frequency', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Waves', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Freq Min', uniform: 'freqMin', type: 'float', min: 1, max: 100, default: 20, step: 1 },
      { name: 'Freq Max', uniform: 'freqMax', type: 'float', min: 1, max: 120, default: 60, step: 1 },
      { name: 'Wave Scale', uniform: 'waveScale', type: 'float', min: 0.0, max: 0.1, default: 0.02, step: 0.005 },
      { name: 'Max Layers', uniform: 'maxLayers', type: 'float', min: 1, max: 8, default: 5, step: 1 },
    ],
  fragmentBody: `
    vec2 uv = vUv;
    float t = time * speed;
    
    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;
    float dist = length(delta);
    
    // Audio-reactive: bass increases wave intensity, mids increase frequency
    float audioMod = 1.0 + audioBass * 3.0;
    float freqMod = 1.0 + audioMid * 0.5;
    
    float freq = mix(freqMin, freqMax, param1) * freqMod;
    float waves = mix(2.0, maxLayers, param2);
    
    // Multiple ripple waves
    float wave = 0.0;
    for (float i = 1.0; i <= 8.0; i++) {
      if (i > waves) break;
      wave += sin(dist * freq * i - t * 4.0 * i) * intensity * waveScale * audioMod / i;
    }
    
    uv += delta * wave;
    uv = clamp(uv, 0.0, 1.0);
    
    gl_FragColor = texture2D(map, uv);
  
`,
};
