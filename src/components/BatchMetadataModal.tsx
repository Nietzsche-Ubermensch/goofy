import React, { useState } from 'react';
import { Tag, X, Check, Sparkles, Folder, FileText } from 'lucide-react';
import { CardMetadataTags } from '../types';

interface BatchMetadataModalProps {
  isOpen: boolean;
  totalCards: number;
  onClose: () => void;
  onApply: (metadata: CardMetadataTags, renameFiles: boolean) => void;
}

export const BatchMetadataModal: React.FC<BatchMetadataModalProps> = ({
  isOpen,
  totalCards,
  onClose,
  onApply,
}) => {
  const [cardSeries, setCardSeries] = useState('');
  const [year, setYear] = useState('');
  const [setName, setSetName] = useState('');
  const [player, setPlayer] = useState('');
  const [gradeTarget, setGradeTarget] = useState('PSA 10 Gem Mint');
  const [notes, setNotes] = useState('');
  const [renameFiles, setRenameFiles] = useState(true);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(
      {
        cardSeries: cardSeries.trim() || undefined,
        year: year.trim() || undefined,
        setName: setName.trim() || undefined,
        player: player.trim() || undefined,
        gradeTarget: gradeTarget || undefined,
        notes: notes.trim() || undefined,
      },
      renameFiles
    );
    onClose();
  };

  const applyPreset = (presetSeries: string, presetYear: string, presetSet?: string) => {
    setCardSeries(presetSeries);
    setYear(presetYear);
    if (presetSet) setSetName(presetSet);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#0c121e] border border-cyan-500/40 rounded-2xl p-6 shadow-2xl shadow-cyan-950/50 space-y-5 text-slate-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Tag size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono text-cyan-300 uppercase tracking-wider">
                Batch Metadata Editor
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Bulk assign series, year, and grading tags across {totalCards} cards in queue
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">
            Popular Series Quick Presets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { series: 'Topps Chrome', year: '2024', set: 'Base Refractor' },
              { series: 'Panini Prizm', year: '2023-24', set: 'Silver Prizm' },
              { series: 'Bowman Chrome', year: '2024', set: '1st Bowman' },
              { series: 'Upper Deck', year: '2023-24', set: 'Young Guns' },
              { series: 'Pokemon 151', year: '2023', set: 'Special Art Rare' },
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p.series, p.year, p.set)}
                className="px-2.5 py-1 rounded-md bg-slate-900/80 hover:bg-cyan-950/50 border border-slate-700 hover:border-cyan-500/50 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1"
              >
                <Sparkles size={10} className="text-cyan-400" />
                <span>{p.series} ({p.year}) [{p.set}]</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleApply} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-mono text-slate-300 font-semibold block">
                Card Series / Brand
              </label>
              <input
                id="batch-meta-series"
                type="text"
                placeholder="e.g., Topps Chrome, Prizm"
                value={cardSeries}
                onChange={(e) => setCardSeries(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#070b12] border border-cyan-500/30 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-slate-300 font-semibold block">
                Set / Parallel / Insert
              </label>
              <input
                id="batch-meta-set"
                type="text"
                placeholder="e.g., Base Refractor, Silver Prizm"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#070b12] border border-cyan-500/30 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-mono text-slate-300 font-semibold block">
                Release Year / Season
              </label>
              <input
                id="batch-meta-year"
                type="text"
                placeholder="e.g., 2024, 1986, 1952"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#070b12] border border-cyan-500/30 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-slate-300 font-semibold block">
                Target Grading Standard
              </label>
              <select
                id="batch-meta-grade"
                value={gradeTarget}
                onChange={(e) => setGradeTarget(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#070b12] border border-cyan-500/30 text-slate-100 focus:outline-none focus:border-cyan-400 font-mono text-xs cursor-pointer"
              >
                <option value="PSA 10 Gem Mint">PSA 10 Gem Mint</option>
                <option value="BGS 9.5 Pristine">BGS 9.5 Pristine</option>
                <option value="CGC 10 Pristine">CGC 10 Pristine</option>
                <option value="SGC 10 Pristine">SGC 10 Pristine</option>
                <option value="Raw Keeper">Raw Keeper</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-mono text-slate-300 font-semibold block">
              Player / Subject (Optional)
            </label>
            <input
              id="batch-meta-player"
              type="text"
              placeholder="e.g., Victor Wembanyama, Michael Jordan"
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070b12] border border-cyan-500/30 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="font-mono text-slate-300 font-semibold block">
              Batch Notes / Custom Tags
            </label>
            <input
              id="batch-meta-notes"
              type="text"
              placeholder="e.g., Box Break Case #4, Lot #12"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#070b12] border border-cyan-500/30 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs"
            />
          </div>

          {/* Rename File Checkbox */}
          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 cursor-pointer select-none">
            <input
              id="batch-meta-rename-checkbox"
              type="checkbox"
              checked={renameFiles}
              onChange={(e) => setRenameFiles(e.target.checked)}
              className="w-4 h-4 rounded accent-cyan-400"
            />
            <div className="text-xs">
              <span className="font-mono font-semibold text-cyan-200 block">
                Format export file names with tags
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Pattern: <code>[Year]_[Series]_[OriginalName].png</code>
              </span>
            </div>
          </label>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-cyan-500/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-mono font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-apply-batch-metadata"
              type="submit"
              className="px-5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,243,255,0.4)]"
            >
              <Check size={14} strokeWidth={3} />
              <span>Apply to All Cards</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
