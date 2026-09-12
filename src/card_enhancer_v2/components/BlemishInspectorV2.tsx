import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle, Flame, Eye } from 'lucide-react';
import { BlemishItem } from '../types';

interface BlemishInspectorV2Props {
  blemishes: BlemishItem[];
  onToggleRepair?: (id: string) => void;
}

export const BlemishInspectorV2: React.FC<BlemishInspectorV2Props> = ({
  blemishes,
  onToggleRepair,
}) => {
  const scratchCount = blemishes.filter(b => b.type === 'scratch').length;
  const dustCount = blemishes.filter(b => b.type === 'dust').length;
  const scuffCount = blemishes.filter(b => b.type === 'scuff').length;

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 space-y-3 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-cyan-400" />
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Defect Telemetry ({blemishes.length})
          </h4>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
          <ShieldCheck size={12} /> Auto-Inpaint Active
        </span>
      </div>

      {/* Defect Summary Counters */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-slate-400 block font-semibold">Scratches</span>
          <span className="text-sm font-bold text-rose-400 font-mono">{scratchCount}</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-slate-400 block font-semibold">Dust Specks</span>
          <span className="text-sm font-bold text-amber-400 font-mono">{dustCount}</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-slate-400 block font-semibold">Slab Scuffs</span>
          <span className="text-sm font-bold text-cyan-400 font-mono">{scuffCount}</span>
        </div>
      </div>

      {/* Blemish List */}
      {blemishes.length > 0 ? (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {blemishes.map((b, idx) => (
            <div
              key={b.id}
              className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px]"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  b.severity === 'high' ? 'bg-rose-500' : b.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <span className="font-semibold text-slate-300 capitalize">{b.type} #{idx + 1}</span>
                <span className="text-[9px] font-mono text-slate-400">
                  ({Math.round(b.confidence * 100)}% conf)
                </span>
              </div>

              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[9px] font-mono font-bold uppercase">
                Restored
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-slate-400 text-xs">
          No surface defects detected on current card.
        </div>
      )}
    </div>
  );
};
