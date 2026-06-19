import { useEffect, useRef } from "react";
import type { JSX } from "react";
import GUI from "lil-gui";
import { VjEffectEngine } from "./VjEffectEngine";
import { assembleVjShader, type VjAssembledShader } from "./shaders/ShaderAssembler";
import { getAllShaderIds, getShader } from "./shaders/registry";
import { createDefaultValues, validateShaderParams, type ShaderDefinition } from "./shaders/types";
import "./lil-gui.css";

const STORAGE_KEY = "opennow.vjOverlay";
const DEFAULT_SHADER_ID = "rgb-split";
const SHADER_IDS = getAllShaderIds();
const SHADER_ID_SET = new Set(SHADER_IDS);
const BASE_UNIFORMS = [
  "map",
  "map2",
  "feedbackTexture",
  "time",
  "mixFactor",
  "opacity",
  "resolution",
  "audioBass",
  "audioLow",
  "audioMid",
  "audioHigh",
  "audioLevel",
  "packetLoss",
  "jitter",
  "bitrate",
  "framesDropped",
  "decodeFps",
  "renderFps",
] as const;

type VjDisplayMode = "replace" | "overlay";

interface VjShaderSettings {
  enabled: boolean;
  showGui: boolean;
  displayMode: VjDisplayMode;
  mode: string;
  opacity: number;
  renderScale: number;
  streamHealthEnabled: boolean;
  showDebugHud: boolean;
  feedbackResetNonce: number;
  compilePreflightNonce: number;
  shaderValues: Record<string, Record<string, number>>;
}

export interface VjStreamHealthUniforms {
  packetLoss: number;
  jitter: number;
  bitrate: number;
  framesDropped: number;
  decodeFps: number;
  renderFps: number;
}

interface VjShaderOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean;
  streamHealth?: VjStreamHealthUniforms;
}

interface ProgramBundle {
  shaderId: string;
  definition: ShaderDefinition;
  assembled: VjAssembledShader;
  program: WebGLProgram;
  positionLocation: number;
  uvLocation: number;
  uniformLocations: Record<string, WebGLUniformLocation | null>;
}

interface VjParamPreset {
  name: string;
  values: Record<string, number>;
}

const DISPLAY_MODE_LABELS: Record<VjDisplayMode, string> = {
  replace: "Replace video",
  overlay: "Overlay video",
};

const ZERO_STREAM_HEALTH: VjStreamHealthUniforms = {
  packetLoss: 0,
  jitter: 0,
  bitrate: 0,
  framesDropped: 0,
  decodeFps: 0,
  renderFps: 0,
};

const DEFAULT_SETTINGS: VjShaderSettings = {
  enabled: false,
  showGui: false,
  displayMode: "replace",
  mode: DEFAULT_SHADER_ID,
  opacity: 1,
  renderScale: 1,
  streamHealthEnabled: false,
  showDebugHud: false,
  feedbackResetNonce: 0,
  compilePreflightNonce: 0,
  shaderValues: {},
};

const VJ_PARAM_PRESETS: Record<string, VjParamPreset[]> = {
  "datamosh": [
    {
      name: "Codec drift",
      values: { intensity: 0.62, speed: 1.0, param1: 0.72, param2: 0.58, edgeMin: 0.16, edgeMaxBase: 0.74, smearScale: 0.055 },
    },
    {
      name: "Heavy melt",
      values: { intensity: 0.86, speed: 1.35, param1: 0.28, param2: 0.92, edgeMin: 0.08, edgeMaxBase: 0.42, smearScale: 0.11 },
    },
    {
      name: "Edge protected",
      values: { intensity: 0.55, speed: 0.85, param1: 0.95, param2: 0.44, edgeMin: 0.18, edgeMaxBase: 0.92, smearScale: 0.04 },
    },
  ],
  "optical-flow": [
    {
      name: "Subtle vectors",
      values: { intensity: 0.42, speed: 1.0, param1: 0.42, param2: 0.35, offsetBase: 0.003, offsetScale: 0.006, lambda: 0.006, overlayGain: 0.55, maskMin: 0.001, maskMax: 0.026 },
    },
    {
      name: "Motion aura",
      values: { intensity: 0.7, speed: 1.1, param1: 0.68, param2: 0.62, offsetBase: 0.004, offsetScale: 0.01, lambda: 0.004, overlayGain: 0.9, maskMin: 0.001, maskMax: 0.018 },
    },
    {
      name: "High contrast flow",
      values: { intensity: 0.88, speed: 1.45, param1: 0.86, param2: 0.8, offsetBase: 0.006, offsetScale: 0.014, lambda: 0.003, overlayGain: 1.35, maskMin: 0.0, maskMax: 0.014 },
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeShaderId(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_SHADER_ID;
  if (SHADER_ID_SET.has(value)) return value;
  if (value === "pixelate") return "pixelate-static";
  if (value === "pixel-sort-lite") return "pixel-sort";
  return DEFAULT_SHADER_ID;
}

function sanitizeShaderValues(value: unknown): Record<string, Record<string, number>> {
  if (!isRecord(value)) return {};
  const result: Record<string, Record<string, number>> = {};
  for (const [shaderId, rawValues] of Object.entries(value)) {
    if (!SHADER_ID_SET.has(shaderId) || !isRecord(rawValues)) continue;
    result[shaderId] = {};
    for (const [uniform, rawValue] of Object.entries(rawValues)) {
      if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        result[shaderId][uniform] = rawValue;
      }
    }
  }
  return result;
}

function loadSettings(): VjShaderSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mode = normalizeShaderId(parsed.mode);
    const shaderValues = sanitizeShaderValues(parsed.shaderValues);

    const legacyValues: Record<string, number> = {};
    for (const uniform of ["intensity", "speed", "param1", "param2"]) {
      const value = parsed[uniform];
      if (typeof value === "number" && Number.isFinite(value)) {
        legacyValues[uniform] = value;
      }
    }
    if (Object.keys(legacyValues).length > 0 && !shaderValues[mode]) {
      shaderValues[mode] = legacyValues;
    }

    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_SETTINGS.enabled,
      showGui: typeof parsed.showGui === "boolean" ? parsed.showGui : DEFAULT_SETTINGS.showGui,
      displayMode: parsed.displayMode === "overlay" || parsed.displayMode === "replace" ? parsed.displayMode : DEFAULT_SETTINGS.displayMode,
      mode,
      opacity: typeof parsed.opacity === "number" && Number.isFinite(parsed.opacity) ? parsed.opacity : DEFAULT_SETTINGS.opacity,
      renderScale: typeof parsed.renderScale === "number" && Number.isFinite(parsed.renderScale) ? Math.max(0.25, Math.min(1, parsed.renderScale)) : DEFAULT_SETTINGS.renderScale,
      streamHealthEnabled: typeof parsed.streamHealthEnabled === "boolean" ? parsed.streamHealthEnabled : DEFAULT_SETTINGS.streamHealthEnabled,
      showDebugHud: typeof parsed.showDebugHud === "boolean" ? parsed.showDebugHud : DEFAULT_SETTINGS.showDebugHud,
      feedbackResetNonce: typeof parsed.feedbackResetNonce === "number" && Number.isFinite(parsed.feedbackResetNonce) ? parsed.feedbackResetNonce : DEFAULT_SETTINGS.feedbackResetNonce,
      compilePreflightNonce: typeof parsed.compilePreflightNonce === "number" && Number.isFinite(parsed.compilePreflightNonce) ? parsed.compilePreflightNonce : DEFAULT_SETTINGS.compilePreflightNonce,
      shaderValues,
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

function getDefinition(shaderId: string): ShaderDefinition {
  return getShader(shaderId) ?? getShader(DEFAULT_SHADER_ID) ?? getShader("none")!;
}

function getValuesForShader(settings: VjShaderSettings, definition: ShaderDefinition): Record<string, number> {
  const defaults = createDefaultValues(definition);
  const rawValues = { ...defaults, ...(settings.shaderValues[definition.id] ?? {}) };
  const validation = validateShaderParams(definition, rawValues);
  const values = validation.correctedValues ?? defaults;
  settings.shaderValues[definition.id] = values;
  return values;
}

function setValuesForShader(settings: VjShaderSettings, definition: ShaderDefinition, values: Record<string, number>): void {
  const defaults = createDefaultValues(definition);
  const validation = validateShaderParams(definition, { ...defaults, ...values });
  settings.shaderValues[definition.id] = validation.correctedValues ?? defaults;
}

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

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
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

function createProgramBundle(gl: WebGLRenderingContext, definition: ShaderDefinition): ProgramBundle {
  const assembled = assembleVjShader(definition);
  const program = createProgram(gl, assembled.vertexShader, assembled.fragmentShader);
  const uniformNames = new Set<string>([...BASE_UNIFORMS, ...assembled.uniforms]);
  const uniformLocations: Record<string, WebGLUniformLocation | null> = {};
  for (const uniform of uniformNames) {
    uniformLocations[uniform] = gl.getUniformLocation(program, uniform);
  }
  return {
    shaderId: definition.id,
    definition,
    assembled,
    program,
    positionLocation: gl.getAttribLocation(program, "a_position"),
    uvLocation: gl.getAttribLocation(program, "a_uv"),
    uniformLocations,
  };
}

function resizeCanvasToVideoContent(canvas: HTMLCanvasElement, video: HTMLVideoElement, renderScale: number): void {
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
  const scale = Math.max(0.25, Math.min(1, renderScale));
  const pixelWidth = Math.max(1, Math.round(displayWidth * dpr * scale));
  const pixelHeight = Math.max(1, Math.round(displayHeight * dpr * scale));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
}

export function VjShaderOverlay({ videoRef, active, streamHealth }: VjShaderOverlayProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const guiHostRef = useRef<HTMLDivElement | null>(null);
  const debugHudRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<VjShaderSettings>(loadSettings());
  const streamHealthRef = useRef<VjStreamHealthUniforms>(streamHealth ?? ZERO_STREAM_HEALTH);

  useEffect(() => {
    streamHealthRef.current = streamHealth ?? ZERO_STREAM_HEALTH;
  }, [streamHealth]);

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
      const definition = getDefinition(settings.mode);
      const shaderOptions = Object.fromEntries(SHADER_IDS.map((id) => [getDefinition(id).name, id]));
      const values = getValuesForShader(settings, definition);

      gui = new GUI({ title: "OpenNOW VJ" });
      host.appendChild(gui.domElement);
      gui.add(settings, "enabled").name("Enable").onChange(() => saveSettings(settings));
      gui.add(settings, "displayMode", DISPLAY_MODE_LABELS).name("Display mode").onChange(() => saveSettings(settings));
      gui.add(settings, "mode", shaderOptions).name("Shader").onChange(() => {
        settings.mode = normalizeShaderId(settings.mode);
        getValuesForShader(settings, getDefinition(settings.mode));
        saveSettings(settings);
        rebuildGui();
      });
      gui.add(settings, "opacity", 0, 1, 0.01).name("Opacity").onChange(() => saveSettings(settings));
      gui.add(settings, "renderScale", 0.25, 1, 0.05).name("Render scale").onChange(() => saveSettings(settings));
      gui.add(settings, "streamHealthEnabled").name("Stream health uniforms").onChange(() => saveSettings(settings));
      gui.add(settings, "showDebugHud").name("Debug HUD").onChange(() => saveSettings(settings));
      gui.add({ resetFeedback: () => {
        settings.feedbackResetNonce += 1;
        saveSettings(settings);
      } }, "resetFeedback").name("Reset feedback buffer");
      gui.add({ compilePreflight: () => {
        settings.compilePreflightNonce += 1;
        settings.showDebugHud = true;
        saveSettings(settings);
      } }, "compilePreflight").name("Compile all shaders");

      const presets = VJ_PARAM_PRESETS[definition.id] ?? [];
      const utilityFolder = gui.addFolder("Shader utilities");
      utilityFolder.add({ resetParams: () => {
        setValuesForShader(settings, definition, createDefaultValues(definition));
        settings.feedbackResetNonce += 1;
        saveSettings(settings);
        rebuildGui();
      } }, "resetParams").name("Reset params to defaults");
      if (presets.length > 0) {
        const presetState = { preset: presets[0].name };
        utilityFolder.add(presetState, "preset", presets.map((preset) => preset.name)).name("Feedback preset");
        utilityFolder.add({ loadPreset: () => {
          const preset = presets.find((item) => item.name === presetState.preset) ?? presets[0];
          setValuesForShader(settings, definition, preset.values);
          settings.feedbackResetNonce += 1;
          saveSettings(settings);
          rebuildGui();
        } }, "loadPreset").name("Load preset");
      }
      utilityFolder.open();

      const paramsFolder = gui.addFolder(`${definition.name} params`);
      for (const param of definition.parameters) {
        paramsFolder
          .add(values, param.uniform, param.min, param.max, param.step)
          .name(param.unit ? `${param.name} (${param.unit})` : param.name)
          .onChange((value: number) => {
            const shaderValues = getValuesForShader(settings, definition);
            shaderValues[param.uniform] = value;
            settings.shaderValues[definition.id] = shaderValues;
            saveSettings(settings);
          });
      }
      paramsFolder.open();

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

    let effectEngine: VjEffectEngine;
    try {
      effectEngine = new VjEffectEngine(gl);
    } catch (error) {
      console.warn("[VJ] Feedback engine setup failed:", error);
      gl.deleteTexture(texture);
      gl.deleteBuffer(vertexBuffer);
      return;
    }

    let raf = 0;
    let bundle: ProgramBundle | null = null;
    let warnedUpload = false;
    let frameCount = 0;
    let fpsWindowStart = performance.now();
    let measuredFps = 0;
    let lastFrameMs = 0;
    let lastHudUpdate = 0;
    let lastShaderStatus = "not compiled";
    let preflightReport = "preflight=not run";
    let lastCompilePreflightNonce = settingsRef.current.compilePreflightNonce;
    let lastFeedbackKey = "";
    let lastFeedbackResetNonce = settingsRef.current.feedbackResetNonce;
    const warnedShaders = new Set<string>();

    const syncDisplayMode = (replaceVideo: boolean) => {
      video.classList.toggle("sv-video--vj-replace", replaceVideo);
      canvas.dataset.vjDisplayMode = settingsRef.current.displayMode;
    };

    const getProgramBundle = (shaderId: string): ProgramBundle | null => {
      const definition = getDefinition(shaderId);
      if (bundle?.shaderId === definition.id) return bundle;
      if (bundle) {
        gl.deleteProgram(bundle.program);
        bundle = null;
      }
      try {
        bundle = createProgramBundle(gl, definition);
        lastShaderStatus = "compiled";
        return bundle;
      } catch (error) {
        lastShaderStatus = "compile failed";
        if (!warnedShaders.has(definition.id)) {
          warnedShaders.add(definition.id);
          console.warn(`[VJ] Shader '${definition.id}' setup failed:`, error);
        }
        return null;
      }
    };

    const runCompilePreflight = (): void => {
      const started = performance.now();
      const failures: string[] = [];
      let passed = 0;
      for (const shaderId of SHADER_IDS) {
        const definition = getDefinition(shaderId);
        try {
          const testBundle = createProgramBundle(gl, definition);
          gl.deleteProgram(testBundle.program);
          passed += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
          failures.push(`${definition.id}: ${reason}`);
        }
      }
      const elapsed = performance.now() - started;
      preflightReport = failures.length === 0
        ? `preflight=pass ${passed}/${SHADER_IDS.length} shaders in ${elapsed.toFixed(1)}ms`
        : `preflight=fail ${passed}/${SHADER_IDS.length} shaders in ${elapsed.toFixed(1)}ms :: ${failures.join(" | ")}`;
      if (failures.length > 0) {
        console.warn("[VJ] Shader compile preflight failures:", failures);
      }
    };

    const render = () => {
      raf = window.requestAnimationFrame(render);
      const frameStart = performance.now();
      const settings = settingsRef.current;
      const shouldRender = active && settings.enabled && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      const replaceVideo = shouldRender && settings.displayMode === "replace";
      canvas.style.display = shouldRender ? "block" : "none";
      syncDisplayMode(replaceVideo);
      const debugHud = debugHudRef.current;
      if (debugHud) {
        debugHud.style.display = settings.showDebugHud ? "block" : "none";
      }
      if (!shouldRender) return;

      if (settings.compilePreflightNonce !== lastCompilePreflightNonce) {
        lastCompilePreflightNonce = settings.compilePreflightNonce;
        runCompilePreflight();
      }

      const currentBundle = getProgramBundle(settings.mode);
      if (!currentBundle) return;
      const values = getValuesForShader(settings, currentBundle.definition);

      resizeCanvasToVideoContent(canvas, video, settings.renderScale);
      const feedbackKey = `${currentBundle.definition.id}:${settings.displayMode}:${canvas.width}x${canvas.height}`;
      if (feedbackKey !== lastFeedbackKey || settings.feedbackResetNonce !== lastFeedbackResetNonce) {
        effectEngine.reset();
        lastFeedbackKey = feedbackKey;
        lastFeedbackResetNonce = settings.feedbackResetNonce;
      }
      try {
        effectEngine.beginFrame(canvas.width, canvas.height);
      } catch (error) {
        console.warn("[VJ] Feedback render target failed:", error);
        return;
      }
      gl.useProgram(currentBundle.program);

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.enableVertexAttribArray(currentBundle.positionLocation);
      gl.vertexAttribPointer(currentBundle.positionLocation, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(currentBundle.uvLocation);
      gl.vertexAttribPointer(currentBundle.uvLocation, 2, gl.FLOAT, false, 16, 8);

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

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, effectEngine.feedbackTexture);

      const uniforms = currentBundle.uniformLocations;
      gl.uniform1i(uniforms.map, 0);
      gl.uniform1i(uniforms.map2, 1);
      gl.uniform1i(uniforms.feedbackTexture, 2);
      gl.uniform1f(uniforms.time, performance.now() * 0.001);
      gl.uniform1f(uniforms.mixFactor, 1);
      gl.uniform1f(uniforms.opacity, settings.opacity);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.audioBass, 0);
      gl.uniform1f(uniforms.audioLow, 0);
      gl.uniform1f(uniforms.audioMid, 0);
      gl.uniform1f(uniforms.audioHigh, 0);
      gl.uniform1f(uniforms.audioLevel, 0);

      const health = settings.streamHealthEnabled ? streamHealthRef.current : ZERO_STREAM_HEALTH;
      gl.uniform1f(uniforms.packetLoss, health.packetLoss);
      gl.uniform1f(uniforms.jitter, health.jitter);
      gl.uniform1f(uniforms.bitrate, health.bitrate);
      gl.uniform1f(uniforms.framesDropped, health.framesDropped);
      gl.uniform1f(uniforms.decodeFps, health.decodeFps);
      gl.uniform1f(uniforms.renderFps, health.renderFps);

      for (const param of currentBundle.definition.parameters) {
        gl.uniform1f(uniforms[param.uniform], values[param.uniform]);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      effectEngine.blitToCanvas(canvas.width, canvas.height);
      effectEngine.endFrame();

      frameCount += 1;
      const now = performance.now();
      if (now - fpsWindowStart >= 500) {
        measuredFps = frameCount / ((now - fpsWindowStart) / 1000);
        frameCount = 0;
        fpsWindowStart = now;
      }
      lastFrameMs = now - frameStart;
      if (debugHud && settings.showDebugHud && now - lastHudUpdate >= 250) {
        lastHudUpdate = now;
        debugHud.textContent = [
          `VJ ${currentBundle.definition.name} (${currentBundle.definition.id})`,
          `category=${currentBundle.definition.category} feedback=${currentBundle.definition.usesFeedback ? "yes" : "no"} status=${lastShaderStatus}`,
          `display=${settings.displayMode} scale=${settings.renderScale.toFixed(2)} canvas=${canvas.width}x${canvas.height} fps=${measuredFps.toFixed(1)} frame=${lastFrameMs.toFixed(2)}ms reset=${settings.feedbackResetNonce}`,
          preflightReport,
          `streamHealth=${settings.streamHealthEnabled ? "on" : "off"} loss=${health.packetLoss.toFixed(2)} jitter=${health.jitter.toFixed(1)} bitrate=${health.bitrate.toFixed(0)}`,
        ].join("\n");
      }
    };

    raf = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(raf);
      video.classList.remove("sv-video--vj-replace");
      delete canvas.dataset.vjDisplayMode;
      gl.deleteTexture(texture);
      gl.deleteBuffer(vertexBuffer);
      effectEngine.destroy();
      if (bundle) gl.deleteProgram(bundle.program);
    };
  }, [active, videoRef]);

  return (
    <>
      <canvas ref={canvasRef} className="vj-shader-overlay" aria-hidden="true" />
      <div ref={debugHudRef} className="vj-debug-hud" aria-hidden="true" />
      <div ref={guiHostRef} className="vj-gui-host" />
    </>
  );
}
