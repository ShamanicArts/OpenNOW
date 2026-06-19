import type { ShaderDefinition } from '../types.js';

export const shader_pixelate_static: ShaderDefinition = {
  id: 'pixelate-static',
  name: 'Pixelate',
  category: 'color',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Size', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Animate', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Pixel Min', uniform: 'pixelMin', type: 'float', min: 0.00001, max: 0.01, default: 0.0001, step: 0.00005 },
      { name: 'Pixel Max', uniform: 'pixelMax', type: 'float', min: 0.001, max: 0.05, default: 0.01, step: 0.001 },
      { name: 'Anim Scale', uniform: 'animScale', type: 'float', min: 0.0, max: 0.01, default: 0.00005, step: 0.00005 },
    ],
  fragmentBody: `
    float t = time * speed;
    
    // Much smaller pixel range for fine control
    // param1 0-1 maps to 0.0001 (tiny) to 0.01 (blocky)
    float pixelSize = mix(pixelMin, pixelMax, param1);
    
    // Optional subtle animation
    pixelSize += sin(t) * animScale * param2;
    pixelSize = clamp(pixelSize, 0.0001, 0.02);
    
    vec2 uv = floor(vUv / pixelSize) * pixelSize + pixelSize * 0.5;
    vec4 base = texture2D(map, vUv);
    vec4 pix = texture2D(map, uv);

    gl_FragColor = mix(base, pix, intensity);
  
`,
};
