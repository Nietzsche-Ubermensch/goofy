import { EnhancementParameters } from '../../types';
import { VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE } from './shaders';

export class WebGLCardRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private isInitialized = false;
  private currentImage: HTMLImageElement | ImageBitmap | null = null;

  // Cached uniform locations for peak performance
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initGL();
  }

  private initGL() {
    try {
      this.gl = this.canvas.getContext('webgl', { 
        preserveDrawingBuffer: true, 
        premultipliedAlpha: false,
        alpha: true 
      });

      if (!this.gl) {
        console.warn('WebGL 1.0 not available, fallback required');
        return;
      }

      const gl = this.gl;

      // Compile Shaders
      const vertexShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

      if (!vertexShader || !fragmentShader) return;

      // Create Program
      this.program = gl.createProgram();
      if (!this.program) return;

      gl.attachShader(this.program, vertexShader);
      gl.attachShader(this.program, fragmentShader);
      gl.linkProgram(this.program);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        console.error('Shader link error:', gl.getProgramInfoLog(this.program));
        return;
      }

      gl.useProgram(this.program);

      // Set up Fullscreen Quad geometry
      const positions = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]);

      const texCoords = new Float32Array([
        0.0, 1.0,
        1.0, 1.0,
        0.0, 0.0,
        0.0, 0.0,
        1.0, 1.0,
        1.0, 0.0,
      ]);

      this.vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

      const aPosition = gl.getAttribLocation(this.program, 'aPosition');
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      this.texCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

      const aTexCoord = gl.getAttribLocation(this.program, 'aTexCoord');
      gl.enableVertexAttribArray(aTexCoord);
      gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);

      // Create Texture
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      // Cache uniform locations
      const uniformNames = [
        'uTexture', 'uResolution',
        'uBrightness', 'uContrast', 'uSaturation', 'uVibrance', 'uTemperature',
        'uSharpenFine', 'uSharpenWide', 'uClarity',
        'uDescratchEnabled', 'uDescratchThreshold', 'uDescratchRadius', 'uShowScratchMask',
        'uHoloFoilClarity', 'uAntiGlare', 'uSpecularBoost', 'uVintagePaperPreserve'
      ];

      uniformNames.forEach(name => {
        this.uniforms[name] = gl.getUniformLocation(this.program!, name);
      });

      this.isInitialized = true;
    } catch (err) {
      console.error('WebGLCardRenderer initialization error:', err);
    }
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  public setImage(image: HTMLImageElement | ImageBitmap) {
    this.currentImage = image;
    if (!this.gl || !this.texture || !this.isInitialized) return;

    const gl = this.gl;
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    gl.viewport(0, 0, image.width, image.height);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  public render(params: EnhancementParameters) {
    if (!this.gl || !this.program || !this.isInitialized || !this.currentImage) return;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Upload Uniforms
    gl.uniform2f(this.uniforms['uResolution'], this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms['uBrightness'], params.brightness);
    gl.uniform1f(this.uniforms['uContrast'], params.contrast);
    gl.uniform1f(this.uniforms['uSaturation'], params.saturation);
    gl.uniform1f(this.uniforms['uVibrance'], params.vibrance);
    gl.uniform1f(this.uniforms['uTemperature'], params.temperature);
    
    gl.uniform1f(this.uniforms['uSharpenFine'], params.sharpenFine);
    gl.uniform1f(this.uniforms['uSharpenWide'], params.sharpenWide);
    gl.uniform1f(this.uniforms['uClarity'], params.clarity);
    
    gl.uniform1i(this.uniforms['uDescratchEnabled'], params.descratchEnabled ? 1 : 0);
    gl.uniform1f(this.uniforms['uDescratchThreshold'], params.descratchThreshold);
    gl.uniform1f(this.uniforms['uDescratchRadius'], params.descratchRadius);
    gl.uniform1i(this.uniforms['uShowScratchMask'], params.showScratchMask ? 1 : 0);
    
    gl.uniform1i(this.uniforms['uHoloFoilClarity'], params.holoFoilClarity ? 1 : 0);
    gl.uniform1i(this.uniforms['uAntiGlare'], params.antiGlare ? 1 : 0);
    gl.uniform1f(this.uniforms['uSpecularBoost'], params.specularBoost);
    gl.uniform1i(this.uniforms['uVintagePaperPreserve'], params.vintagePaperPreserve ? 1 : 0);

    // Bind texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms['uTexture'], 0);

    // Draw Quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public async exportBlob(type: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png', quality = 0.95): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(blob);
      }, type, quality);
    });
  }

  public destroy() {
    if (!this.gl) return;
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);
    if (this.program) gl.deleteProgram(this.program);
    this.isInitialized = false;
  }
}
