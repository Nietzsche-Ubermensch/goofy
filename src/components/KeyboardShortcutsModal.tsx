import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  X,
  Search,
  Move,
  RotateCw,
  Sparkles,
  Download,
  Terminal,
  Grid,
  CornerUpLeft,
  Info,
  Layers,
  MousePointer,
  HelpCircle
} from 'lucide-react';
import { LiquidGlassContainer } from './LiquidGlassContainer';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'crop' | 'actions' | 'rotation' | 'system';
  detail?: string;
  badgeColor?: string;
}

const SHORTCUT_LIST: ShortcutItem[] = [
  // Crop & Nudge
  {
    keys: ['↑', '↓', '←', '→'],
    description: 'Precision Micro-Nudge (1px)',
    category: 'crop',
    detail: 'Moves active quad crop boundaries by 0.002 relative units for microscopic edge alignment.',
    badgeColor: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10'
  },
  {
    keys: ['Shift', '+', 'Arrow Keys'],
    description: 'Fast Macro-Nudge (10px)',
    category: 'crop',
    detail: 'Quickly reposition quad boundaries across 0.015 relative units.',
    badgeColor: 'border-indigo-500/40 text-indigo-300 bg-indigo-500/10'
  },
  {
    keys: ['Mouse Drag'],
    description: 'Direct Quad Corner Positioning',
    category: 'crop',
    detail: 'Click and drag any of the 4 neon corner handles with live perspective preview.',
    badgeColor: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10'
  },
  {
    keys: ['Drag & Drop'],
    description: 'Universal File & Folder Import',
    category: 'crop',
    detail: 'Drop slab photos or batch directories anywhere onto the viewport.',
    badgeColor: 'border-purple-500/40 text-purple-300 bg-purple-500/10'
  },

  // Actions & Processing
  {
    keys: ['Space'],
    description: 'Execute Auto-Crop Edge Detection',
    category: 'actions',
    detail: 'Runs automatic Sobel contour edge analysis to detect card borders instantly.',
    badgeColor: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
  },
  {
    keys: ['Enter'],
    description: 'Instant High-Res PNG Export',
    category: 'actions',
    detail: 'Renders full GPU WebGL shader pipeline and downloads the straightened card.',
    badgeColor: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
  },
  {
    keys: ['Esc'],
    description: 'Reset Enhancement Filters',
    category: 'actions',
    detail: 'Restores default contrast, sharpening, saturation, and descratch settings.',
    badgeColor: 'border-amber-500/40 text-amber-300 bg-amber-500/10'
  },

  // Deskewing & Rotation
  {
    keys: ['['],
    description: 'Rotate 90° Counter-Clockwise',
    category: 'rotation',
    detail: 'Rotates card canvas orientation by -90 degrees.',
    badgeColor: 'border-sky-500/40 text-sky-300 bg-sky-500/10'
  },
  {
    keys: [']'],
    description: 'Rotate 90° Clockwise',
    category: 'rotation',
    detail: 'Rotates card canvas orientation by +90 degrees.',
    badgeColor: 'border-sky-500/40 text-sky-300 bg-sky-500/10'
  },
  {
    keys: ['Alt', '+', '←'],
    description: 'Fine-Tune Deskew (-0.5°)',
    category: 'rotation',
    detail: 'Sub-degree rotation adjustment for correcting misaligned scanner beds.',
    badgeColor: 'border-blue-500/40 text-blue-300 bg-blue-500/10'
  },
  {
    keys: ['Alt', '+', '→'],
    description: 'Fine-Tune Deskew (+0.5°)',
    category: 'rotation',
    detail: 'Sub-degree clockwise rotation adjustment for card slab tilt.',
    badgeColor: 'border-blue-500/40 text-blue-300 bg-blue-500/10'
  },
  {
    keys: ['Shift', '+', 'R'],
    description: 'Reset Rotation to 0.0°',
    category: 'rotation',
    detail: 'Instantly resets orientation and fine deskew angle to zero.',
    badgeColor: 'border-blue-500/40 text-blue-300 bg-blue-500/10'
  },
  {
    keys: ['G'],
    description: 'Toggle Straightening Grid',
    category: 'rotation',
    detail: 'Overlays a high-precision 40px neon grid for optical alignment check.',
    badgeColor: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10'
  },

  // System & Telemetry
  {
    keys: ['?', 'or', 'Shift', '+', '/'],
    description: 'Toggle Keyboard Shortcuts Modal',
    category: 'system',
    detail: 'Opens this quick hotkey reference guide anytime.',
    badgeColor: 'border-purple-500/40 text-purple-300 bg-purple-500/10'
  },
  {
    keys: ['Ctrl', '+', 'Shift', '+', 'A'],
    description: 'Open Single-Pass Telemetry Audit',
    category: 'system',
    detail: 'Captures full diagnostic metrics, GPU status, and formatted AI audit logs.',
    badgeColor: 'border-purple-500/40 text-purple-300 bg-purple-500/10'
  }
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'crop' | 'actions' | 'rotation' | 'system'>('all');
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // Listen to live keydown events while modal is open to test hotkeys
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      setPressedKeys((prev) => {
        const next = new Set(prev);
        if (e.key === ' ') next.add('Space');
        else if (e.key === 'Control') next.add('Ctrl');
        else if (e.key === 'Meta') next.add('Cmd');
        else if (e.key === 'Alt') next.add('Alt');
        else if (e.key === 'Shift') next.add('Shift');
        else if (e.key === 'ArrowUp') next.add('↑');
        else if (e.key === 'ArrowDown') next.add('↓');
        else if (e.key === 'ArrowLeft') next.add('←');
        else if (e.key === 'ArrowRight') next.add('→');
        else next.add(e.key.toUpperCase());
        return next;
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setPressedKeys((prev) => {
        const next = new Set(prev);
        if (e.key === ' ') next.delete('Space');
        else if (e.key === 'Control') next.delete('Ctrl');
        else if (e.key === 'Meta') next.delete('Cmd');
        else if (e.key === 'Alt') next.delete('Alt');
        else if (e.key === 'Shift') next.delete('Shift');
        else if (e.key === 'ArrowUp') next.delete('↑');
        else if (e.key === 'ArrowDown') next.delete('↓');
        else if (e.key === 'ArrowLeft') next.delete('←');
        else if (e.key === 'ArrowRight') next.delete('→');
        else next.delete(e.key.toUpperCase());
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredShortcuts = SHORTCUT_LIST.filter((item) => {
    const matchesTab = activeTab === 'all' || item.category === activeTab;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keys.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.detail && item.detail.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const categories = [
    { id: 'all', label: 'All Commands', count: SHORTCUT_LIST.length, icon: Layers },
    {
      id: 'crop',
      label: 'Nudge & Crop',
      count: SHORTCUT_LIST.filter((s) => s.category === 'crop').length,
      icon: Move
    },
    {
      id: 'actions',
      label: 'Actions & Export',
      count: SHORTCUT_LIST.filter((s) => s.category === 'actions').length,
      icon: Sparkles
    },
    {
      id: 'rotation',
      label: 'Rotation & Grid',
      count: SHORTCUT_LIST.filter((s) => s.category === 'rotation').length,
      icon: RotateCw
    },
    {
      id: 'system',
      label: 'System & Audits',
      count: SHORTCUT_LIST.filter((s) => s.category === 'system').length,
      icon: Terminal
    }
  ];

  return (
    <div
      id="keyboard-shortcuts-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-[#070d19] border border-cyan-400/40 shadow-[0_0_50px_rgba(0,243,255,0.25)] overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_15px_rgba(0,243,255,0.2)]">
              <Keyboard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Keyboard Shortcuts & Hotkey Mappings
                <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-400/30">
                  ? or Shift+/
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Single-key triggers for perspective nudges, automated edge cropping, deskewing, and high-res export
              </p>
            </div>
          </div>
          <button
            id="close-shortcuts-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/10"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar & Category Tabs */}
        <div className="p-6 pb-2 space-y-4 border-b border-white/5 bg-slate-950/40">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shortcuts (e.g. nudge, crop, rotate)..."
                className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 transition-all font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live Key Detection / Indicator */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className={`w-2 h-2 rounded-full ${pressedKeys.size > 0 ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
                Live Keys:
              </span>
              <div className="flex items-center gap-1 min-h-[26px]">
                {pressedKeys.size > 0 ? (
                  Array.from(pressedKeys).map((k) => (
                    <kbd
                      key={k}
                      className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 font-bold shadow-[0_0_10px_rgba(0,243,255,0.3)] text-[11px]"
                    >
                      {k}
                    </kbd>
                  ))
                ) : (
                  <span className="text-slate-600 text-[11px] italic">Press any key to test</span>
                )}
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm font-semibold'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-cyan-400/30 text-cyan-200' : 'bg-white/10 text-slate-500'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shortcuts List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-sans">
          {filteredShortcuts.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <HelpCircle className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">No shortcuts found matching "{searchQuery}"</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('all');
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-xs font-mono"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredShortcuts.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-between p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-cyan-400/30 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {item.description}
                      </h4>
                      {item.detail && (
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Hotkey Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5 mt-2">
                    {item.keys.map((k, kIdx) => {
                      if (k === '+' || k === 'or') {
                        return (
                          <span key={kIdx} className="text-slate-500 text-[11px] font-mono font-medium px-0.5">
                            {k}
                          </span>
                        );
                      }
                      return (
                        <kbd
                          key={kIdx}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold tracking-wide border shadow-sm ${
                            item.badgeColor || 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10'
                          }`}
                        >
                          {k}
                        </kbd>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Precision Nudge Guide Footer Card */}
          <LiquidGlassContainer className="p-4 mt-6 bg-cyan-950/20 border border-cyan-400/20 rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h5 className="font-bold text-cyan-300 font-mono uppercase tracking-wider">
                Pro Grading Tip: Micro-Nudge & Alignment Deskew
              </h5>
              <p className="text-slate-300 leading-relaxed">
                When cropping PSA, BGS, or CGC encapsulated slabs, use <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">G</kbd> to activate the overlay grid, adjust micro-tilt with <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">Alt + ← / →</kbd>, and nudge the quad corners using <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">Arrow Keys</kbd> to guarantee exact 2.5×3.5 aspect ratio bounding without clipping card borders.
              </p>
            </div>
          </LiquidGlassContainer>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-slate-950/60 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span>Press</span>
            <kbd className="px-2 py-0.5 rounded bg-white/10 text-slate-200 border border-white/15">Esc</kbd>
            <span>or click outside to close</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 font-semibold transition-all active:scale-95 shadow-sm"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
export default KeyboardShortcutsModal;
