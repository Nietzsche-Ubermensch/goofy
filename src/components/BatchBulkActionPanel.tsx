import React, { useState } from 'react';
import { 
  Tag, 
  Sparkles, 
  Check, 
  Layers, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw, 
  Calendar, 
  Award,
  FileSpreadsheet,
  FileCode,
  Zap,
  Bookmark
} from 'lucide-react';
import { CardMetadataTags } from '../types';

interface BatchBulkActionPanelProps {
  totalCards: number;
  onApplyMetadata: (metadata: CardMetadataTags, renameFiles: boolean) => void;
  onClearMetadata?: () => void;
  onStartExport: () => void;
  onApplyEnhancements: () => void;
  isProcessing?: boolean;
  isExporting?: boolean;
  activeMetadataCount?: number;
}

const COMMON_CARD_PRESETS: Array<{
  name: string;
  series: string;
  year: string;
  setName: string;
  gradeTarget: string;
}> = [
  {
    name: '2024 Topps Chrome',
    series: 'Topps Chrome',
    year: '2024',
    setName: 'Base Refractor',
    gradeTarget: 'PSA 10 Gem Mint'
  },
  {
    name: '2023-24 Panini Prizm',
    series: 'Panini Prizm',
    year: '2023-24',
    setName: 'Silver Prizm',
    gradeTarget: 'PSA 10 Gem Mint'
  },
  {
    name: '2024 Bowman Chrome 1st',
    series: 'Bowman Chrome',
    year: '2024',
    setName: '1st Bowman Edition',
    gradeTarget: 'BGS 9.5 Pristine'
  },
  {
    name: '2023-24 Upper Deck',
    series: 'Upper Deck Series 1',
    year: '2023-24',
    setName: 'Young Guns',
    gradeTarget: 'PSA 10 Gem Mint'
  },
  {
    name: '2023 Pokémon 151',
    series: 'Scarlet & Violet: 151',
    year: '2023',
    setName: 'Special Illustration Rare',
    gradeTarget: 'CGC 10 Pristine'
  },
  {
    name: '1986-87 Fleer Vintage',
    series: 'Fleer Basketball',
    year: '1986-87',
    setName: 'Premier Vintage',
    gradeTarget: 'PSA 9 Mint'
  }
];

export const BatchBulkActionPanel: React.FC<BatchBulkActionPanelProps> = ({
  totalCards,
  onApplyMetadata,
  onClearMetadata,
  onStartExport,
  onApplyEnhancements,
  isProcessing = false,
  isExporting = false,
  activeMetadataCount = 0
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [cardSeries, setCardSeries] = useState('');
  const [year, setYear] = useState('');
  const [setName, setSetName] = useState('');
  const [gradeTarget, setGradeTarget] = useState('PSA 10 Gem Mint');
  const [notes, setNotes] = useState('');
  const [player, setPlayer] = useState('');
  const [renameFiles, setRenameFiles] = useState(true);
  const [justAppliedMessage, setJustAppliedMessage] = useState<string | null>(null);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (totalCards === 0) return;

    const meta: CardMetadataTags = {
      cardSeries: cardSeries.trim() || undefined,
      year: year.trim() || undefined,
      setName: setName.trim() || undefined,
      player: player.trim() || undefined,
      gradeTarget: gradeTarget || undefined,
      notes: notes.trim() || undefined,
    };

    onApplyMetadata(meta, renameFiles);

    const summaryParts = [
      year.trim(),
      cardSeries.trim(),
      setName.trim()
    ].filter(Boolean);

    setJustAppliedMessage(`✓ Applied "${summaryParts.join(' • ') || 'Custom Metadata'}" to all ${totalCards} cards!`);
    setTimeout(() => {
      setJustAppliedMessage(null);
    }, 4000);
  };

  const handleApplyAndExport = () => {
    handleApply();
    setTimeout(() => {
      onStartExport();
    }, 150);
  };

  const handleSelectPreset = (preset: typeof COMMON_CARD_PRESETS[0]) => {
    setCardSeries(preset.series);
    setYear(preset.year);
    setSetName(preset.setName);
    setGradeTarget(preset.gradeTarget);
  };

  const handleResetInputs = () => {
    setCardSeries('');
    setYear('');
    setSetName('');
    setPlayer('');
    setNotes('');
    setGradeTarget('PSA 10 Gem Mint');
    if (onClearMetadata) {
      onClearMetadata();
    }
  };

  // Compute live preview of exported filename
  const sampleYear = year.trim() || '2024';
  const sampleSeries = (cardSeries.trim() || 'Topps_Chrome').replace(/\s+/g, '_');
  const sampleSet = setName.trim() ? `${setName.trim().replace(/\s+/g, '_')}_` : '';
  const previewFilename = `${sampleYear}_${sampleSeries}_${sampleSet}enhanced_card_001.png`;

  return (
    <div className="w-full bg-[#090e1a]/95 border-b border-cyan-500/25 text-slate-200 transition-all shadow-lg relative z-10 backdrop-blur-md">
      {/* Panel Top Header Bar */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 bg-[#0c1322] border-b border-cyan-500/20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_10px_rgba(0,243,255,0.25)]">
            <Bookmark size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wider">
                Bulk Action & Queue Metadata
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold">
                {totalCards} {totalCards === 1 ? 'Card' : 'Cards'} in Queue
              </span>
              {activeMetadataCount > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center gap-1">
                  <Check size={10} /> {activeMetadataCount} Tagged
                </span>
              )}
            </div>
            <p className="text-[10.5px] font-mono text-slate-400 leading-none mt-0.5">
              Tag series, year, set, and target grade to all cards with 1 click before exporting ZIP archive
            </p>
          </div>
        </div>

        {/* Quick Header Actions & Collapse Toggle */}
        <div className="flex items-center gap-2">
          {justAppliedMessage && (
            <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-400/40 px-2.5 py-1 rounded animate-fade-in flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              <Check size={12} className="text-emerald-300" />
              {justAppliedMessage}
            </span>
          )}

          <button
            id="btn-bulk-panel-apply-header"
            onClick={() => handleApply()}
            disabled={totalCards === 0 || isProcessing}
            className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,243,255,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Single-click: apply Card Series, Year, and Set to all cards in the batch queue"
          >
            <Zap size={13} fill="currentColor" />
            <span>Apply to All Cards</span>
          </button>

          <button
            id="btn-bulk-panel-export"
            onClick={handleApplyAndExport}
            disabled={totalCards === 0 || isExporting || isProcessing}
            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(99,102,241,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Apply metadata and immediately start ZIP export package generation"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Apply & Export</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-colors"
            title={isExpanded ? 'Collapse bulk action panel' : 'Expand bulk action panel'}
            aria-label="Toggle Panel"
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="p-3.5 md:p-4 space-y-3.5 bg-[#090e1a]/90">
          
          {/* Quick 1-Click Popular Series Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 mr-1">
              <Sparkles size={11} className="text-cyan-400" />
              1-Click Series:
            </span>
            {COMMON_CARD_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className="px-2.5 py-1 rounded bg-slate-900/90 hover:bg-cyan-950/60 border border-slate-700/80 hover:border-cyan-400/60 text-[10.5px] font-mono text-slate-300 hover:text-cyan-200 transition-all flex items-center gap-1.5"
                title={`Click to fill: ${p.series} (${p.year}) - ${p.setName}`}
              >
                <span>{p.name}</span>
                <span className="text-[9px] text-cyan-400/80 font-mono">[{p.setName}]</span>
              </button>
            ))}
          </div>

          {/* Form Input Row */}
          <form onSubmit={handleApply} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              
              {/* Card Series */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-mono text-cyan-300 font-semibold flex items-center gap-1">
                  <Tag size={11} className="text-cyan-400" /> Card Series / Brand
                </label>
                <input
                  id="bulk-card-series-input"
                  type="text"
                  placeholder="e.g. Topps Chrome, Prizm"
                  value={cardSeries}
                  onChange={(e) => setCardSeries(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-[#060a12] border border-cyan-500/30 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs shadow-inner"
                />
              </div>

              {/* Release Year */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-mono text-cyan-300 font-semibold flex items-center gap-1">
                  <Calendar size={11} className="text-cyan-400" /> Year / Season
                </label>
                <input
                  id="bulk-year-input"
                  type="text"
                  placeholder="e.g. 2024, 2023-24, 1986"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-[#060a12] border border-cyan-500/30 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs shadow-inner"
                />
              </div>

              {/* Set / Parallel */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-mono text-cyan-300 font-semibold flex items-center gap-1">
                  <Layers size={11} className="text-cyan-400" /> Set / Parallel / Insert
                </label>
                <input
                  id="bulk-set-input"
                  type="text"
                  placeholder="e.g. Silver Prizm, Young Guns"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-[#060a12] border border-cyan-500/30 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs shadow-inner"
                />
              </div>

              {/* Target Grading */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-mono text-cyan-300 font-semibold flex items-center gap-1">
                  <Award size={11} className="text-cyan-400" /> Target Grade Tier
                </label>
                <select
                  id="bulk-grade-input"
                  value={gradeTarget}
                  onChange={(e) => setGradeTarget(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-[#060a12] border border-cyan-500/30 text-slate-100 focus:outline-none focus:border-cyan-400 font-mono text-xs shadow-inner cursor-pointer"
                >
                  <option value="PSA 10 Gem Mint">PSA 10 Gem Mint</option>
                  <option value="BGS 9.5 Pristine">BGS 9.5 Pristine</option>
                  <option value="CGC 10 Pristine">CGC 10 Pristine</option>
                  <option value="SGC 10 Pristine">SGC 10 Pristine</option>
                  <option value="PSA 9 Mint">PSA 9 Mint</option>
                  <option value="Raw Keeper">Raw Keeper</option>
                </select>
              </div>

              {/* Player / Notes */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-mono text-cyan-300 font-semibold flex items-center gap-1">
                  <Bookmark size={11} className="text-cyan-400" /> Lot / Batch Note
                </label>
                <input
                  id="bulk-notes-input"
                  type="text"
                  placeholder="e.g. Case #1, Box Break"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-[#060a12] border border-cyan-500/30 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs shadow-inner"
                />
              </div>

            </div>

            {/* Bottom Controls, Naming Preview & Execution */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-500/15">
              
              {/* Left: Export Preview & Naming Configuration */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-cyan-200">
                  <input
                    type="checkbox"
                    checked={renameFiles}
                    onChange={(e) => setRenameFiles(e.target.checked)}
                    className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
                  />
                  <span className="text-[11px]">Format Export File Names</span>
                </label>

                <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded border border-cyan-500/20 text-[10px] text-cyan-300">
                  <FileCode size={11} className="text-cyan-400" />
                  <span className="text-slate-400">Pattern:</span>
                  <code className="text-cyan-200 truncate max-w-xs">{previewFilename}</code>
                </div>

                <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <FileSpreadsheet size={11} className="text-emerald-400" /> manifest.json & CSV included in ZIP
                  </span>
                </div>
              </div>

              {/* Right: Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetInputs}
                  className="px-2.5 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 text-[11px] font-mono transition-colors flex items-center gap-1"
                  title="Clear inputs & remove tags from queue"
                >
                  <RotateCcw size={11} />
                  <span>Clear</span>
                </button>

                <button
                  type="button"
                  onClick={onApplyEnhancements}
                  disabled={totalCards === 0 || isProcessing}
                  className="px-3 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 text-[11px] font-mono font-semibold flex items-center gap-1 transition-all disabled:opacity-40"
                  title="Enhance all queued cards with GPU shader filter"
                >
                  <Sparkles size={11} />
                  <span>Enhance All</span>
                </button>

                <button
                  id="btn-bulk-panel-apply-primary"
                  type="submit"
                  disabled={totalCards === 0 || isProcessing}
                  className="px-4 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Apply metadata across all cards in the queue"
                >
                  <Zap size={13} fill="currentColor" />
                  <span>Apply to All ({totalCards}) Cards</span>
                </button>
              </div>

            </div>
          </form>

        </div>
      )}
    </div>
  );
};
export default BatchBulkActionPanel;
