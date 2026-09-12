import React, { useState } from 'react';
import { 
  Layers, 
  Play, 
  Trash2, 
  Download, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X,
  Plus
} from 'lucide-react';
import { CardEnhancementTask } from '../types';

interface BatchQueueDrawerV2Props {
  queue: CardEnhancementTask[];
  isProcessing: boolean;
  currentProcessingIndex: number;
  overallProgress: number;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onRunBatch: () => void;
  onExportZip: () => void;
  onApplyBulkMetadata: (metadata: {
    cardSeries?: string;
    year?: string;
    player?: string;
    gradeTarget?: string;
    notes?: string;
  }) => void;
}

export const BatchQueueDrawerV2: React.FC<BatchQueueDrawerV2Props> = ({
  queue,
  isProcessing,
  currentProcessingIndex,
  overallProgress,
  onRemoveItem,
  onClearQueue,
  onRunBatch,
  onExportZip,
  onApplyBulkMetadata,
}) => {
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [cardSeries, setCardSeries] = useState('');
  const [year, setYear] = useState('');
  const [player, setPlayer] = useState('');
  const [gradeTarget, setGradeTarget] = useState('PSA 10 Gem Mint');
  const [notes, setNotes] = useState('');

  const handleSaveMetadata = () => {
    onApplyBulkMetadata({
      cardSeries: cardSeries || undefined,
      year: year || undefined,
      player: player || undefined,
      gradeTarget: gradeTarget || undefined,
      notes: notes || undefined,
    });
    setShowMetaModal(false);
  };

  const completedCount = queue.filter(t => t.status === 'completed').length;

  if (queue.length === 0) return null;

  return (
    <div className="w-full bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
      {/* Batch Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Layers size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">Batch Processing Queue</h3>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold">
                {queue.length} Cards
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {completedCount} of {queue.length} completed • Bulk tag series & export all to ZIP
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Bulk Metadata Editor Button */}
          <button
            id="btn-open-bulk-metadata"
            onClick={() => setShowMetaModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700"
          >
            <Tag size={14} className="text-cyan-400" />
            <span>Bulk Metadata</span>
          </button>

          {/* Run Batch Enhancement */}
          <button
            id="btn-run-batch-enhancement"
            onClick={onRunBatch}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Processing ({overallProgress}%)...</span>
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" />
                <span>Process All</span>
              </>
            )}
          </button>

          {/* Export ZIP */}
          {completedCount > 0 && (
            <button
              id="btn-export-batch-zip"
              onClick={onExportZip}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/10"
            >
              <Download size={14} />
              <span>Download ZIP ({completedCount})</span>
            </button>
          )}

          {/* Clear Queue */}
          <button
            id="btn-clear-queue"
            onClick={onClearQueue}
            disabled={isProcessing}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Clear Queue"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
          <div 
            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      )}

      {/* Queue Items Horizontal Scroll */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-56 overflow-y-auto p-1">
        {queue.map((task, idx) => (
          <div
            key={task.id}
            className={`relative p-2 rounded-xl border flex flex-col gap-2 transition-all ${
              idx === currentProcessingIndex
                ? 'bg-cyan-950/30 border-cyan-500 ring-1 ring-cyan-500/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* Thumbnail */}
            <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-slate-900">
              <img
                src={task.enhancedBlobUrl || task.previewUrl}
                alt={task.name}
                className="w-full h-full object-cover"
              />

              {/* Status Badge */}
              <div className="absolute top-1.5 right-1.5">
                {task.status === 'completed' && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
                    <CheckCircle2 size={12} strokeWidth={3} />
                  </div>
                )}
                {task.status === 'processing' && (
                  <div className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-md animate-spin">
                    <Loader2 size={12} strokeWidth={3} />
                  </div>
                )}
                {task.status === 'failed' && (
                  <div className="w-5 h-5 rounded-full bg-rose-500 text-slate-950 flex items-center justify-center shadow-md">
                    <AlertCircle size={12} strokeWidth={3} />
                  </div>
                )}
              </div>
            </div>

            {/* Title & Metadata Tags */}
            <div className="text-[11px] leading-tight truncate">
              <span className="font-semibold text-slate-200 block truncate">{task.name}</span>
              {task.metadataTags?.cardSeries && (
                <span className="text-[10px] text-cyan-400 block truncate font-mono">
                  {task.metadataTags.year ? `${task.metadataTags.year} ` : ''}{task.metadataTags.cardSeries}
                </span>
              )}
            </div>

            {/* Remove button */}
            {!isProcessing && (
              <button
                id={`btn-remove-queue-item-${task.id}`}
                onClick={() => onRemoveItem(task.id)}
                className="absolute top-1 left-1 p-1 rounded-md bg-slate-950/80 text-slate-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Bulk Metadata Tagging Modal */}
      {showMetaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-cyan-400" />
                <h4 className="text-base font-bold text-slate-100">Bulk Card Metadata</h4>
              </div>
              <button
                onClick={() => setShowMetaModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Apply common tags to all {queue.length} cards in this queue. Tags will format export file names and metadata tags.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Card Series / Set Name</label>
                <input
                  id="input-meta-series"
                  type="text"
                  placeholder="e.g., Topps Chrome, Prizm Silver, Bowman Draft"
                  value={cardSeries}
                  onChange={(e) => setCardSeries(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Release Year</label>
                  <input
                    id="input-meta-year"
                    type="text"
                    placeholder="e.g., 2024, 1952"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Target Grade</label>
                  <select
                    id="select-meta-grade"
                    value={gradeTarget}
                    onChange={(e) => setGradeTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="PSA 10 Gem Mint">PSA 10 Gem Mint</option>
                    <option value="BGS 9.5 Pristine">BGS 9.5 Pristine</option>
                    <option value="CGC 10 Pristine">CGC 10 Pristine</option>
                    <option value="Raw Keeper">Raw Keeper</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Player / Subject</label>
                <input
                  id="input-meta-player"
                  type="text"
                  placeholder="e.g., Victor Wembanyama, Mickey Mantle"
                  value={player}
                  onChange={(e) => setPlayer(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowMetaModal(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                id="btn-apply-bulk-meta"
                onClick={handleSaveMetadata}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
              >
                Apply to Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
