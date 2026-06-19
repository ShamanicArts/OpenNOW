import type { ShaderDefinition } from '../types.js';

export const shader_psychedelic: ShaderDefinition = {
  id: 'psychedelic',
  name: 'Psychedelic',
  category: 'color',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Warp', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Color Shift', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],
  fragmentBody: `
    vec2 uv = vUv;
    float t = time * speed;
    
    // Spiral warp
    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;
    float dist = length(delta);
    float angle = atan(delta.y, delta.x);
    
    // VR-safe: cap warp to avoid nausea-inducing distortion
    float warpAmount = param1 * intensity * 0.35;
    angle += sin(dist * 8.0 - t * 2.0) * warpAmount * 0.5;
    dist += sin(angle * 4.0 + t) * warpAmount * 0.05;
    
    uv = center + vec2(cos(angle), sin(angle)) * dist;
    uv = clamp(uv, 0.0, 1.0);
    
    vec4 color = texture2D(map, uv);
    
    // Color cycling based on position and time
    float hueShift = t * param2 * 0.5 + dist * 2.0;
    
    // Gentle hue rotation in RGB space — clamped to prevent blow-out
    float eff = intensity * 0.5;
    float c = cos(hueShift * eff);
    float s = sin(hueShift * eff);
    color.rgb = vec3(
      color.r * c - color.g * s * 0.5,
      color.r * s * 0.5 + color.g * c,
      color.b + sin(t + dist * 10.0) * eff * 0.3
    );
    color.rgb = clamp(color.rgb, 0.0, 1.0);
    
    // Subtle saturation boost
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(luma), color.rgb, 1.0 + eff * 0.4);
    
    gl_FragColor = color;
  
`,
};
