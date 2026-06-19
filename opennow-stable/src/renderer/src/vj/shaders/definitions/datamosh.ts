import type { ShaderDefinition } from '../types.js';

export const shader_datamosh: ShaderDefinition = {
  id: 'datamosh',
  name: 'Datamosh',
  category: 'glitch',
  parameters: [
      { name: 'Intensity', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Edge Protect', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Smear', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Edge Min', uniform: 'edgeMin', type: 'float', min: 0.01, max: 0.5, default: 0.15, step: 0.01 },
      { name: 'Edge Max Base', uniform: 'edgeMaxBase', type: 'float', min: 0.1, max: 1.5, default: 0.6, step: 0.01 },
      { name: 'Smear Scale', uniform: 'smearScale', type: 'float', min: 0.005, max: 0.2, default: 0.06, step: 0.005 },
    ],
  usesFeedback: true,
  fragmentBody: `
    vec2 uv = vUv;

    // --- Live video & history ---
    vec4 liveVid = texture2D(map, uv);
    vec4 history = texture2D(feedbackTexture, uv);

    // --- Blurred Sobel edge detection on live video ---
    // Wide texel step produces a soft, forgiving edge mask
    vec2 t = vec2(0.006);
    float tl = dot(texture2D(map, uv + vec2(-t.x, -t.y)).rgb, vec3(0.299, 0.587, 0.114));
    float tc = dot(texture2D(map, uv + vec2( 0.0, -t.y)).rgb, vec3(0.299, 0.587, 0.114));
    float tr = dot(texture2D(map, uv + vec2( t.x, -t.y)).rgb, vec3(0.299, 0.587, 0.114));
    float ml = dot(texture2D(map, uv + vec2(-t.x,  0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float mr = dot(texture2D(map, uv + vec2( t.x,  0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float bl = dot(texture2D(map, uv + vec2(-t.x,  t.y)).rgb, vec3(0.299, 0.587, 0.114));
    float bc = dot(texture2D(map, uv + vec2( 0.0,  t.y)).rgb, vec3(0.299, 0.587, 0.114));
    float br = dot(texture2D(map, uv + vec2( t.x,  t.y)).rgb, vec3(0.299, 0.587, 0.114));

    float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
    float edge = sqrt(gx*gx + gy*gy);

    // param1 controls how strongly edges resist moshing (0 = edges mosh too, 1 = edges fully protected)
    float edgeProtect = smoothstep(edgeMin, edgeMaxBase + param1 * 0.8, edge);

    // --- Optical flow from history buffer ---
    vec2 ft = vec2(0.004);
    float fn = dot(texture2D(feedbackTexture, uv + vec2(0.0, ft.y)).rgb, vec3(0.333));
    float fs = dot(texture2D(feedbackTexture, uv - vec2(0.0, ft.y)).rgb, vec3(0.333));
    float fe = dot(texture2D(feedbackTexture, uv + vec2(ft.x, 0.0)).rgb, vec3(0.333));
    float fw = dot(texture2D(feedbackTexture, uv - vec2(ft.x, 0.0)).rgb, vec3(0.333));
    vec2 flow = vec2(fe - fw, fn - fs);

    // Tighter smear — subtler, more like real codec P-frame drift
    float smearAmt = param2 * intensity * smearScale * (0.5 + speed * 0.25);
    vec2 smearUv = uv - flow * smearAmt;
    vec4 moshed = texture2D(feedbackTexture, clamp(smearUv, 0.0, 1.0));

    // --- Temporal diff: how much has changed since last frame ---
    float diff = distance(liveVid.rgb, history.rgb);
    // High threshold — normal video motion (0.1-0.3) should NOT force refresh.
    // Only big scene changes / cuts (>0.4) punch through as I-frames.
    float refreshMask = smoothstep(0.3, 0.6, diff);

    // --- Final blend ---
    // edgeProtect: 1 where edges are → force live video
    // refreshMask: 1 where change detected → force live video
    // Mosh only survives where both are low (flat + static)
    float liveMix = max(edgeProtect, refreshMask);
    // Intensity scales how much mosh is allowed at all
    liveMix = mix(1.0, liveMix, intensity);

    gl_FragColor = vec4(mix(moshed.rgb, liveVid.rgb, liveMix), 1.0);
  
`,
};
