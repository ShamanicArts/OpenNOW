import type { ShaderDefinition } from '../types.js';

export const shader_neon_edge: ShaderDefinition = {
  id: 'neon-edge',
  name: 'Neon Edge',
  category: 'color',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Thickness', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Glow', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],
  fragmentBody: `
    float t = time * speed;
    vec2 texel = vec2(0.002 * (1.0 + param1));
    
    // Sobel edge detection
    float tl = dot(texture2D(map, vUv + vec2(-texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float tc = dot(texture2D(map, vUv + vec2(0.0, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float tr = dot(texture2D(map, vUv + vec2(texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float ml = dot(texture2D(map, vUv + vec2(-texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float mr = dot(texture2D(map, vUv + vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float bl = dot(texture2D(map, vUv + vec2(-texel.x, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float bc = dot(texture2D(map, vUv + vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float br = dot(texture2D(map, vUv + vec2(texel.x, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    
    float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
    float edge = sqrt(gx*gx + gy*gy);
    
    vec4 orig = texture2D(map, vUv);
    
    // Animated neon color
    vec3 neon = vec3(
      0.5 + 0.5 * sin(t + vUv.x * 5.0),
      0.5 + 0.5 * sin(t * 1.3 + vUv.y * 5.0),
      0.5 + 0.5 * sin(t * 0.7 + (vUv.x + vUv.y) * 5.0)
    );
    
    // Edge strength
    float strength = edge * intensity * 5.0;
    strength = clamp(strength, 0.0, 1.0);
    
    // Mix: edges get neon color, non-edges get dimmed original
    vec3 color = mix(orig.rgb * 0.15, neon, strength);
    
    // Add glow
    color += neon * edge * param2 * intensity * 0.3;
    
    gl_FragColor = vec4(color, 1.0);
  
`,
};
