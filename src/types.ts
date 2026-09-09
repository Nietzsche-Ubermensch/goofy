export type AppState = 'Idle' | 'Loading' | 'Auto-Detecting' | 'Editing' | 'Processing' | 'Ready';

export interface Point {
  x: number;
  y: number;
}

export interface CropQuad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface EnhancementSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  sharpen: number;
  descratchEnabled: boolean;
  descratchThreshold: number;
  descratchRadius: number;
  showScratchMask: boolean;
  aspectRatio: number | null;
  autoSnap: boolean;
}

export interface TelemetryMetrics {
  fps: number;
  frameTimeMs: number;
  edgeDetectTimeMs: number;
  shaderCompileTimeMs: number;
  workerProcessingTimeMs: number;
  webglStateDrops: number;
  lastKeystroke: string;
  timestamp: string;
}

export interface TelemetryError {
  id: string;
  message: string;
  timestamp: string;
  source: string;
}

export interface TelemetryPayload {
  metrics: TelemetryMetrics;
  errors: TelemetryError[];
  appState: AppState;
  activeCardName: string;
  resolution: string;
  browserUserAgent: string;
  webglVendor: string;
  webglRenderer: string;
  memoryUsage?: string;
}

export interface CardItem {
  id: string;
  name: string;
  originalUrl: string;
  imageElement: HTMLImageElement | null;
  width: number;
  height: number;
  quad: CropQuad;
  rotation?: number;
  processedBlobUrl?: string;
  status: AppState;
  isPreset?: boolean;
}

// Legacy / Auxiliary Compatibility Types
export enum ProcessingStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Completed = 'Completed',
  Failed = 'Failed'
}

export interface DamageIssue {
  type: string;
  description: string;
  severity: number;
  boundingBox: number[];
}

export interface AnalysisResult {
  damageScore: number;
  issues: string[];
  detailedIssues?: DamageIssue[];
  recommendedFixes: string[];
  boundingBox?: number[];
}

export enum AIProvider {
  Gemini = 'Gemini',
  OpenRouter = 'OpenRouter',
  Venice = 'Venice',
  OpenAI = 'OpenAI',
  xAI = 'xAI'
}

export interface AIModelConfig {
  provider: AIProvider;
  modelId: string;
}

export interface ProcessingSettings {
  aspectRatio: number;
  jpegQuality: number;
  enableUpscaling: boolean;
  enableDescratching: boolean;
  restorationStrength: number;
  upscalingScale: number;
  backgroundColor: string;
  autoCrop: boolean;
  aiConfig: AIModelConfig;
  // Manual WebGL Enhancement Controls
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  sharpen: number;
  descratchThreshold: number;
  descratchRadius: number;
  microDustFilter?: boolean;
  antiGlare?: boolean;
  chromeParallelClarity?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum ImageSize {
  Size1K = '1K',
  Size2K = '2K',
  Size4K = '4K'
}

export interface CardImage {
  id: string;
  file: File;
  previewUrl: string;
  processedUrl?: string;
  status: ProcessingStatus;
  originalWidth: number;
  originalHeight: number;
  analysis?: AnalysisResult;
  quad?: CropQuad;
  rotation?: number;
  customSettings?: Partial<ProcessingSettings>;
  isCustomConfigured?: boolean;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
