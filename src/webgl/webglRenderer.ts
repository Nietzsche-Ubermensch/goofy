import { EnhancementSettings, CropQuad, Point } from '../types';
import {
  VERTEX_SHADER_SOURCE,
  HIGH_PASS_SCRATCH_MASK_FRAGMENT,
  NAVIER_STOKES_INPAINT_FRAGMENT,
  FINAL_ENHANCEMENT_FRAGMENT
} from './shaders';
import { warpPerspectiveCanvas } from '../utils/imageEnhancer';
import { telemetry } from '../utils/telemetry';

export class WebGLCardRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement;

  // Shader Programs
  private maskProgram: WebGLProgram | null = null;
  private inpaintProgram: WebGLProgram | null = null;
  private enhanceProgram: WebGLProgram | null = null;

  // Quad Geometry Buffers
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;

  // Framebuffer Objects & Textures
  private baseTexture: WebGLTexture | null = null;
  private maskFBO: WebGLFramebuffer | null = null;
  private maskTexture: WebGLTexture | null = null;
  private inpaintFBO1: WebGLFramebuffer | null = null;
  private inpaintTexture1: WebGLTexture | null = null;
  private inpaintFBO2: WebGLFramebuffer | null = null;
  private inpaintTexture2: WebGLTexture | null = null;

  private currentImageWidth = 0;
  private currentImageHeight = 0;
  private isContextValid = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initWebGL();
  }

  private initWebGL() {
    const startTime = performance.now();
    try {
      this.gl = this.canvas.getContext('webgl2', {
        preserveDrawingBuffer: true,
        alpha: true,
        premultipliedAlpha: false,
        antialias: true
      }) as WebGL2RenderingContext;

      if (!this.gl) {
        telemetry.logError('WebGL 2.0 not supported in current environment', 'WebGLRenderer');
        return;
      }

      const gl = this.gl;

      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.isContextValid = false;
        telemetry.logWebglStateDrop();
      });

      this.canvas.addEventListener('webglcontextrestored', () => {
        this.initWebGL();
      });

      // Unit Quad Buffers (-1..1 positions, 0..1 UVs)
      this.positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1,
           1, -1,
          -1,  1,
          -1,  1,
           1, -1,
           1,  1
        ]),
        gl.STATIC_DRAW
      );

      this.texCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          0, 1,
          1, 1,
          0, 0,
          0, 0,
          1, 1,
          1, 0
        ]),
        gl.STATIC_DRAW
      );

      // Compile Shader Pipeline
      this.maskProgram = this.createProgram(VERTEX_SHADER_SOURCE, HIGH_PASS_SCRATCH_MASK_FRAGMENT);
      this.inpaintProgram = this.createProgram(VERTEX_SHADER_SOURCE, NAVIER_STOKES_INPAINT_FRAGMENT);
      this.enhanceProgram = this.createProgram(VERTEX_SHADER_SOURCE, FINAL_ENHANCEMENT_FRAGMENT);

      this.isContextValid = !!(this.maskProgram && this.inpaintProgram && this.enhanceProgram);
      telemetry.logShaderCompileTime(performance.now() - startTime);

    } catch (err: any) {
      telemetry.logError(`WebGL Init Error: ${err?.message || err}`, 'WebGLRenderer');
      this.isContextValid = false;
    }
  }

  private createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      telemetry.logError(`Shader compile failure: ${info}`, 'WebGLRenderer');
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private createProgram(vertSrc: string, fragSrc: string): WebGLProgram | null {
    if (!this.gl) return null;
    const gl = this.gl;

    const vertShader = this.createShader(gl, gl.VERTEX_SHADER, vertSrc);
    const fragShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragSrc);

    if (!vertShader || !fragShader) return null;

    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      telemetry.logError(`Program link failure: ${info}`, 'WebGLRenderer');
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  private setupFramebuffers(w: number, h: number) {
    if (!this.gl) return;
    const gl = this.gl;

    if (this.currentImageWidth === w && this.currentImageHeight === h && this.maskFBO && this.inpaintFBO1 && this.inpaintFBO2) {
      return;
    }

    this.currentImageWidth = w;
    this.currentImageHeight = h;

    // Mask FBO
    if (this.maskTexture) gl.deleteTexture(this.maskTexture);
    if (this.maskFBO) gl.deleteFramebuffer(this.maskFBO);

    this.maskTexture = this.createEmptyTexture(w, h);
    this.maskFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.maskTexture, 0);

    // Inpaint FBO 1
    if (this.inpaintTexture1) gl.deleteTexture(this.inpaintTexture1);
    if (this.inpaintFBO1) gl.deleteFramebuffer(this.inpaintFBO1);

    this.inpaintTexture1 = this.createEmptyTexture(w, h);
    this.inpaintFBO1 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.inpaintFBO1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.inpaintTexture1, 0);

    // Inpaint FBO 2 (Ping-Pong target)
    if (this.inpaintTexture2) gl.deleteTexture(this.inpaintTexture2);
    if (this.inpaintFBO2) gl.deleteFramebuffer(this.inpaintFBO2);

    this.inpaintTexture2 = this.createEmptyTexture(w, h);
    this.inpaintFBO2 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.inpaintFBO2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.inpaintTexture2, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private createEmptyTexture(w: number, h: number): WebGLTexture | null {
    if (!this.gl) return null;
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  public loadSourceImage(image: HTMLImageElement | HTMLCanvasElement) {
    if (!this.gl || !this.isContextValid) return;
    const gl = this.gl;

    const w = image.width || 1;
    const h = image.height || 1;

    this.setupFramebuffers(w, h);

    if (this.baseTexture) gl.deleteTexture(this.baseTexture);
    this.baseTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  public render(settings: EnhancementSettings & { chromaticCorrection?: number; antiGlare?: boolean; foilClarity?: number }) {
    if (!this.gl || !this.isContextValid || !this.baseTexture) return;
    const gl = this.gl;

    const w = this.currentImageWidth;
    const h = this.currentImageHeight;
    if (w <= 0 || h <= 0) return;

    this.canvas.width = w;
    this.canvas.height = h;

    // PASS 1: Structure-Tensor & Scratch Anomaly Mask Extraction -> maskFBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, settings.descratchEnabled ? this.maskFBO : null);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (settings.descratchEnabled && this.maskProgram) {
      gl.useProgram(this.maskProgram);
      this.bindAttributes(this.maskProgram);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
      gl.uniform1i(gl.getUniformLocation(this.maskProgram, 'uTexture'), 0);
      gl.uniform2f(gl.getUniformLocation(this.maskProgram, 'uTexelSize'), 1.0 / w, 1.0 / h);
      gl.uniform1f(gl.getUniformLocation(this.maskProgram, 'uThreshold'), settings.descratchThreshold);
      gl.uniform1f(gl.getUniformLocation(this.maskProgram, 'uRadius'), settings.descratchRadius);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // PASS 2: Navier-Stokes PDE Isophote & Texture Matrix Inpainting -> inpaintFBO1
    let activeOutputTex = this.baseTexture;

    if (settings.descratchEnabled && this.inpaintProgram && this.maskTexture && this.inpaintFBO1) {
      // Pass 2A: Iteration 1 (Base -> inpaintFBO1)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.inpaintFBO1);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(this.inpaintProgram);
      this.bindAttributes(this.inpaintProgram);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
      gl.uniform1i(gl.getUniformLocation(this.inpaintProgram, 'uTexture'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
      gl.uniform1i(gl.getUniformLocation(this.inpaintProgram, 'uMaskTexture'), 1);

      gl.uniform2f(gl.getUniformLocation(this.inpaintProgram, 'uTexelSize'), 1.0 / w, 1.0 / h);
      gl.uniform1f(gl.getUniformLocation(this.inpaintProgram, 'uRadius'), settings.descratchRadius);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      activeOutputTex = this.inpaintTexture1;

      // Pass 2B: Optional Iteration 2 for deep scratches (inpaintFBO1 -> inpaintFBO2)
      if (settings.descratchRadius > 2.5 && this.inpaintFBO2 && this.inpaintTexture1) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.inpaintFBO2);
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inpaintTexture1);
        gl.uniform1i(gl.getUniformLocation(this.inpaintProgram, 'uTexture'), 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        activeOutputTex = this.inpaintTexture2;
      }
    }

    // PASS 3: Master Photometric & Chromatic Correction Engine -> Screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.enhanceProgram) {
      gl.useProgram(this.enhanceProgram);
      this.bindAttributes(this.enhanceProgram);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, activeOutputTex);
      gl.uniform1i(gl.getUniformLocation(this.enhanceProgram, 'uTexture'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, (settings.descratchEnabled && this.maskTexture) ? this.maskTexture : this.baseTexture);
      gl.uniform1i(gl.getUniformLocation(this.enhanceProgram, 'uMaskTexture'), 1);

      gl.uniform2f(gl.getUniformLocation(this.enhanceProgram, 'uTexelSize'), 1.0 / w, 1.0 / h);

      // Color & Visual Adjustments
      gl.uniform1f(gl.getUniformLocation(this.enhanceProgram, 'uBrightness'), settings.brightness);
      gl.uniform1f(gl.getUniformLocation(this.enhanceProgram, 'uContrast'), settings.contrast);
      gl.uniform1f(gl.getUniformLocation(this.enhanceProgram, 'uSaturation'), settings.saturation);
      gl.uniform1f(gl.getUniformLocation(this.enhanceProgram, 'uVibrance'), settings.vibrance);
      gl.uniform1f(gl.getUniformLocation(this.enhanceProgram, 'uSharpen'), settings.sharpen);
      gl.uniform1f(gl.getUniformLocation(this.enhanceProgram, 'uChromaticCorrection'), settings.chromaticCorrection || 0.0);
      gl.uniform1i(gl.getUniformLocation(this.enhanceProgram, 'uAntiGlare'), settings.antiGlare ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(this.enhanceProgram, 'uFoilClarity'), settings.foilClarity || 0.0);
      gl.uniform1i(gl.getUniformLocation(this.enhanceProgram, 'uShowScratchMask'), settings.showScratchMask ? 1 : 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  private bindAttributes(program: WebGLProgram) {
    if (!this.gl) return;
    const gl = this.gl;

    const aPosLoc = gl.getAttribLocation(program, 'aPosition');
    if (aPosLoc !== -1 && this.positionBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
    }

    const aTexLoc = gl.getAttribLocation(program, 'aTexCoord');
    if (aTexLoc !== -1 && this.texCoordBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
      gl.enableVertexAttribArray(aTexLoc);
      gl.vertexAttribPointer(aTexLoc, 2, gl.FLOAT, false, 0, 0);
    }
  }

  /**
   * Performs true 4-point perspective warp and GPU shader pipeline rendering for high-resolution card export.
   */
  public exportCroppedHighRes(
    image: HTMLImageElement | HTMLCanvasElement,
    quad: CropQuad,
    settings: EnhancementSettings & { chromaticCorrection?: number; antiGlare?: boolean; foilClarity?: number }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      try {
        // 1. Warp perspective via sub-pixel homography
        const warpedCanvas = warpPerspectiveCanvas(
          image,
          quad,
          undefined,
          undefined,
          settings.aspectRatio || 2.5 / 3.5
        );

        // 2. Render warped card through GPU WebGL pipeline
        const offCanvas = document.createElement('canvas');
        offCanvas.width = warpedCanvas.width;
        offCanvas.height = warpedCanvas.height;

        const offRenderer = new WebGLCardRenderer(offCanvas);
        offRenderer.loadSourceImage(warpedCanvas);
        offRenderer.render(settings);

        offCanvas.toBlob((blob) => {
          telemetry.logWorkerTime(performance.now() - startTime);
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(offCanvas.toDataURL('image/png'));
          }
        }, 'image/png');

      } catch (err: any) {
        telemetry.logError(`High-res export error: ${err?.message || err}`, 'ExportPipeline');
        reject(err);
      }
    });
  }
}
