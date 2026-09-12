import React from 'react';
import { 
  Sparkles, 
  Loader2, 
  Pause, 
  Play, 
  XOctagon, 
  Gauge, 
  Clock, 
  Zap, 
  Layers, 
  CheckCircle2 
} from 'lucide-react';

export interface BatchProcessingProgressBarProps {
  isRendering: boolean;
  isPaused: boolean;
  completed: number;
  total: number;
  throughputCardsPerSec: number;
  avgMsPerCard: number;
  estimatedSecondsRemaining: number | null;
  elapsedSeconds: number;
  currentFileName?: string | null;
  onTogglePause: () => void;
  onCancel: () => void;
}

export const BatchProcessingProgressBar: React.FC<BatchProcessingProgressBarProps> = ({
  isRendering,
  isPaused,
  completed,
  total,
  throughputCardsPerSec,
  avgMsPerCard,
  estimatedSecondsRemaining,
  elapsedSeconds,
  currentFileName,
  onTogglePause,
  onCancel
}) => {
  if (!isRendering && !isPaused) return null;

  const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  const formatTime = (seconds: number | null): string => {
    if (seconds === null || isNaN(seconds) || seconds < 0) return 'Calculating...';
    if (seconds < 3) return 'Almost done...';
    if (seconds < 60) return `${Math.round(seconds)}s remaining`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs.toString().padStart(2, '0')}s remaining`;
  };

  const formatElapsed = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-[#090f1d] border-b border-cyan-500/30 p-3.5 md:px-6 shadow-[0_4px_20px_rgba(0,0,0,0.4)] z-20 animate-fadeIn">
      <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
        
        {/* Top Header Row: Status, ETA, & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border ${
              isPaused 
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300' 
                : 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 animate-pulse'
            }`}>
              {isPaused ? <Pause size={16} /> : <Loader2 size={16} className="animate-spin" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-cyan-300">
                  {isPaused ? 'Batch Processing Paused' : 'Processing Sports Card Batch'}
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  {completed} / {total} Cards ({percentage}%)
                </span>
              </div>
              
              {currentFileName && (
                <p className="text-[10px] font-mono text-slate-400 truncate max-w-xs md:max-w-md">
                  Active: <span className="text-cyan-200">{currentFileName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Right Metrics & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Real-time Throughput Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/50 border border-slate-800 text-[11px] font-mono text-slate-300">
              <Gauge size={13} className="text-cyan-400" />
              <span>
                {throughputCardsPerSec > 0 
                  ? `${throughputCardsPerSec.toFixed(1)} cards/s (${Math.round(avgMsPerCard)}ms)` 
                  : 'Measuring speed...'}
              </span>
            </div>

            {/* Estimated Time Remaining Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-400/50 text-cyan-300 text-xs font-mono font-bold shadow-[0_0_12px_rgba(0,243,255,0.2)]">
              <Clock size={13} className="text-cyan-400" />
              <span>{isPaused ? 'Paused' : formatTime(estimatedSecondsRemaining)}</span>
            </div>

            {/* Elapsed Timer */}
            <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-black/40 border border-slate-800 text-[10px] font-mono text-slate-400">
              <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
            </div>

            {/* Pause / Resume Button */}
            <button
              onClick={onTogglePause}
              className={`px-3 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 transition-all border ${
                isPaused
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400 text-amber-300'
              }`}
              title={isPaused ? 'Resume batch processing' : 'Pause batch processing'}
            >
              {isPaused ? <Play size={12} /> : <Pause size={12} />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            {/* Stop Button */}
            <button
              onClick={onCancel}
              className="px-2.5 py-1 rounded-md text-xs font-mono text-slate-400 hover:text-red-300 hover:bg-red-500/20 border border-slate-800 hover:border-red-500/40 transition-colors flex items-center gap-1"
              title="Halt remaining cards"
            >
              <XOctagon size={12} />
              <span className="hidden sm:inline">Halt</span>
            </button>

          </div>
        </div>

        {/* High-Precision Dynamic Progress Bar */}
        <div className="w-full h-2.5 bg-black/70 rounded-full overflow-hidden border border-cyan-500/25 p-0.5 relative">
          <div 
            className="h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden bg-gradient-to-r from-cyan-600 via-cyan-400 to-emerald-400 shadow-[0_0_15px_rgba(0,243,255,0.6)]"
            style={{ width: `${Math.max(2, percentage)}%` }}
          >
            {/* Animated shimmer beam */}
            {!isPaused && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
