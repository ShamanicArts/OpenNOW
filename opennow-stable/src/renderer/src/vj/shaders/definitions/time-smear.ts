import type { ShaderDefinition } from '../types.js';

export const shader_time_smear: ShaderDefinition = {
  id: 'time-smear',
  name: 'Time Smear',
  category: 'feedback',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Angle', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Persistence', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],
  usesFeedback: true,
  fragmentBody: `
    vec2 uv = vUv;
    vec4 liveVid = texture2D(map, uv);

    // Base smear direction
    float angle = param1 * 6.2832;
    float drift = intensity * 0.015;
    float decay = 0.82 + param2 * 0.16;

    // --- Chromatic separation: each channel smears at a different angle ---
    // Creates prismatic/rainbow comet tails
    float spread = 0.15 * intensity; // angular spread between R/G/B
    
    vec2 dirR = vec2(cos(angle - spread), sin(angle - spread));
    vec2 dirG = vec2(cos(angle), sin(angle));
    vec2 dirB = vec2(cos(angle + spread), sin(angle + spread));

    // Primary smear per channel
    float hR = texture2D(feedbackTexture, clamp(uv - dirR * drift, 0.0, 1.0)).r * decay;
    float hG = texture2D(feedbackTexture, clamp(uv - dirG * drift, 0.0, 1.0)).g * decay;
    float hB = texture2D(feedbackTexture, clamp(uv - dirB * drift, 0.0, 1.0)).b * decay;

    // Secondary wider smear for soft falloff
    float wR = texture2D(feedbackTexture, clamp(uv - dirR * drift * 2.5, 0.0, 1.0)).r * decay * 0.85;
    float wG = texture2D(feedbackTexture, clamp(uv - dirG * drift * 2.5, 0.0, 1.0)).g * decay * 0.85;
    float wB = texture2D(feedbackTexture, clamp(uv - dirB * drift * 2.5, 0.0, 1.0)).b * decay * 0.85;

    vec3 trail = vec3(max(hR, wR), max(hG, wG), max(hB, wB));

    // Accumulate: brighter of live or trailed
    vec3 trailed = max(liveVid.rgb, trail);

    // Slight hue drift over time on the trails for extra psychedelia
    float timeTint = time * speed * 0.3;
    vec3 tint = vec3(
      0.5 + 0.5 * sin(timeTint),
      0.5 + 0.5 * sin(timeTint + 2.094),
      0.5 + 0.5 * sin(timeTint + 4.189)
    );
    // Only tint the trail portion, not the live video
    vec3 trailOnly = max(trail - liveVid.rgb, vec3(0.0));
    trailed += trailOnly * tint * intensity * 0.4;

    gl_FragColor = vec4(mix(liveVid.rgb, trailed, intensity), 1.0);
  
`,
};
