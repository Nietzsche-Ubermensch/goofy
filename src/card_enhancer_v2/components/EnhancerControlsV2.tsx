import React, { useState } from 'react';
import { 
  Sun, 
  Contrast, 
  Sparkles, 
  Sliders, 
  Cpu, 
  Zap, 
  ShieldAlert, 
  RotateCcw, 
  Layers,
  Wand2,
  Gem
} from 'lucide-react';
import { EnhancementParameters } from '../types';

interface EnhancerControlsV2Props {
  params: EnhancementParameters;
  onUpdateParam: <K extends keyof EnhancementParameters>(key: K, value: EnhancementParameters[K]) => void;
  onResetParams: () => void;
}

type TabType = 'tone' | 'sharpness' | 'ai' | 'inpainting' | 'holo';

export const EnhancerControlsV2: React.FC<EnhancerControlsV2Props> = ({
  params,
  onUpdateParam,
  onResetParams,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('tone');

  return (
    <div className="w-full h-full flex flex-col bg-slate-900/90 backdrop-blur-xl border-l border-slate-800/80 select-none">
      {/* Category Tab Bar */}
      <div className="flex items-center gap-1 p-3 border-b border-slate-800 overflow-x-auto no-scrollbar">
        <button
          id="tab-btn-tone"
          onClick={() => setActiveTab('tone')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'tone'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sun size={14} />
          <span>Exposure</span>
        </button>

        <button
          id="tab-btn-sharpness"
          onClick={() => setActiveTab('sharpness')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'sharpness'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sparkles size={14} />
          <span>Clarity</span>
        </button>

        <button
          id="tab-btn-ai"
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'ai'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Cpu size={14} />
          <span>AI HD Upscale</span>
        </button>

        <button
          id="tab-btn-inpainting"
          onClick={() => setActiveTab('inpainting')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'inpainting'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Wand2 size={14} />
          <span>Inpainting</span>
        </button>

        <button
          id="tab-btn-holo"
          onClick={() => setActiveTab('holo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'holo'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Gem size={14} />
          <span>Foil / Slab</span>
        </button>
      </div>

      {/* Main Sliders Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* --- 1. EXPOSURE & TONE TAB --- */}
        {activeTab === 'tone' && (
          <div className="space-y-4">
            {/* EV Brightness Gain */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <Sun size={13} className="text-amber-400" />
                  EV Brightness Gain
                </span>
                <span className="font-mono text-cyan-400">
                  {params.brightness > 0 ? `+${Math.round(params.brightness * 100)}%` : `${Math.round(params.brightness * 100)}%`}
                </span>
              </div>
              <input
                id="slider-brightness"
                type="range"
                min="-1.0"
                max="1.5"
                step="0.02"
                value={params.brightness}
                onChange={(e) => onUpdateParam('brightness', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-100%</span>
                <span>0 EV</span>
                <span>+150%</span>
              </div>
            </div>

            {/* Contrast */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <Contrast size={13} className="text-cyan-400" />
                  Dynamic Contrast
                </span>
                <span className="font-mono text-cyan-400">
                  {params.contrast.toFixed(2)}x
                </span>
              </div>
              <input
                id="slider-contrast"
                type="range"
                min="0.5"
                max="2.5"
                step="0.05"
                value={params.contrast}
                onChange={(e) => onUpdateParam('contrast', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Saturation */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">Color Saturation</span>
                <span className="font-mono text-cyan-400">
                  {Math.round(params.saturation * 100)}%
                </span>
              </div>
              <input
                id="slider-saturation"
                type="range"
                min="0.0"
                max="2.5"
                step="0.05"
                value={params.saturation}
                onChange={(e) => onUpdateParam('saturation', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Vibrance */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">Smart Vibrance</span>
                <span className="font-mono text-cyan-400">
                  {params.vibrance > 0 ? `+${Math.round(params.vibrance * 100)}%` : `${Math.round(params.vibrance * 100)}%`}
                </span>
              </div>
              <input
                id="slider-vibrance"
                type="range"
                min="-1.0"
                max="1.5"
                step="0.05"
                value={params.vibrance}
                onChange={(e) => onUpdateParam('vibrance', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Temperature (Cool / Warm) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">Color Temperature</span>
                <span className="font-mono text-cyan-400">
                  {params.temperature > 0 ? `Warm +${params.temperature.toFixed(2)}` : params.temperature < 0 ? `Cool ${params.temperature.toFixed(2)}` : 'Neutral'}
                </span>
              </div>
              <input
                id="slider-temperature"
                type="range"
                min="-1.0"
                max="1.0"
                step="0.02"
                value={params.temperature}
                onChange={(e) => onUpdateParam('temperature', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* --- 2. SHARPNESS & CLARITY TAB --- */}
        {activeTab === 'sharpness' && (
          <div className="space-y-4">
            {/* Fine Sharpening */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">Fine Edge & Text Sharpen</span>
                <span className="font-mono text-cyan-400">
                  {Math.round(params.sharpenFine * 100)}%
                </span>
              </div>
              <input
                id="slider-sharpen-fine"
                type="range"
                min="0.0"
                max="3.0"
                step="0.05"
                value={params.sharpenFine}
                onChange={(e) => onUpdateParam('sharpenFine', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Wide Structural Sharpening */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">Structural Contour Sharpen</span>
                <span className="font-mono text-cyan-400">
                  {Math.round(params.sharpenWide * 100)}%
                </span>
              </div>
              <input
                id="slider-sharpen-wide"
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={params.sharpenWide}
                onChange={(e) => onUpdateParam('sharpenWide', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Micro-Contrast Clarity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">Micro-Contrast Clarity</span>
                <span className="font-mono text-cyan-400">
                  {Math.round(params.clarity * 100)}%
                </span>
              </div>
              <input
                id="slider-clarity"
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={params.clarity}
                onChange={(e) => onUpdateParam('clarity', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* --- 3. AI SUPER-RESOLUTION TAB --- */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {/* Model Selector */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Super-Resolution Model</label>
              <select
                id="select-sr-model"
                value={params.srModel}
                onChange={(e) => onUpdateParam('srModel', e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="RealESRGAN_x4plus">RealESRGAN x4+ (High Detail GAN)</option>
                <option value="RealESRNet_x4plus">RealESRNet x4+ (Artifact-Free PSNR)</option>
                <option value="RealESRGAN_Anime_6B">RealESRGAN Anime 6B (TCG / Manga)</option>
                <option value="None">None (Fast 60fps WebGL Mode)</option>
              </select>
            </div>

            {/* Scale Factor */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Upscale Scale Multiplier</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 4].map((scale) => (
                  <button
                    key={scale}
                    id={`btn-scale-${scale}x`}
                    onClick={() => onUpdateParam('upscaleFactor', scale as any)}
                    className={`py-2 rounded-xl font-mono text-xs font-bold transition-all ${
                      params.upscaleFactor === scale
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'bg-slate-950/80 text-slate-400 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {scale}x HD
                  </button>
                ))}
              </div>
            </div>

            {/* CodeFormer Fidelity Weight (w) */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">CodeFormer Fidelity ($w$)</span>
                <span className="font-mono text-cyan-400">{params.codeformerWeight.toFixed(2)}</span>
              </div>
              <input
                id="slider-codeformer-weight"
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={params.codeformerWeight}
                onChange={(e) => onUpdateParam('codeformerWeight', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.0 (Max AI Generative)</span>
                <span>1.0 (Exact Raw Grain)</span>
              </div>
            </div>
          </div>
        )}

        {/* --- 4. INPAINTING & DEFECTS TAB --- */}
        {activeTab === 'inpainting' && (
          <div className="space-y-4">
            {/* Descratch Enable Toggle */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <Wand2 size={15} className="text-cyan-400" />
                <span className="font-semibold text-slate-200">Enable Inpainting</span>
              </div>
              <input
                id="toggle-descratch"
                type="checkbox"
                checked={params.descratchEnabled}
                onChange={(e) => onUpdateParam('descratchEnabled', e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400"
              />
            </label>

            {/* Show Mask Toggle */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <ShieldAlert size={15} className="text-rose-400" />
                <span className="font-semibold text-slate-200">Show Scratch Mask</span>
              </div>
              <input
                id="toggle-show-mask"
                type="checkbox"
                checked={params.showScratchMask}
                onChange={(e) => onUpdateParam('showScratchMask', e.target.checked)}
                className="w-4 h-4 rounded accent-rose-500"
              />
            </label>

            {/* Defect Sensitivity Threshold */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">Defect Sensitivity</span>
                <span className="font-mono text-cyan-400">{params.descratchThreshold.toFixed(2)}</span>
              </div>
              <input
                id="slider-descratch-threshold"
                type="range"
                min="0.02"
                max="0.40"
                step="0.01"
                value={params.descratchThreshold}
                onChange={(e) => onUpdateParam('descratchThreshold', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Inpaint Radius */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">Inpaint Transport Radius</span>
                <span className="font-mono text-cyan-400">{params.descratchRadius.toFixed(1)} px</span>
              </div>
              <input
                id="slider-descratch-radius"
                type="range"
                min="1.0"
                max="16.0"
                step="0.5"
                value={params.descratchRadius}
                onChange={(e) => onUpdateParam('descratchRadius', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* --- 5. FOIL / REFRACTOR & SLAB TAB --- */}
        {activeTab === 'holo' && (
          <div className="space-y-4">
            {/* Holographic Refractor Boost */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <Gem size={15} className="text-amber-400" />
                <span className="font-semibold text-slate-200">Prismatic Holofoil Clarity</span>
              </div>
              <input
                id="toggle-holo-clarity"
                type="checkbox"
                checked={params.holoFoilClarity}
                onChange={(e) => onUpdateParam('holoFoilClarity', e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400"
              />
            </label>

            {/* Anti-Glare Suppression */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-cyan-400" />
                <span className="font-semibold text-slate-200">Slab Anti-Glare Suppressor</span>
              </div>
              <input
                id="toggle-anti-glare"
                type="checkbox"
                checked={params.antiGlare}
                onChange={(e) => onUpdateParam('antiGlare', e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400"
              />
            </label>

            {/* Vintage Paper Preservation */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-amber-200" />
                <span className="font-semibold text-slate-200">Vintage Paper Tone Matrix</span>
              </div>
              <input
                id="toggle-vintage-paper"
                type="checkbox"
                checked={params.vintagePaperPreserve}
                onChange={(e) => onUpdateParam('vintagePaperPreserve', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-400"
              />
            </label>
          </div>
        )}
      </div>

      {/* Footer Reset Action */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <button
          id="btn-reset-all-params"
          onClick={onResetParams}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all"
        >
          <RotateCcw size={13} />
          <span>Reset All Sliders</span>
        </button>
      </div>
    </div>
  );
};
