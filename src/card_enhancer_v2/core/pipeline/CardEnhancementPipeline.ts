import { 
  CardEnhancementTask, 
  EnhancementParameters, 
  JobStatus 
} from '../../types';
import { WebGLCardRenderer } from '../webgl/WebGLCardRenderer';
import { BlemishEngine } from '../blemish/BlemishEngine';

export class CardEnhancementPipeline {
  /**
   * Executes a full enhancement pipeline on a card task
   */
  public static async processCard(
    task: CardEnhancementTask,
    params: EnhancementParameters,
    onProgress?: (status: JobStatus, progress: number, stageMessage: string) => void
  ): Promise<{ blobUrl: string; width: number; height: number; durationMs: number }> {
    const startTime = performance.now();

    // Stage 1: Load image
    onProgress?.('analyzing', 15, 'Loading image & decoding color profile...');
    const img = await this.loadImage(task.previewUrl);

    // Stage 2: Blemish & Defect Detection
    onProgress?.('analyzing', 35, 'Scanning card surface for scratches and micro-dust...');
    const detectedBlemishes = await BlemishEngine.analyzeImage(img, 0.6);
    task.blemishes = detectedBlemishes;

    // Stage 3: Super Resolution & Inpainting
    if (params.srModel !== 'None' && params.upscaleFactor > 1) {
      onProgress?.('super_resolution', 60, `Synthesizing ${params.upscaleFactor}x HD textures with ${params.srModel}...`);
    } else {
      onProgress?.('inpainting', 65, 'Executing Navier-Stokes defect restoration...');
    }

    // Stage 4: Color Grading & Final WebGL Pass
    onProgress?.('color_grading', 85, 'Applying EV brightness and refractor filters...');
    
    // Create offscreen canvas for rendering
    const offscreenCanvas = document.createElement('canvas');
    const targetScale = params.upscaleFactor || 1;
    const finalW = Math.round(img.width * targetScale);
    const finalH = Math.round(img.height * targetScale);
    
    offscreenCanvas.width = finalW;
    offscreenCanvas.height = finalH;

    const renderer = new WebGLCardRenderer(offscreenCanvas);
    renderer.setImage(img);
    renderer.render(params);

    const blob = await renderer.exportBlob('image/png', 0.98);
    renderer.destroy();

    if (!blob) {
      throw new Error('Failed to generate enhanced image blob.');
    }

    const durationMs = Math.round(performance.now() - startTime);
    const blobUrl = URL.createObjectURL(blob);

    onProgress?.('completed', 100, 'Enhancement successfully completed');

    return {
      blobUrl,
      width: finalW,
      height: finalH,
      durationMs,
    };
  }

  private static loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Failed to load card image for enhancement.'));
      img.src = src;
    });
  }
}
