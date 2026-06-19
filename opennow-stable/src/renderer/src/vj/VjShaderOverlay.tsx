import { useEffect, useRef } from "react";
import type { JSX } from "react";
import GUI from "lil-gui";
import "./lil-gui.css";

const STORAGE_KEY = "opennow.vjOverlay";

type VjShaderMode =
  | "none"
  | "rgb-split"
  | "chromatic"
  | "vhs"
  | "glitch"
  | "ripple"
  | "wave"
  | "psychedelic"
  | "posterize"
  | "pixelate"
  | "edge-glow"
  | "neon-edge"
  | "heat"
  | "kaleidoscope"
  | "pixel-sort-lite";

interface VjShaderSettings {
  enabled: boolean;
  showGui: boolean;
  mode: VjShaderMode;
  opacity: number;
  intensity: number;
  speed: number;
  param1: number;
  param2: number;
}

interface VjShaderOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean;
}

const MODE_TO_ID: Record<VjShaderMode, number> = {
  none: 0,
  "rgb-split": 1,
  chromatic: 2,
  vhs: 3,
  glitch: 4,
  ripple: 5,
  wave: 6,
  psychedelic: 7,
  posterize: 8,
  pixelate: 9,
  "edge-glow": 10,
  "neon-edge": 11,
  heat: 12,
  kaleidoscope: 13,
  "pixel-sort-lite": 14,
};

const DEFAULT_SETTINGS: VjShaderSettings = {
  enabled: false,
  showGui: false,
  mode: "rgb-split",
  opacity: 1,
  intensity: 0.45,
  speed: 1,
  param1: 0.5,
  param2: 0.5,
};

function loadSettings(): VjShaderSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<VjShaderSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      mode: typeof parsed.mode === "string" && parsed.mode in MODE_TO_ID ? parsed.mode as VjShaderMode : DEFAULT_SETTINGS.mode,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: VjShaderSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures; the live controls still work.
  }
}

const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform sampler2D u_video;
uniform vec2 u_resolution;
uniform float u_time;
uniform int u_mode;
uniform float u_opacity;
uniform float u_intensity;
uniform float u_speed;
uniform float u_param1;
uniform float u_param2;
varying vec2 v_uv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 rgbSplit(vec2 uv, float amount) {
  vec2 dir = vec2(cos(u_time * u_speed), sin(u_time * u_speed * 0.73));
  vec2 off = dir * amount;
  float r = texture2D(u_video, clamp(uv + off, 0.0, 1.0)).r;
  float g = texture2D(u_video, uv).g;
  float b = texture2D(u_video, clamp(uv - off, 0.0, 1.0)).b;
  return vec3(r, g, b);
}

vec3 vhs(vec2 uv) {
  float t = u_time * u_speed;
  float line = sin((uv.y * u_resolution.y) * 1.7 + t * 18.0);
  float scan = 1.0 - 0.08 * u_intensity + line * 0.035 * u_intensity;
  float band = step(0.985 - u_intensity * 0.04, hash(vec2(floor(uv.y * 90.0), floor(t * 8.0))));
  float tear = (hash(vec2(floor(uv.y * 64.0), floor(t * 10.0))) - 0.5) * band * 0.09 * u_intensity;
  vec2 warped = vec2(uv.x + tear + sin(uv.y * 80.0 + t * 5.0) * 0.002 * u_param1 * u_intensity, uv.y);
  vec3 color = rgbSplit(warped, 0.004 * u_intensity * (0.5 + u_param1));
  float noise = (hash(uv * u_resolution.xy + t) - 0.5) * 0.18 * u_param2 * u_intensity;
  return color * scan + noise;
}

vec3 edgeGlow(vec2 uv) {
  vec2 px = 1.0 / max(u_resolution, vec2(1.0));
  vec3 c = texture2D(u_video, uv).rgb;
  float tl = luma(texture2D(u_video, uv + px * vec2(-1.0, -1.0)).rgb);
  float tc = luma(texture2D(u_video, uv + px * vec2( 0.0, -1.0)).rgb);
  float tr = luma(texture2D(u_video, uv + px * vec2( 1.0, -1.0)).rgb);
  float ml = luma(texture2D(u_video, uv + px * vec2(-1.0,  0.0)).rgb);
  float mr = luma(texture2D(u_video, uv + px * vec2( 1.0,  0.0)).rgb);
  float bl = luma(texture2D(u_video, uv + px * vec2(-1.0,  1.0)).rgb);
  float bc = luma(texture2D(u_video, uv + px * vec2( 0.0,  1.0)).rgb);
  float br = luma(texture2D(u_video, uv + px * vec2( 1.0,  1.0)).rgb);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float edge = smoothstep(u_param1 * 0.35, u_param1 * 0.35 + 0.28, length(vec2(gx, gy)));
  vec3 glow = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + u_time * u_speed + edge * 4.0);
  return c + glow * edge * u_intensity * (0.5 + u_param2 * 2.0);
}

vec3 glitch(vec2 uv) {
  float t = floor(u_time * (4.0 + u_speed * 18.0));
  float row = floor(uv.y * (18.0 + u_param1 * 120.0));
  float trigger = step(0.72 - u_intensity * 0.35, hash(vec2(row, t)));
  float shift = (hash(vec2(row, t + 17.0)) - 0.5) * trigger * u_intensity * (0.02 + u_param2 * 0.14);
  vec2 guv = vec2(fract(uv.x + shift), uv.y);
  vec3 color = rgbSplit(guv, abs(shift) * 0.35 + 0.002 * u_intensity);
  float block = step(0.965, hash(floor(uv * vec2(80.0, 45.0)) + t));
  color = mix(color, color.bgr, block * u_intensity);
  return color;
}

vec3 heat(vec2 uv) {
  vec3 c = texture2D(u_video, uv).rgb;
  float y = luma(c);
  vec3 cold = vec3(0.05, 0.1, 0.45);
  vec3 mid = vec3(0.95, 0.15, 0.55);
  vec3 hot = vec3(1.0, 0.88, 0.18);
  vec3 ramp = mix(cold, mid, smoothstep(0.0, 0.65, y));
  ramp = mix(ramp, hot, smoothstep(0.45, 1.0, y));
  float pulse = 0.5 + 0.5 * sin(u_time * u_speed * 3.0 + y * 10.0);
  return mix(c, ramp + pulse * 0.08 * u_param2, u_intensity * (0.35 + u_param1 * 0.65));
}

vec3 chromatic(vec2 uv) {
  vec2 center = vec2(0.5);
  vec2 dir = uv - center;
  float dist = length(dir);
  float pulse = 1.0 + u_param2 * sin(u_time * u_speed);
  float aberration = u_intensity * u_param1 * 0.05 * pulse * (0.5 + dist);
  float r = texture2D(u_video, clamp(uv + dir * aberration, 0.0, 1.0)).r;
  float g = texture2D(u_video, uv).g;
  float b = texture2D(u_video, clamp(uv - dir * aberration, 0.0, 1.0)).b;
  return vec3(r, g, b);
}

vec3 ripple(vec2 uv) {
  float t = u_time * u_speed;
  vec2 center = vec2(0.5);
  vec2 delta = uv - center;
  float dist = length(delta);
  float freq = mix(20.0, 60.0, u_param1);
  float waves = mix(2.0, 8.0, u_param2);
  float wave = 0.0;
  for (float i = 1.0; i <= 8.0; i++) {
    if (i > waves) break;
    wave += sin(dist * freq * i - t * 4.0 * i) * u_intensity * 0.02 / i;
  }
  return texture2D(u_video, clamp(uv + delta * wave, 0.0, 1.0)).rgb;
}

vec3 waveFx(vec2 uv) {
  float t = u_time * u_speed;
  float amp = u_intensity * u_param1 * 0.03;
  float freq = 15.0 + u_param2 * 20.0;
  uv.x += sin(uv.y * freq + t * 3.0) * amp;
  uv.y += cos(uv.x * freq * 0.8 + t * 2.0) * amp * 0.7;
  uv.x += sin(uv.y * freq * 2.0 + t * 5.0) * amp * 0.5;
  uv.y += cos(uv.x * freq * 1.5 + t * 4.0) * amp * 0.4;
  return texture2D(u_video, clamp(uv, 0.0, 1.0)).rgb;
}

vec3 psychedelic(vec2 uv) {
  float t = u_time * u_speed;
  vec2 center = vec2(0.5);
  vec2 delta = uv - center;
  float dist = length(delta);
  float angle = atan(delta.y, delta.x);
  float warpAmount = u_param1 * u_intensity * 0.35;
  angle += sin(dist * 8.0 - t * 2.0) * warpAmount * 0.5;
  dist += sin(angle * 4.0 + t) * warpAmount * 0.05;
  uv = clamp(center + vec2(cos(angle), sin(angle)) * dist, 0.0, 1.0);
  vec3 color = texture2D(u_video, uv).rgb;
  float hueShift = t * u_param2 * 0.5 + dist * 2.0;
  float eff = u_intensity * 0.5;
  float c = cos(hueShift * eff);
  float s = sin(hueShift * eff);
  color = vec3(color.r * c - color.g * s * 0.5, color.r * s * 0.5 + color.g * c, color.b + sin(t + dist * 10.0) * eff * 0.3);
  float y = luma(color);
  return clamp(mix(vec3(y), color, 1.0 + eff * 0.4), 0.0, 1.0);
}

vec3 posterize(vec2 uv) {
  float t = u_time * u_speed;
  vec3 color = texture2D(u_video, uv).rgb;
  float levels = max(2.0, mix(16.0, 2.0, u_intensity * u_param1) + sin(t) * 2.0);
  color = floor(color * levels) / levels;
  color.r += sin(t + uv.x * 10.0) * u_intensity * u_param2 * 0.1;
  color.b += cos(t + uv.y * 10.0) * u_intensity * u_param2 * 0.1;
  return clamp(color, 0.0, 1.0);
}

vec3 pixelate(vec2 uv) {
  float pixelSize = mix(0.0005, 0.035, u_param1);
  pixelSize += sin(u_time * u_speed) * 0.001 * u_param2;
  pixelSize = clamp(pixelSize, 0.0005, 0.05);
  vec2 pixUv = floor(uv / pixelSize) * pixelSize + pixelSize * 0.5;
  return texture2D(u_video, clamp(pixUv, 0.0, 1.0)).rgb;
}

vec3 neonEdge(vec2 uv) {
  float t = u_time * u_speed;
  vec2 texel = (1.0 / max(u_resolution, vec2(1.0))) * (1.0 + u_param1 * 6.0);
  float tl = luma(texture2D(u_video, uv + vec2(-texel.x, -texel.y)).rgb);
  float tc = luma(texture2D(u_video, uv + vec2(0.0, -texel.y)).rgb);
  float tr = luma(texture2D(u_video, uv + vec2(texel.x, -texel.y)).rgb);
  float ml = luma(texture2D(u_video, uv + vec2(-texel.x, 0.0)).rgb);
  float mr = luma(texture2D(u_video, uv + vec2(texel.x, 0.0)).rgb);
  float bl = luma(texture2D(u_video, uv + vec2(-texel.x, texel.y)).rgb);
  float bc = luma(texture2D(u_video, uv + vec2(0.0, texel.y)).rgb);
  float br = luma(texture2D(u_video, uv + vec2(texel.x, texel.y)).rgb);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float edge = length(vec2(gx, gy));
  vec3 orig = texture2D(u_video, uv).rgb;
  vec3 neon = 0.5 + 0.5 * sin(vec3(t + uv.x * 5.0, t * 1.3 + uv.y * 5.0, t * 0.7 + (uv.x + uv.y) * 5.0));
  float strength = clamp(edge * u_intensity * 5.0, 0.0, 1.0);
  return mix(orig * 0.15, neon, strength) + neon * edge * u_param2 * u_intensity * 0.3;
}

vec3 kaleidoscope(vec2 uv) {
  vec2 centered = uv - vec2(0.5);
  float radius = length(centered);
  float angle = atan(centered.y, centered.x) + u_time * u_speed * 0.05;
  float segments = floor(mix(2.0, 16.0, u_param1));
  float seg = 6.2831853 / max(2.0, segments);
  angle = mod(angle, seg);
  angle = abs(angle - seg * 0.5);
  vec2 sampleUv = vec2(cos(angle), sin(angle)) * radius + vec2(0.5);
  sampleUv = mix(uv, sampleUv, u_intensity);
  vec3 c = texture2D(u_video, clamp(sampleUv, 0.0, 1.0)).rgb;
  return mix(c, rgbSplit(sampleUv, 0.002 + u_param2 * 0.02), u_param2 * 0.35);
}

vec3 pixelSortLite(vec2 uv) {
  vec3 live = texture2D(u_video, uv).rgb;
  float y = luma(live);
  float angle = mix(0.0, 1.5708, u_param1);
  vec2 sortDir = vec2(cos(angle), sin(angle));
  float thresh = 0.05 + u_param2 * 0.6;
  float mask = smoothstep(thresh - 0.08, thresh + 0.08, y);
  float maxDisp = u_intensity * 0.25;
  vec3 bestColor = live;
  float bestLuma = y;
  for (float i = 1.0; i <= 8.0; i++) {
    float d = i * maxDisp / 8.0;
    vec3 s = texture2D(u_video, clamp(uv - sortDir * d, 0.0, 1.0)).rgb;
    float sl = luma(s);
    if (sl > bestLuma && sl > thresh) {
      bestLuma = sl;
      bestColor = s;
    }
  }
  float chromaOff = mask * u_intensity * 0.015;
  float r = texture2D(u_video, clamp(uv - sortDir * maxDisp * 0.5 + vec2(chromaOff, 0.0), 0.0, 1.0)).r;
  float b = texture2D(u_video, clamp(uv - sortDir * maxDisp * 0.5 - vec2(chromaOff, 0.0), 0.0, 1.0)).b;
  vec3 sorted = mix(bestColor, vec3(r, bestColor.g, b), 0.6);
  return mix(live, sorted, mask);
}

void main() {
  vec2 uv = v_uv;
  vec3 original = texture2D(u_video, uv).rgb;
  vec3 color = original;

  if (u_mode == 1) {
    color = rgbSplit(uv, 0.002 + u_intensity * (0.002 + u_param1 * 0.035));
  } else if (u_mode == 2) {
    color = chromatic(uv);
  } else if (u_mode == 3) {
    color = vhs(uv);
  } else if (u_mode == 4) {
    color = glitch(uv);
  } else if (u_mode == 5) {
    color = ripple(uv);
  } else if (u_mode == 6) {
    color = waveFx(uv);
  } else if (u_mode == 7) {
    color = psychedelic(uv);
  } else if (u_mode == 8) {
    color = posterize(uv);
  } else if (u_mode == 9) {
    color = pixelate(uv);
  } else if (u_mode == 10) {
    color = edgeGlow(uv);
  } else if (u_mode == 11) {
    color = neonEdge(uv);
  } else if (u_mode == 12) {
    color = heat(uv);
  } else if (u_mode == 13) {
    color = kaleidoscope(uv);
  } else if (u_mode == 14) {
    color = pixelSortLite(uv);
  }

  color = mix(original, color, clamp(u_intensity, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(u_opacity, 0.0, 1.0));
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create shader program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "unknown shader link error";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

function resizeCanvasToVideoContent(canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
  const containerWidth = Math.max(1, video.clientWidth);
  const containerHeight = Math.max(1, video.clientHeight);
  const videoWidth = video.videoWidth || containerWidth;
  const videoHeight = video.videoHeight || containerHeight;
  const videoAspect = videoWidth / Math.max(1, videoHeight);
  const containerAspect = containerWidth / Math.max(1, containerHeight);

  let displayWidth = containerWidth;
  let displayHeight = containerHeight;
  if (containerAspect > videoAspect) {
    displayHeight = containerHeight;
    displayWidth = displayHeight * videoAspect;
  } else {
    displayWidth = containerWidth;
    displayHeight = displayWidth / videoAspect;
  }

  const left = (containerWidth - displayWidth) * 0.5;
  const top = (containerHeight - displayHeight) * 0.5;
  canvas.style.left = `${left}px`;
  canvas.style.top = `${top}px`;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const pixelWidth = Math.max(1, Math.round(displayWidth * dpr));
  const pixelHeight = Math.max(1, Math.round(displayHeight * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
}

export function VjShaderOverlay({ videoRef, active }: VjShaderOverlayProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const guiHostRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<VjShaderSettings>(loadSettings());

  useEffect(() => {
    const onToggleRequest = () => {
      settingsRef.current.showGui = !settingsRef.current.showGui;
      saveSettings(settingsRef.current);
      window.dispatchEvent(new CustomEvent("opennow:vj-gui-toggle"));
    };
    window.addEventListener("opennow:vj-toggle-request", onToggleRequest);
    return () => window.removeEventListener("opennow:vj-toggle-request", onToggleRequest);
  }, []);

  useEffect(() => {
    const host = guiHostRef.current;
    if (!host) return;

    let gui: GUI | null = null;
    const rebuildGui = () => {
      gui?.destroy();
      gui = null;
      host.innerHTML = "";
      if (!settingsRef.current.showGui) return;

      const settings = settingsRef.current;
      gui = new GUI({ title: "OpenNOW VJ" });
      host.appendChild(gui.domElement);
      gui.add(settings, "enabled").name("Enable").onChange(() => saveSettings(settings));
      gui.add(settings, "mode", Object.keys(MODE_TO_ID)).name("Shader").onChange(() => saveSettings(settings));
      gui.add(settings, "opacity", 0, 1, 0.01).name("Opacity").onChange(() => saveSettings(settings));
      gui.add(settings, "intensity", 0, 1, 0.01).name("Intensity").onChange(() => saveSettings(settings));
      gui.add(settings, "speed", 0, 4, 0.01).name("Speed").onChange(() => saveSettings(settings));
      gui.add(settings, "param1", 0, 1, 0.01).name("Param 1").onChange(() => saveSettings(settings));
      gui.add(settings, "param2", 0, 1, 0.01).name("Param 2").onChange(() => saveSettings(settings));
      gui.add({ hide: () => {
        settings.showGui = false;
        saveSettings(settings);
        rebuildGui();
      } }, "hide").name("Hide GUI (Ctrl+Alt+V)");
    };

    rebuildGui();
    window.addEventListener("opennow:vj-gui-toggle", rebuildGui);
    return () => {
      window.removeEventListener("opennow:vj-gui-toggle", rebuildGui);
      gui?.destroy();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      console.warn("[VJ] WebGL unavailable; shader overlay disabled");
      return;
    }

    let program: WebGLProgram;
    try {
      program = createProgram(gl);
    } catch (error) {
      console.warn("[VJ] Shader setup failed:", error);
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const uvLocation = gl.getAttribLocation(program, "a_uv");
    const uniforms = {
      video: gl.getUniformLocation(program, "u_video"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      mode: gl.getUniformLocation(program, "u_mode"),
      opacity: gl.getUniformLocation(program, "u_opacity"),
      intensity: gl.getUniformLocation(program, "u_intensity"),
      speed: gl.getUniformLocation(program, "u_speed"),
      param1: gl.getUniformLocation(program, "u_param1"),
      param2: gl.getUniformLocation(program, "u_param2"),
    };

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
      -1,  1, 0, 1,
       1, -1, 1, 0,
       1,  1, 1, 1,
    ]), gl.STATIC_DRAW);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    let raf = 0;
    let warnedUpload = false;
    const render = () => {
      raf = window.requestAnimationFrame(render);
      const settings = settingsRef.current;
      const shouldRender = active && settings.enabled && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      canvas.style.display = shouldRender ? "block" : "none";
      if (!shouldRender) return;

      resizeCanvasToVideoContent(canvas, video);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(uvLocation);
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      } catch (error) {
        if (!warnedUpload) {
          warnedUpload = true;
          console.warn("[VJ] Video texture upload failed:", error);
        }
        return;
      }

      gl.uniform1i(uniforms.video, 0);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, performance.now() * 0.001);
      gl.uniform1i(uniforms.mode, MODE_TO_ID[settings.mode]);
      gl.uniform1f(uniforms.opacity, settings.opacity);
      gl.uniform1f(uniforms.intensity, settings.intensity);
      gl.uniform1f(uniforms.speed, settings.speed);
      gl.uniform1f(uniforms.param1, settings.param1);
      gl.uniform1f(uniforms.param2, settings.param2);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    raf = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(raf);
      gl.deleteTexture(texture);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteProgram(program);
    };
  }, [active, videoRef]);

  return (
    <>
      <canvas ref={canvasRef} className="vj-shader-overlay" aria-hidden="true" />
      <div ref={guiHostRef} className="vj-gui-host" />
    </>
  );
}
