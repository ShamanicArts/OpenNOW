import type { ShaderDefinition } from '../types.js';

export const shader_edge_trails: ShaderDefinition = {
  id: 'edge-trails',
  name: 'Edge Trails',
  category: 'feedback',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Decay', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Color Shift', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],
  fragmentBody: `
    float t = time * speed;
    vec4 original = texture2D(map, vUv);
    
    // Build trail from edge samples over time
    vec3 trailAccum = vec3(0.0);
    float totalWeight = 0.0;
    float samples = 4.0 + param1 * 6.0;
    float fade = 0.85;
    vec2 texel = vec2(0.002);
    
    for (float i = 0.0; i < 8.0; i++) {
      if (i >= samples) break;
      
      // Historical offset
      vec2 offset = vec2(
        sin(t * 0.5 + i * 0.4) * 0.005 * i,
        cos(t * 0.4 + i * 0.3) * 0.005 * i
      );
      
      vec2 sampleUv = clamp(vUv + offset, 0.0, 1.0);
      
      // Sobel edge at this historical position
      float stl = dot(texture2D(map, sampleUv + vec2(-texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float stc = dot(texture2D(map, sampleUv + vec2(0.0, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float str = dot(texture2D(map, sampleUv + vec2(texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float sml = dot(texture2D(map, sampleUv + vec2(-texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
      float smr = dot(texture2D(map, sampleUv + vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
      float sbl = dot(texture2D(map, sampleUv + vec2(-texel.x, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float sbc = dot(texture2D(map, sampleUv + vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float sbr = dot(texture2D(map, sampleUv + vec2(texel.x, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      
      float sgx = -stl - 2.0*sml - sbl + str + 2.0*smr + sbr;
      float sgy = -stl - 2.0*stc - str + sbl + 2.0*sbc + sbr;
      float sEdge = sqrt(sgx*sgx + sgy*sgy);
      
      // EXACT color math from EdgeGlowFragment applied to the trail loop
      vec3 col = vec3(
        0.5 + 0.5 * sin(t * param2 + sEdge * 10.0),
        0.5 + 0.5 * sin(t * param2 * 1.3 + sEdge * 10.0 + 2.0),
        0.5 + 0.5 * sin(t * param2 * 0.7 + sEdge * 10.0 + 4.0)
      );
      
      float weight = pow(fade, i) * sEdge;
      trailAccum += col * weight;
      totalWeight += weight;
    }
    
    // Normalize trail
    if (totalWeight > 0.0) {
      trailAccum /= totalWeight;
    }
    
    // Current edge for intensity
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
    
    // Trail intensity based on edge
    float trailIntensity = min(edge * intensity * 2.0, 0.8);
    
    // Trails OVER original content
    gl_FragColor = vec4(mix(original.rgb, trailAccum, trailIntensity), 1.0);
  
`,
};
