import type { ShaderDefinition, ShaderParam } from "./types.js";
import { BASE_GLSL_UTILS, SHADER_DEFINITIONS } from "./registry.js";

export interface VjAssembledShader {
  vertexShader: string;
  fragmentShader: string;
  uniforms: string[];
  defaultValues: Record<string, number>;
}

function generateUniformDecl(param: ShaderParam): string {
  return `uniform float ${param.uniform};`;
}

function buildVertexShader(): string {
  return `
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 vUv;

void main() {
  vUv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
}

function buildBaseUniforms(): string {
  return `
uniform sampler2D map;
uniform sampler2D map2;
uniform sampler2D feedbackTexture;
uniform float time;
uniform float mixFactor;
uniform float opacity;
uniform vec2 resolution;

uniform float audioBass;
uniform float audioLow;
uniform float audioMid;
uniform float audioHigh;
uniform float audioLevel;

uniform float packetLoss;
uniform float jitter;
uniform float bitrate;
uniform float framesDropped;
uniform float decodeFps;
uniform float renderFps;
`;
}

export function assembleVjShader(definition: ShaderDefinition): VjAssembledShader {
  const uniforms: string[] = [];
  const defaultValues: Record<string, number> = {};
  const paramUniforms = definition.parameters.map(generateUniformDecl).join("\n");

  for (const param of definition.parameters) {
    uniforms.push(param.uniform);
    defaultValues[param.uniform] = param.default;
  }

  const fragmentShader = `
precision highp float;

${buildBaseUniforms()}
${paramUniforms}

varying vec2 vUv;

${BASE_GLSL_UTILS}
${definition.fragmentPreamble ?? ""}

void main() {
${definition.fragmentBody}
  gl_FragColor.a *= clamp(opacity, 0.0, 1.0);
}
`;

  return {
    vertexShader: buildVertexShader(),
    fragmentShader,
    uniforms,
    defaultValues,
  };
}

export function buildVjShaderCache(): Map<string, VjAssembledShader> {
  const cache = new Map<string, VjAssembledShader>();
  for (const [id, definition] of Object.entries(SHADER_DEFINITIONS)) {
    cache.set(id, assembleVjShader(definition));
  }
  return cache;
}
