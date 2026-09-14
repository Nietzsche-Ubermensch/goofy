import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  Columns2,
  Eye,
  Sparkles,
  Crop,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  Tag,
  SlidersHorizontal,
  Info,
  Loader2,
  Layers,
  RefreshCw,
  Award
} from 'lucide-react';
import { CardImage, CropQuad, ProcessingSettings, ProcessingStatus } from '../types';
import { processCardComplete } from '../utils/imageEnhancer';
import { calculateCardCentering } from '../utils/edgeDetection';

interface BatchCompareLightboxModalProps {
  cards: CardImage[];
  activeCardId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectCard: (id: string) => void;
  onOpenEditor?: (card: CardImage) => void;
  onUpdateCard?: (updatedCard: CardImage) => void;
  globalSettings: ProcessingSettings;
  onEnhanceAllPending?: () => void;
}

type CompareViewMode = 'split' | 'side-by-side' | 'flip' | 'diff';

export const BatchCompareLightboxModal: React.FC<BatchCompareLightboxModalProps> = ({
  cards,
  activeCardId,
  isOpen,
  onClose,
  onSelectCard,
  onOpenEditor,
  onUpdateCard,
  globalSettings,
  onEnhanceAllPending
}) => {
  if (!isOpen || cards.length === 0) return null;

  const activeIndex = Math.max(
    0,
    cards.findIndex(c => c.id === activeCardId)
  );
  const activeCard = cards[activeIndex] || cards[0];

  const [viewMode, setViewMode] = useState<CompareViewMode>('split');
  const [sliderPos, setSliderPos] = useState<number>(50); // 0 = 100% Original, 100 = 100% Enhanced
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const [isFlippedOriginal, setIsFlippedOriginal] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isGeneratingLocal, setIsGeneratingLocal] = useState<boolean>(false);
  const [localProcessedUrl, setLocalProcessedUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll active card into filmstrip view
  useEffect(() => {
    if (filmstripRef.current && activeCard) {
      const activeEl = filmstripRef.current.querySelector(`[data-card-id="${activeCard.id}"]`) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeCard?.id]);

  // If card doesn't have processedUrl yet, generate a live cropped & enhanced preview on-the-fly
  useEffect(() => {
    let isMounted = true;

    if (activeCard.processedUrl) {
      setLocalProcessedUrl(null);
      return;
    }

    // Generate instant preview for pending card
    const generateInstantPreview = async () => {
      setIsGeneratingLocal(true);
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image for preview'));
          img.src = activeCard.previewUrl;
        });

        if (!isMounted) return;

        const effectiveQuad: CropQuad = activeCard.quad || {
          topLeft: { x: 0.05, y: 0.05 },
          topRight: { x: 0.95, y: 0.05 },
          bottomRight: { x: 0.95, y: 0.95 },
          bottomLeft: { x: 0.05, y: 0.95 }
        };

        const result = await processCardComplete(img, effectiveQuad, {
          ...globalSettings,
          ...(activeCard.customSettings || {})
        });

        if (isMounted) {
          setLocalProcessedUrl(result.blobUrl);
        }
      } catch (err) {
        console.warn('Could not generate on-demand preview:', err);
      } finally {
        if (isMounted) {
          setIsGeneratingLocal(false);
        }
      }
    };

    generateInstantPreview();

    return () => {
      isMounted = false;
    };
  }, [activeCard.id, activeCard.processedUrl, activeCard.previewUrl, activeCard.quad, globalSettings]);

  // Reset zoom and pan when switching cards
  useEffect(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setIsFlippedOriginal(false);
  }, [activeCard.id]);

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = (activeIndex - 1 + cards.length) % cards.length;
        onSelectCard(cards[prevIndex].id);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = (activeIndex + 1) % cards.length;
        onSelectCard(cards[nextIndex].id);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsFlippedOriginal(prev => !prev);
      } else if (e.key === '1') {
        setViewMode('split');
      } else if (e.key === '2') {
        setViewMode('side-by-side');
      } else if (e.key === '3') {
        setViewMode('flip');
      } else if (e.key === '4') {
        setViewMode('diff');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, cards, onClose, onSelectCard]);

  // Slider Mouse / Touch tracking
  const handleSliderMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clampedPercentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(Math.round(clampedPercentage));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      if (zoomLevel > 1) {
        setIsPanning(true);
        setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      } else if (viewMode === 'split') {
        setIsDraggingSlider(true);
        handleSliderMove(e.clientX);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingSlider && viewMode === 'split') {
      handleSliderMove(e.clientX);
    } else if (isPanning && zoomLevel > 1) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingSlider(false);
    setIsPanning(false);
  };

  // Touch event handlers for mobile / tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && viewMode === 'split') {
      setIsDraggingSlider(true);
      handleSliderMove(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDraggingSlider && e.touches.length === 1 && viewMode === 'split') {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    setIsDraggingSlider(false);
  };

  const effectiveEnhancedUrl = activeCard.processedUrl || localProcessedUrl || activeCard.previewUrl;
  const isEnhancedReady = !!(activeCard.processedUrl || localProcessedUrl);

  // Calculate centering ratios for active card
  const centeringAnalysis = activeCard.quad ? calculateCardCentering(activeCard.quad) : null;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl text-slate-100 select-none overflow-hidden animate-in fade-in duration-200"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Header Bar */}
      <div className="h-14 border-b border-cyan-500/20 bg-[#080d18]/90 px-4 flex items-center justify-between z-30 shrink-0">
        
        {/* Left: Card File Info & Metadata */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/40 text-cyan-300">
            <ArrowRightLeft size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-mono font-bold text-cyan-200 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                {activeCard.file.name}
              </h2>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold shrink-0">
                {activeIndex + 1} / {cards.length}
              </span>
              {isEnhancedReady ? (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1 shrink-0">
                  <CheckCircle2 size={10} /> ENHANCED
                </span>
              ) : isGeneratingLocal ? (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold flex items-center gap-1 shrink-0">
                  <Loader2 size={10} className="animate-spin" /> RENDERING
                </span>
              ) : (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0">
                  PENDING
                </span>
              )}
            </div>

            {/* Tag metadata badge */}
            {(activeCard.metadata?.cardSeries || activeCard.metadata?.year || activeCard.metadata?.setName) && (
              <div className="text-[10px] font-mono text-cyan-400/80 truncate flex items-center gap-1 mt-0.5">
                <Tag size={10} className="shrink-0" />
                <span>
                  {activeCard.metadata.year ? `${activeCard.metadata.year} ` : ''}
                  {activeCard.metadata.cardSeries || ''}
                  {activeCard.metadata.setName ? ` [${activeCard.metadata.setName}]` : ''}
                  {activeCard.metadata.player ? ` • ${activeCard.metadata.player}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Comparison View Mode Switcher */}
        <div className="hidden sm:flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'split'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(0,243,255,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Interactive Split Slider (Key: 1)"
          >
            <ArrowRightLeft size={13} />
            <span>Split Slider</span>
          </button>

          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-3 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'side-by-side'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(0,243,255,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Side-by-Side Dual View (Key: 2)"
          >
            <Columns2 size={13} />
            <span>Side-by-Side</span>
          </button>

          <button
            onClick={() => setViewMode('flip')}
            className={`px-3 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'flip'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(0,243,255,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="A/B Flip Toggle (Key: 3 / Spacebar)"
          >
            <Eye size={13} />
            <span>A/B Flip</span>
          </button>

          <button
            onClick={() => setViewMode('diff')}
            className={`px-3 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'diff'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(0,243,255,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Difference Map (Key: 4)"
          >
            <Layers size={13} />
            <span>Diff Map</span>
          </button>
        </div>

        {/* Right: Inspection Zoom & Actions */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-black/60 rounded-md border border-slate-800 p-0.5">
            <button
              onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.5))}
              disabled={zoomLevel <= 1}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[10px] font-mono text-cyan-400 font-bold px-1.5 min-w-[32px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.5))}
              disabled={zoomLevel >= 3}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {onOpenEditor && (
            <button
              onClick={() => {
                onOpenEditor(activeCard);
                onClose();
              }}
              className="px-2.5 py-1 rounded-md bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-medium flex items-center gap-1 transition-colors"
              title="Fine-tune crop quad corners for this card"
            >
              <Crop size={12} />
              <span className="hidden md:inline">Fine-Tune</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-500/40 transition-colors"
            title="Close Lightbox (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Viewport Workspace */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-4 sm:p-6 bg-[#04070e]">
        
        {/* Previous Card Navigation Button */}
        <button
          onClick={() => {
            const prevIndex = (activeIndex - 1 + cards.length) % cards.length;
            onSelectCard(cards[prevIndex].id);
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/70 hover:bg-cyan-500 text-slate-300 hover:text-slate-950 border border-slate-700 hover:border-cyan-400 shadow-xl transition-all"
          title="Previous Card (← Arrow)"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Next Card Navigation Button */}
        <button
          onClick={() => {
            const nextIndex = (activeIndex + 1) % cards.length;
            onSelectCard(cards[nextIndex].id);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/70 hover:bg-cyan-500 text-slate-300 hover:text-slate-950 border border-slate-700 hover:border-cyan-400 shadow-xl transition-all"
          title="Next Card (→ Arrow)"
        >
          <ChevronRight size={20} />
        </button>

        {/* ========================================================================= */}
        {/* VIEW MODE 1: INTERACTIVE SPLIT SLIDER */}
        {/* ========================================================================= */}
        {viewMode === 'split' && (
          <div className="relative w-full h-full max-w-4xl flex flex-col items-center justify-center">
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              className={`relative max-w-full max-h-[calc(100vh-210px)] aspect-[2.5/3.5] select-none overflow-hidden rounded-xl border border-cyan-500/30 shadow-[0_0_35px_rgba(0,0,0,0.8)] bg-black/90 ${
                zoomLevel > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-ew-resize'
              }`}
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                transition: isPanning || isDraggingSlider ? 'none' : 'transform 0.15s ease-out'
              }}
            >
              {/* Background Layer: Cropped & Enhanced Result */}
              <img
                src={effectiveEnhancedUrl}
                alt="Enhanced Output"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
              <div className="absolute top-3 right-3 z-10 bg-emerald-500/90 text-slate-950 font-black text-[10px] font-mono px-2 py-0.5 rounded shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                CROPPED & ENHANCED {activeCard.originalWidth ? `(${activeCard.originalWidth}x${activeCard.originalHeight})` : ''}
              </div>

              {/* Foreground Layer: Raw Original Scan (Clipped) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{
                  clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                }}
              >
                <img
                  src={activeCard.previewUrl}
                  alt="Original Scan"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />
                <div className="absolute top-3 left-3 z-10 bg-slate-900/90 text-cyan-300 font-bold text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-500/30 shadow">
                  ORIGINAL SCAN (RAW)
                </div>
              </div>

              {/* Glowing Divider Line & Draggable Handle */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none shadow-[0_0_12px_#00f3ff] z-20"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.7)] pointer-events-auto cursor-ew-resize hover:scale-110 active:scale-95 transition-transform">
                  <ArrowRightLeft size={14} className="font-extrabold stroke-[2.5]" />
                </div>
              </div>

              {/* Centering Ratio Overlay (if quad detected) */}
              {centeringAnalysis && (
                <div className="absolute bottom-3 right-3 z-10 bg-black/80 backdrop-blur border border-cyan-500/30 text-cyan-300 font-mono text-[9px] px-2 py-1 rounded">
                  Centering: L/R {centeringAnalysis.leftPct}% / {centeringAnalysis.rightPct}% • T/B {centeringAnalysis.topPct}% / {centeringAnalysis.bottomPct}% ({centeringAnalysis.centeringGrade})
                </div>
              )}
            </div>

            {/* Bottom Slider Position Control Bar */}
            <div className="w-full max-w-md mt-3 flex items-center justify-between gap-3 px-4 py-1.5 rounded-lg bg-[#080d18]/80 border border-cyan-500/20 text-xs font-mono">
              <button
                onClick={() => setSliderPos(0)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  sliderPos === 0 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                0% (Original)
              </button>

              <input
                type="range"
                min="0"
                max="100"
                value={sliderPos}
                onChange={(e) => setSliderPos(parseInt(e.target.value, 10))}
                className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
              />

              <button
                onClick={() => setSliderPos(50)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  sliderPos === 50 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                50% Split
              </button>

              <button
                onClick={() => setSliderPos(100)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  sliderPos === 100 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                100% (Enhanced)
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW MODE 2: SIDE-BY-SIDE DUAL VIEW */}
        {/* ========================================================================= */}
        {viewMode === 'side-by-side' && (
          <div className="w-full h-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-center">
            
            {/* Left Column: Original Scan */}
            <div className="relative h-full max-h-[calc(100vh-210px)] rounded-xl border border-slate-800 bg-[#080d18] p-3 flex flex-col items-center justify-between shadow-xl">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  RAW ORIGINAL SCAN
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {activeCard.file.size ? `${(activeCard.file.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                </span>
              </div>
              
              <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden bg-black/60 rounded-lg p-2">
                <img
                  src={activeCard.previewUrl}
                  alt="Original"
                  className="max-h-full max-w-full object-contain rounded"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`
                  }}
                />
              </div>

              <div className="w-full mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Uncorrected perspective & scan margin</span>
                <span className="text-cyan-400">Source Resolution</span>
              </div>
            </div>

            {/* Right Column: Cropped & Enhanced Output */}
            <div className="relative h-full max-h-[calc(100vh-210px)] rounded-xl border border-cyan-500/40 bg-[#0a1120] p-3 flex flex-col items-center justify-between shadow-[0_0_25px_rgba(0,243,255,0.15)]">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  CROPPED & ENHANCED
                </span>
                {centeringAnalysis && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                    <Award size={10} />
                    {centeringAnalysis.isCentered5050 ? 'PSA 10 50/50' : centeringAnalysis.centeringGrade}
                  </span>
                )}
              </div>

              <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden bg-black/80 rounded-lg p-2">
                <img
                  src={effectiveEnhancedUrl}
                  alt="Enhanced"
                  className="max-h-full max-w-full object-contain rounded shadow-2xl"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`
                  }}
                />
              </div>

              <div className="w-full mt-2 pt-2 border-t border-cyan-500/20 flex items-center justify-between text-[10px] font-mono text-cyan-300">
                <span>
                  {activeCard.originalWidth ? `${activeCard.originalWidth}x${activeCard.originalHeight}px` : 'Processed'} • Descratch & Sharpen Active
                </span>
                <span className="text-emerald-400 font-bold">100% Quality</span>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW MODE 3: FAST A/B FLIP TOGGLE */}
        {/* ========================================================================= */}
        {viewMode === 'flip' && (
          <div className="relative w-full h-full max-w-3xl flex flex-col items-center justify-center">
            <div
              onClick={() => setIsFlippedOriginal(prev => !prev)}
              className="relative max-w-full max-h-[calc(100vh-210px)] aspect-[2.5/3.5] select-none overflow-hidden rounded-xl border border-cyan-500/40 shadow-2xl bg-black/90 cursor-pointer group"
            >
              <img
                src={isFlippedOriginal ? activeCard.previewUrl : effectiveEnhancedUrl}
                alt={isFlippedOriginal ? 'Original' : 'Enhanced'}
                className="w-full h-full object-contain pointer-events-none transition-all duration-75"
              />

              {/* Status Badge */}
              <div className="absolute top-3 left-3 z-10">
                {isFlippedOriginal ? (
                  <span className="bg-slate-900/95 text-slate-200 font-mono font-bold text-xs px-3 py-1 rounded border border-slate-700 shadow">
                    VIEWING: RAW ORIGINAL SCAN
                  </span>
                ) : (
                  <span className="bg-emerald-500 text-slate-950 font-mono font-black text-xs px-3 py-1 rounded shadow-[0_0_15px_rgba(16,185,129,0.6)]">
                    VIEWING: CROPPED & ENHANCED
                  </span>
                )}
              </div>

              <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="bg-black/80 backdrop-blur px-3 py-1.5 rounded-lg border border-cyan-400/40 text-cyan-300 font-mono text-xs font-bold">
                  Click or Press SPACE to Flip
                </span>
              </div>
            </div>

            {/* Controls underneath */}
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => setIsFlippedOriginal(false)}
                className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  !isFlippedOriginal
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Enhanced State
              </button>
              
              <button
                onClick={() => setIsFlippedOriginal(true)}
                className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  isFlippedOriginal
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(0,243,255,0.5)]'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Original State
              </button>

              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                (Press Spacebar anytime to flip)
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW MODE 4: DIFFERENCE / ARTIFACT MAP */}
        {/* ========================================================================= */}
        {viewMode === 'diff' && (
          <div className="relative w-full h-full max-w-3xl flex flex-col items-center justify-center">
            <div className="relative max-w-full max-h-[calc(100vh-210px)] aspect-[2.5/3.5] select-none overflow-hidden rounded-xl border border-cyan-500/40 shadow-2xl bg-black">
              {/* Original bottom */}
              <img
                src={activeCard.previewUrl}
                alt="Original"
                className="absolute inset-0 w-full h-full object-contain"
              />
              {/* Enhanced top with difference blend mode */}
              <img
                src={effectiveEnhancedUrl}
                alt="Diff Map"
                className="absolute inset-0 w-full h-full object-contain mix-blend-difference opacity-90"
              />
              <div className="absolute top-3 left-3 bg-indigo-950/90 text-indigo-300 font-mono font-bold text-xs px-2.5 py-1 rounded border border-indigo-500/40">
                SPECTRAL DIFFERENCE MAP (HIGHLIGHTS RESTORED ARTIFACTS)
              </div>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-2 text-center">
              Bright pixels highlight desk background removal, surface scratch inpainting, and contrast boost.
            </p>
          </div>
        )}

      </div>

      {/* Bottom Queue Filmstrip Carousel */}
      <div className="h-20 border-t border-cyan-500/20 bg-[#060a14] px-4 flex items-center justify-between gap-3 shrink-0 z-30">
        
        <div className="flex items-center gap-2 shrink-0 text-xs font-mono text-slate-400">
          <span className="text-cyan-400 font-bold">BATCH QUEUE</span>
          <span className="text-[10px] text-slate-500">({cards.length} cards)</span>
        </div>

        {/* Scrollable Filmstrip */}
        <div 
          ref={filmstripRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto py-1 px-2 custom-scrollbar"
        >
          {cards.map((card, index) => {
            const isSelected = card.id === activeCard.id;
            const hasEnhanced = !!card.processedUrl;

            return (
              <button
                key={card.id}
                data-card-id={card.id}
                onClick={() => onSelectCard(card.id)}
                className={`group relative h-14 w-12 rounded-md overflow-hidden shrink-0 border transition-all flex flex-col items-center justify-center ${
                  isSelected
                    ? 'border-cyan-400 ring-2 ring-cyan-400/50 scale-105 shadow-[0_0_12px_rgba(0,243,255,0.4)] z-10'
                    : 'border-slate-800 hover:border-cyan-500/50 opacity-70 hover:opacity-100'
                }`}
                title={`${index + 1}. ${card.file.name}`}
              >
                <img
                  src={card.processedUrl || card.previewUrl}
                  alt={card.file.name}
                  className="w-full h-full object-cover"
                />

                {/* Status indicator dot */}
                <div className="absolute top-1 right-1">
                  {hasEnhanced ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] block" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-500 block" />
                  )}
                </div>

                {/* Index badge */}
                <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] font-mono text-cyan-200 text-center py-0.5 truncate px-0.5">
                  #{index + 1}
                </div>
              </button>
            );
          })}
        </div>

        {/* Batch Action in Lightbox */}
        <div className="flex items-center gap-2 shrink-0">
          {onEnhanceAllPending && cards.some(c => c.status !== ProcessingStatus.Completed) && (
            <button
              onClick={onEnhanceAllPending}
              className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,243,255,0.3)] transition-all"
            >
              <Sparkles size={12} />
              <span className="hidden sm:inline">Enhance All Pending</span>
            </button>
          )}

          <div className="text-[10px] font-mono text-slate-500 hidden lg:flex items-center gap-2 border-l border-slate-800 pl-3">
            <span>Keys: [←/→] Navigate</span>
            <span>[Space] Flip</span>
            <span>[1-4] Modes</span>
          </div>
        </div>

      </div>

    </div>
  );
};
