import type { ShaderDefinition } from '../types.js';

export const shader_glitch: ShaderDefinition = {
  id: 'glitch',
  name: 'Glitch',
  category: 'glitch',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Blocks', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Frequency', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Trigger Base', uniform: 'triggerBase', type: 'float', min: 0.5, max: 1.0, default: 0.95, step: 0.01 },
      { name: 'Bass Trigger Gain', uniform: 'bassTriggerGain', type: 'float', min: 0.0, max: 1.0, default: 0.3, step: 0.01 },
      { name: 'Scanline Freq', uniform: 'scanlineFreq', type: 'float', min: 20, max: 500, default: 200, step: 5 },
      { name: 'Scanline Amount', uniform: 'scanlineAmount', type: 'float', min: 0.0, max: 0.1, default: 0.01, step: 0.001 },
      { name: 'RGB Split Amount', uniform: 'rgbSplitAmount', type: 'float', min: 0.0, max: 0.1, default: 0.02, step: 0.001 },
    ],
  fragmentPreamble: `
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }
`,
  fragmentBody: `
    vec2 uv = vUv;
    float t = time * speed;
    float blocks = mix(5.0, 30.0, param1);
    float freq = mix(5.0, 30.0, param2);
    
    // Audio-reactive: bass increases glitch amount
    float audioMod = 1.0 + audioBass * 2.0 + audioLow;
    float glitchIntensity = intensity * audioMod;
    
    // Block glitch
    float blockY = floor(vUv.y * blocks) / blocks;
    float glitchTrigger = step(triggerBase - audioBass * bassTriggerGain, rand(vec2(blockY, floor(t * freq))));
    
    if (glitchTrigger > 0.5) {
      uv.x += (rand(vec2(blockY, t)) - 0.5) * glitchIntensity * 0.3;
    }
    
    // Scan line displacement
    float scanGlitch = sin(vUv.y * scanlineFreq + t * 5.0) * glitchIntensity * scanlineAmount;
    uv.x += scanGlitch * step(0.97, rand(vec2(floor(t * 20.0), vUv.y)));
    
    // Color channel split on glitch
    vec4 color = texture2D(map, uv);
    if (glitchTrigger > 0.5) {
      color.rgb = vec3(
        texture2D(map, uv + vec2(rgbSplitAmount * glitchIntensity, 0.0)).r,
        color.g,
        texture2D(map, uv - vec2(rgbSplitAmount * glitchIntensity, 0.0)).b
      );
    }
    
    gl_FragColor = color;
  
`,
};
