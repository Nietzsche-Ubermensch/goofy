import { useState, useCallback } from 'react';
import { CardEnhancementTask, EnhancementParameters } from '../types';
import { DEFAULT_ENHANCEMENT_PARAMS } from '../core/presets';
import { CardEnhancementPipeline } from '../core/pipeline/CardEnhancementPipeline';
import JSZip from 'jszip';

export function useBatchEnhancer() {
  const [queue, setQueue] = useState<CardEnhancementTask[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(-1);
  const [overallProgress, setOverallProgress] = useState(0);

  // Add files to queue
  const addFilesToQueue = useCallback((files: File[]) => {
    const newTasks: CardEnhancementTask[] = files.map((file, idx) => ({
      id: `task_batch_${Date.now()}_${idx}`,
      file,
      name: file.name,
      sizeBytes: file.size,
      previewUrl: URL.createObjectURL(file),
      status: 'idle',
      progress: 0,
      stageMessage: 'In Queue',
      blemishes: [],
      parameters: { ...DEFAULT_ENHANCEMENT_PARAMS },
      metadataTags: {
        cardSeries: '',
        year: '',
        player: '',
        gradeTarget: '',
        notes: ''
      }
    }));

    setQueue(prev => [...prev, ...newTasks]);
  }, []);

  // Remove single card from queue
  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(t => t.id !== id));
  }, []);

  // Clear entire queue
  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentProcessingIndex(-1);
    setIsBatchProcessing(false);
    setOverallProgress(0);
  }, []);

  // Bulk update metadata tags on all items or specific subset
  const applyBulkMetadata = useCallback((metadata: {
    cardSeries?: string;
    year?: string;
    player?: string;
    gradeTarget?: string;
    notes?: string;
  }, taskIds?: string[]) => {
    setQueue(prev => prev.map(task => {
      if (!taskIds || taskIds.includes(task.id)) {
        return {
          ...task,
          metadataTags: {
            ...task.metadataTags,
            ...(metadata.cardSeries !== undefined ? { cardSeries: metadata.cardSeries } : {}),
            ...(metadata.year !== undefined ? { year: metadata.year } : {}),
            ...(metadata.player !== undefined ? { player: metadata.player } : {}),
            ...(metadata.gradeTarget !== undefined ? { gradeTarget: metadata.gradeTarget } : {}),
            ...(metadata.notes !== undefined ? { notes: metadata.notes } : {}),
          }
        };
      }
      return task;
    }));
  }, []);

  // Bulk update parameters across all items in queue
  const applyBulkParameters = useCallback((params: Partial<EnhancementParameters>, taskIds?: string[]) => {
    setQueue(prev => prev.map(task => {
      if (!taskIds || taskIds.includes(task.id)) {
        return {
          ...task,
          parameters: {
            ...task.parameters,
            ...params
          }
        };
      }
      return task;
    }));
  }, []);

  // Run Batch Processing
  const runBatchEnhancement = useCallback(async () => {
    if (queue.length === 0 || isBatchProcessing) return;

    setIsBatchProcessing(true);
    const total = queue.length;

    for (let i = 0; i < total; i++) {
      setCurrentProcessingIndex(i);
      const currentTask = queue[i];

      // Update task status to processing
      setQueue(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'processing', progress: 10 } : t));

      try {
        const result = await CardEnhancementPipeline.processCard(
          currentTask,
          currentTask.parameters,
          (status, progress, stageMessage) => {
            setQueue(prev => prev.map((t, idx) => idx === i ? {
              ...t,
              status,
              progress,
              stageMessage
            } : t));
          }
        );

        // Mark completed
        setQueue(prev => prev.map((t, idx) => idx === i ? {
          ...t,
          status: 'completed',
          progress: 100,
          stageMessage: 'Completed',
          enhancedBlobUrl: result.blobUrl,
          metrics: {
            durationMs: result.durationMs,
            originalWidth: 0,
            originalHeight: 0,
            enhancedWidth: result.width,
            enhancedHeight: result.height,
          }
        } : t));
      } catch (err: any) {
        setQueue(prev => prev.map((t, idx) => idx === i ? {
          ...t,
          status: 'failed',
          progress: 100,
          stageMessage: err.message || 'Processing failed'
        } : t));
      }

      setOverallProgress(Math.round(((i + 1) / total) * 100));
    }

    setIsBatchProcessing(false);
    setCurrentProcessingIndex(-1);
  }, [queue, isBatchProcessing]);

  // Export all completed items as a ZIP
  const exportBatchZip = useCallback(async () => {
    const zip = new JSZip();
    const completedTasks = queue.filter(t => t.status === 'completed' && t.enhancedBlobUrl);

    if (completedTasks.length === 0) return;

    for (const task of completedTasks) {
      if (!task.enhancedBlobUrl) continue;
      const res = await fetch(task.enhancedBlobUrl);
      const blob = await res.blob();
      
      const safeName = task.name.replace(/\.[^/.]+$/, "");
      const meta = task.metadataTags;
      let filename = `${safeName}_enhanced.png`;

      if (meta?.cardSeries || meta?.year) {
        filename = `${meta.year ? meta.year + '_' : ''}${meta.cardSeries ? meta.cardSeries.replace(/\s+/g, '_') + '_' : ''}${filename}`;
      }

      zip.file(filename, blob);
    }

    const zipContent = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipContent);
    link.download = `Enhanced_Cards_Batch_${Date.now()}.zip`;
    link.click();
  }, [queue]);

  return {
    queue,
    isBatchProcessing,
    currentProcessingIndex,
    overallProgress,
    addFilesToQueue,
    removeFromQueue,
    clearQueue,
    applyBulkMetadata,
    applyBulkParameters,
    runBatchEnhancement,
    exportBatchZip,
  };
}
