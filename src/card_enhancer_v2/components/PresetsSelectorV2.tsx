import React, { useState } from 'react';
import { Sparkles, Check, Flame, Trophy, Layers, Clock, Gem } from 'lucide-react';
import { EnhancementPreset } from '../types';

interface PresetsSelectorV2Props {
  presets: EnhancementPreset[];
  activePresetId?: string;
  onSelectPreset: (preset: EnhancementPreset) => void;
}

export const PresetsSelectorV2: React.FC<PresetsSelectorV2Props> = ({
  presets,
  activePresetId,
  onSelectPreset,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Sports', 'Modern Prizm', 'Vintage', 'TCG & Holo', 'Restoration'];

  const filteredPresets = selectedCategory === 'All'
    ? presets
    : presets.filter(p => p.category === selectedCategory);

  return (
    <div className="w-full space-y-3 select-none">
      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            id={`preset-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Preset Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredPresets.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <div
              key={preset.id}
              id={`preset-card-${preset.id}`}
              onClick={() => onSelectPreset(preset)}
              className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                isActive
                  ? 'bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border-cyan-500/80 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                  : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition-colors">
                      {preset.name}
                    </span>
                  </div>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-cyan-400 font-semibold">
                    {preset.badge}
                  </span>
                </div>

                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                  isActive ? 'bg-cyan-500 text-slate-950' : 'border border-slate-700 text-transparent'
                }`}>
                  <Check size={12} strokeWidth={3} />
                </div>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {preset.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
