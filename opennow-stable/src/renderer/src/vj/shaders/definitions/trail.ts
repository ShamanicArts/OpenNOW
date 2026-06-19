import type { ShaderDefinition } from '../types.js';

export const shader_trail: ShaderDefinition = {
  id: 'trail',
  name: 'Trail',
  category: 'feedback',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Length', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Fade', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Max Samples', uniform: 'maxSamples', type: 'float', min: 1, max: 16, default: 10, step: 1 },
      { name: 'Offset Scale', uniform: 'offsetScale', type: 'float', min: 0.0001, max: 0.02, default: 0.003, step: 0.0005 },
      { name: 'Fade Floor', uniform: 'fadeFloor', type: 'float', min: 0.0, max: 1.0, default: 0.5, step: 0.01 },
    ],
  fragmentBody: `
    float t = time * speed;
    vec4 color = vec4(0.0);
    
    // Simulate trail by sampling at time-offset positions
    // This creates a motion blur effect
    float trailLength = 1.0 + intensity * param1 * maxSamples;
    float fade = 1.0 - param2 * fadeFloor;
    
    for (float i = 0.0; i < 16.0; i++) {
      if (i >= trailLength) break;
      
      float offset = i * offsetScale * intensity;
      vec2 sampleUv = vUv;
      
      // Directional offset based on motion
      sampleUv.x += sin(t * 2.0 + i * 0.5) * offset;
      sampleUv.y += cos(t * 1.5 + i * 0.3) * offset;
      
      float weight = pow(fade, i);
      color += texture2D(map, clamp(sampleUv, 0.0, 1.0)) * weight;
    }
    
    color /= trailLength * 0.5;
    color.a = 1.0;
    
    gl_FragColor = color;
  
`,
};
