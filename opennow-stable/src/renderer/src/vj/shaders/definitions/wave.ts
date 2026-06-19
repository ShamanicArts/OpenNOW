import type { ShaderDefinition } from '../types.js';

export const shader_wave: ShaderDefinition = {
  id: 'wave',
  name: 'Wave',
  category: 'distortion',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Amplitude', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Frequency', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Amp Scale', uniform: 'ampScale', type: 'float', min: 0.0, max: 0.1, default: 0.03, step: 0.005 },
      { name: 'Freq Base', uniform: 'freqBase', type: 'float', min: 1, max: 50, default: 15, step: 1 },
      { name: 'Freq Range', uniform: 'freqRange', type: 'float', min: 0, max: 50, default: 20, step: 1 },
      { name: 'Layer2 Scale', uniform: 'layer2Scale', type: 'float', min: 0.0, max: 2.0, default: 0.5, step: 0.05 },
      { name: 'Layer3 Scale', uniform: 'layer3Scale', type: 'float', min: 0.0, max: 2.0, default: 0.4, step: 0.05 },
    ],
  fragmentBody: `
    vec2 uv = vUv;
    float t = time * speed;
    
    // Audio-reactive: bass increases amplitude, mids increase frequency
    float audioAmp = 1.0 + audioBass * 3.0 + audioLow * 0.5;
    float audioFreq = 1.0 + audioMid * 0.3;
    
    float amp = intensity * param1 * ampScale * audioAmp;
    float freq = (freqBase + param2 * freqRange) * audioFreq;
    
    // Multiple wave layers
    uv.x += sin(uv.y * freq + t * 3.0) * amp;
    uv.y += cos(uv.x * freq * 0.8 + t * 2.0) * amp * 0.7;
    
    uv.x += sin(uv.y * freq * 2.0 + t * 5.0) * amp * layer2Scale;
    uv.y += cos(uv.x * freq * 1.5 + t * 4.0) * amp * layer3Scale;
    
    uv = clamp(uv, 0.0, 1.0);
    gl_FragColor = texture2D(map, uv);
  
`,
};
