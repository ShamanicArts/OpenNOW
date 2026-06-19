import type { ShaderDefinition } from '../types.js';

export const shader_kaleidoscope: ShaderDefinition = {
  id: 'kaleidoscope',
  name: 'Kaleidoscope',
  category: 'distortion',
  parameters: [
      { name: 'Effect Mix', uniform: 'intensity', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Rotation Speed', uniform: 'speed', type: 'float', min: 0, max: 3, default: 1.0, step: 0.1 },
      { name: 'Segments', uniform: 'segments', type: 'float', min: 2, max: 16, default: 8, step: 1 },
      { name: 'Center Width', uniform: 'param1', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Crossfade', uniform: 'param2', type: 'float', min: 0, max: 1, default: 0.5, step: 0.01 },
      { name: 'Rotation Factor', uniform: 'rotationFactor', type: 'float', min: 0, max: 0.02, default: 0.002, step: 0.001 },
      { name: 'Min Width', uniform: 'centerMinWidth', type: 'float', min: 0.0, max: 0.5, default: 0.1, step: 0.01 },
      { name: 'Max Width', uniform: 'centerMaxWidth', type: 'float', min: 0.5, max: 1.0, default: 1.0, step: 0.01 },
      { name: 'Fade Width Max', uniform: 'fadeMaxWidth', type: 'float', min: 0.0, max: 1.0, default: 0.5, step: 0.01 },
    ],
  fragmentBody: `
    vec2 uv = vUv;
    
    // Detect which eye we're rendering for (SBS stereo)
    float eyeOffset = 0.0;
    float eyeScale = 1.0;
    bool isRightEye = uv.x > 0.5;
    
    if (isRightEye) {
      eyeOffset = 0.5;
      eyeScale = 2.0;
    } else if (uv.x < 0.5 && uv.x > 0.01) {
      eyeScale = 2.0;
    }
    
    // Get UV within this eye (0-1 range)
    vec2 eyeUv = vec2((uv.x - eyeOffset) * eyeScale, uv.y);
    
    // VIEWER POSITION: Full 360° azimuth around the sphere
    float viewAzimuth = eyeUv.x;
    float viewElevation = eyeUv.y;

    // Rotation in segment view space
    float rotation = time * speed * rotationFactor;
    viewAzimuth = fract(viewAzimuth + rotation);

    // Segment count
    float numSegments = max(2.0, floor(segments));

    // Which segment are we in?
    float segmentIndex = floor(viewAzimuth * numSegments);
    float inSegment = fract(viewAzimuth * numSegments);

    // CENTER CONTENT ONLY MAPPING:
    // Sample only from center of 180° video, never from sides
    // param1 controls how much of the center we show (0=very narrow, 1=full width)
    float centerWidth = centerMinWidth + param1 * (centerMaxWidth - centerMinWidth);

    // Center of 180° video is at 0.5 (within eye)
    float sourceCenter = 0.5;

    // Map inSegment (0-1) to a range around the center
    float sourceAzimuth = sourceCenter + (inSegment - 0.5) * centerWidth;
    sourceAzimuth = clamp(sourceAzimuth, 0.0, 1.0);
    
    // Convert to SBS stereo UV within the source video
    vec2 sampleUv;
    sampleUv.x = sourceAzimuth * 0.5 + eyeOffset;
    sampleUv.y = viewElevation;
    
    // Sample both videos from CENTER region only
    vec4 color1 = texture2D(map, sampleUv);
    vec4 color2 = texture2D(map2, sampleUv);
    
    // FADE BETWEEN VIDEOS based on param2
    // At segment boundary, fade between video 1 and 2
    float fadeWidth = fadeMaxWidth * param2;
    
    float useVideo2;
    if (fadeWidth < 0.01) {
      // Hard cut
      useVideo2 = mod(segmentIndex, 2.0);
    } else {
      // Smooth fade across segment boundary
      // Center of segment = pure video, edges = blend to other video
      float distFromCenter = abs(inSegment - 0.5) * 2.0; // 0 at center, 1 at edges
      
      // Which video is this segment?
      float thisVideo = mod(segmentIndex, 2.0);
      float nextVideo = mod(segmentIndex + 1.0, 2.0);
      
      // Fade to next video as we approach edge
      float fade = smoothstep(1.0 - fadeWidth, 1.0, distFromCenter);
      useVideo2 = mix(thisVideo, nextVideo, fade);
    }
    
    // Mix based on calculated blend
    vec4 result = mix(color1, color2, useVideo2);
    vec4 base = texture2D(map, vec2(eyeUv.x * 0.5 + eyeOffset, viewElevation));

    gl_FragColor = mix(base, result, intensity);
  
`,
};
