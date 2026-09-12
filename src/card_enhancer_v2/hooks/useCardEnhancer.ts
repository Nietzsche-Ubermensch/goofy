import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  CardEnhancementTask, 
  EnhancementParameters, 
  EnhancementPreset,
  JobStatus
} from '../types';
import { DEFAULT_ENHANCEMENT_PARAMS, ENHANCER_PRESETS } from '../core/presets';
import { WebGLCardRenderer } from '../core/webgl/WebGLCardRenderer';
import { CardEnhancementPipeline } from '../core/pipeline/CardEnhancementPipeline';

export function useCardEnhancer() {
  const [activeTask, setActiveTask] = useState<CardEnhancementTask | null>(null);
  const [params, setParams] = useState<EnhancementParameters>(DEFAULT_ENHANCEMENT_PARAMS);
  const [history, setHistory] = useState<EnhancementParameters[]>([DEFAULT_ENHANCEMENT_PARAMS]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<JobStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WebGLCardRenderer | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Initialize WebGL Renderer when canvas is attached
  const setCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (rendererRef.current) {
      rendererRef.current.destroy();
      rendererRef.current = null;
    }
    canvasRef.current = canvas;
    if (canvas) {
      rendererRef.current = new WebGLCardRenderer(canvas);
      if (loadedImageRef.current) {
        rendererRef.current.setImage(loadedImageRef.current);
        rendererRef.current.render(params);
      }
    }
  }, [params]);

  // Load a new card file or URL
  const loadCard = useCallback(async (file: File | string) => {
    setIsProcessing(true);
    setStatus('analyzing');
    setProgress(10);
    setStageMessage('Loading image into GPU memory...');

    let url: string;
    let name = 'Sports Card Scan';
    let size = 0;
    let fileObj: File;

    if (typeof file === 'string') {
      url = file;
      const res = await fetch(file);
      const blob = await res.blob();
      fileObj = new File([blob], 'card_sample.jpg', { type: blob.type });
      size = blob.size;
    } else {
      url = URL.createObjectURL(file);
      name = file.name;
      size = file.size;
      fileObj = file;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      if (rendererRef.current) {
        rendererRef.current.setImage(img);
        rendererRef.current.render(params);
      }

      const newTask: CardEnhancementTask = {
        id: `task_${Date.now()}`,
        file: fileObj,
        name,
        sizeBytes: size,
        previewUrl: url,
        status: 'idle',
        progress: 0,
        stageMessage: 'Ready for enhancement',
        blemishes: [],
        parameters: { ...params },
        metrics: {
          durationMs: 0,
          originalWidth: img.width,
          originalHeight: img.height,
          enhancedWidth: img.width * (params.upscaleFactor || 1),
          enhancedHeight: img.height * (params.upscaleFactor || 1),
        }
      };

      setActiveTask(newTask);
      setIsProcessing(false);
      setStatus('idle');
      setProgress(0);
      setStageMessage('Ready');
    };
    img.src = url;
  }, [params]);

  // Update specific parameters with real-time WebGL re-render
  const updateParam = useCallback(<K extends keyof EnhancementParameters>(
    key: K, 
    value: EnhancementParameters[K]
  ) => {
    setParams(prev => {
      const next = { ...prev, [key]: value };
      if (rendererRef.current) {
        rendererRef.current.render(next);
      }
      return next;
    });
  }, []);

  // Set all parameters (e.g. from preset) and record history
  const applyParams = useCallback((newParams: Partial<EnhancementParameters>, recordHistory = true) => {
    setParams(prev => {
      const next = { ...prev, ...newParams };
      if (rendererRef.current) {
        rendererRef.current.render(next);
      }
      if (recordHistory) {
        setHistory(h => [...h.slice(0, historyIndex + 1), next]);
        setHistoryIndex(i => i + 1);
      }
      return next;
    });
  }, [historyIndex]);

  // Apply a preset
  const applyPreset = useCallback((preset: EnhancementPreset) => {
    applyParams(preset.params);
    if (activeTask) {
      setActiveTask(t => t ? { ...t, appliedPresetId: preset.id } : null);
    }
  }, [applyParams, activeTask]);

  // Undo / Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const targetParams = history[historyIndex - 1];
      setHistoryIndex(i => i - 1);
      setParams(targetParams);
      if (rendererRef.current) {
        rendererRef.current.render(targetParams);
      }
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetParams = history[historyIndex + 1];
      setHistoryIndex(i => i + 1);
      setParams(targetParams);
      if (rendererRef.current) {
        rendererRef.current.render(targetParams);
      }
    }
  }, [history, historyIndex]);

  // Full processing and export
  const processFullEnhancement = useCallback(async () => {
    if (!activeTask) return null;
    setIsProcessing(true);
    setStatus('processing');

    try {
      const result = await CardEnhancementPipeline.processCard(
        activeTask,
        params,
        (s, p, msg) => {
          setStatus(s);
          setProgress(p);
          setStageMessage(msg);
        }
      );

      setActiveTask(t => t ? {
        ...t,
        enhancedBlobUrl: result.blobUrl,
        status: 'completed',
        progress: 100,
        stageMessage: 'Completed',
        metrics: {
          ...t.metrics!,
          enhancedWidth: result.width,
          enhancedHeight: result.height,
          durationMs: result.durationMs,
        }
      } : null);

      setIsProcessing(false);
      return result.blobUrl;
    } catch (err: any) {
      setIsProcessing(false);
      setStatus('failed');
      setStageMessage(err.message || 'Enhancement failed.');
      return null;
    }
  }, [activeTask, params]);

  return {
    activeTask,
    params,
    status,
    progress,
    stageMessage,
    isProcessing,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    setCanvas,
    loadCard,
    updateParam,
    applyParams,
    applyPreset,
    undo,
    redo,
    processFullEnhancement,
    presets: ENHANCER_PRESETS,
  };
}
