import React from 'react';

export const KeyboardShortcutsBadge: React.FC<{ onOpenAudit: () => void }> = ({ onOpenAudit }) => {
  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl text-xs font-mono text-slate-400">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-slate-200 font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Hotkeys:
        </span>
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
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-amber-300 border border-white/15">Esc</kbd>
          <span>Reset</span>
        </div>
      </div>

      <button
        onClick={onOpenAudit}
        className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 font-mono transition-all shadow-md active:scale-95"
      >
        <kbd className="font-bold">Ctrl+Shift+A</kbd>
        <span>Audit Log</span>
      </button>
    </div>
  );
};
