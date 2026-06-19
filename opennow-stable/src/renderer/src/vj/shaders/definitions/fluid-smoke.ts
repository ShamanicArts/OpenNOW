import type { ShaderDefinition } from '../types.js';

export const shader_fluid_smoke: ShaderDefinition = {
  id: 'fluid-smoke',
  name: 'Fluid Smoke',
  category: 'feedback',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Flow Speed', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Smoke Life', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Texel Scale', uniform: 'texelScale', type: 'float', min: 0.001, max: 0.02, default: 0.004, step: 0.001 },
      { name: 'Turbulence', uniform: 'turbulenceScale', type: 'float', min: 0.0, max: 0.02, default: 0.005, step: 0.001 },
      { name: 'Decay Min', uniform: 'decayMin', type: 'float', min: 0.5, max: 0.98, default: 0.85, step: 0.01 },
      { name: 'Decay Max', uniform: 'decayMax', type: 'float', min: 0.7, max: 0.999, default: 0.99, step: 0.001 },
    ],
  usesFeedback: true,
  fragmentBody: `
    vec2 uv = vUv;
    vec4 liveVid = texture2D(map, uv);
    vec2 texel = vec2(texelScale);
    float t = time * speed;

    // 1. Base upward flow
    float flowSpeed = param1 * 0.01 * intensity * (0.85 + 0.15 * sin(t));
    vec2 sampleUv = uv - vec2(0.0, flowSpeed);
    
    // 2. Self-advection (Curl Noise based on history brightness)
    float left  = dot(texture2D(feedbackTexture, sampleUv - vec2(texel.x, 0.0)).rgb, vec3(0.333));
    float right = dot(texture2D(feedbackTexture, sampleUv + vec2(texel.x, 0.0)).rgb, vec3(0.333));
    float down  = dot(texture2D(feedbackTexture, sampleUv - vec2(0.0, texel.y)).rgb, vec3(0.333));
    float up    = dot(texture2D(feedbackTexture, sampleUv + vec2(0.0, texel.y)).rgb, vec3(0.333));
    
    // Turbulence displacement
    sampleUv.x += (down - up) * turbulenceScale * intensity;
    sampleUv.y += (right - left) * turbulenceScale * intensity;
    
    // 3. Sample the displaced history
    vec4 history = texture2D(feedbackTexture, clamp(sampleUv, 0.0, 1.0));
    
    // 4. Decay history over time
    float decay = mix(decayMin, decayMax, param2);
    vec3 smoke = history.rgb * decay;
    
    // 5. Inject new video frames as light/heat sources
    vec3 result = max(smoke, liveVid.rgb);
    
    gl_FragColor = vec4(result, 1.0);
  
`,
};
