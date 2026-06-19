import type { ShaderDefinition } from '../types.js';

export const shader_edge_glow: ShaderDefinition = {
  id: 'edge-glow',
  name: 'Edge Glow',
  category: 'color',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Sensitivity', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Color Speed', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],
  fragmentBody: `
    float t = time * speed;
    vec2 texel = vec2(0.001 * (1.0 + param1));
    
    // Audio-reactive: bass increases edge intensity, high frequencies increase sensitivity
    float audioMod = 1.0 + audioBass * 2.0 + audioLow;
    float edgeAudio = 1.0 + audioHigh * 0.5;
    
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
    float edge = sqrt(gx*gx + gy*gy) * edgeAudio;
    
    // Colorful edge mask - audio-reactive color cycling
    float colorSpeed = param2 * (1.0 + audioMid);
    vec3 edgeColor = vec3(
      0.5 + 0.5 * sin(t * colorSpeed + edge * 10.0),
      0.5 + 0.5 * sin(t * colorSpeed * 1.3 + edge * 10.0 + 2.0),
      0.5 + 0.5 * sin(t * colorSpeed * 0.7 + edge * 10.0 + 4.0)
    );
    
    // Original content
    vec4 original = texture2D(map, vUv);
    
    // Edge as mask on top of original - audio boosts the effect
    float edgeMask = smoothstep(0.1, 0.5, edge * intensity * audioMod);
    vec3 color = mix(original.rgb, edgeColor, edgeMask * 0.8);
    
    gl_FragColor = vec4(color, 1.0);
  
`,
};
