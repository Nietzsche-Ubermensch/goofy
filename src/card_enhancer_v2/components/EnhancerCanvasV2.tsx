import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Columns, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Layers, 
  Sliders, 
  Sparkles,
  Maximize2
} from 'lucide-react';
import { CardEnhancementTask, ComparisonMode, EnhancementParameters } from '../types';

interface EnhancerCanvasV2Props {
  task: CardEnhancementTask | null;
  params: EnhancementParameters;
  onMountCanvas: (canvas: HTMLCanvasElement | null) => void;
  comparisonMode: ComparisonMode;
  onComparisonModeChange: (mode: ComparisonMode) => void;
  sliderPos: number;
  onSliderPosChange: (pos: number) => void;
}

export const EnhancerCanvasV2: React.FC<EnhancerCanvasV2Props> = ({
  task,
  params,
  onMountCanvas,
  comparisonMode,
  onComparisonModeChange,
  sliderPos,
  onSliderPosChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [showBlemishes, setShowBlemishes] = useState(true);

  // Bind WebGL canvas on mount
  useEffect(() => {
    if (canvasRef.current) {
      onMountCanvas(canvasRef.current);
    }
    return () => {
      onMountCanvas(null);
    };
  }, [onMountCanvas]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (comparisonMode === 'slider') {
      setIsDraggingSlider(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [comparisonMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingSlider || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percentage = (x / rect.width) * 100;
    onSliderPosChange(percentage);
  }, [isDraggingSlider, onSliderPosChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDraggingSlider(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  if (!task) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mb-4 shadow-xl">
          <Sparkles size={28} />
        </div>
        <h3 className="text-lg font-bold text-slate-200">No Card Loaded</h3>
        <p className="text-sm text-slate-400 max-w-sm mt-1">
          Upload a high-resolution sports card or TCG scan to activate real-time GPU enhancement.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950/80 select-none overflow-hidden">
      {/* Floating Canvas Controls Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Comparison Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl pointer-events-auto">
          <button
            id="btn-mode-slider"
            onClick={() => onComparisonModeChange('slider')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              comparisonMode === 'slider'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Columns size={14} />
            <span>Split Slider</span>
          </button>

          <button
            id="btn-mode-side"
            onClick={() => onComparisonModeChange('side-by-side')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              comparisonMode === 'side-by-side'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Sliders size={14} />
            <span>Side-by-Side</span>
          </button>
        </div>

        {/* Zoom & Overlay Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            id="btn-toggle-blemish-overlay"
            onClick={() => setShowBlemishes(!showBlemishes)}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl transition-all ${
              showBlemishes ? 'text-cyan-300 border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Defect Detection Bounding Boxes"
          >
            {showBlemishes ? <Eye size={16} /> : <EyeOff size={16} />}
            <span className="hidden sm:inline">Defects ({task.blemishes.length})</span>
          </button>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl">
            <button
              id="btn-zoom-out"
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <ZoomOut size={15} />
            </button>
            <span className="text-xs font-mono text-slate-300 px-2 min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              id="btn-zoom-in"
              onClick={() => setZoom(z => Math.min(3.0, z + 0.25))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <ZoomIn size={15} />
            </button>
            <button
              id="btn-zoom-reset"
              onClick={() => setZoom(1.0)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div 
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative flex-1 w-full h-full flex items-center justify-center p-4 overflow-hidden cursor-crosshair"
      >
        <div 
          className="relative max-w-full max-h-full transition-transform duration-75 ease-out shadow-2xl rounded-xl overflow-hidden border border-slate-800/80"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Base / Enhanced WebGL Canvas */}
          <canvas
            ref={canvasRef}
            className="block max-w-full max-h-[72vh] object-contain"
          />

          {/* Slider Comparison Split Layer */}
          {comparisonMode === 'slider' && (
            <>
              {/* Original Image Clipped Layer */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none border-r border-cyan-400/80"
                style={{ width: `${sliderPos}%` }}
              >
                <img
                  src={task.previewUrl}
                  alt="Original Card"
                  className="absolute top-0 left-0 max-w-none h-full object-contain"
                  style={{ width: canvasRef.current?.clientWidth || '100%' }}
                />

                {/* Original Label Badge */}
                <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-[10px] font-mono text-slate-300 font-bold uppercase tracking-wider">
                  Raw Scan
                </div>
              </div>

              {/* Enhanced Label Badge */}
              <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-cyan-950/80 backdrop-blur-md border border-cyan-500/50 text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider pointer-events-none">
                WebGL Enhanced
              </div>

              {/* Interactive Divider Handle */}
              <div
                onPointerDown={handlePointerDown}
                className="absolute top-0 bottom-0 -ml-3 w-6 flex items-center justify-center cursor-ew-resize z-30 touch-none"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 shadow-lg flex items-center justify-center border-2 border-white ring-2 ring-cyan-500/40">
                  <Columns size={12} />
                </div>
              </div>
            </>
          )}

          {/* Blemish Detection Bounding Boxes */}
          {showBlemishes && task.blemishes.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {task.blemishes.map((b) => (
                <div
                  key={b.id}
                  className="absolute border border-dashed border-rose-500/90 bg-rose-500/10 rounded-[2px]"
                  style={{
                    left: `${b.bbox[0] * 100}%`,
                    top: `${b.bbox[1] * 100}%`,
                    width: `${b.bbox[2] * 100}%`,
                    height: `${b.bbox[3] * 100}%`,
                  }}
                >
                  <span className="absolute -top-4 left-0 px-1 py-0.2 rounded bg-rose-950/90 text-rose-300 text-[9px] font-mono font-bold uppercase tracking-tighter whitespace-nowrap">
                    {b.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
