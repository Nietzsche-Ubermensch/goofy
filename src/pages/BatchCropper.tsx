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
  Maximize2
} from 'lucide-react';
import { CardImage, ProcessingStatus, ProcessingSettings, AIProvider, EnhancementSettings, CropQuad } from '../types';
import { analyzeCardDamage, restoreCard } from '../services/aiService';
import { detectCardEdges } from '../utils/edgeDetection';
import { processCardComplete } from '../utils/imageEnhancer';
import { BatchItemEditorModal } from '../components/BatchItemEditorModal';
import JSZip from 'jszip';

export interface BatchCropperProps {
  initialFiles?: File[];
  folderName?: string;
  onClearInitialFiles?: () => void;
}

const BatchCropper: React.FC<BatchCropperProps> = ({ initialFiles, folderName, onClearInitialFiles }) => {
  const [cards, setCards] = useState<CardImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBatchRendering, setIsBatchRendering] = useState(false);
  const [batchRenderProgress, setBatchRenderProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedCardForView, setSelectedCardForView] = useState<CardImage | null>(null);
  const [editingCard, setEditingCard] = useState<CardImage | null>(null);
  const [previewMode, setPreviewMode] = useState<'enhanced' | 'original'>('enhanced');
  
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
      modelId: 'gemini-2.5-flash'
    },
    // Real Optical & Filter Controls
    brightness: 0.0,
    contrast: 1.15,
    saturation: 1.1,
    vibrance: 0.15,
    sharpen: 0.4,
    descratchThreshold: 0.14,
    descratchRadius: 2.5,
    microDustFilter: true,
    antiGlare: true,
    chromeParallelClarity: true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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

  const processFiles = useCallback((fileList: FileList | File[]) => {
      const MAX_SIZE_MB = 40;
      const MAX_BATCH_SIZE = 100;
      
      const files = Array.from(fileList) as File[];
      
      if (files.length > MAX_BATCH_SIZE) {
          addLog(`Notice: Selected ${files.length} files. Processing first ${MAX_BATCH_SIZE}.`);
      }

      const acceptedFiles = files.slice(0, MAX_BATCH_SIZE);
      let skippedCount = 0;

      acceptedFiles.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            skippedCount++;
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        const cardId = Math.random().toString(36).substring(2, 11);

        // Probe dimensions & auto-detect quad
        const probeImg = new Image();
        probeImg.crossOrigin = 'anonymous';
        probeImg.onload = () => {
          const w = probeImg.naturalWidth || probeImg.width;
          const h = probeImg.naturalHeight || probeImg.height;
          const detectedQuad = detectCardEdges(probeImg, settings.aspectRatio);

          setCards(prev => prev.map(c => 
            c.id === cardId 
              ? { 
                  ...c, 
                  originalWidth: w, 
                  originalHeight: h,
                  quad: detectedQuad
                } 
              : c
          ));
        };
        probeImg.src = previewUrl;

        const newCard: CardImage = {
            id: cardId,
            file,
            previewUrl,
            status: ProcessingStatus.Pending,
            originalWidth: 0,
            originalHeight: 0
        };

        setCards(prev => [...prev, newCard]);
      });

      if (skippedCount > 0) {
          addLog(`Skipped ${skippedCount} files larger than ${MAX_SIZE_MB}MB.`);
      }

      addLog(`Added ${acceptedFiles.length - skippedCount} cards to batch queue.`);
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      processFiles(acceptedFiles);
    }
  }, [processFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.heic', '.gif']
    },
    noClick: true,
    noKeyboard: true
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        processFiles(event.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAll = () => {
      if (isBatchRendering || isProcessing) {
          if (!window.confirm("Processing is active. Are you sure you want to stop and clear?")) return;
      }
      cards.forEach(c => {
          URL.revokeObjectURL(c.previewUrl);
          if (c.processedUrl && c.processedUrl.startsWith('blob:')) {
            URL.revokeObjectURL(c.processedUrl);
          }
      });
      setCards([]);
      setSelectedCardForView(null);
      addLog("Queue cleared. Memory released.");
  };

  /**
   * CORE BATCH FILTER & ENHANCEMENT ENGINE
   * Processes all cards in the batch queue using real pixel transformations.
   */
  const handleApplyEnhancementsToAll = async () => {
    if (cards.length === 0 || isBatchRendering || isProcessing) return;

    setIsBatchRendering(true);
    setBatchRenderProgress({ completed: 0, total: cards.length });
    const startTime = performance.now();
    addLog(`[Batch Enhancer] Applying active filters to all ${cards.length} cards in queue...`);

    // Set all cards to Processing status
    setCards(prev => prev.map(c => ({ ...c, status: ProcessingStatus.Processing })));

    let completedCounter = 0;

    const renderPromises = cards.map(async (card) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to decode image data for ${card.file.name}`));
          img.src = card.previewUrl;
        });

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
        setBatchRenderProgress({ completed: completedCounter, total: cards.length });

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

        addLog(`[Enhancer] ✓ Processed "${card.file.name}" (${result.width}x${result.height})`);
        return {
          cardId: card.id,
          fileName: card.file.name,
          blob: result.blob,
          blobUrl: result.blobUrl,
          width: result.width,
          height: result.height
        };
      } catch (err: any) {
        addLog(`[Enhancer ERROR] ✗ "${card.file.name}": ${err?.message || 'Enhancement failed'}`);
        setCards(prev => prev.map(c => 
          c.id === card.id ? { ...c, status: ProcessingStatus.Failed } : c
        ));
        return null;
      }
    });

    const results = await Promise.all(renderPromises);
    const successful = results.filter((r): r is NonNullable<typeof r> => r !== null);
    const totalTime = Math.round(performance.now() - startTime);

    setIsBatchRendering(false);
    addLog(`[Batch Enhancer] Finished ${successful.length}/${cards.length} cards in ${totalTime}ms.`);
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
        imagesFolder.file(`enhanced_${safeName}.png`, exportBlob);
      });

      await Promise.all(exportPromises);

      // Add Manifests
      const manifestJSON = cards.map(c => ({
        fileName: c.file.name,
        enhancedName: `enhanced_${c.file.name.replace(/\.[^/.]+$/, "")}.png`,
        originalSize: `${c.originalWidth || 0}x${c.originalHeight || 0}`,
        status: c.status
      }));
      zip.file("manifest.json", JSON.stringify(manifestJSON, null, 2));

      const csvRows = [
        ["Original File", "Enhanced File", "Dimensions", "Status"].join(","),
        ...cards.map(c => [
          `"${c.file.name}"`,
          `"enhanced_${c.file.name.replace(/\.[^/.]+$/, "")}.png"`,
          `"${c.originalWidth || 0}x${c.originalHeight || 0}"`,
          `"${c.status}"`
        ].join(","))
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
                 <p className="text-[10px] font-mono text-slate-400">
                   {cards.length} Cards in Queue • {completedCount} Enhanced
                 </p>
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

            {cards.length > 0 && (
              <button 
                onClick={clearAll}
                className="px-2.5 py-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-500/50 text-xs font-mono transition-colors flex items-center gap-1"
                title="Clear all cards from batch queue"
              >
                <Trash2 size={12} />
                <span className="hidden md:inline">Clear</span>
              </button>
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
              onClick={handleApplyEnhancementsToAll}
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
        <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelect}/>
      </div>

      {/* Main Workspace Layout */}
      <div {...getRootProps()} className="flex-1 flex overflow-hidden relative">
        <input {...getInputProps()} />

        {/* Global Drag Overlay */}
        {isDragActive && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center p-8 transition-all pointer-events-none">
            <div className="p-5 rounded-2xl bg-cyan-400/20 border border-cyan-400 text-cyan-300 mb-4 shadow-[0_0_30px_rgba(0,243,255,0.6)] animate-bounce">
              <Upload className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-bold font-mono text-cyan-300 tracking-tight">Drop Cards or Folders Here</h3>
            <p className="text-sm font-mono text-slate-300 mt-2 text-center max-w-md">
              Adding all card scans directly into the active batch enhancement queue
            </p>
          </div>
        )}

        {/* Center Card Grid */}
        <div className="flex-1 p-5 md:p-7 overflow-y-auto relative bg-[#070b12]">
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
                 onClick={handleApplyEnhancementsToAll}
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

    </div>
  );
};

export default BatchCropper;
