import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Copy, 
  Check, 
  X, 
  FileText, 
  ShoppingBag, 
  Layers, 
  Tag, 
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Package
} from 'lucide-react';
import { CardImage } from '../types';
import { 
  generateCatalogCsv, 
  generateEbayExchangeCsv, 
  getEnhancedFileName, 
  downloadCsvFile, 
  copyCsvToClipboard 
} from '../utils/csvExport';

interface BatchMetadataCsvModalProps {
  isOpen: boolean;
  cards: CardImage[];
  onClose: () => void;
  onDownloadZip?: () => void;
}

export type CsvExportFormat = 'catalog' | 'ebay';

export const BatchMetadataCsvModal: React.FC<BatchMetadataCsvModalProps> = ({
  isOpen,
  cards,
  onClose,
  onDownloadZip
}) => {
  const [format, setFormat] = useState<CsvExportFormat>('catalog');
  const [useMetadataPrefix, setUseMetadataPrefix] = useState<boolean>(true);
  const [defaultPrice, setDefaultPrice] = useState<string>('19.99');
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table');

  // Compute generated CSV string based on format & naming options
  const csvContent = useMemo(() => {
    if (cards.length === 0) return '';
    if (format === 'ebay') {
      return generateEbayExchangeCsv(cards, { useMetadataPrefix, defaultPrice });
    }
    return generateCatalogCsv(cards, { useMetadataPrefix });
  }, [cards, format, useMetadataPrefix, defaultPrice]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const success = await copyCsvToClipboard(csvContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = format === 'ebay' 
      ? `ebay_trading_cards_queue_${timestamp}.csv`
      : `cardcrop_catalog_metadata_${timestamp}.csv`;
    downloadCsvFile(csvContent, fileName);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl max-h-[90vh] bg-[#0c121e] border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/50 flex flex-col overflow-hidden text-slate-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-cyan-500/20 bg-[#090e18] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(0,243,255,0.25)]">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-mono text-cyan-300 uppercase tracking-wider">
                  Export Queue Metadata as CSV
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                  {cards.length} {cards.length === 1 ? 'Card' : 'Cards'} in Queue
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Export structured spreadsheets with file naming that strictly matches cropped image assets.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Format Selector & Controls Toolbar */}
        <div className="p-4 bg-[#070b13] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          
          {/* Format Tabs */}
          <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-lg border border-slate-800">
            <button
              id="tab-csv-catalog"
              onClick={() => setFormat('catalog')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold flex items-center gap-2 transition-all ${
                format === 'catalog'
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(0,243,255,0.4)]'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              <Layers size={14} />
              <span>Standard Catalog CSV</span>
            </button>
            <button
              id="tab-csv-ebay"
              onClick={() => setFormat('ebay')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold flex items-center gap-2 transition-all ${
                format === 'ebay'
                  ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                  : 'text-slate-400 hover:text-indigo-300'
              }`}
            >
              <ShoppingBag size={14} />
              <span>eBay Trading Cards (Cat #261328)</span>
            </button>
          </div>

          {/* Configuration Options */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            {/* Format Naming Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-cyan-200">
              <input
                id="checkbox-meta-filename-prefix"
                type="checkbox"
                checked={useMetadataPrefix}
                onChange={(e) => setUseMetadataPrefix(e.target.checked)}
                className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
              />
              <span>Include metadata prefixes in filenames</span>
            </label>

            {format === 'ebay' && (
              <div className="flex items-center gap-1.5 bg-[#0e1726] px-2.5 py-1 rounded border border-indigo-500/30">
                <span className="text-slate-400 text-[11px]">Default Price ($):</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.99"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  className="w-16 px-1.5 py-0.5 bg-black/60 border border-slate-700 rounded text-cyan-300 text-xs font-mono text-center focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-slate-800 text-[11px]">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2 py-1 rounded ${viewMode === 'table' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-500'}`}
              >
                Table View
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-2 py-1 rounded ${viewMode === 'raw' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-500'}`}
              >
                Raw CSV
              </button>
            </div>
          </div>
        </div>

        {/* Naming Consistency Banner */}
        <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between text-xs font-mono text-emerald-300">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
            <span>
              <strong>File Naming Guaranteed:</strong> Each row's <code className="text-emerald-200 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/40">{format === 'ebay' ? 'CustomLabel' : 'Cropped Asset Filename'}</code> strictly matches the file generated inside the downloaded ZIP archive.
            </span>
          </div>
          <span className="text-[10px] text-emerald-400/80 hidden sm:inline">
            UTF-8 BOM Encoded (Excel / Sheets Ready)
          </span>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-4 bg-[#060a12]">
          {viewMode === 'table' ? (
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs font-mono divide-y divide-slate-800">
                <thead className="bg-[#0b1322] text-slate-300 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-cyan-300">
                      {format === 'ebay' ? 'CustomLabel (Cropped Asset)' : 'Cropped Asset Filename'}
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-slate-300">Original File</th>
                    <th className="py-2.5 px-3 font-semibold text-slate-300">Player / Subject</th>
                    <th className="py-2.5 px-3 font-semibold text-slate-300">Series / Brand</th>
                    <th className="py-2.5 px-3 font-semibold text-slate-300">Year</th>
                    <th className="py-2.5 px-3 font-semibold text-slate-300">Set / Parallel</th>
                    <th className="py-2.5 px-3 font-semibold text-slate-300">Auto</th>
                    <th className="py-2.5 px-3 font-semibold text-slate-300">Print Run</th>
                    <th className="py-2.5 px-3 font-semibold text-slate-300">Condition / Grade</th>
                    {format === 'ebay' && (
                      <th className="py-2.5 px-3 font-semibold text-emerald-300">Price</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#070b14]">
                  {cards.map((card, idx) => {
                    const meta = card.metadata || {};
                    const assetFileName = getEnhancedFileName(card, { useMetadataPrefix });
                    const isAuto = meta.autographed === 'Yes' || meta.autographed === true || card.file.name.toLowerCase().includes('auto');

                    return (
                      <tr key={card.id || idx} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-2.5 px-3 text-cyan-300 font-bold max-w-xs truncate" title={assetFileName}>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                            <span className="truncate">{assetFileName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs" title={card.file.name}>
                          {card.file.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-200 font-semibold">
                          {meta.player || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {meta.cardSeries || meta.manufacturer || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {meta.year || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {meta.setName || meta.parallel || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {isAuto ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              AUTO
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {meta.printRun ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              {meta.printRun}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {meta.gradeTarget || meta.condition || 'Near mint or better'}
                        </td>
                        {format === 'ebay' && (
                          <td className="py-2.5 px-3 text-emerald-400 font-bold">
                            ${meta.price || defaultPrice}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="relative">
              <pre className="p-4 bg-black/80 rounded-lg border border-slate-800 text-slate-300 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre select-all max-h-[50vh]">
                {csvContent}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#090e18] border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Ready to export {cards.length} structured rows</span>
            <span>•</span>
            <span className="text-cyan-300 font-bold">Format: {format === 'ebay' ? 'eBay Category 261328' : 'Standard Catalog CSV'}</span>
          </div>

          <div className="flex items-center gap-2">
            {onDownloadZip && (
              <button
                type="button"
                onClick={onDownloadZip}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-indigo-500/40 text-indigo-300 hover:text-indigo-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                title="Download the corresponding ZIP archive containing the cropped images"
              >
                <Package size={14} />
                <span>Download Assets ZIP</span>
              </button>
            )}

            <button
              id="btn-copy-csv-clipboard"
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
              title="Copy CSV content directly to clipboard"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy CSV'}</span>
            </button>

            <button
              id="btn-download-csv-file"
              type="button"
              onClick={handleDownload}
              className="px-5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-mono font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(0,243,255,0.4)]"
              title="Download CSV file for immediate import into Excel or eBay"
            >
              <Download size={15} />
              <span>Download .CSV File</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
