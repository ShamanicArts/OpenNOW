import type { ShaderDefinition } from '../types.js';

export const shader_vhs: ShaderDefinition = {
  id: 'vhs',
  name: 'VHS',
  category: 'glitch',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Noise', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Bleed', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Tear Threshold', uniform: 'tearThreshold', type: 'float', min: 0.5, max: 1.0, default: 0.96, step: 0.01 },
      { name: 'Tear Amount', uniform: 'tearAmount', type: 'float', min: 0.0, max: 0.2, default: 0.05, step: 0.005 },
      { name: 'Wobble Amount', uniform: 'wobbleAmount', type: 'float', min: 0.0, max: 0.05, default: 0.005, step: 0.001 },
      { name: 'Bleed Scale', uniform: 'bleedScale', type: 'float', min: 0.0, max: 0.1, default: 0.02, step: 0.001 },
    ],
  fragmentPreamble: `
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }
`,
  fragmentBody: `
    vec2 uv = vUv;
    float t = time * speed;
    
    // Horizontal tear lines
    float tearLine = step(tearThreshold, rand(vec2(floor(vUv.y * 50.0), floor(t * 3.0))));
    if (tearLine > 0.5) {
      uv.x += sin(t * 30.0) * intensity * tearAmount;
    }
    
    // Vertical wobble
    uv.y += sin(uv.x * 40.0 + t * 2.0) * intensity * wobbleAmount;
    
    // Noise
    float noise = rand(uv + t) * intensity * param1;
    
    // Color bleeding
    float bleed = sin(uv.y * 100.0 + t) * intensity * bleedScale * param2;
    vec4 color = texture2D(map, uv);
    color.r = texture2D(map, uv + vec2(bleed, 0.0)).r;
    color.b = texture2D(map, uv - vec2(bleed, 0.0)).b;
    
    // Add noise
    color.rgb += noise;
    
    // Slight desaturation and contrast boost
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(luma), color.rgb, 0.85);
    color.rgb = (color.rgb - 0.5) * 1.1 + 0.5;
    
    gl_FragColor = color;
  
`,
};
