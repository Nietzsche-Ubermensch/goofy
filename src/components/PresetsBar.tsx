import React from 'react';
import { CardItem } from '../types';
import { Upload, Image as ImageIcon, CheckCircle2, Plus } from 'lucide-react';
import { LiquidGlassContainer } from './LiquidGlassContainer';

interface PresetsBarProps {
  cards: CardItem[];
  activeCardId: string;
  onSelectCard: (id: string) => void;
  onFileUpload: (files: FileList | File[]) => void;
}

export const PresetsBar: React.FC<PresetsBarProps> = ({
  cards,
  activeCardId,
  onSelectCard,
  onFileUpload
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-cyan-400" />
          Card Queue & Sample Presets ({cards.length})
        </h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-cyan-300 border border-white/10 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Card</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onFileUpload(e.target.files)}
        />
      </div>

      {/* Grid of Cards */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {cards.map((card) => {
          const isActive = card.id === activeCardId;
          return (
            <LiquidGlassContainer
              key={card.id}
              onClick={() => onSelectCard(card.id)}
              active={isActive}
              className="group cursor-pointer p-2.5 flex flex-col gap-2 relative transition-transform duration-200 active:scale-95"
            >
              {/* Thumbnail Container */}
              <div className="relative w-full aspect-[2.5/3.5] rounded-xl overflow-hidden bg-black/60 border border-white/10">
                <img
                  src={card.processedBlobUrl || card.originalUrl}
                  alt={card.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {isActive && (
                  <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-cyan-400 text-slate-950 shadow-md">
                    <CheckCircle2 className="w-3.5 h-3.5 fill-slate-950 stroke-cyan-400" />
                  </div>
                )}

                {card.isPreset && (
                  <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] bg-black/70 text-cyan-300 font-mono border border-cyan-400/30">
                    Preset
                  </div>
                )}
              </div>

              {/* Card Label */}
              <div className="px-1">
                <p className="text-xs font-medium text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                  {card.name}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {card.width}×{card.height}
                </p>
              </div>
            </LiquidGlassContainer>
          );
        })}

        {/* Drag & Drop Upload Tile */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group cursor-pointer p-2.5 flex flex-col items-center justify-center gap-2 aspect-[2.5/3.5] rounded-2xl border border-dashed border-white/20 hover:border-cyan-400/60 bg-white/[0.01] hover:bg-cyan-500/[0.03] transition-all"
        >
          <div className="p-3 rounded-full bg-white/5 group-hover:bg-cyan-500/20 text-slate-400 group-hover:text-cyan-300 transition-colors">
            <Upload className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-slate-400 group-hover:text-cyan-300 text-center px-2">
            Drop your image here
          </span>
        </div>
      </div>
    </div>
  );
};
