import { TelemetryPayload, TelemetryMetrics, TelemetryError, AppState } from '../types';

class TelemetrySystem {
  private static instance: TelemetrySystem;
  
  private metrics: TelemetryMetrics = {
    fps: 60,
    frameTimeMs: 16.6,
    edgeDetectTimeMs: 0,
    shaderCompileTimeMs: 0,
    workerProcessingTimeMs: 0,
    webglStateDrops: 0,
    lastKeystroke: 'None',
    timestamp: new Date().toISOString()
  };

  private errors: TelemetryError[] = [];
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private auditCallback?: () => void;

  private constructor() {
    this.setupGlobalErrorHandlers();
  }

  public static getInstance(): TelemetrySystem {
    if (!TelemetrySystem.instance) {
      TelemetrySystem.instance = new TelemetrySystem();
    }
    return TelemetrySystem.instance;
  }

  private setupGlobalErrorHandlers() {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.logError(event.message || 'Uncaught error', 'WindowError');
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.logError(String(event.reason?.message || event.reason || 'Unhandled Promise Rejection'), 'PromiseRejection');
      });
    }
  }

  public registerAuditCallback(cb: () => void) {
    this.auditCallback = cb;
  }

  public triggerAudit() {
    if (this.auditCallback) {
      this.auditCallback();
    }
  }

  public updateFrameTime(deltaMs: number) {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.metrics.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
    // Exponential moving average for frame time to avoid jitter & memory allocations
    this.metrics.frameTimeMs = Math.round((this.metrics.frameTimeMs * 0.8 + deltaMs * 0.2) * 10) / 10;
    this.metrics.timestamp = new Date().toISOString();
  }

  public logEdgeDetectLatency(timeMs: number) {
    this.metrics.edgeDetectTimeMs = Math.round(timeMs * 100) / 100;
  }

  public logShaderCompileTime(timeMs: number) {
    this.metrics.shaderCompileTimeMs = Math.round(timeMs * 100) / 100;
  }

  public logWorkerTime(timeMs: number) {
    this.metrics.workerProcessingTimeMs = Math.round(timeMs * 100) / 100;
  }

  public logKeystroke(key: string) {
    this.metrics.lastKeystroke = key;
  }

  public logWebglStateDrop() {
    this.metrics.webglStateDrops++;
    this.logError('WebGL context lost or buffer drop detected', 'WebGLRenderer');
  }

  public logError(message: string, source: string = 'App') {
    const errorItem: TelemetryError = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      timestamp: new Date().toISOString(),
      source
    };
    // Keep last 25 errors max
    this.errors.unshift(errorItem);
    if (this.errors.length > 25) {
      this.errors.pop();
    }
  }

  public getPayload(appState: AppState = 'Idle', cardName: string = 'None', resolution: string = '0x0'): TelemetryPayload {
    let webglVendor = 'Hardware Accelerated';
    let webglRenderer = 'WebGL 2.0 (Custom Shaders)';

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || webglVendor;
          webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || webglRenderer;
        }
      }
    } catch (_) {}

    return {
      metrics: { ...this.metrics },
      errors: [...this.errors],
      appState,
      activeCardName: cardName,
      resolution,
      browserUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      webglVendor,
      webglRenderer,
      memoryUsage: (performance as any).memory
        ? `${Math.round((performance as any).memory.usedJSHeapSize / 1048576)} MB / ${Math.round((performance as any).memory.jsHeapSizeLimit / 1048576)} MB`
        : 'N/A'
    };
  }
}

export const telemetry = TelemetrySystem.getInstance();
