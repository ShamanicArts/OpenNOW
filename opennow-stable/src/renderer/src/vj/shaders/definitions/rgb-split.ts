import type { ShaderDefinition } from '../types.js';

export const shader_rgb_split: ShaderDefinition = {
  id: 'rgb-split',
  name: 'RGB Split',
  category: 'color',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Distance', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Rotation', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],
  fragmentBody: `
    float t = time * speed;
    vec2 uv = vUv;
    
    // Animated split direction
    float angle = t * param2;
    vec2 dir = vec2(cos(angle), sin(angle));
    
    float split = intensity * 0.06 * param1;
    split += sin(t * 3.0) * 0.01;
    
    float r = texture2D(map, uv + dir * split).r;
    float g = texture2D(map, uv).g;
    float b = texture2D(map, uv - dir * split).b;
    
    vec4 color = vec4(r, g, b, 1.0);
    
    // Boost contrast
    color.rgb = (color.rgb - 0.5) * 1.2 + 0.5;
    
    gl_FragColor = color;
  
`,
};
