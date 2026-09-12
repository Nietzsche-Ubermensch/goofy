/**
 * Card Enhancer V2 - Types and Interface Specifications
 */

export type EnhancementEngine = 
  | 'WebGL_GPU_Realtime'
  | 'RealESRGAN_x4plus'
  | 'RealESRNet_x4plus'
  | 'RealESRGAN_Anime_6B'
  | 'CodeFormer_Fidelity'
  | 'NavierStokes_Inpainting'
  | 'Canvas_CPU_Fallback';

export type JobStatus = 
  | 'idle' 
  | 'queued' 
  | 'analyzing' 
  | 'denoising' 
  | 'inpainting' 
  | 'super_resolution' 
  | 'color_grading' 
  | 'processing'
  | 'completed' 
  | 'failed' 
  | 'canceled';

export type ComparisonMode = 'slider' | 'side-by-side' | 'toggle' | 'loupe';

export interface BlemishItem {
  id: string;
  type: 'scratch' | 'dust' | 'scuff' | 'print_dot' | 'corner_wear' | 'holo_scratch';
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height] normalized (0..1)
  severity: 'low' | 'medium' | 'high' | 'critical';
  repaired: boolean;
}

export interface EnhancementParameters {
  // Exposure & Tone
  brightness: number; // -1.0 to 1.5 (EV Gain)
  contrast: number;   // 0.5 to 2.5
  saturation: number; // 0.0 to 2.5
  vibrance: number;   // -1.0 to 1.5
  temperature: number;// -1.0 to 1.0 (warm/cool)
  
  // High-Resolution & Detail
  sharpenFine: number;   // 0.0 to 3.0 (fine text / boundary details)
  sharpenWide: number;   // 0.0 to 2.0 (structural contours)
  clarity: number;       // 0.0 to 1.5
  
  // AI Super-Resolution & Restoration
  upscaleFactor: 1 | 2 | 4;
  srModel: 'RealESRGAN_x4plus' | 'RealESRNet_x4plus' | 'RealESRGAN_Anime_6B' | 'None';
  codeformerWeight: number; // 0.0 (max AI recreation) to 1.0 (strict grain preservation)
  
  // Defect & Inpainting
  descratchEnabled: boolean;
  descratchThreshold: number; // 0.01 to 0.50
  descratchRadius: number;    // 1 to 16 px
  showScratchMask: boolean;
  microDustFilter: boolean;
  
  // Special Collectible Optical Filters
  holoFoilClarity: boolean;
  antiGlare: boolean;
  specularBoost: number; // 0.0 to 1.0
  vintagePaperPreserve: boolean;
}

export interface EnhancementPreset {
  id: string;
  name: string;
  category: 'Sports' | 'Vintage' | 'TCG & Holo' | 'Modern Prizm' | 'Restoration';
  badge: string;
  description: string;
  engine: EnhancementEngine;
  params: Partial<EnhancementParameters>;
}

export interface CardEnhancementTask {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  previewUrl: string;
  enhancedBlobUrl?: string;
  thumbnailUrl?: string;
  status: JobStatus;
  progress: number;
  stageMessage: string;
  blemishes: BlemishItem[];
  parameters: EnhancementParameters;
  appliedPresetId?: string;
  error?: string;
  metrics?: {
    durationMs: number;
    originalWidth: number;
    originalHeight: number;
    enhancedWidth: number;
    enhancedHeight: number;
    peakVramMb?: number;
  };
  metadataTags?: {
    cardSeries?: string;
    year?: string;
    player?: string;
    gradeTarget?: string;
    notes?: string;
  };
}

export interface WebGLShaderState {
  gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  program: WebGLProgram | null;
  texture: WebGLTexture | null;
  framebuffer: WebGLFramebuffer | null;
  canvas: HTMLCanvasElement | null;
  isSupported: boolean;
}
