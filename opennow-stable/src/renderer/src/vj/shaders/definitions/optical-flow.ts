import type { ShaderDefinition } from '../types.js';

export const shader_optical_flow: ShaderDefinition = {
  id: 'optical-flow',
  name: 'Optical Flow',
  category: 'feedback',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.001 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Sensitivity', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Advection', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Offset Base', uniform: 'offsetBase', type: 'float', min: 0.001, max: 0.02, default: 0.004, step: 0.001 },
      { name: 'Offset Scale', uniform: 'offsetScale', type: 'float', min: 0.0, max: 0.02, default: 0.008, step: 0.001 },
      { name: 'Smoothness', uniform: 'lambda', type: 'float', min: 0.001, max: 0.05, default: 0.005, step: 0.001 },
      { name: 'Overlay Gain', uniform: 'overlayGain', type: 'float', min: 0.1, max: 2.0, default: 0.7, step: 0.05 },
      { name: 'Mask Min', uniform: 'maskMin', type: 'float', min: 0.0, max: 0.02, default: 0.001, step: 0.001 },
      { name: 'Mask Max', uniform: 'maskMax', type: 'float', min: 0.005, max: 0.1, default: 0.02, step: 0.001 },
    ],
  usesFeedback: true,
  fragmentPreamble: `
  float luma(vec4 c) {
    return dot(c.rgb, vec3(0.299, 0.587, 0.114));
  }
`,
  fragmentBody: `
    vec2 uv = vUv;
    vec4 liveVid = texture2D(map, uv);

    // Rescale intensity: 100x lower than previous tuning
    float eff = intensity * 0.0003;

    // --- Horn-Schunck optical flow ---
    float offset = offsetBase + param1 * offsetScale;

    float nextR = luma(texture2D(map, uv + vec2(offset, 0.0)));
    float nextL = luma(texture2D(map, uv - vec2(offset, 0.0)));
    float nextU = luma(texture2D(map, uv + vec2(0.0, offset)));
    float nextD = luma(texture2D(map, uv - vec2(0.0, offset)));

    float pastR = luma(texture2D(feedbackTexture, uv + vec2(offset, 0.0)));
    float pastL = luma(texture2D(feedbackTexture, uv - vec2(offset, 0.0)));
    float pastU = luma(texture2D(feedbackTexture, uv + vec2(0.0, offset)));
    float pastD = luma(texture2D(feedbackTexture, uv - vec2(0.0, offset)));

    float gradX = (nextR - nextL) + (pastR - pastL);
    float gradY = (nextU - nextD) + (pastU - pastD);
    float gradMag = sqrt(gradX * gradX + gradY * gradY + lambda);

    float curr = luma(liveVid);
    float prev = luma(texture2D(feedbackTexture, uv));
    float diff = curr - prev;

    vec2 flow = vec2(diff * gradX / gradMag, diff * gradY / gradMag);

    // --- Advect feedback along flow ---
    float advectStrength = param2 * eff * 5.0 * (0.5 + speed * 0.25);
    vec2 advectedUv = uv - flow * advectStrength;
    vec4 advected = texture2D(feedbackTexture, clamp(advectedUv, 0.0, 1.0));

    float decay = 0.92 + (1.0 - eff * 33.0) * 0.06;
    advected.rgb *= clamp(decay, 0.85, 0.98);

    // --- Flow visualization: angle → hue, magnitude → brightness ---
    float flowPower = length(flow);
    float flowAngle = atan(flow.y, flow.x);

    float hue = flowAngle / 6.2832 + 0.5;
    float sat = 0.85 * clamp(flowPower * 80.0, 0.0, 1.0);
    float lit = 0.5 * clamp(flowPower * 60.0, 0.0, 1.0);

    float ch = (1.0 - abs(2.0 * lit - 1.0)) * sat;
    float xh = ch * (1.0 - abs(mod(hue * 6.0, 2.0) - 1.0));
    float mh = lit - ch * 0.5;
    vec3 flowColor;
    float h6 = hue * 6.0;
    if (h6 < 1.0) flowColor = vec3(ch, xh, 0.0);
    else if (h6 < 2.0) flowColor = vec3(xh, ch, 0.0);
    else if (h6 < 3.0) flowColor = vec3(0.0, ch, xh);
    else if (h6 < 4.0) flowColor = vec3(0.0, xh, ch);
    else if (h6 < 5.0) flowColor = vec3(xh, 0.0, ch);
    else flowColor = vec3(ch, 0.0, xh);
    flowColor += mh;

    // --- Composite ---
    vec3 base = max(liveVid.rgb, advected.rgb);
    // Keep optical-flow overlay 100x+ lower than previous intensity behavior
    float flowMask = smoothstep(maskMin, maskMax, flowPower) * (eff * 36.0);
    vec3 result = mix(base, base + flowColor * overlayGain, clamp(flowMask, 0.0, 1.0));

    gl_FragColor = vec4(result, 1.0);
  
`,
};
