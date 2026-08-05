import React from 'react';
import { EnhancementSettings } from '../types';
import { ShieldCheck, Eye, Sparkles, RefreshCw, Sliders, Zap, Sun, Contrast, Droplets } from 'lucide-react';

interface ToolbarControlsProps {
  settings: EnhancementSettings;
  onChange: (newSettings: EnhancementSettings) => void;
  onReset: () => void;
  cardEditorRef: React.RefObject<{ exportCard: () => void }>;
}

export const ToolbarControls: React.FC<ToolbarControlsProps> = ({
  settings,
  onChange,
  onReset,
  cardEditorRef
}) => {
  const updateSetting = <K extends keyof EnhancementSettings>(key: K, val: EnhancementSettings[K]) => {
    onChange({ ...settings, [key]: val });
  };

  const exportCard = async () => {
    if (cardEditorRef.current) {
        console.log("Exporting card via WebGL context...");
        await cardEditorRef.current.exportCard();
    }
  };

  return (
    <div className="w-full space-y-4 font-sans text-slate-200">
      {/* 1. Surface Descratching Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-slate-100 text-xs tracking-wide">Surface Cleaning & Descratch</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateSetting('showScratchMask', !settings.showScratchMask)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                settings.showScratchMask
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Mask View</span>
            </button>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.descratchEnabled}
                onChange={(e) => updateSetting('descratchEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
            </label>
          </div>
        </div>

        {settings.descratchEnabled && (
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Sensitivity</span>
                <span className="text-indigo-400 font-semibold">{settings.descratchThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.4"
                step="0.01"
                value={settings.descratchThreshold}
                onChange={(e) => updateSetting('descratchThreshold', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Inpaint Radius</span>
                <span className="text-indigo-400 font-semibold">{settings.descratchRadius.toFixed(1)}px</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.5"
                value={settings.descratchRadius}
                onChange={(e) => updateSetting('descratchRadius', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. WebGL Detail & Color Enhancer */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-slate-100 text-xs tracking-wide">Image Enhancements</h3>
          </div>
          <button
            onClick={onReset}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors bg-slate-800 px-2 py-1 rounded-md border border-slate-700"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
          {/* Sharpening */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Sharpen</span>
              <span className="text-indigo-400 font-semibold">{(settings.sharpen * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.05"
              value={settings.sharpen}
              onChange={(e) => updateSetting('sharpen', parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          {/* Contrast */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Contrast</span>
              <span className="text-indigo-400 font-semibold">{(settings.contrast * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={settings.contrast}
              onChange={(e) => updateSetting('contrast', parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          {/* Saturation */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Saturation</span>
              <span className="text-indigo-400 font-semibold">{(settings.saturation * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.05"
              value={settings.saturation}
              onChange={(e) => updateSetting('saturation', parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          {/* Vibrance */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Vibrance</span>
              <span className="text-indigo-400 font-semibold">{(settings.vibrance * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={settings.vibrance}
              onChange={(e) => updateSetting('vibrance', parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          {/* Brightness */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Brightness</span>
              <span className="text-indigo-400 font-semibold">{(settings.brightness * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="-0.5"
              max="0.5"
              step="0.02"
              value={settings.brightness}
              onChange={(e) => updateSetting('brightness', parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          {/* Aspect Ratio Picker */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Target Aspect Ratio</span>
              <span className="text-indigo-400 font-semibold">{settings.aspectRatio ? '2.5:3.5 (Standard)' : 'Freeform'}</span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => updateSetting('aspectRatio', 2.5 / 3.5)}
                className={`flex-1 py-1 text-xs rounded-lg font-medium border transition-all ${
                  settings.aspectRatio
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                2.5×3.5
              </button>
              <button
                onClick={() => updateSetting('aspectRatio', null)}
                className={`flex-1 py-1 text-xs rounded-lg font-medium border transition-all ${
                  !settings.aspectRatio
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                Custom
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Export Action Button */}
      <button
        onClick={exportCard}
        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm tracking-wide shadow-lg shadow-indigo-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        <span>Export High-Res Enhanced PNG</span>
      </button>
    </div>
  );
};
