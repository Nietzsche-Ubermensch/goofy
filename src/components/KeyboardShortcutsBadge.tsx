import React from 'react';
import { HelpCircle, Terminal } from 'lucide-react';

export const KeyboardShortcutsBadge: React.FC<{
  onOpenAudit: () => void;
  onOpenShortcuts: () => void;
}> = ({ onOpenAudit, onOpenShortcuts }) => {
  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl text-xs font-mono text-slate-400">
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={onOpenShortcuts}
          className="text-slate-200 font-semibold flex items-center gap-1.5 hover:text-cyan-300 transition-colors group cursor-pointer"
          title="Click or press '?' for full shortcut mapping"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse group-hover:scale-125 transition-transform" />
          <span>Hotkeys</span>
          <kbd className="ml-1 px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-[10px]">?</kbd>
        </button>
        <div className="flex items-center gap-1.5">
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-cyan-300 border border-white/15">Space</kbd>
          <span>Auto-Crop</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-emerald-300 border border-white/15">Enter</kbd>
          <span>Export PNG</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-purple-300 border border-white/15">Arrows</kbd>
          <span>1px Nudge</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-purple-300 border border-white/15">Shift+Arrows</kbd>
          <span>10px Nudge</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-blue-300 border border-white/15">Alt+Arrows</kbd>
          <span>Deskew</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-amber-300 border border-white/15">Esc</kbd>
          <span>Reset</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenShortcuts}
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/10 font-mono transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
          <kbd className="font-bold text-cyan-300">?</kbd>
          <span>All Hotkeys</span>
        </button>

        <button
          onClick={onOpenAudit}
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 font-mono transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5" />
          <kbd className="font-bold">Ctrl+Shift+A</kbd>
          <span>Audit Log</span>
        </button>
      </div>
    </div>
  );
};

