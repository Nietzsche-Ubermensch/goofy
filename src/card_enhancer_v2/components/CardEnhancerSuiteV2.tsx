import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Sparkles, 
  Upload, 
  Download, 
  RotateCcw, 
  RotateCw, 
  Undo2, 
  Redo2, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  UserCheck, 
  Maximize2,
  Sliders,
  Play,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { useCardEnhancer } from '../hooks/useCardEnhancer';
import { useBatchEnhancer } from '../hooks/useBatchEnhancer';
import { useComparisonSlider } from '../hooks/useComparisonSlider';
import { EnhancerCanvasV2 } from './EnhancerCanvasV2';
import { EnhancerControlsV2 } from './EnhancerControlsV2';
import { PresetsSelectorV2 } from './PresetsSelectorV2';
import { BatchQueueDrawerV2 } from './BatchQueueDrawerV2';
import { BlemishInspectorV2 } from './BlemishInspectorV2';
import { DEFAULT_ENHANCEMENT_PARAMS } from '../core/presets';

export const CardEnhancerSuiteV2: React.FC = () => {
  const {
    activeTask,
    params,
    status,
    progress,
    stageMessage,
    isProcessing,
    canUndo,
    canRedo,
    setCanvas,
    loadCard,
    updateParam,
    applyParams,
    applyPreset,
    undo,
    redo,
    processFullEnhancement,
    presets,
  } = useCardEnhancer();

  const {
    queue,
    isBatchProcessing,
    currentProcessingIndex,
    overallProgress,
    addFilesToQueue,
    removeFromQueue,
    clearQueue,
    applyBulkMetadata,
    runBatchEnhancement,
    exportBatchZip,
  } = useBatchEnhancer();

  const {
    mode: comparisonMode,
    setMode: setComparisonMode,
    sliderPos,
    setSliderPos,
  } = useComparisonSlider();

  // Dropzone for both single edit and batch queue
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    if (acceptedFiles.length === 1 && !activeTask) {
      loadCard(acceptedFiles[0]);
    } else {
      addFilesToQueue(acceptedFiles);
      if (!activeTask) {
        loadCard(acceptedFiles[0]);
      }
    }
  }, [activeTask, loadCard, addFilesToQueue]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    multiple: true,
  });

  const handleExportSingle = async () => {
    const blobUrl = await processFullEnhancement();
    if (blobUrl) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${activeTask?.name.replace(/\.[^/.]+$/, "") || 'card'}_enhanced_${params.upscaleFactor}x.png`;
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 lg:p-6 space-y-6">
      {/* Top Header Banner */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-500/10">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base text-slate-100 tracking-tight">
                Card Enhancer V2
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold">
                GPU REALTIME + AI HD
              </span>
            </div>
            <p className="text-xs text-slate-400">
              WebGL 60fps Shaders • Real-ESRGAN Super-Resolution • Navier-Stokes Inpainting
            </p>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              id="btn-undo"
              onClick={undo}
              disabled={!canUndo}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
              title="Undo parameter change"
            >
              <Undo2 size={15} />
            </button>
            <button
              id="btn-redo"
              onClick={redo}
              disabled={!canRedo}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
              title="Redo parameter change"
            >
              <Redo2 size={15} />
            </button>
          </div>

          {/* Upload Button */}
          <div {...getRootProps()} className="cursor-pointer">
            <input {...getInputProps()} />
            <button
              id="btn-upload-new-card"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700 shadow-sm"
            >
              <Upload size={14} className="text-cyan-400" />
              <span>Upload Card</span>
            </button>
          </div>

          {/* Export Enhanced Card Button */}
          {activeTask && (
            <button
              id="btn-export-single-card"
              onClick={handleExportSingle}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              <Download size={14} />
              <span>Export {params.upscaleFactor}x HD</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Grid: Canvas + Controls */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: Interactive Canvas & Presets */}
        <div className="lg:col-span-8 space-y-5">
          {/* Canvas Box */}
          <div className="w-full h-[620px] rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800 overflow-hidden shadow-2xl relative">
            <EnhancerCanvasV2
              task={activeTask}
              params={params}
              onMountCanvas={setCanvas}
              comparisonMode={comparisonMode}
              onComparisonModeChange={setComparisonMode}
              sliderPos={sliderPos}
              onSliderPosChange={setSliderPos}
            />
          </div>

          {/* Collectible Enhancement Presets */}
          <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-400" />
                <span>Collectible Calibration Presets</span>
              </h3>
              <span className="text-xs text-slate-400">1-Click Custom Profiles</span>
            </div>
            <PresetsSelectorV2
              presets={presets}
              activePresetId={activeTask?.appliedPresetId}
              onSelectPreset={applyPreset}
            />
          </div>

          {/* Batch Processing Queue & Bulk Metadata Editor */}
          <BatchQueueDrawerV2
            queue={queue}
            isProcessing={isBatchProcessing}
            currentProcessingIndex={currentProcessingIndex}
            overallProgress={overallProgress}
            onRemoveItem={removeFromQueue}
            onClearQueue={clearQueue}
            onRunBatch={runBatchEnhancement}
            onExportZip={exportBatchZip}
            onApplyBulkMetadata={applyBulkMetadata}
          />
        </div>

        {/* Right Sidebar: Real-Time Parameter Sliders & Defect Inspector */}
        <div className="lg:col-span-4 space-y-5">
          {/* Controls Panel */}
          <div className="h-[520px] rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
            <EnhancerControlsV2
              params={params}
              onUpdateParam={updateParam}
              onResetParams={() => applyParams(DEFAULT_ENHANCEMENT_PARAMS)}
            />
          </div>

          {/* Defect Inspector */}
          {activeTask && (
            <BlemishInspectorV2
              blemishes={activeTask.blemishes}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CardEnhancerSuiteV2;
