import type { ShaderDefinition } from '../types.js';

export const shader_luma_feedback: ShaderDefinition = {
  id: 'luma-feedback',
  name: 'Luma Feedback',
  category: 'feedback',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Threshold', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Glow', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Threshold Base', uniform: 'thresholdBase', type: 'float', min: 0.0, max: 1.0, default: 0.3, step: 0.01 },
      { name: 'Threshold Range', uniform: 'thresholdRange', type: 'float', min: 0.0, max: 1.0, default: 0.3, step: 0.01 },
      { name: 'Glow Pulse', uniform: 'glowPulseAmount', type: 'float', min: 0.0, max: 1.0, default: 0.15, step: 0.01 },
    ],
  fragmentBody: `
    vec4 color = texture2D(map, vUv);
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    float threshold = thresholdBase - param1 * thresholdRange;
    float glowPulse = (1.0 - glowPulseAmount) + glowPulseAmount * sin(time * speed);
    float glow = param2 * intensity * glowPulse;
    
    // Bloom bright areas
    if (luma > threshold) {
      float brightness = (luma - threshold) / (1.0 - threshold);
      color.rgb += color.rgb * brightness * glow;
    }
    
    gl_FragColor = color;
  
`,
};
