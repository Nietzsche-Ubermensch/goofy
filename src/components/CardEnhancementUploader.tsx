import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Sliders, 
  Layers, 
  Maximize2, 
  RefreshCw, 
  X, 
  ShieldCheck, 
  Zap, 
  Image as ImageIcon,
  Cpu,
  Eye,
  Columns,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface PresetModel {
  id: string;
  name: string;
  description: string;
  recommendedScale: number;
  denoise: number;
  sharpen: number;
  descratch: boolean;
  contrast: number;
  vibrance: number;
  engine: string;
}

export interface EnhancementJobStatus {
  jobId: string;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed' | 'canceled' | 'expired';
  progress: number;
  stage: string;
  preset: string;
  scale: number;
  resultUrl?: string;
  error?: string;
  originalDimensions?: { width: number; height: number };
  enhancedDimensions?: { width: number; height: number };
  metrics?: {
    durationMs: number;
    inputSizeBytes: number;
    outputSizeBytes: number;
    upscaleFactor: number;
    denoiseApplied: number;
    sharpenApplied: number;
  };
}

export const CardEnhancementUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('high-detail-restoration');
  const [selectedScale, setSelectedScale] = useState<number>(2);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeJob, setActiveJob] = useState<EnhancementJobStatus | null>(null);
  const [resultImageBlobUrl, setResultImageBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<PresetModel[]>([]);
  const [compareSliderPos, setCompareSliderPos] = useState<number>(50);
  const [comparisonMode, setComparisonMode] = useState<'slider' | 'side-by-side'>('slider');
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<any>(null);

  // Load Approved Models Catalog on mount
  useEffect(() => {
    fetch('/api/card-enhancement/models')
      .then(res => res.json())
      .then(data => {
        if (data.models) {
          setModels(data.models);
        }
      })
      .catch(err => {
        console.error("Failed to load models:", err);
      });

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    const selected = acceptedFiles[0];
    setFile(selected);
    setError(null);
    setResultImageBlobUrl(null);
    setActiveJob(null);

    const objectUrl = URL.createObjectURL(selected);
    setPreviewUrl(objectUrl);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    multiple: false,
    maxFiles: 1,
    maxSize: 25 * 1024 * 1024, // 25MB max
  });

  const enhanceCard = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResultImageBlobUrl(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('preset', selectedPreset);
      formData.append('scale', selectedScale.toString());

      const response = await fetch('/api/card-enhancement/jobs', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'The enhancement request could not be started.');
      }

      const initialJob = await response.json();
      setActiveJob({
        jobId: initialJob.jobId,
        status: initialJob.status,
        progress: 10,
        stage: initialJob.stage || 'Job submitted',
        preset: initialJob.preset,
        scale: initialJob.scale
      });

      // Start Polling for Status
      pollJobStatus(initialJob.jobId);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setIsProcessing(false);
    }
  };

  const pollJobStatus = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/card-enhancement/jobs/${jobId}`);
        if (!res.ok) {
          throw new Error('Failed to retrieve job status.');
        }

        const data: EnhancementJobStatus = await res.json();
        setActiveJob(data);

        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          setIsProcessing(false);
          
          // Fetch result blob to render comparison
          const resultRes = await fetch(`/api/card-enhancement/jobs/${jobId}/result`);
          if (resultRes.ok) {
            const blob = await resultRes.blob();
            const resultUrl = URL.createObjectURL(blob);
            setResultImageBlobUrl(resultUrl);
          }
        } else if (data.status === 'failed' || data.status === 'canceled') {
          clearInterval(pollIntervalRef.current);
          setIsProcessing(false);
          setError(data.error || 'Processing failed.');
        }
      } catch (err: any) {
        console.error("Poll error:", err);
      }
    }, 800);
  };

  const handleCancelJob = async () => {
    if (!activeJob?.jobId) return;
    try {
      await fetch(`/api/card-enhancement/jobs/${activeJob.jobId}/cancel`, { method: 'POST' });
      setIsProcessing(false);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setActiveJob(prev => prev ? { ...prev, status: 'canceled', stage: 'Canceled by user' } : null);
    } catch (err) {
      console.error("Failed to cancel job:", err);
    }
  };

  const handleSliderMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const relativeX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    setCompareSliderPos(percentage);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Title & Pipeline Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-cyan-400" />
                Authenticated AI Pipeline
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[11px] font-mono font-medium">
                ComfyUI UltimateSDUpscale Engine
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Sparkles className="text-cyan-400" size={24} />
              AI Card Auto-Enhancement Suite
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Direct application-controlled neural upscaling, surface descratching, and micro-text restoration. Zero S3 dependencies.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-right font-mono">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Storage Policy</div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Auto-Cleanup (20m Temp)
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dropzone & Settings Controls */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upload Dropzone */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider flex items-center gap-2">
              <Upload size={15} className="text-cyan-400" />
              Card Source Image
            </h3>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-cyan-400 bg-cyan-500/10 scale-[0.99]'
                  : 'border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/40 bg-slate-950/40'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400 shadow-inner">
                <Upload size={22} />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                {isDragActive ? 'Drop card scan here...' : 'Drag & drop card scan, or click to browse'}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Supports PNG, JPG, JPEG, WEBP up to 25MB
              </p>
            </div>

            {file && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs font-mono">
                <div className="flex items-center gap-2.5 truncate">
                  <ImageIcon size={16} className="text-cyan-400 shrink-0" />
                  <span className="text-slate-200 truncate font-semibold">{file.name}</span>
                </div>
                <span className="text-slate-400 shrink-0 ml-2">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            )}
          </div>

          {/* Approved Presets Selection */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider flex items-center gap-2">
                <Sliders size={15} className="text-cyan-400" />
                Approved Enhancement Presets
              </h3>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                6 Verified
              </span>
            </div>

            <div className="space-y-2">
              {(models.length > 0 ? models : [
                { id: 'standard-card-cleanup', name: 'Standard Card Cleanup', description: 'Dust removal, scratch reduction, surface gloss recovery, natural edges.', recommendedScale: 2 },
                { id: 'text-preserving-upscale', name: 'Text-Preserving Upscale', description: 'Optimized micro-contrast for sharp player statistics, text, and serials.', recommendedScale: 2 },
                { id: 'illustration-enhancement', name: 'Illustration Enhancement', description: 'Vibrant color recovery, holographic foil sparkle booster, smooth gradients.', recommendedScale: 2 },
                { id: 'high-detail-restoration', name: 'High-Detail Restoration', description: 'Deep scratch recovery, corner scuff concealment, matte-surface cleanup, 4x micro-texture.', recommendedScale: 4 },
                { id: 'two-times-upscale', name: 'Two-Times Upscale (2x)', description: 'Clean 200% resolution multiplier with edge anti-aliasing.', recommendedScale: 2 },
                { id: 'four-times-upscale', name: 'Four-Times Upscale (4x)', description: 'Maximum 400% ultra-high definition export for archival and grading.', recommendedScale: 4 }
              ]).map(preset => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedPreset(preset.id);
                      if (preset.recommendedScale) setSelectedScale(preset.recommendedScale);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-950/40 to-indigo-950/40 border-cyan-500 text-white shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        {preset.name}
                        {isSelected && <CheckCircle2 size={13} className="text-cyan-400" />}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {preset.recommendedScale || 2}x Default
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{preset.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Target Upscale Multiplier */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 font-mono">Upscale Resolution:</span>
              <div className="flex gap-2">
                {[2, 4].map(scale => (
                  <button
                    key={scale}
                    onClick={() => setSelectedScale(scale)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all ${
                      selectedScale === scale
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    {scale}x Multiplier
                  </button>
                ))}
              </div>
            </div>

            {/* Action Trigger Button */}
            <button
              onClick={enhanceCard}
              disabled={!file || isProcessing}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black text-xs uppercase tracking-wider font-mono shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin text-slate-950" />
                  Processing Card ({activeJob?.progress || 10}%)
                </>
              ) : (
                <>
                  <Zap size={16} className="fill-slate-950" />
                  Auto-Enhance Card
                </>
              )}
            </button>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Comparison Viewer & Telemetry Dashboard */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider flex items-center gap-2">
                <Eye size={15} className="text-cyan-400" />
                Interactive Visual Comparison
              </h3>

              {resultImageBlobUrl && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setComparisonMode(prev => prev === 'slider' ? 'side-by-side' : 'slider')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono flex items-center gap-1.5"
                  >
                    <ArrowRightLeft size={12} />
                    {comparisonMode === 'slider' ? 'Side-by-Side View' : 'Split Slider View'}
                  </button>

                  <a
                    href={resultImageBlobUrl}
                    download={activeJob ? `enhanced_${file?.name || 'card.png'}` : 'enhanced_card.png'}
                    className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <Download size={13} />
                    Download High-Res PNG
                  </a>
                </div>
              )}
            </div>

            {/* Active Pipeline Status Bar */}
            {activeJob && (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                    {activeJob.status === 'completed' ? (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    ) : (
                      <Loader2 size={14} className="animate-spin text-cyan-400" />
                    )}
                    {activeJob.stage}
                  </span>
                  <span className="text-slate-400">{activeJob.progress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${activeJob.progress}%` }}
                  />
                </div>
                {isProcessing && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleCancelJob}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-mono underline"
                    >
                      Cancel Job
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Comparison Visual Canvas */}
            <div className="min-h-[420px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative flex items-center justify-center p-4">
              {!previewUrl ? (
                <div className="text-center p-8 text-slate-500 space-y-3 font-mono">
                  <Layers size={40} className="mx-auto opacity-30 text-cyan-400" />
                  <p className="text-xs">Upload a card scan to inspect high-resolution neural enhancement.</p>
                </div>
              ) : resultImageBlobUrl ? (
                comparisonMode === 'slider' ? (
                  <div
                    ref={containerRef}
                    onMouseMove={(e) => isDraggingSlider && handleSliderMove(e)}
                    onTouchMove={(e) => isDraggingSlider && handleSliderMove(e)}
                    onMouseDown={() => setIsDraggingSlider(true)}
                    onTouchStart={() => setIsDraggingSlider(true)}
                    onMouseUp={() => setIsDraggingSlider(false)}
                    onTouchEnd={() => setIsDraggingSlider(false)}
                    className="relative w-full max-w-md h-[460px] mx-auto select-none overflow-hidden rounded-xl cursor-ew-resize border border-slate-700 shadow-2xl"
                  >
                    {/* Background: Enhanced Result */}
                    <img
                      src={resultImageBlobUrl}
                      alt="Enhanced Card"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-slate-900"
                    />
                    <div className="absolute top-3 right-3 bg-emerald-500/90 text-slate-950 font-black text-[10px] font-mono px-2 py-0.5 rounded shadow">
                      ENHANCED ({activeJob?.enhancedDimensions ? `${activeJob.enhancedDimensions.width}x${activeJob.enhancedDimensions.height}` : `${selectedScale}x`})
                    </div>

                    {/* Foreground: Original (Clipped) */}
                    <div
                      className="absolute inset-0 overflow-hidden pointer-events-none"
                      style={{ clipPath: `polygon(0 0, ${compareSliderPos}% 0, ${compareSliderPos}% 100%, 0 100%)` }}
                    >
                      <img
                        src={previewUrl}
                        alt="Original Card"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-slate-900"
                      />
                      <div className="absolute top-3 left-3 bg-slate-900/90 text-slate-300 font-bold text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700 shadow">
                        ORIGINAL ({activeJob?.originalDimensions ? `${activeJob.originalDimensions.width}x${activeJob.originalDimensions.height}` : 'Source'})
                      </div>
                    </div>

                    {/* Divider Line & Handle */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none shadow-[0_0_10px_#00f3ff]"
                      style={{ left: `${compareSliderPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg pointer-events-auto">
                        <ArrowRightLeft size={13} className="font-bold" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 w-full h-[460px]">
                    <div className="relative rounded-xl border border-slate-800 bg-slate-900/60 p-2 flex flex-col">
                      <span className="text-[11px] font-mono font-bold text-slate-400 mb-2">Original Source</span>
                      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                        <img src={previewUrl} alt="Original" className="max-h-full object-contain rounded" />
                      </div>
                    </div>
                    <div className="relative rounded-xl border border-emerald-500/40 bg-emerald-950/10 p-2 flex flex-col">
                      <span className="text-[11px] font-mono font-bold text-emerald-400 mb-2">Enhanced Output</span>
                      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                        <img src={resultImageBlobUrl} alt="Enhanced" className="max-h-full object-contain rounded" />
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="relative max-h-[460px] flex items-center justify-center">
                  <img src={previewUrl} alt="Card Preview" className="max-h-[420px] object-contain rounded-xl border border-slate-800 shadow-xl" />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center gap-3">
                      <Loader2 size={36} className="animate-spin text-cyan-400" />
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {activeJob?.stage || 'Running ComfyUI UltimateSDUpscale Workflow...'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Execution Telemetry & Job Metrics */}
            {activeJob?.metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-center font-mono">
                  <div className="text-[10px] text-slate-400 uppercase">Processing Time</div>
                  <div className="text-xs font-bold text-cyan-400 mt-0.5">
                    {(activeJob.metrics.durationMs / 1000).toFixed(2)}s
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-center font-mono">
                  <div className="text-[10px] text-slate-400 uppercase">Upscale Factor</div>
                  <div className="text-xs font-bold text-indigo-400 mt-0.5">
                    {activeJob.metrics.upscaleFactor}x Resolution
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-center font-mono">
                  <div className="text-[10px] text-slate-400 uppercase">Denoise Applied</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    {activeJob.metrics.denoiseApplied}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-center font-mono">
                  <div className="text-[10px] text-slate-400 uppercase">Output Size</div>
                  <div className="text-xs font-bold text-amber-400 mt-0.5">
                    {(activeJob.metrics.outputSizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
