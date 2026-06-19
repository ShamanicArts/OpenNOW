import type { ShaderDefinition } from '../types.js';

export const shader_trail_dissolve: ShaderDefinition = {
  id: 'trail-dissolve',
  name: 'Trail Dissolve',
  category: 'feedback',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Length', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Feedback', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Max Samples', uniform: 'maxSamples', type: 'float', min: 1, max: 16, default: 10, step: 1 },
      { name: 'Offset Scale', uniform: 'offsetScale', type: 'float', min: 0.0001, max: 0.02, default: 0.004, step: 0.0005 },
      { name: 'Noise Cutoff', uniform: 'noiseCutoff', type: 'float', min: 0.0, max: 1.0, default: 0.3, step: 0.01 },
      { name: 'Dissolve Min', uniform: 'dissolveMin', type: 'float', min: 0.0, max: 1.0, default: 0.3, step: 0.01 },
      { name: 'Dissolve Range', uniform: 'dissolveRange', type: 'float', min: 0.0, max: 1.0, default: 0.7, step: 0.01 },
    ],
  fragmentBody: `
    float t = time * speed;
    vec4 original = texture2D(map, vUv);
    
    // Build trail from dissolve particles
    vec3 trailAccum = vec3(0.0);
    float totalWeight = 0.0;
    float samples = 4.0 + param1 * maxSamples;
    float fade = 0.85;
    
    for (float i = 0.0; i < 16.0; i++) {
      if (i >= samples) break;
      
      float offset = i * offsetScale * intensity;
      vec2 sampleUv = vUv;
      
      sampleUv.x += sin(t * 2.0 + i * 0.5) * offset;
      sampleUv.y += cos(t * 1.5 + i * 0.3) * offset;
      
      // FIX: Renamed reserved keyword "sample" to "texColor"
      vec4 texColor = texture2D(map, clamp(sampleUv, 0.0, 1.0));
      
      // FIX: Wrapped float addition in vec2() for strict compiler compatibility
      float noise = fract(sin(dot(sampleUv * 30.0 + vec2(t + i * 0.1), vec2(12.9898, 78.233))) * 43758.5453);
      float dissolve = dissolveMin + dissolveRange * step(noiseCutoff, noise + param2 * 0.5);
      
      float weight = pow(fade, i) * dissolve;
      trailAccum += texColor.rgb * weight;
      totalWeight += weight;
    }
    
    // Always have some trail (minimum 0.3 blend)
    trailAccum = mix(original.rgb, trailAccum / max(totalWeight, 0.1), 0.7);
    
    // Current dissolve for intensity (Wrapped float addition in vec2() here as well)
    float curNoise = fract(sin(dot(vUv * 30.0 + vec2(t), vec2(12.9898, 78.233))) * 43758.5453);
    float curDissolve = 0.2 + 0.8 * step(0.3, curNoise + param2 * 0.5);
    
    // Trail intensity driven by dissolve
    float trailIntensity = min(curDissolve * intensity, 0.7);
    
    // Trails OVER original content
    gl_FragColor = vec4(mix(original.rgb, trailAccum, trailIntensity), 1.0);
  
`,
};
