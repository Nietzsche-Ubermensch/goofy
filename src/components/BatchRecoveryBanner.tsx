import React from 'react';
import { 
  History, 
  Play, 
  Trash2, 
  CheckCircle2, 
  Layers, 
  Clock, 
  RotateCcw, 
  ShieldCheck, 
  FolderSync 
} from 'lucide-react';
import { CardImage, ProcessingStatus } from '../types';

export interface BatchRecoveryBannerProps {
  savedCards: CardImage[];
  savedAt: number;
  onResumeProcessing: () => void;
  onRestoreToQueue: () => void;
  onDiscardSession: () => void;
}

export const BatchRecoveryBanner: React.FC<BatchRecoveryBannerProps> = ({
  savedCards,
  savedAt,
  onResumeProcessing,
  onRestoreToQueue,
  onDiscardSession
}) => {
  const completedCount = savedCards.filter(c => c.status === ProcessingStatus.Completed).length;
  const pendingCount = savedCards.length - completedCount;

  const formatTimeAgo = (time: number): string => {
    const diffSec = Math.floor((Date.now() - time) / 1000);
    if (diffSec < 60) return 'just moments ago';
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return new Date(time).toLocaleDateString();
  };

  return (
    <div className="mb-6 p-4 md:p-5 rounded-xl bg-gradient-to-r from-[#0d1627] via-[#091122] to-[#0d1627] border-2 border-cyan-400/40 shadow-[0_0_30px_rgba(0,243,255,0.15)] relative overflow-hidden">
      
      {/* Background Cybernetic Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
        
        {/* Left: Info & Thumbnail Previews */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/60 text-cyan-300">
              <History size={18} className="animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono text-cyan-300 uppercase tracking-wide flex items-center gap-2">
                Interrupted Batch Session Detected
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  AUTO-SAVED
                </span>
              </h3>
              <p className="text-xs font-mono text-slate-300 mt-0.5">
                Saved {formatTimeAgo(savedAt)} • <span className="text-emerald-400 font-bold">{completedCount} enhanced</span>, <span className="text-amber-300 font-bold">{pendingCount} pending</span> ({savedCards.length} total cards)
              </p>
            </div>
          </div>

          {/* Card Preview Strip */}
          <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1 max-w-full">
            {savedCards.slice(0, 6).map((card, i) => (
              <div 
                key={card.id || i} 
                className="w-12 h-16 rounded-md bg-black/80 border border-cyan-500/30 p-1 shrink-0 overflow-hidden relative group"
                title={card.file.name}
              >
                <img 
                  src={card.processedUrl || card.previewUrl} 
                  alt={card.file.name} 
                  className="w-full h-full object-contain"
                />
                {card.status === ProcessingStatus.Completed && (
                  <div className="absolute bottom-0.5 right-0.5 p-0.5 rounded-full bg-emerald-500 text-slate-950">
                    <CheckCircle2 size={8} />
                  </div>
                )}
              </div>
            ))}
            {savedCards.length > 6 && (
              <div className="w-12 h-16 rounded-md bg-black/60 border border-dashed border-cyan-500/40 flex items-center justify-center shrink-0 font-mono text-[10px] text-cyan-300 font-bold">
                +{savedCards.length - 6}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full lg:w-auto justify-end">
          
          <button
            onClick={onDiscardSession}
            className="px-3 py-2 rounded-lg bg-black/40 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-500/40 text-xs font-mono font-medium transition-all flex items-center gap-1.5"
            title="Discard this saved session and start fresh"
          >
            <Trash2 size={13} />
            <span>Discard</span>
          </button>

          <button
            onClick={onRestoreToQueue}
            className="px-3.5 py-2 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/50 text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-sm"
            title="Load all cards into the workspace to inspect before running"
          >
            <FolderSync size={13} className="text-cyan-400" />
            <span>Load to Queue</span>
          </button>

          <button
            onClick={onResumeProcessing}
            className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:scale-[1.02]"
            title="Restore and immediately resume processing remaining cards"
          >
            <Play size={13} className="fill-slate-950" />
            <span>RESUME BATCH ({pendingCount} REMAINING)</span>
          </button>

        </div>

      </div>
    </div>
  );
};
