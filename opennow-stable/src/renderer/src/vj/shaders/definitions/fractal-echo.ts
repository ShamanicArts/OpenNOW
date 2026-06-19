import type { ShaderDefinition } from '../types.js';

export const shader_fractal_echo: ShaderDefinition = {
  id: 'fractal-echo',
  name: 'Fractal Echo',
  category: 'feedback',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Zoom', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Spin + Color', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],
  usesFeedback: true,
  fragmentPreamble: `
  // Attempt hue rotation in RGB space (Rodrigues-style)
  vec3 hueShift(vec3 col, float shift) {
    float cosA = cos(shift);
    float sinA = sin(shift);
    // Rotate around (1,1,1) axis
    vec3 k = vec3(0.57735); // normalized (1,1,1)
    return col * cosA + cross(k, col) * sinA + k * dot(k, col) * (1.0 - cosA);
  }
`,
  fragmentBody: `
    vec2 uv = vUv;
    vec4 liveVid = texture2D(map, uv);

    // Center-relative coords for zoom + rotate
    vec2 center = uv - 0.5;

    // Zoom: shrink toward center each frame
    float zoom = 1.0 - (0.005 + param1 * 0.025) * intensity;
    center *= zoom;

    // Rotate: accumulates into spirals
    float angle = (0.003 + param2 * 0.02) * intensity * speed;
    float co = cos(angle);
    float si = sin(angle);
    center = vec2(center.x * co - center.y * si, center.x * si + center.y * co);

    vec2 feedbackUv = clamp(center + 0.5, 0.0, 1.0);
    vec4 history = texture2D(feedbackTexture, feedbackUv);

    // --- Hue shift the feedback: each recursion layer rotates color ---
    // This is what makes it psychedelic — the tunnel spirals through rainbow
    float hueAngle = (0.03 + param2 * 0.12) * intensity * speed;
    history.rgb = hueShift(history.rgb, hueAngle);

    // Slight saturation boost to keep colors vivid through recursion
    float histLuma = dot(history.rgb, vec3(0.299, 0.587, 0.114));
    history.rgb = mix(vec3(histLuma), history.rgb, 1.15);

    // Decay: prevent blowout but keep it vibrant
    float decay = 0.90 + (1.0 - intensity) * 0.07;
    history.rgb *= decay;
    history.rgb = clamp(history.rgb, 0.0, 1.0);

    // Edge injection: live video at edges, feedback tunnel in center
    float edgeDist = length(uv - 0.5) * 2.0;
    float liveMix = smoothstep(0.2, 0.85, edgeDist);
    liveMix = max(liveMix, 1.0 - intensity);

    // Blend: luminance-aware — brighter of live or shifted feedback
    vec3 blended = max(liveVid.rgb, history.rgb);
    vec3 result = mix(history.rgb, blended, liveMix);

    gl_FragColor = vec4(result, 1.0);
  
`,
};
