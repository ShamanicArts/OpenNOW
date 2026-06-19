interface RenderTarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
}

const BLIT_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 vUv;

void main() {
  vUv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const BLIT_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D sourceTexture;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(sourceTexture, vUv);
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

function createTarget(gl: WebGLRenderingContext): RenderTarget {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) throw new Error("Unable to create VJ feedback target");

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { texture, framebuffer };
}

export class VjEffectEngine {
  private readonly gl: WebGLRenderingContext;
  private readonly targets: [RenderTarget, RenderTarget];
  private readonly blitProgram: WebGLProgram;
  private readonly blitBuffer: WebGLBuffer;
  private readonly blitPositionLocation: number;
  private readonly blitUvLocation: number;
  private readonly blitSourceLocation: WebGLUniformLocation | null;
  private readIndex = 0;
  private writeIndex = 1;
  private width = 0;
  private height = 0;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    this.targets = [createTarget(gl), createTarget(gl)];
    this.blitProgram = createProgram(gl, BLIT_VERTEX_SHADER, BLIT_FRAGMENT_SHADER);
    this.blitBuffer = gl.createBuffer() ?? (() => { throw new Error("Unable to create VJ blit buffer"); })();
    this.blitPositionLocation = gl.getAttribLocation(this.blitProgram, "a_position");
    this.blitUvLocation = gl.getAttribLocation(this.blitProgram, "a_uv");
    this.blitSourceLocation = gl.getUniformLocation(this.blitProgram, "sourceTexture");

    gl.bindBuffer(gl.ARRAY_BUFFER, this.blitBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
      -1,  1, 0, 1,
       1, -1, 1, 0,
       1,  1, 1, 1,
    ]), gl.STATIC_DRAW);
  }

  ensureSize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;

    for (const target of this.targets) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, target.texture);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer);
      this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, target.texture, 0);
      const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
      if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Incomplete VJ feedback framebuffer: ${status}`);
      }
      this.gl.viewport(0, 0, width, height);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  get feedbackTexture(): WebGLTexture {
    return this.targets[this.readIndex].texture;
  }

  get renderFramebuffer(): WebGLFramebuffer {
    return this.targets[this.writeIndex].framebuffer;
  }

  get outputTexture(): WebGLTexture {
    return this.targets[this.writeIndex].texture;
  }

  reset(): void {
    if (this.width <= 0 || this.height <= 0) return;
    this.readIndex = 0;
    this.writeIndex = 1;
    for (const target of this.targets) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer);
      this.gl.viewport(0, 0, this.width, this.height);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  beginFrame(width: number, height: number): void {
    this.ensureSize(width, height);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.renderFramebuffer);
    this.gl.viewport(0, 0, width, height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  blitToCanvas(width: number, height: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.blitProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.blitBuffer);
    gl.enableVertexAttribArray(this.blitPositionLocation);
    gl.vertexAttribPointer(this.blitPositionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.blitUvLocation);
    gl.vertexAttribPointer(this.blitUvLocation, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.outputTexture);
    gl.uniform1i(this.blitSourceLocation, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  endFrame(): void {
    const nextRead = this.writeIndex;
    this.writeIndex = this.readIndex;
    this.readIndex = nextRead;
  }

  destroy(): void {
    for (const target of this.targets) {
      this.gl.deleteTexture(target.texture);
      this.gl.deleteFramebuffer(target.framebuffer);
    }
    this.gl.deleteBuffer(this.blitBuffer);
    this.gl.deleteProgram(this.blitProgram);
  }
}
