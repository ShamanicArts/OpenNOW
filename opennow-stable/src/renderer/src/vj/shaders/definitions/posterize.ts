import type { ShaderDefinition } from '../types.js';

export const shader_posterize: ShaderDefinition = {
  id: 'posterize',
  name: 'Posterize',
  category: 'color',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Levels', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Color Shift', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],
  fragmentBody: `
    float t = time * speed;
    vec4 color = texture2D(map, vUv);
    
    // Dynamic posterization levels
    float levels = mix(16.0, 2.0, intensity * param1);
    levels = max(2.0, levels + sin(t) * 2.0);
    
    color.rgb = floor(color.rgb * levels) / levels;
    
    // Add some color shift
    color.r += sin(t + vUv.x * 10.0) * intensity * param2 * 0.1;
    color.b += cos(t + vUv.y * 10.0) * intensity * param2 * 0.1;
    
    gl_FragColor = color;
  
`,
};
