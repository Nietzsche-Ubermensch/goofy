import React from 'react';
import {
  ArrowRightLeft,
  Columns2,
  Maximize2,
  Sparkles,
  SlidersHorizontal,
  Info,
  Eye
} from 'lucide-react';

interface BatchCompareBarProps {
  totalCards: number;
  enhancedCount: number;
  sliderPos: number;
  onSliderChange: (val: number) => void;
  compareFormat: 'split' | 'side-by-side';
  onFormatChange: (format: 'split' | 'side-by-side') => void;
  onOpenLightbox: () => void;
  onEnhanceAllPending?: () => void;
  isProcessing?: boolean;
}

export const BatchCompareBar: React.FC<BatchCompareBarProps> = ({
  totalCards,
  enhancedCount,
  sliderPos,
  onSliderChange,
  compareFormat,
  onFormatChange,
  onOpenLightbox,
  onEnhanceAllPending,
  isProcessing
}) => {
  return (
    <div className="w-full bg-[#080d1a] border-b border-cyan-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md z-20">
      
      {/* Left: Mode Title & Format Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-cyan-500/10 border border-cyan-400/40 text-cyan-300">
            <ArrowRightLeft size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wide">
                Simultaneous Queue Compare
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold">
                {totalCards} CARDS
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 hidden sm:block">
              Comparing Original vs Cropped/Enhanced across all queue items simultaneously
            </p>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-800 hidden sm:block" />

        {/* Format Toggle: Split Curtain vs Side-by-Side */}
        <div className="flex items-center bg-black/60 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => onFormatChange('split')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium flex items-center gap-1.5 transition-all ${
              compareFormat === 'split'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(0,243,255,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Split-wipe curtain slider across all cards"
          >
            <ArrowRightLeft size={12} />
            <span>Split Curtain</span>
          </button>
          <button
            onClick={() => onFormatChange('side-by-side')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium flex items-center gap-1.5 transition-all ${
              compareFormat === 'side-by-side'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(0,243,255,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Dual side-by-side cards in grid"
          >
            <Columns2 size={12} />
            <span>Side-by-Side</span>
          </button>
        </div>
      </div>

      {/* Center: Master Split Slider (when in split mode) */}
      {compareFormat === 'split' && (
        <div className="flex-1 max-w-md flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg border border-slate-800 min-w-[240px]">
          <button
            onClick={() => onSliderChange(0)}
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
              sliderPos === 0 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            0% Orig
          </button>

          <input
            type="range"
            min="0"
            max="100"
            value={sliderPos}
            onChange={(e) => onSliderChange(parseInt(e.target.value, 10))}
            className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
            title="Drag to adjust split wipe across all cards simultaneously"
          />

          <button
            onClick={() => onSliderChange(50)}
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
              sliderPos === 50 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            50% Split
          </button>

          <button
            onClick={() => onSliderChange(100)}
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
              sliderPos === 100 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            100% Enh
          </button>

          <span className="text-[11px] font-mono text-cyan-300 font-bold min-w-[36px] text-right">
            {sliderPos}%
          </span>
        </div>
      )}

      {/* Right: Lightbox & Execution Buttons */}
      <div className="flex items-center gap-2">
        {enhancedCount < totalCards && onEnhanceAllPending && (
          <button
            onClick={onEnhanceAllPending}
            disabled={isProcessing}
            className="px-2.5 py-1.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
            title="Enhance all pending cards to enable full comparison"
          >
            <Sparkles size={12} />
            <span className="hidden md:inline">Enhance Pending ({totalCards - enhancedCount})</span>
          </button>
        )}

        <button
          onClick={onOpenLightbox}
          className="px-3.5 py-1.5 rounded-md bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all"
          title="Open high-resolution compare lightbox with zoom, multi-card filmstrip, and difference inspection"
        >
          <Maximize2 size={13} />
          <span>Open Compare Lightbox</span>
        </button>
      </div>

    </div>
  );
};
