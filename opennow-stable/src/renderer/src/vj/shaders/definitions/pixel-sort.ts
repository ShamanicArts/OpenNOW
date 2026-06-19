import type { ShaderDefinition } from '../types.js';

export const shader_pixel_sort: ShaderDefinition = {
  id: 'pixel-sort',
  name: 'Pixel Sort',
  category: 'glitch',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Direction', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Threshold', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Threshold Base', uniform: 'thresholdBase', type: 'float', min: 0.0, max: 1.0, default: 0.05, step: 0.01 },
      { name: 'Threshold Range', uniform: 'thresholdRange', type: 'float', min: 0.0, max: 1.0, default: 0.6, step: 0.01 },
      { name: 'Max Displace', uniform: 'maxDisplace', type: 'float', min: 0.05, max: 1.0, default: 0.25, step: 0.01 },
      { name: 'Chroma Amount', uniform: 'chromaAmount', type: 'float', min: 0.0, max: 1.0, default: 0.015, step: 0.005 },
    ],
  usesFeedback: true,
  fragmentPreamble: `
  float getLuma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }
`,
  fragmentBody: `
    vec2 uv = vUv;
    vec4 liveVid = texture2D(map, uv);
    float luma = getLuma(liveVid.rgb);

    // Sort direction
    float angle = mix(0.0, 1.5708, param1);
    vec2 sortDir = vec2(cos(angle), sin(angle));

    // Threshold: pixels above this get sorted
    float thresh = thresholdBase + param2 * thresholdRange;
    float sortMask = smoothstep(thresh - 0.08, thresh + 0.08, luma);

    // --- Multi-step cascade: sample multiple positions along sort direction ---
    // This creates long sorted "runs" like real pixel sorting
    float maxDisp = intensity * maxDisplace; // much more aggressive range
    vec3 bestColor = liveVid.rgb;
    float bestLuma = luma;

    for (float i = 1.0; i <= 8.0; i++) {
      float d = i * maxDisp / 8.0;
      vec2 sampleUv = clamp(uv - sortDir * d, 0.0, 1.0);
      vec3 s = texture2D(map, sampleUv).rgb;
      float sl = getLuma(s);
      // Pull in brighter pixels from along the sort direction
      if (sl > bestLuma && sl > thresh) {
        bestLuma = sl;
        bestColor = s;
      }
    }

    // Chromatic separation on sorted pixels — R/G/B channels offset slightly
    float chromaOff = sortMask * intensity * chromaAmount;
    float sR = texture2D(map, clamp(uv - sortDir * maxDisp * 0.5 + vec2(chromaOff, 0.0), 0.0, 1.0)).r;
    float sB = texture2D(map, clamp(uv - sortDir * maxDisp * 0.5 - vec2(chromaOff, 0.0), 0.0, 1.0)).b;
    vec3 chromaSorted = vec3(sR, bestColor.g, sB);

    vec3 sorted = mix(bestColor, chromaSorted, 0.6);

    // --- Feedback: sorted streaks persist and drift ---
    vec2 feedbackUv = uv - sortDir * intensity * 0.02 * (0.5 + speed * 0.25);
    vec4 history = texture2D(feedbackTexture, clamp(feedbackUv, 0.0, 1.0));
    float decay = 0.88 + (1.0 - intensity) * 0.08;

    // History streaks only in sorted regions
    float histLuma = getLuma(history.rgb);
    float histMask = smoothstep(thresh - 0.08, thresh + 0.08, histLuma);
    vec3 streaked = history.rgb * decay;

    // Composite: sorted cascade + feedback streaks
    vec3 sortResult = mix(liveVid.rgb, sorted, sortMask);
    sortResult = max(sortResult, streaked * histMask * 0.7);

    // Final blend
    gl_FragColor = vec4(mix(liveVid.rgb, sortResult, intensity), 1.0);
  
`,
};
