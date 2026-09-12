import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  X, 
  Loader2, 
  Download, 
  Settings2, 
  Play, 
  Trash2, 
  Sliders, 
  Crop, 
  Wand2, 
  Info, 
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Zap,
  Eye,
  ShieldCheck,
  Check,
  RefreshCw,
  FolderInput,
  FileDown,
  Maximize2,
  Tag,
  PackageCheck,
  Award
} from 'lucide-react';
import { CardImage, ProcessingStatus, ProcessingSettings, AIProvider, EnhancementSettings, CropQuad, CardMetadataTags } from '../types';
import { analyzeCardDamage, restoreCard } from '../services/aiService';
import { detectCardEdges, autoCenterQuad, calculateCardCentering } from '../utils/edgeDetection';
import { processCardComplete } from '../utils/imageEnhancer';
import { scanDroppedItems, unpackZipFile } from '../utils/dropzoneScanner';
import { BatchItemEditorModal } from '../components/BatchItemEditorModal';
import { BatchMetadataModal } from '../components/BatchMetadataModal';
import { BatchBulkActionPanel } from '../components/BatchBulkActionPanel';
import { BatchProcessingProgressBar } from '../components/BatchProcessingProgressBar';
import { BatchRecoveryBanner } from '../components/BatchRecoveryBanner';
import SettingsModal from '../components/SettingsModal';
import { 
  saveBatchSession, 
  getStoredBatchSession, 
  updateCardRecordInSession, 
  clearBatchSession 
} from '../utils/batchSessionStorage';
import JSZip from 'jszip';

export interface BatchCropperProps {
  initialFiles?: File[];
  folderName?: string;
  onClearInitialFiles?: () => void;
}

export interface SportsCardPreset {
  id: string;
  name: string;
  badge: string;
  desc: string;
  settings: Partial<ProcessingSettings>;
}

export const SPORTS_CARD_PRESETS: SportsCardPreset[] = [
  {
    id: 'prizm_chrome',
    name: 'Modern Prizm / Chrome / Optic',
    badge: '🏆 HIGH POP',
    desc: 'Punchy jersey colors, razor text & refractor prism luster',
    settings: {
      contrast: 1.28,
      brightness: 0.04,
      saturation: 1.22,
      vibrance: 0.35,
      sharpen: 1.10,
      descratchThreshold: 0.12,
      descratchRadius: 2.5,
      microDustFilter: true,
      antiGlare: true,
      chromeParallelClarity: true,
      enableDescratching: true
    }
  },
  {
    id: 'vintage_paper',
    name: 'Vintage Paper (1952-1989)',
    badge: '⚾ CLASSIC',
    desc: 'Deep authentic contrast, paper fiber protection, zero artifacting',
    settings: {
      contrast: 1.18,
      brightness: 0.02,
      saturation: 1.05,
      vibrance: 0.12,
      sharpen: 0.75,
      descratchThreshold: 0.16,
      descratchRadius: 2.0,
      microDustFilter: true,
      antiGlare: false,
      chromeParallelClarity: false,
      enableDescratching: true
    }
  },
  {
    id: 'autograph_serial',
    name: 'Autograph & Serial Number HD',
    badge: '✍️ 1-of-1',
    desc: 'Maximum edge micro-contrast for sharp ink strokes & stamps',
    settings: {
      contrast: 1.32,
      brightness: 0.02,
      saturation: 1.10,
      vibrance: 0.15,
      sharpen: 1.45,
      descratchThreshold: 0.14,
      descratchRadius: 2.0,
      microDustFilter: true,
      antiGlare: true,
      chromeParallelClarity: true,
      enableDescratching: false
    }
  },
  {
    id: 'slab_scuff_fix',
    name: 'Heavy Slab / Toploader Scuff Fix',
    badge: '🛡️ RESTORE',
    desc: 'Deep scratch inpainting & specular reflection suppression',
    settings: {
      contrast: 1.20,
      brightness: 0.05,
      saturation: 1.15,
      vibrance: 0.25,
      sharpen: 0.90,
      descratchThreshold: 0.10,
      descratchRadius: 3.0,
      microDustFilter: true,
      antiGlare: true,
      chromeParallelClarity: true,
      enableDescratching: true
    }
  },
  {
    id: 'studio_raw',
    name: 'Clean Studio Crisp',
    badge: '⚡ BALANCED',
    desc: 'Crisp balanced contrast, clean border whitening & natural tone',
    settings: {
      contrast: 1.16,
      brightness: 0.03,
      saturation: 1.12,
      vibrance: 0.20,
      sharpen: 0.85,
      descratchThreshold: 0.14,
      descratchRadius: 2.0,
      microDustFilter: true,
      antiGlare: true,
      chromeParallelClarity: true,
      enableDescratching: true
    }
  }
];

const BatchCropper: React.FC<BatchCropperProps> = ({ initialFiles, folderName, onClearInitialFiles }) => {
  const [cards, setCards] = useState<CardImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBatchRendering, setIsBatchRendering] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [batchRenderProgress, setBatchRenderProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [throughputCardsPerSec, setThroughputCardsPerSec] = useState<number>(0);
  const [avgMsPerCard, setAvgMsPerCard] = useState<number>(0);
  const [estimatedSecondsRemaining, setEstimatedSecondsRemaining] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [activeProcessingCardName, setActiveProcessingCardName] = useState<string | null>(null);
  const [savedSession, setSavedSession] = useState<{ cards: CardImage[]; settings?: ProcessingSettings; savedAt: number } | null>(null);

  const isPausedRef = useRef<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedCardForView, setSelectedCardForView] = useState<CardImage | null>(null);
  const [editingCard, setEditingCard] = useState<CardImage | null>(null);
  const [previewMode, setPreviewMode] = useState<'enhanced' | 'original'>('enhanced');
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string>('prizm_chrome');
  const [scanQueueProgress, setScanQueueProgress] = useState<{ processed: number; total: number } | null>(null);
  
  const handleApplyBulkMetadata = (metadata: CardMetadataTags, renameFiles: boolean) => {
    setCards(prev => prev.map(card => ({
      ...card,
      metadata: {
        ...card.metadata,
        ...metadata,
      }
    })));

    const tagSummary = [
      metadata.cardSeries ? `Series: "${metadata.cardSeries}"` : null,
      metadata.year ? `Year: "${metadata.year}"` : null,
      metadata.setName ? `Set: "${metadata.setName}"` : null,
      metadata.player ? `Player: "${metadata.player}"` : null,
      metadata.gradeTarget ? `Target: "${metadata.gradeTarget}"` : null,
    ].filter(Boolean).join(', ');

    addLog(`[Metadata] Applied bulk tags to ${cards.length} cards: ${tagSummary || 'Custom notes'}`);
  };

  const handleClearBulkMetadata = () => {
    setCards(prev => prev.map(card => ({
      ...card,
      metadata: undefined
    })));
    addLog(`[Metadata] Cleared all metadata tags from ${cards.length} cards in queue.`);
  };

  const taggedCardsCount = cards.filter(c => c.metadata && (c.metadata.cardSeries || c.metadata.year || c.metadata.setName)).length;

  const [settings, setSettings] = useState<ProcessingSettings>({
    aspectRatio: 2.5 / 3.5,
    jpegQuality: 95,
    enableUpscaling: true,
    enableDescratching: true,
    restorationStrength: 0.5,
    upscalingScale: 4,
    backgroundColor: 'White',
    autoCrop: true,
    aiConfig: {
      provider: AIProvider.Gemini,
      modelId: 'gemini-3.1-flash-image'
    },
    // Calibrated High-Impact Sports Card Settings (Prizm / Chrome Default)
    brightness: 0.04,
    contrast: 1.28,
    saturation: 1.22,
    vibrance: 0.35,
    sharpen: 1.10,
    descratchThreshold: 0.12,
    descratchRadius: 2.5,
    microDustFilter: true,
    antiGlare: true,
    chromeParallelClarity: true
  });

  const handleAutoCenterAllCards = useCallback(() => {
    setCards(prev => prev.map(c => {
      if (!c.quad) return c;
      const centered = autoCenterQuad(c.quad, settings.aspectRatio);
      return {
        ...c,
        quad: centered
      };
    }));
    addLog(`✓ Auto-centered all ${cards.length} card crops to standard 50/50 ratio.`);
  }, [cards.length, settings.aspectRatio]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const applySportsPreset = (presetId: string) => {
    const matched = SPORTS_CARD_PRESETS.find(p => p.id === presetId);
    if (!matched) return;
    setActivePresetId(presetId);
    setSettings(prev => ({
      ...prev,
      ...matched.settings
    }));
    addLog(`[Preset] Applied sports card preset: "${matched.name}"`);
  };

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Check for interrupted batch sessions in IndexedDB on component mount
  useEffect(() => {
    getStoredBatchSession().then(stored => {
      if (stored && stored.cards.length > 0) {
        setSavedSession(stored);
        const completed = stored.cards.filter(c => c.status === ProcessingStatus.Completed).length;
        addLog(`[Session Storage] Detected saved batch session with ${stored.cards.length} cards (${completed} enhanced).`);
      }
    });
  }, []);

  // Timer effect for elapsed processing duration
  useEffect(() => {
    let timerInterval: any = null;
    if (isBatchRendering && !isPaused) {
      timerInterval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isBatchRendering, isPaused]);

  // Auto-save batch cards to IndexedDB when idle
  useEffect(() => {
    if (cards.length > 0 && !isBatchRendering) {
      const debounceTimer = setTimeout(() => {
        saveBatchSession(cards, settings);
      }, 800);
      return () => clearTimeout(debounceTimer);
    }
  }, [cards, settings, isBatchRendering]);

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      cards.forEach(card => {
        URL.revokeObjectURL(card.previewUrl);
        if (card.processedUrl && card.processedUrl.startsWith('blob:')) {
          URL.revokeObjectURL(card.processedUrl);
        }
      });
    };
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleTogglePause = () => {
    setIsPaused(prev => {
      const next = !prev;
      isPausedRef.current = next;
      addLog(next ? '⏸️ Batch processing paused by user' : '▶️ Batch processing resumed');
      return next;
    });
  };

  const handleCancelBatch = () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    addLog('🛑 Halt signal sent to batch workers...');
  };

  const handleResumeSession = async (autoStart = true) => {
    if (!savedSession) return;
    const restoredCards = savedSession.cards;
    if (savedSession.settings) {
      setSettings(savedSession.settings);
    }
    setCards(restoredCards);
    setSavedSession(null);
    addLog(`[Session] Restored ${restoredCards.length} cards from saved session.`);

    if (autoStart) {
      const pendingCount = restoredCards.filter(c => c.status !== ProcessingStatus.Completed).length;
      if (pendingCount > 0) {
        addLog(`[Session] Auto-resuming ${pendingCount} pending cards...`);
        // Slight delay to allow state to settle
        setTimeout(() => {
          handleApplyEnhancementsToAll(restoredCards, true);
        }, 100);
      } else {
        addLog(`[Session] All ${restoredCards.length} cards are already enhanced.`);
      }
    }
  };

  const handleRestoreToQueue = () => {
    if (!savedSession) return;
    setCards(savedSession.cards);
    if (savedSession.settings) {
      setSettings(savedSession.settings);
    }
    setSavedSession(null);
    addLog(`[Session] Loaded ${savedSession.cards.length} cards into workspace queue for inspection.`);
  };

  const handleDiscardSession = async () => {
    await clearBatchSession();
    setSavedSession(null);
    addLog('[Session] Cleared saved batch session from storage.');
  };

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
      const MAX_SIZE_MB = 50;
      const MAX_BATCH_SIZE = 250;
      
      const rawFiles = Array.from(fileList) as File[];
      const extractedFiles: File[] = [];

      // Expand any ZIP files asynchronously with live non-blocking throttling
      for (const file of rawFiles) {
        if (file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip')) {
          try {
            addLog(`📦 Extracting ZIP archive: "${file.name}"...`);
            const unzipped = await unpackZipFile(file, file.name, {
              chunkSize: 4,
              onProgress: (p) => {
                if (p.processed % 15 === 0 || p.processed === p.total) {
                  addLog(`📦 Unpacking "${file.name}": ${p.processed}/${p.total} cards (${p.percent}%)`);
                }
              }
            });
            extractedFiles.push(...unzipped);
            addLog(`✓ Extracted ${unzipped.length} cards from "${file.name}"`);
          } catch (zipErr: any) {
            addLog(`❌ Failed to extract ZIP "${file.name}": ${zipErr.message}`);
          }
        } else if (file.type.startsWith('image/')) {
          extractedFiles.push(file);
        }
      }
      
      if (extractedFiles.length > MAX_BATCH_SIZE) {
          addLog(`Notice: Selected ${extractedFiles.length} files. Queueing first ${MAX_BATCH_SIZE}.`);
      }

      const acceptedFiles = extractedFiles.slice(0, MAX_BATCH_SIZE);
      let skippedCount = 0;
      const newCardsToAdd: CardImage[] = [];

      acceptedFiles.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            skippedCount++;
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        const cardId = Math.random().toString(36).substring(2, 11);

        newCardsToAdd.push({
            id: cardId,
            file,
            previewUrl,
            status: ProcessingStatus.Pending,
            originalWidth: 0,
            originalHeight: 0
        });
      });

      if (newCardsToAdd.length > 0) {
        // Enqueue cards into UI in a single atomic state batch
        setCards(prev => [...prev, ...newCardsToAdd]);
        addLog(`Added ${newCardsToAdd.length} cards to batch queue. Starting non-blocking edge analysis...`);

        // Process edge detection in a throttled non-blocking worker queue (2 workers, yielding between items)
        const queue = [...newCardsToAdd];
        const totalToScan = queue.length;
        let scannedCount = 0;
        setScanQueueProgress({ processed: 0, total: totalToScan });

        const scanWorker = async () => {
          while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;

            await new Promise<void>((resolve) => {
              const probeImg = new Image();
              probeImg.crossOrigin = 'anonymous';
              probeImg.onload = () => {
                const w = probeImg.naturalWidth || probeImg.width;
                const h = probeImg.naturalHeight || probeImg.height;
                const detectedQuad = detectCardEdges(probeImg, settings.aspectRatio);

                setCards(prev => prev.map(c => 
                  c.id === item.id 
                    ? { 
                        ...c, 
                        originalWidth: w, 
                        originalHeight: h,
                        quad: detectedQuad
                      } 
                    : c
                ));
                scannedCount++;
                setScanQueueProgress({ processed: scannedCount, total: totalToScan });
                resolve();
              };
              probeImg.onerror = () => {
                scannedCount++;
                setScanQueueProgress({ processed: scannedCount, total: totalToScan });
                resolve();
              };
              probeImg.src = item.previewUrl;
            });

            // Non-blocking yield to event loop
            await new Promise(r => setTimeout(r, 12));
          }
        };

        Promise.all([scanWorker(), scanWorker()]).then(() => {
          setScanQueueProgress(null);
          addLog(`✓ Edge analysis complete for ${totalToScan} cards.`);
        });
      }

      if (skippedCount > 0) {
          addLog(`Skipped ${skippedCount} files larger than ${MAX_SIZE_MB}MB.`);
      }
  }, [settings.aspectRatio]);

  // Synchronize initialFiles from directory drops passed via props
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      processFiles(initialFiles);
      if (folderName) {
        addLog(`📁 Directory Batch enqueued: "${folderName}" (${initialFiles.length} cards)`);
      }
      onClearInitialFiles?.();
    }
  }, [initialFiles, folderName, processFiles, onClearInitialFiles]);

  // Synchronize dynamic directory enqueue events
  useEffect(() => {
    const handleEnqueueEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ files: File[]; folderName?: string }>;
      if (customEvent.detail && customEvent.detail.files && customEvent.detail.files.length > 0) {
        processFiles(customEvent.detail.files);
        if (customEvent.detail.folderName) {
          addLog(`📁 Directory Batch enqueued: "${customEvent.detail.folderName}" (${customEvent.detail.files.length} cards)`);
        }
      }
    };

    window.addEventListener('batch-queue-enqueue', handleEnqueueEvent);
    return () => {
      window.removeEventListener('batch-queue-enqueue', handleEnqueueEvent);
    };
  }, [processFiles]);

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: any, event: any) => {
    if (event?.dataTransfer) {
      try {
        const scanned = await scanDroppedItems(event.dataTransfer, acceptedFiles);
        if (scanned.files.length > 0) {
          await processFiles(scanned.files);
          if (scanned.directoryName) {
            addLog(`📁 Loaded "${scanned.directoryName}" (${scanned.files.length} cards)`);
          }
          return;
        }
      } catch (err: any) {
        console.warn("Scan dropped items fallback:", err);
      }
    }

    if (acceptedFiles && acceptedFiles.length > 0) {
      await processFiles(acceptedFiles);
    }
  }, [processFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.heic', '.gif'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
    },
    noClick: true,
    noKeyboard: true
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        await processFiles(event.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAll = () => {
      if (isBatchRendering || isProcessing) {
          if (!window.confirm("Processing is active. Are you sure you want to stop and clear?")) return;
      }
      isCancelledRef.current = true;
      isPausedRef.current = false;
      setIsPaused(false);
      setIsBatchRendering(false);
      cards.forEach(c => {
          URL.revokeObjectURL(c.previewUrl);
          if (c.processedUrl && c.processedUrl.startsWith('blob:')) {
            URL.revokeObjectURL(c.processedUrl);
          }
      });
      setCards([]);
      setSelectedCardForView(null);
      clearBatchSession();
      setSavedSession(null);
      addLog("Queue cleared. Memory and storage released.");
  };

  /**
   * CORE BATCH FILTER & ENHANCEMENT ENGINE
   * Processes cards with controlled concurrency, real-time throughput metrics,
   * live ETA estimation, pause/resume capabilities, and instant crash-proof session saving.
   */
  const handleApplyEnhancementsToAll = async (cardsOverride?: CardImage[], onlyPending = false) => {
    const currentCards = cardsOverride || cards;
    if (currentCards.length === 0 || isBatchRendering || isProcessing) return;

    setIsBatchRendering(true);
    setIsPaused(false);
    isPausedRef.current = false;
    isCancelledRef.current = false;
    setElapsedSeconds(0);
    setThroughputCardsPerSec(0);
    setAvgMsPerCard(0);
    setEstimatedSecondsRemaining(null);

    const cardsToProcess = onlyPending 
      ? currentCards.filter(c => c.status !== ProcessingStatus.Completed)
      : [...currentCards];

    const totalCount = currentCards.length;
    const initialCompleted = totalCount - cardsToProcess.length;
    let completedCounter = initialCompleted;
    let completedInRun = 0;

    setBatchRenderProgress({ completed: completedCounter, total: totalCount });
    const runStartTime = performance.now();
    addLog(`[Batch Enhancer] Starting non-blocking enhancement for ${cardsToProcess.length} cards (${initialCompleted} already enhanced)...`);

    // Set pending cards to Processing status
    setCards(prev => prev.map(c => {
      if (!onlyPending || c.status !== ProcessingStatus.Completed) {
        return { ...c, status: ProcessingStatus.Processing };
      }
      return c;
    }));

    const results: any[] = [];
    const MAX_CONCURRENT_WORKERS = 3;

    const worker = async () => {
      while (cardsToProcess.length > 0) {
        if (isCancelledRef.current) break;

        // Yield while paused by user
        while (isPausedRef.current && !isCancelledRef.current) {
          await new Promise(r => setTimeout(r, 100));
        }
        if (isCancelledRef.current) break;

        const card = cardsToProcess.shift();
        if (!card) break;

        setActiveProcessingCardName(card.file.name);
        const cardStartTime = performance.now();

        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to decode image data for ${card.file.name}`));
            img.src = card.previewUrl;
          });

          if (isCancelledRef.current) break;

          // Determine effective quad
          const effectiveQuad: CropQuad = card.quad || (settings.autoCrop 
            ? detectCardEdges(img, settings.aspectRatio) 
            : {
                topLeft: { x: 0, y: 0 },
                topRight: { x: 1, y: 0 },
                bottomRight: { x: 1, y: 1 },
                bottomLeft: { x: 0, y: 1 }
              });

          // Determine effective settings
          const effectiveSettings: ProcessingSettings = {
            ...settings,
            ...(card.customSettings || {})
          };

          const result = await processCardComplete(img, effectiveQuad, effectiveSettings);

          completedCounter++;
          completedInRun++;
          setBatchRenderProgress({ completed: completedCounter, total: totalCount });

          // Update card in real-time in grid
          setCards(prev => prev.map(c => 
            c.id === card.id 
              ? { 
                  ...c, 
                  status: ProcessingStatus.Completed, 
                  processedUrl: result.blobUrl,
                  originalWidth: result.width,
                  originalHeight: result.height,
                  quad: effectiveQuad
                } 
              : c
          ));

          // Real-time calculation of Throughput & Time Remaining
          const now = performance.now();
          const elapsedSec = (now - runStartTime) / 1000;
          if (elapsedSec > 0.2 && completedInRun > 0) {
            const rate = completedInRun / elapsedSec; // cards per second
            const remaining = totalCount - completedCounter;
            const etaSec = rate > 0 ? remaining / rate : 0;
            const avgMs = (now - runStartTime) / completedInRun;
            setThroughputCardsPerSec(rate);
            setAvgMsPerCard(avgMs);
            setEstimatedSecondsRemaining(etaSec);
          }

          // Instant persist to IndexedDB so session is crash-proof
          updateCardRecordInSession(
            card.id, 
            ProcessingStatus.Completed, 
            result.blob, 
            result.width, 
            result.height
          );

          addLog(`[Enhancer] ✓ Processed "${card.file.name}" (${result.width}x${result.height}) in ${Math.round(performance.now() - cardStartTime)}ms`);
          results.push({
            cardId: card.id,
            fileName: card.file.name,
            blob: result.blob,
            blobUrl: result.blobUrl,
            width: result.width,
            height: result.height
          });
        } catch (err: any) {
          addLog(`[Enhancer ERROR] ✗ "${card.file.name}": ${err?.message || 'Enhancement failed'}`);
          setCards(prev => prev.map(c => 
            c.id === card.id ? { ...c, status: ProcessingStatus.Failed } : c
          ));
          updateCardRecordInSession(card.id, ProcessingStatus.Failed);
        }

        // Yield main thread to prevent frame drops and keep browser smooth
        await new Promise(r => setTimeout(r, 10));
      }
    };

    const workerPromises = Array.from(
      { length: Math.min(MAX_CONCURRENT_WORKERS, cardsToProcess.length + 1) }, 
      () => worker()
    );

    await Promise.all(workerPromises);
    const totalTime = Math.round(performance.now() - runStartTime);

    setActiveProcessingCardName(null);
    setIsBatchRendering(false);
    setIsPaused(false);
    isPausedRef.current = false;

    if (isCancelledRef.current) {
      addLog(`[Batch Enhancer] Batch processing halted by user.`);
    } else {
      addLog(`[Batch Enhancer] Finished ${completedCounter}/${totalCount} cards in ${(totalTime / 1000).toFixed(1)}s.`);
    }
  };

  /**
   * Reset enhancements and revert to original scans
   */
  const handleResetEnhancements = () => {
    cards.forEach(c => {
      if (c.processedUrl && c.processedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(c.processedUrl);
      }
    });
    setCards(prev => prev.map(c => ({
      ...c,
      status: ProcessingStatus.Pending,
      processedUrl: undefined
    })));
    addLog("Reverted all cards to original scans.");
  };

  /**
   * Bulk Export: Download compressed ZIP containing all enhanced images + JSON / CSV manifests
   */
  const handleDownloadBatchZip = async () => {
    if (cards.length === 0) return;
    setIsDownloading(true);

    try {
      addLog(`Preparing Batch ZIP Archive for ${cards.length} cards...`);
      const zip = new JSZip();
      const imagesFolder = zip.folder("cards") || zip;

      const exportPromises = cards.map(async (card, idx) => {
        let exportBlob: Blob;

        if (card.processedUrl) {
          const response = await fetch(card.processedUrl);
          exportBlob = await response.blob();
        } else {
          // If not yet enhanced, process now on-the-fly
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to load ${card.file.name}`));
            img.src = card.previewUrl;
          });

          const effectiveQuad: CropQuad = card.quad || (settings.autoCrop 
            ? detectCardEdges(img, settings.aspectRatio) 
            : {
                topLeft: { x: 0, y: 0 },
                topRight: { x: 1, y: 0 },
                bottomRight: { x: 1, y: 1 },
                bottomLeft: { x: 0, y: 1 }
              });

          const result = await processCardComplete(img, effectiveQuad, settings);
          exportBlob = result.blob;
        }

        const safeName = card.file.name.replace(/\.[^/.]+$/, "");
        const meta = card.metadata;
        let enhancedFileName = `enhanced_${safeName}.png`;
        if (meta?.cardSeries || meta?.year || meta?.setName) {
          const yearPrefix = meta.year ? `${meta.year}_` : '';
          const seriesPrefix = meta.cardSeries ? `${meta.cardSeries.replace(/\s+/g, '_')}_` : '';
          const setPrefix = meta.setName ? `${meta.setName.replace(/\s+/g, '_')}_` : '';
          enhancedFileName = `${yearPrefix}${seriesPrefix}${setPrefix}enhanced_${safeName}.png`;
        }
        imagesFolder.file(enhancedFileName, exportBlob);
      });

      await Promise.all(exportPromises);

      // Add Manifests with rich metadata tags
      const manifestJSON = cards.map(c => {
        const safeName = c.file.name.replace(/\.[^/.]+$/, "");
        const meta = c.metadata;
        let enhancedFileName = `enhanced_${safeName}.png`;
        if (meta?.cardSeries || meta?.year || meta?.setName) {
          const yearPrefix = meta.year ? `${meta.year}_` : '';
          const seriesPrefix = meta.cardSeries ? `${meta.cardSeries.replace(/\s+/g, '_')}_` : '';
          const setPrefix = meta.setName ? `${meta.setName.replace(/\s+/g, '_')}_` : '';
          enhancedFileName = `${yearPrefix}${seriesPrefix}${setPrefix}enhanced_${safeName}.png`;
        }
        return {
          fileName: c.file.name,
          enhancedName: enhancedFileName,
          originalSize: `${c.originalWidth || 0}x${c.originalHeight || 0}`,
          status: c.status,
          cardSeries: meta?.cardSeries || null,
          year: meta?.year || null,
          setName: meta?.setName || null,
          player: meta?.player || null,
          gradeTarget: meta?.gradeTarget || null,
          notes: meta?.notes || null
        };
      });
      zip.file("manifest.json", JSON.stringify(manifestJSON, null, 2));

      const csvRows = [
        ["Original File", "Enhanced File", "Series", "Year", "Set / Parallel", "Player", "Target Grade", "Dimensions", "Status", "Notes"].join(","),
        ...cards.map(c => {
          const safeName = c.file.name.replace(/\.[^/.]+$/, "");
          const meta = c.metadata;
          let enhancedFileName = `enhanced_${safeName}.png`;
          if (meta?.cardSeries || meta?.year || meta?.setName) {
            const yearPrefix = meta.year ? `${meta.year}_` : '';
            const seriesPrefix = meta.cardSeries ? `${meta.cardSeries.replace(/\s+/g, '_')}_` : '';
            const setPrefix = meta.setName ? `${meta.setName.replace(/\s+/g, '_')}_` : '';
            enhancedFileName = `${yearPrefix}${seriesPrefix}${setPrefix}enhanced_${safeName}.png`;
          }
          return [
            `"${c.file.name}"`,
            `"${enhancedFileName}"`,
            `"${meta?.cardSeries || ''}"`,
            `"${meta?.year || ''}"`,
            `"${meta?.setName || ''}"`,
            `"${meta?.player || ''}"`,
            `"${meta?.gradeTarget || ''}"`,
            `"${c.originalWidth || 0}x${c.originalHeight || 0}"`,
            `"${c.status}"`,
            `"${meta?.notes || ''}"`
          ].join(",");
        })
      ].join("\n");
      zip.file("manifest.csv", csvRows);

      addLog("Compressing archive...");
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `cardcrop_batch_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      const sizeMB = (zipBlob.size / (1024 * 1024)).toFixed(2);
      addLog(`[Export] Successfully downloaded "cardcrop_batch_${Date.now()}.zip" (${sizeMB} MB)!`);
    } catch (err: any) {
      console.error(err);
      addLog(`[Export ERROR] Failed to generate ZIP: ${err?.message || err}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const completedCount = cards.filter(c => c.status === ProcessingStatus.Completed).length;

  return (
    <div className="flex flex-col h-full bg-[#070b12] text-slate-100 overflow-hidden font-sans">
      
      {/* Top Action Toolbar */}
      <div className="p-3 md:px-6 bg-[#0c121e] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3 shadow-md z-10">
        
        {/* Left: Queue Info & Upload */}
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
               <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/40 text-cyan-300">
                 <Layers size={18} />
               </div>
               <div>
                 <h2 className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wider">
                   Batch Card Editor
                 </h2>
                 <div className="flex items-center gap-2">
                   <p className="text-[10px] font-mono text-slate-400">
                     {cards.length} Cards in Queue • {completedCount} Enhanced
                   </p>
                   {scanQueueProgress && (
                     <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                       <Loader2 size={10} className="animate-spin text-cyan-300" />
                       Scanning: {scanQueueProgress.processed}/{scanQueueProgress.total}
                     </span>
                   )}
                 </div>
               </div>
            </div>

            <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Upload size={13} />
              <span>Add Cards</span>
            </button>

            <button
              id="btn-batch-open-settings"
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-2.5 py-1.5 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
              title="Configure API Keys (Gemini, OpenRouter, Venice, OpenAI, xAI) & Railway Backend"
            >
              <Settings2 size={13} className="text-cyan-400" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {cards.length > 0 && (
              <>
                <button
                  id="btn-auto-center-all-cards"
                  onClick={handleAutoCenterAllCards}
                  className="px-3 py-1.5 rounded-md bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Square and 50/50 center crop quads for all cards in the batch queue"
                >
                  <Crop size={13} className="text-cyan-400" />
                  <span>Center All (50/50)</span>
                </button>

                <button
                  id="btn-open-batch-metadata"
                  onClick={() => setIsMetadataModalOpen(true)}
                  className="px-3 py-1.5 rounded-md bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Bulk edit series, release year, player, and grading metadata for all cards in queue"
                >
                  <Tag size={13} className="text-cyan-400" />
                  <span>Batch Metadata</span>
                </button>

                <button 
                  onClick={clearAll}
                  className="px-2.5 py-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-500/50 text-xs font-mono transition-colors flex items-center gap-1"
                  title="Clear all cards from batch queue"
                >
                  <Trash2 size={12} />
                  <span className="hidden md:inline">Clear</span>
                </button>
              </>
            )}
        </div>

        {/* Center: Live Preview Mode Switcher */}
        {cards.length > 0 && (
          <div className="flex items-center gap-1 bg-black/50 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setPreviewMode('enhanced')}
              className={`px-3 py-1 rounded text-[11px] font-mono font-medium transition-all ${
                previewMode === 'enhanced'
                  ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(0,243,255,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Enhanced View
            </button>
            <button
              onClick={() => setPreviewMode('original')}
              className={`px-3 py-1 rounded text-[11px] font-mono font-medium transition-all ${
                previewMode === 'original'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Original Scans
            </button>
          </div>
        )}

        {/* Right: Primary Batch Execution Buttons */}
        <div className="flex items-center gap-2">
            <button 
              onClick={() => handleApplyEnhancementsToAll()}
              disabled={cards.length === 0 || isBatchRendering || isProcessing}
              className="px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 font-mono bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(0,243,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Apply contrast, sharpening, descratching, and edge crop across all cards in the batch"
            >
              {isBatchRendering ? <Loader2 className="animate-spin text-slate-950" size={14} /> : <Sparkles size={14} />}
              {isBatchRendering 
                ? `ENHANCING (${batchRenderProgress.completed}/${batchRenderProgress.total})...` 
                : 'APPLY ENHANCEMENTS TO ALL'}
            </button>

            <button 
              onClick={handleDownloadBatchZip}
              disabled={cards.length === 0 || isDownloading || isBatchRendering}
              className="px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 font-mono bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Download all enhanced card images in full resolution with manifests as a ZIP"
            >
              {isDownloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
              <span>DOWNLOAD ZIP</span>
            </button>
        </div>
        <input 
          type="file" 
          multiple 
          accept="image/*,.zip,application/zip,application/x-zip-compressed" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileSelect}
        />
      </div>

      {/* Visual Time Remaining, Speed Throughput & Processing Controls Bar */}
      <BatchProcessingProgressBar
        isRendering={isBatchRendering}
        isPaused={isPaused}
        completed={batchRenderProgress.completed}
        total={batchRenderProgress.total}
        throughputCardsPerSec={throughputCardsPerSec}
        avgMsPerCard={avgMsPerCard}
        estimatedSecondsRemaining={estimatedSecondsRemaining}
        elapsedSeconds={elapsedSeconds}
        currentFileName={activeProcessingCardName}
        onTogglePause={handleTogglePause}
        onCancel={handleCancelBatch}
      />

      {/* Bulk-Action Metadata Panel: 1-Click Card Series, Year & Set Assignment Before Export */}
      {cards.length > 0 && (
        <BatchBulkActionPanel
          totalCards={cards.length}
          activeMetadataCount={taggedCardsCount}
          onApplyMetadata={handleApplyBulkMetadata}
          onClearMetadata={handleClearBulkMetadata}
          onStartExport={handleDownloadBatchZip}
          onApplyEnhancements={() => handleApplyEnhancementsToAll()}
          isProcessing={isBatchRendering}
          isExporting={isDownloading}
        />
      )}

      {/* Main Workspace Layout */}
      <div {...getRootProps()} className="flex-1 flex overflow-hidden relative">
        <input {...getInputProps()} />

        {/* Global Drag Overlay */}
        {isDragActive && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center p-8 transition-all pointer-events-none">
            <div className="p-5 rounded-2xl bg-cyan-400/20 border border-cyan-400 text-cyan-300 mb-4 shadow-[0_0_30px_rgba(0,243,255,0.6)] animate-bounce">
              <Upload className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-bold font-mono text-cyan-300 tracking-tight">Drop Cards, Folders or ZIPs Here</h3>
            <p className="text-sm font-mono text-slate-300 mt-2 text-center max-w-md">
              Automatically extracting image scans and loading them into the high-performance batch queue
            </p>
          </div>
        )}

        {/* Center Card Grid */}
        <div className="flex-1 p-5 md:p-7 overflow-y-auto relative bg-[#070b12]">
          
          {/* Interrupted Session Recovery Banner */}
          {savedSession && (
            <BatchRecoveryBanner
              savedCards={savedSession.cards}
              savedAt={savedSession.savedAt}
              onResumeProcessing={() => handleResumeSession(true)}
              onRestoreToQueue={() => handleResumeSession(false)}
              onDiscardSession={handleDiscardSession}
            />
          )}

          {cards.length === 0 ? (
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="h-full min-h-[420px] border-2 border-dashed border-cyan-500/30 bg-cyan-500/[0.02] rounded-xl flex flex-col items-center justify-center text-cyan-300/70 cursor-pointer hover:border-cyan-400 hover:bg-cyan-500/[0.05] transition-all group p-8"
             >
               <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-[0_0_25px_rgba(0,243,255,0.2)] group-hover:scale-105 transition-all">
                  <Upload size={28} />
               </div>
               <p className="font-mono text-base font-bold text-cyan-300">Drop Card Scans or Folders to Begin</p>
               <p className="text-xs font-mono text-slate-400 mt-1.5 text-center max-w-md">
                 Batch enhance contrast, remove scratches & scanner dust, sharpen details, and auto-crop standard trading cards in full resolution.
               </p>
               
               <div className="mt-6 flex items-center gap-3">
                 <button
                   onClick={(e) => {
                     e.stopPropagation();
                     fileInputRef.current?.click();
                   }}
                   className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg font-mono text-xs transition-all shadow-[0_0_20px_rgba(0,243,255,0.3)] flex items-center gap-2"
                 >
                   <Upload size={16} /> Select Card Images
                 </button>
               </div>
             </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 relative z-0">
              {cards.map(card => {
                const currentImgSrc = (previewMode === 'enhanced' && card.processedUrl) 
                  ? card.processedUrl 
                  : card.previewUrl;

                return (
                  <div 
                    key={card.id} 
                    className="group relative bg-[#0d1424] border border-cyan-500/25 hover:border-cyan-400 rounded-lg overflow-hidden shadow-lg hover:shadow-[0_4px_25px_rgba(0,243,255,0.25)] transition-all flex flex-col cursor-pointer"
                    onClick={() => setEditingCard(card)}
                  >
                    <div className="aspect-[3/4] relative bg-black/80 p-2 flex items-center justify-center overflow-hidden">
                      <img 
                        src={currentImgSrc} 
                        alt={card.file.name} 
                        className={`w-full h-full object-contain rounded transition-all ${
                          card.status === ProcessingStatus.Processing ? 'opacity-50 blur-sm scale-[0.98]' : 'scale-100'
                        }`} 
                      />
                      
                      {/* Status Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                           {card.status === ProcessingStatus.Completed && (
                               <div className="bg-emerald-500/90 text-slate-950 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                                   <CheckCircle2 size={11} /> ENHANCED
                               </div>
                           )}
                           {card.status === ProcessingStatus.Processing && (
                               <div className="bg-cyan-500/90 text-slate-950 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono flex items-center gap-1 animate-pulse">
                                   <Loader2 size={11} className="animate-spin" /> WORKING
                               </div>
                           )}
                           {card.status === ProcessingStatus.Failed && (
                               <div className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">
                                   FAILED
                               </div>
                           )}
                      </div>

                      {/* Top Right Quick Delete */}
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            URL.revokeObjectURL(card.previewUrl);
                            if (card.processedUrl && card.processedUrl.startsWith('blob:')) {
                              URL.revokeObjectURL(card.processedUrl);
                            }
                            setCards(prev => prev.filter(c => c.id !== card.id));
                            if (selectedCardForView?.id === card.id) setSelectedCardForView(null);
                            if (editingCard?.id === card.id) setEditingCard(null);
                        }}
                        className="absolute top-2 right-2 bg-black/70 hover:bg-red-500 p-1.5 rounded text-slate-300 hover:text-white opacity-0 group-hover:opacity-100 transition-all border border-slate-700 hover:border-red-400 z-10"
                        title="Remove from batch"
                      >
                        <X size={12} />
                      </button>

                      {/* Bottom Action Bar */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all z-10 gap-1.5">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCard(card);
                          }}
                          className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-1 px-2 rounded text-[10px] font-mono font-bold flex items-center justify-center gap-1 shadow-md transition-colors"
                        >
                          <Crop size={11} /> Fine-Tune
                        </button>
                      </div>
                    </div>

                    {/* Card Label Footer */}
                    <div className="p-2.5 bg-[#090e1a] border-t border-cyan-500/15 flex flex-col gap-0.5">
                       <span className="text-[11px] font-mono text-cyan-200 truncate font-semibold" title={card.file.name}>
                         {card.file.name}
                       </span>
                       {(card.metadata?.cardSeries || card.metadata?.setName) && (
                         <span className="text-[10px] font-mono text-cyan-400 truncate flex items-center gap-1 font-semibold">
                           <Tag size={10} className="text-cyan-400 shrink-0" />
                           {card.metadata.year ? `${card.metadata.year} ` : ''}
                           {card.metadata.cardSeries || ''}
                           {card.metadata.setName ? ` [${card.metadata.setName}]` : ''}
                         </span>
                       )}
                       <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                         <span>{card.originalWidth ? `${card.originalWidth}x${card.originalHeight}` : 'Loading...'}</span>
                         {card.processedUrl && (
                           <span className="text-emerald-400 font-bold">100% High-Res</span>
                         )}
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Settings & Filter Sidebar */}
        <div className="w-80 md:w-88 border-l border-cyan-500/20 flex flex-col z-20 bg-[#0a0f1d]">
          
          <div className="p-3.5 border-b border-cyan-500/20 flex items-center justify-between bg-[#0e1526]">
            <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
                    <Sliders size={14} />
                </div>
                <h3 className="font-bold text-xs text-cyan-300 uppercase tracking-wide font-mono">
                  Batch Controls & Filters
                </h3>
            </div>
            <button
              onClick={handleResetEnhancements}
              className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              title="Reset all settings to default"
            >
              <RefreshCw size={10} /> Reset
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-slate-200">
            
            {/* 1-Click Sports Card Optimization Presets */}
            <div className="p-3 bg-[#0d1424] border border-cyan-500/30 rounded-lg space-y-2 shadow-sm">
               <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-cyan-300 uppercase font-mono flex items-center gap-1.5">
                    <Award size={13} className="text-cyan-400" /> Sports Card Presets
                  </label>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                    1-CLICK OPTIMIZE
                  </span>
               </div>
               <p className="text-[10px] font-mono text-slate-400 leading-tight">
                 Pre-tuned optical profiles calibrated for cards, chromium foil, vintage pulp, and slab scratches:
               </p>
               <div className="space-y-1.5 pt-1">
                 {SPORTS_CARD_PRESETS.map(preset => {
                   const isActive = activePresetId === preset.id;
                   return (
                     <button
                       key={preset.id}
                       onClick={() => applySportsPreset(preset.id)}
                       className={`w-full text-left p-2 rounded-md border transition-all flex flex-col gap-0.5 ${
                         isActive 
                           ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,243,255,0.2)]' 
                           : 'bg-black/40 border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:bg-black/60'
                       }`}
                     >
                       <div className="flex items-center justify-between">
                         <span className="text-[11px] font-bold font-mono text-cyan-300 flex items-center gap-1">
                           {preset.name}
                         </span>
                         <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded ${
                           isActive ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                         }`}>
                           {preset.badge}
                         </span>
                       </div>
                       <span className="text-[9px] font-mono text-slate-400 leading-snug">
                         {preset.desc}
                       </span>
                     </button>
                   );
                 })}
               </div>
            </div>

            {/* Auto-Crop & Centering */}
            <div className="p-3 bg-[#0d1424] border border-cyan-500/20 rounded-lg space-y-2.5">
               <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-cyan-300 uppercase font-mono flex items-center gap-1.5">
                    <Crop size={13} /> Auto-Crop & Perspective
                  </label>
                  <input 
                    type="checkbox" 
                    checked={settings.autoCrop}
                    onChange={(e) => setSettings({...settings, autoCrop: e.target.checked})}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
               </div>

               {settings.autoCrop && (
                 <div className="space-y-1 pt-1">
                   <div className="flex justify-between text-[10px] font-mono text-slate-400">
                     <span>Target Aspect Ratio:</span>
                     <span className="text-cyan-300 font-bold">Standard (2.5 : 3.5)</span>
                   </div>
                   <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                     <button
                       onClick={() => setSettings({...settings, aspectRatio: 2.5 / 3.5})}
                       className={`p-1.5 rounded border text-center transition-colors ${
                         Math.abs(settings.aspectRatio - 2.5/3.5) < 0.01 
                           ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold' 
                           : 'bg-black/30 border-slate-700 text-slate-400'
                       }`}
                     >
                       Standard 2.5x3.5
                     </button>
                     <button
                       onClick={() => setSettings({...settings, aspectRatio: 800 / 1120})}
                       className={`p-1.5 rounded border text-center transition-colors ${
                         Math.abs(settings.aspectRatio - 800/1120) < 0.01 
                           ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold' 
                           : 'bg-black/30 border-slate-700 text-slate-400'
                       }`}
                     >
                       PSA Slab Ratio
                     </button>
                   </div>
                 </div>
               )}
            </div>

            {/* Hardware Filters & Descratching Toggles */}
            <div className="p-3 bg-[#0d1424] border border-cyan-500/20 rounded-lg space-y-2.5">
               <label className="text-[11px] font-bold text-cyan-300 uppercase font-mono flex items-center gap-1.5 mb-1">
                 <Wand2 size={13} /> Restoration & Repair Filters
               </label>

               <label className="flex items-center justify-between p-2 bg-black/40 rounded border border-slate-800 hover:border-cyan-500/40 transition-colors cursor-pointer">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-mono text-cyan-200 flex items-center gap-1.5">
                      Descratch & Surface Polish
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      Removes hairline scratches & surface scuffs
                    </span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settings.enableDescratching}
                    onChange={(e) => setSettings({...settings, enableDescratching: e.target.checked})}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
               </label>

               <label className="flex items-center justify-between p-2 bg-black/40 rounded border border-slate-800 hover:border-cyan-500/40 transition-colors cursor-pointer">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-mono text-cyan-200 flex items-center gap-1.5">
                      Micro-Dust & Speckle Cleaner
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      Suppresses scanner glass dust particles
                    </span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={!!settings.microDustFilter}
                    onChange={(e) => setSettings({...settings, microDustFilter: e.target.checked})}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
               </label>

               <label className="flex items-center justify-between p-2 bg-black/40 rounded border border-slate-800 hover:border-cyan-500/40 transition-colors cursor-pointer">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-mono text-cyan-200 flex items-center gap-1.5">
                      Anti-Glare & Highlight Recovery
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      Recovers washed-out chrome / foil parallels
                    </span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={!!settings.antiGlare}
                    onChange={(e) => setSettings({...settings, antiGlare: e.target.checked})}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
               </label>

               <label className="flex items-center justify-between p-2 bg-black/40 rounded border border-slate-800 hover:border-cyan-500/40 transition-colors cursor-pointer">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-mono text-cyan-200 flex items-center gap-1.5">
                      Refractor & Foil Hologram Pop
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      Boosts prizm / speckle foil micro-contrast
                    </span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={!!settings.chromeParallelClarity}
                    onChange={(e) => setSettings({...settings, chromeParallelClarity: e.target.checked})}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
               </label>
            </div>

            {/* Manual Color & Contrast Sliders */}
            <div className="p-3 bg-[#0d1424] border border-cyan-500/20 rounded-lg space-y-3">
               <label className="text-[11px] font-bold text-cyan-300 uppercase font-mono flex items-center gap-1.5">
                 <Sliders size={13} /> Optical Adjustments
               </label>

               {/* Contrast */}
               <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                     <span className="text-slate-300">Contrast</span>
                     <span className="text-cyan-300 font-bold">{settings.contrast.toFixed(2)}x</span>
                  </div>
                  <input
                     type="range"
                     min="0.5"
                     max="2.2"
                     step="0.05"
                     value={settings.contrast}
                     onChange={(e) => setSettings({...settings, contrast: parseFloat(e.target.value)})}
                     className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                  />
               </div>

               {/* Sharpening */}
               <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                     <span className="text-slate-300">Sharpening (Unsharp Mask)</span>
                     <span className="text-cyan-300 font-bold">{Math.round(settings.sharpen * 100)}%</span>
                  </div>
                  <input
                     type="range"
                     min="0.0"
                     max="1.2"
                     step="0.05"
                     value={settings.sharpen}
                     onChange={(e) => setSettings({...settings, sharpen: parseFloat(e.target.value)})}
                     className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                  />
               </div>

               {/* Brightness */}
               <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                     <span className="text-slate-300">Brightness</span>
                     <span className="text-cyan-300 font-bold">
                       {settings.brightness > 0 ? `+${Math.round(settings.brightness * 100)}%` : `${Math.round(settings.brightness * 100)}%`}
                     </span>
                  </div>
                  <input
                     type="range"
                     min="-0.4"
                     max="0.4"
                     step="0.02"
                     value={settings.brightness}
                     onChange={(e) => setSettings({...settings, brightness: parseFloat(e.target.value)})}
                     className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                  />
               </div>

               {/* Vibrance */}
               <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                     <span className="text-slate-300">Color Vibrance</span>
                     <span className="text-cyan-300 font-bold">
                       {settings.vibrance > 0 ? `+${Math.round(settings.vibrance * 100)}%` : `${Math.round(settings.vibrance * 100)}%`}
                     </span>
                  </div>
                  <input
                     type="range"
                     min="-0.4"
                     max="0.6"
                     step="0.05"
                     value={settings.vibrance}
                     onChange={(e) => setSettings({...settings, vibrance: parseFloat(e.target.value)})}
                     className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                  />
               </div>
            </div>

            {/* Execution CTA in Sidebar */}
            <div className="space-y-2 pt-1">
               <button
                 onClick={() => handleApplyEnhancementsToAll()}
                 disabled={cards.length === 0 || isBatchRendering || isProcessing}
                 className="w-full py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,243,255,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
               >
                 {isBatchRendering ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                 <span>APPLY TO ALL {cards.length} CARDS</span>
               </button>
            </div>

            {/* Activity Log */}
            <div className="space-y-1.5 pt-2 border-t border-cyan-500/20">
                <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300 font-bold uppercase">
                    <span>Batch Execution Log</span>
                    <span className="text-emerald-400 animate-pulse">LIVE</span>
                </div>
                <div className="h-32 bg-black/60 border border-slate-800 p-2 rounded overflow-y-auto text-[9px] font-mono text-slate-300 custom-scrollbar">
                    {logs.length === 0 && <span className="text-slate-500">Ready. Drag cards to begin...</span>}
                    {logs.map((log, i) => (
                        <div key={i} className="mb-0.5 leading-relaxed">
                            {log.includes('ERROR') ? <span className="text-red-400">{log}</span> :
                             log.includes('Processed') || log.includes('download') ? <span className="text-emerald-400">{log}</span> : log}
                        </div>
                    ))}
                    <div ref={logsEndRef}></div>
                </div>
            </div>

          </div>
        </div>
      </div>

      {/* Single Item Fine-Tune Modal */}
      {editingCard && (
        <BatchItemEditorModal
          card={editingCard}
          globalSettings={settings}
          isOpen={!!editingCard}
          onClose={() => setEditingCard(null)}
          onSave={(updatedCard) => {
            setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
            setEditingCard(null);
            addLog(`Saved fine-tuned settings for "${updatedCard.file.name}".`);
          }}
        />
      )}

      {/* Bulk Metadata Editor Modal */}
      <BatchMetadataModal
        isOpen={isMetadataModalOpen}
        totalCards={cards.length}
        onClose={() => setIsMetadataModalOpen(false)}
        onApply={handleApplyBulkMetadata}
      />

      {/* Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

    </div>
  );
};

export default BatchCropper;
