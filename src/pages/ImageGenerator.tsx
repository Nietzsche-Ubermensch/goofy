import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Loader2, 
  Download, 
  Image as ImageIcon, 
  AlertCircle, 
  Cpu, 
  Wand2, 
  Upload, 
  RefreshCw, 
  Layers, 
  Sliders, 
  Eye, 
  Check, 
  ArrowRightLeft,
  FileImage,
  CheckCircle2,
  ExternalLink,
  Zap,
  Maximize2,
  ShieldCheck,
  Crop,
  SunMedium
} from 'lucide-react';
import { ImageSize, AIProvider, AIModelConfig } from '../types';
import { generateCardImage, editCardImage } from '../services/aiService';
import { getPresetCards } from '../data/presetCards';
import html2canvas from 'html2canvas';

type GeneratorMode = 'edit' | 'create';

export const CARD_STYLE_PRESETS = [
  {
    id: 'cyberpunk',
    title: 'Cyberpunk Holofoil',
    prompt: 'Cyberpunk Holofoil Rookie Card with glowing neon stadium lighting and futuristic grid frame',
    tag: 'Chromium · Neon Matrix',
    icon: '⚡'
  },
  {
    id: 'vintage_sepia',
    title: '1952 Classic Sepia',
    prompt: '1952 Classic Vintage Sepia Baseball Legend in hand-painted oil texture with aged card stock',
    tag: 'Paper Fiber · Hand-Tinted',
    icon: '📜'
  },
  {
    id: 'mythic_dragon',
    title: 'Mythic Obsidian Dragon',
    prompt: 'Mythic Dragon trading card with cracked obsidian border and molten gold foil stamp',
    tag: 'Molten Gold · Obsidian',
    icon: '🐉'
  },
  {
    id: 'gold_prizm',
    title: 'Modern Gold Prizm',
    prompt: 'Modern Gold Prizm Basketball Superstar in mid-air dunk with refractor prism reflections',
    tag: 'Refractor · Specular Plate',
    icon: '🏀'
  },
  {
    id: 'galactic_space',
    title: 'Galactic Nebula Explorer',
    prompt: 'Galactic Space Explorer card with iridescent cosmic nebula and chrome typography',
    tag: 'Cosmic Dust · Chrome',
    icon: '🌌'
  },
  {
    id: 'japanese_manga',
    title: 'Japanese Manga Holo Foil',
    prompt: 'Japanese Manga Holo Foil Edition with dynamic speed lines and cherry blossom accents',
    tag: 'Speed Lines · Holo Foil',
    icon: '🌸'
  }
];

const ASPECT_RATIOS = [
  { id: '3:4', label: '3:4 (Trading Card)', desc: 'Standard card format' },
  { id: '1:1', label: '1:1 (Square)', desc: 'Avatar / Icon' },
  { id: '4:3', label: '4:3 (Horizontal)', desc: 'Landscape card' },
  { id: '9:16', label: '9:16 (Story/Poster)', desc: 'Tall portrait' },
  { id: '16:9', label: '16:9 (Wide Banner)', desc: 'Widescreen artwork' },
];

const ImageGenerator: React.FC = () => {
  const [mode, setMode] = useState<GeneratorMode>('edit');
  const [prompt, setPrompt] = useState(CARD_STYLE_PRESETS[0].prompt);
  const [activePresetId, setActivePresetId] = useState<string>(CARD_STYLE_PRESETS[0].id);
  const [size, setSize] = useState<ImageSize>(ImageSize.Size1K);
  const [aspectRatio, setAspectRatio] = useState('3:4');
  
  // Pipeline enhancement toggles
  const [enableEdgeRectification, setEnableEdgeRectification] = useState(true);
  const [enableDenoising, setEnableDenoising] = useState(true);
  const [enableRefractorPolish, setEnableRefractorPolish] = useState(true);
  const [enableSharpening, setEnableSharpening] = useState(true);

  // Model Config
  const [aiConfig, setAiConfig] = useState<AIModelConfig>({
    provider: AIProvider.Gemini,
    modelId: 'gemini-3.1-flash-image-preview'
  });

  // Source image for Edit Mode
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string>('');
  
  // Results
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [modelResponseText, setModelResponseText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Before/After comparison slider in Edit Mode
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [comparisonMode, setComparisonMode] = useState<'slider' | 'side-by-side' | 'result-only'>('slider');

  const cardRef = useRef<HTMLDivElement>(null);

  // Load a preset card as default edit source on initial mount
  useEffect(() => {
    const presets = getPresetCards();
    if (presets.length > 0 && !sourceImage) {
      setSourceImage(presets[0].originalUrl);
      setSourceFileName(presets[0].name);
    }
  }, []);

  const handleExport = async () => {
    if (cardRef.current) {
      const canvas = await html2canvas(cardRef.current);
      const link = document.createElement('a');
      link.download = `card-rectified-${activePresetId}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else if (generatedImage) {
      const link = document.createElement('a');
      link.download = `card-rectified-${activePresetId}-${Date.now()}.png`;
      link.href = generatedImage;
      link.click();
    }
  };

  const handleSourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSourceImage(reader.result as string);
        setSourceFileName(file.name);
        setGeneratedImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePresetSelect = (card: { name: string; originalUrl: string }) => {
    setSourceImage(card.originalUrl);
    setSourceFileName(card.name);
    setGeneratedImage(null);
    setError(null);
  };

  const handleStylePresetClick = (preset: typeof CARD_STYLE_PRESETS[0]) => {
    setActivePresetId(preset.id);
    setPrompt(preset.prompt);
  };

  const handleExecute = async () => {
    if (!prompt.trim()) {
      setError('Please provide a descriptive style enhancement prompt.');
      return;
    }

    if (mode === 'edit' && !sourceImage) {
      setError('Please select or upload a source card to edit.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessNotice(null);
    setModelResponseText('');

    try {
      if (mode === 'edit') {
        // Image editing with Gemini 3.1 Flash Image Preview adhering to 4-pillar task directives
        const result = await editCardImage({
          prompt: prompt.trim(),
          imageBase64: sourceImage!,
          size,
          aspectRatio,
          config: aiConfig
        });

        setGeneratedImage(result.imageUrl);
        if (result.text) setModelResponseText(result.text);
        setSuccessNotice(`Card successfully transformed into [${activePresetId.toUpperCase()}] with surface enhancement & 50/50 centered alignment!`);
      } else {
        // Create new image
        const imageData = await generateCardImage({
          prompt: prompt.trim(),
          size,
          aspectRatio,
          config: aiConfig
        });
        setGeneratedImage(imageData);
        setSuccessNotice('New high-fidelity card artwork generated successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process AI image request.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectKey = async () => {
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
      }
    } catch (e) {
      console.error(e);
      setError("Could not open key selection dialog.");
    }
  };

  const presetCards = getPresetCards();

  return (
    <div className="h-full bg-[#070b14] p-4 md:p-8 overflow-y-auto holo-text">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Mode Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(0,243,255,0.2)] pb-4">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-bold text-[#00f3ff] flex items-center gap-3 font-mono">
              <Cpu size={28} className="text-[#00f3ff]" />
              <span>AI CARD ENHANCEMENT & STYLIZATION STUDIO</span>
            </h2>
            <p className="text-[rgba(0,243,255,0.7)] font-mono text-xs md:text-sm">
              Execute high-fidelity surface enhancement, denoising, edge rectification, and chromatic refractor optimization via <span className="text-[#00f3ff] font-semibold">Gemini 3.1 Flash Image Preview</span>.
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-sm border border-[rgba(0,243,255,0.3)]">
            <button
              onClick={() => { setMode('edit'); setError(null); }}
              className={`px-3 py-1.5 rounded-sm text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                mode === 'edit'
                  ? 'bg-[rgba(0,243,255,0.2)] text-[#00f3ff] border border-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.4)]'
                  : 'text-[rgba(0,243,255,0.6)] hover:text-[#00f3ff]'
              }`}
            >
              <Wand2 size={14} />
              <span>TRANSFORM & ENHANCE CARD</span>
            </button>

            <button
              onClick={() => { setMode('create'); setError(null); }}
              className={`px-3 py-1.5 rounded-sm text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                mode === 'create'
                  ? 'bg-[rgba(0,243,255,0.2)] text-[#00f3ff] border border-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.4)]'
                  : 'text-[rgba(0,243,255,0.6)] hover:text-[#00f3ff]'
              }`}
            >
              <Sparkles size={14} />
              <span>CREATE NEW ARTWORK</span>
            </button>
          </div>
        </div>

        {/* Alerts & Feedback */}
        {error && (
          <div className="bg-[rgba(255,0,229,0.1)] border border-[#ff00e5] text-[#ff00e5] px-4 py-3 rounded-sm flex items-center gap-3 font-mono text-xs shadow-[0_0_15px_rgba(255,0,229,0.3)]">
            <AlertCircle size={16} className="shrink-0" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {successNotice && (
          <div className="bg-[rgba(0,243,255,0.1)] border border-[#00f3ff] text-[#00f3ff] px-4 py-3 rounded-sm flex items-center gap-3 font-mono text-xs shadow-[0_0_15px_rgba(0,243,255,0.3)]">
            <CheckCircle2 size={16} className="shrink-0 text-[#00f3ff]" />
            <p className="flex-1">{successNotice}</p>
          </div>
        )}

        {/* 6 STYLISTIC PRESET CARDS SELECTOR */}
        <div className="bg-black/50 border border-[rgba(0,243,255,0.3)] p-4 rounded-sm space-y-3 holo-border">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-[#00f3ff] font-mono flex items-center gap-2">
              <Zap size={15} />
              <span>APPROVED CARD STYLIZATION & ENHANCEMENT PRESETS</span>
            </h3>
            <span className="text-[10px] font-mono text-[rgba(0,243,255,0.6)]">
              PRESERVES LAYOUT & TYPOGRAPHY · 50/50 CENTERED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {CARD_STYLE_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleStylePresetClick(preset)}
                  className={`p-3 rounded-sm border text-left transition-all flex flex-col justify-between gap-2 relative overflow-hidden group ${
                    isSelected
                      ? 'border-[#00f3ff] bg-[rgba(0,243,255,0.15)] shadow-[0_0_15px_rgba(0,243,255,0.35)]'
                      : 'border-[rgba(0,243,255,0.2)] bg-black/40 hover:border-[rgba(0,243,255,0.6)] hover:bg-black/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{preset.icon}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-xs bg-black/60 text-[rgba(0,243,255,0.8)] border border-[rgba(0,243,255,0.3)]">
                      {preset.tag}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-mono text-xs font-bold text-slate-100 group-hover:text-[#00f3ff] transition-colors line-clamp-1">
                      {preset.title}
                    </h4>
                    <p className="font-mono text-[10px] text-[rgba(0,243,255,0.6)] line-clamp-2 mt-1 leading-snug">
                      {preset.prompt}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00f3ff] shadow-[0_0_6px_#00f3ff]"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* MAIN WORKFLOW GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Controls & Prompting (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* EDIT MODE: Source Selection */}
            {mode === 'edit' && (
              <div className="bg-black/50 border border-[rgba(0,243,255,0.3)] p-4 md:p-5 rounded-sm space-y-4 holo-border">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[rgba(0,243,255,0.8)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <FileImage size={14} />
                    <span>[INPUT_IMAGE: card_crop_rectified]</span>
                  </label>
                  <label className="text-[10px] text-[#00f3ff] hover:underline cursor-pointer font-mono">
                    UPLOAD CUSTOM SCAN
                    <input type="file" onChange={handleSourceUpload} accept="image/*" className="hidden" />
                  </label>
                </div>

                {/* Preset Selector Chips */}
                <div className="space-y-2">
                  <p className="text-[10px] text-[rgba(0,243,255,0.6)] font-mono">Or select an existing card scan to transform:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {presetCards.slice(0, 3).map((card) => (
                      <button
                        key={card.id}
                        onClick={() => handlePresetSelect(card)}
                        className={`p-1.5 rounded-sm border text-left transition-all flex flex-col items-center gap-1 ${
                          sourceFileName === card.name 
                            ? 'border-[#00f3ff] bg-[rgba(0,243,255,0.15)] shadow-[0_0_10px_rgba(0,243,255,0.3)]' 
                            : 'border-[rgba(0,243,255,0.2)] bg-black/40 hover:border-[rgba(0,243,255,0.5)]'
                        }`}
                      >
                        <img src={card.originalUrl} alt={card.name} className="w-12 h-16 object-cover rounded-xs border border-black/50" />
                        <span className="text-[9px] font-mono text-slate-300 truncate w-full text-center">{card.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* High-Fidelity Pipeline Directives Badge */}
            <div className="bg-black/60 border border-[rgba(0,243,255,0.3)] p-4 rounded-sm space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-[rgba(0,243,255,0.2)] pb-2">
                <span className="text-xs font-bold text-[#00f3ff] flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  SURFACE ENHANCEMENT DIRECTIVES
                </span>
                <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-xs border border-emerald-500/30">
                  ACTIVE
                </span>
              </div>

              <div className="space-y-2 text-[10px]">
                <div className="flex items-start gap-2 text-slate-300">
                  <Crop size={12} className="text-[#00f3ff] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#00f3ff] font-bold">1. Edge Rectification & Alignment:</span> Razor-sharp 90° outer boundaries; eliminate sensor noise and distortion.
                  </div>
                </div>

                <div className="flex items-start gap-2 text-slate-300">
                  <Sliders size={12} className="text-[#00f3ff] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#00f3ff] font-bold">2. Surface Denoising & TV Filter:</span> Flat pixel background smoothing; isolated line-art & text boundaries.
                  </div>
                </div>

                <div className="flex items-start gap-2 text-slate-300">
                  <SunMedium size={12} className="text-[#00f3ff] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#00f3ff] font-bold">3. Chromatic Refractor Polish:</span> Specular reflection vector tuning (Cyberpunk/Prizm) & paper fiber matrix (Sepia).
                  </div>
                </div>

                <div className="flex items-start gap-2 text-slate-300">
                  <Zap size={12} className="text-[#00f3ff] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#00f3ff] font-bold">4. Sharpening & Contrast Maximization:</span> +25% edge contrast on micro-stamps, serial numbers, and crystal-clear text.
                  </div>
                </div>
              </div>
            </div>

            {/* Model & Configuration Panel */}
            <div className="bg-black/50 border border-[rgba(0,243,255,0.3)] p-4 md:p-5 rounded-sm space-y-4 holo-border">
              
              {/* Model Selector */}
              <div>
                <label className="block text-xs font-bold text-[rgba(0,243,255,0.8)] uppercase tracking-wider mb-2 font-mono">
                  AI Multimodal Vision / Image Model
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <select 
                    value={aiConfig.provider}
                    onChange={(e) => {
                      const provider = e.target.value as AIProvider;
                      let modelId = 'gemini-3.1-flash-image-preview';
                      if (provider === AIProvider.OpenRouter) modelId = 'black-forest-labs/flux.2-pro';
                      if (provider === AIProvider.Venice) modelId = 'flux-2-pro';
                      if (provider === AIProvider.OpenAI) modelId = 'gpt-image-2';
                      if (provider === AIProvider.xAI) modelId = 'grok-imagine-image-2.0';
                      setAiConfig({ provider, modelId });
                    }}
                    className="bg-black/80 border border-[rgba(0,243,255,0.3)] rounded-sm p-2 text-xs text-[#00f3ff] font-mono outline-none focus:border-[#00f3ff]"
                  >
                    <option value={AIProvider.Gemini}>Google Gemini (SOTA)</option>
                    <option value={AIProvider.OpenRouter}>OpenRouter (FLUX.2)</option>
                    <option value={AIProvider.Venice}>Venice AI</option>
                    <option value={AIProvider.OpenAI}>OpenAI</option>
                    <option value={AIProvider.xAI}>xAI</option>
                  </select>

                  <select 
                    value={aiConfig.modelId}
                    onChange={(e) => setAiConfig({ ...aiConfig, modelId: e.target.value })}
                    className="bg-black/80 border border-[rgba(0,243,255,0.3)] rounded-sm p-2 text-xs text-[#00f3ff] font-mono outline-none focus:border-[#00f3ff]"
                  >
                    {aiConfig.provider === AIProvider.Gemini && (
                      <>
                        <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image Preview (Nano Banana 2 · 1K/2K)</option>
                        <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image (Standard)</option>
                        <option value="gemini-3-pro-image">Gemini 3 Pro Image (Ultra 4K)</option>
                        <option value="gemini-3.1-flash-lite-image">Gemini 3.1 Flash-Lite Image (Fast)</option>
                        <option value="imagen-3.0-generate-002">Imagen 3.0 Production</option>
                      </>
                    )}
                    {aiConfig.provider === AIProvider.OpenRouter && (
                      <>
                        <option value="black-forest-labs/flux.2-pro">BFL: FLUX.2 Pro (SOTA)</option>
                        <option value="google/nano-banana-2">Google: Nano Banana 2</option>
                        <option value="openai/gpt-image-2">OpenAI: GPT Image 2</option>
                      </>
                    )}
                    {aiConfig.provider === AIProvider.OpenAI && (
                      <option value="gpt-image-2">GPT Image 2</option>
                    )}
                    {aiConfig.provider === AIProvider.xAI && (
                      <option value="grok-imagine-image-2.0">Grok Imagine 2.0</option>
                    )}
                    {aiConfig.provider === AIProvider.Venice && (
                      <option value="flux-2-pro">Flux 2 Pro</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Prompt Text Input */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-[rgba(0,243,255,0.8)] uppercase tracking-wider font-mono">
                    {mode === 'edit' ? 'Active Stylization & Transformation Directive' : 'Artwork Creation Prompt'}
                  </label>
                </div>
                <textarea
                  className="w-full h-24 bg-black/70 border border-[rgba(0,243,255,0.3)] rounded-sm p-3 focus:border-[#00f3ff] focus:shadow-[0_0_15px_rgba(0,243,255,0.3)] outline-none resize-none text-[#00f3ff] font-mono text-xs placeholder:text-[rgba(0,243,255,0.3)] transition-all"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              {/* Aspect Ratio & Resolution Controls */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wider mb-1 font-mono">
                    Aspect Ratio
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full bg-black/80 border border-[rgba(0,243,255,0.3)] rounded-sm p-1.5 text-xs text-[#00f3ff] font-mono outline-none focus:border-[#00f3ff]"
                  >
                    {ASPECT_RATIOS.map((ar) => (
                      <option key={ar.id} value={ar.id}>{ar.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wider mb-1 font-mono">
                    Resolution
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {Object.values(ImageSize).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`py-1.5 rounded-sm text-[10px] font-bold font-mono border transition-all ${
                          size === s
                            ? 'bg-[rgba(0,243,255,0.25)] border-[#00f3ff] text-[#00f3ff] shadow-[0_0_8px_rgba(0,243,255,0.4)]'
                            : 'bg-black/60 border-[rgba(0,243,255,0.2)] text-[rgba(0,243,255,0.5)] hover:text-[#00f3ff]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleExecute}
                disabled={isLoading || !prompt.trim() || (mode === 'edit' && !sourceImage)}
                className="w-full py-3.5 bg-[linear-gradient(90deg,rgba(0,243,255,0.25),rgba(255,0,229,0.25))] hover:bg-[linear-gradient(90deg,rgba(0,243,255,0.4),rgba(255,0,229,0.4))] border border-[#00f3ff] text-[#00f3ff] font-bold uppercase tracking-wider text-xs md:text-sm flex items-center justify-center gap-2 transition-all font-mono shadow-[0_0_15px_rgba(0,243,255,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 className="animate-spin" size={16} /> : mode === 'edit' ? <Wand2 size={16} /> : <Sparkles size={16} />}
                <span>{isLoading ? 'PROCESSING HIGH-FIDELITY SURFACE ENHANCEMENT...' : mode === 'edit' ? 'EXECUTE RECTIFIED CARD TRANSFORMATION' : 'GENERATE CARD ARTWORK'}</span>
              </button>

              <div className="flex justify-between items-center text-[10px] text-[rgba(0,243,255,0.6)] font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  GEMINI MULTIMODAL VISION RECTIFICATION ACTIVE
                </span>
                <button onClick={selectKey} className="text-[#ff00e5] hover:underline">
                  SYS_KEYS
                </button>
              </div>

            </div>
          </div>

          {/* Right Column: Interactive Visual Canvas (7 cols) */}
          <div className="lg:col-span-7 bg-black/60 border border-[rgba(0,243,255,0.3)] rounded-sm p-4 md:p-6 flex flex-col justify-between holo-panel relative overflow-hidden min-h-[500px]">
            
            {/* Canvas Header & View Modes */}
            <div className="flex justify-between items-center border-b border-[rgba(0,243,255,0.2)] pb-3 z-10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#00f3ff]">
                  {mode === 'edit' ? '50/50 RECTIFIED CARD PREVIEW' : 'GENERATED ARTWORK'}
                </span>
                {generatedImage && (
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-xs border border-emerald-500/30">
                    50/50 CENTERED · RECTIFIED
                  </span>
                )}
              </div>

              {mode === 'edit' && generatedImage && (
                <div className="flex items-center gap-1 bg-black/80 p-1 rounded-sm border border-[rgba(0,243,255,0.2)]">
                  <button
                    onClick={() => setComparisonMode('slider')}
                    className={`px-2 py-1 text-[10px] font-mono rounded-xs transition-all ${
                      comparisonMode === 'slider' ? 'bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Slider
                  </button>
                  <button
                    onClick={() => setComparisonMode('side-by-side')}
                    className={`px-2 py-1 text-[10px] font-mono rounded-xs transition-all ${
                      comparisonMode === 'side-by-side' ? 'bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Side-by-Side
                  </button>
                  <button
                    onClick={() => setComparisonMode('result-only')}
                    className={`px-2 py-1 text-[10px] font-mono rounded-xs transition-all ${
                      comparisonMode === 'result-only' ? 'bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Result
                  </button>
                </div>
              )}
            </div>

            {/* Main Visual Center */}
            <div className="my-auto py-6 flex items-center justify-center relative z-10 w-full">
              
              {/* 1. EDIT MODE WITH GENERATED RESULT */}
              {mode === 'edit' && generatedImage && sourceImage && (
                <div className="w-full flex flex-col items-center">
                  
                  {/* Mode: Split Comparison Slider */}
                  {comparisonMode === 'slider' && (
                    <div className="relative w-full max-w-sm aspect-[3/4] rounded-sm overflow-hidden border-2 border-[#00f3ff] shadow-[0_0_35px_rgba(0,243,255,0.35)] bg-black select-none">
                      {/* Background (Enhanced Result) */}
                      <img 
                        src={generatedImage} 
                        alt="Enhanced Card" 
                        className="absolute inset-0 w-full h-full object-cover" 
                      />

                      {/* Foreground (Original Source with Clip Path) */}
                      <div 
                        className="absolute inset-0 overflow-hidden"
                        style={{ width: `${sliderPosition}%` }}
                      >
                        <img 
                          src={sourceImage} 
                          alt="Original Card" 
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ width: '100%', maxWidth: 'none' }}
                        />
                      </div>

                      {/* Drag Divider */}
                      <div 
                        className="absolute top-0 bottom-0 w-1 bg-[#00f3ff] shadow-[0_0_10px_#00f3ff] cursor-ew-resize flex items-center justify-center"
                        style={{ left: `calc(${sliderPosition}% - 2px)` }}
                      >
                        <div className="w-6 h-6 rounded-full bg-black border border-[#00f3ff] shadow-[0_0_8px_#00f3ff] flex items-center justify-center text-[#00f3ff]">
                          <ArrowRightLeft size={10} />
                        </div>
                      </div>

                      {/* Slider overlay control */}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sliderPosition}
                        onChange={(e) => setSliderPosition(Number(e.target.value))}
                        className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-20"
                      />

                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-xs bg-black/70 text-[9px] font-mono text-slate-300 border border-black/50 z-10">
                        Input Scan ({sliderPosition}%)
                      </div>
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-xs bg-black/70 text-[9px] font-mono text-[#00f3ff] border border-[#00f3ff]/40 z-10">
                        50/50 Rectified
                      </div>
                    </div>
                  )}

                  {/* Mode: Side-by-Side */}
                  {comparisonMode === 'side-by-side' && (
                    <div className="grid grid-cols-2 gap-4 w-full max-w-xl">
                      <div className="space-y-1.5 text-center">
                        <p className="text-[10px] font-mono text-slate-400">[INPUT: card_crop_rectified]</p>
                        <div className="aspect-[3/4] rounded-sm overflow-hidden border border-[rgba(0,243,255,0.3)] bg-black">
                          <img src={sourceImage} alt="Original" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="space-y-1.5 text-center">
                        <p className="text-[10px] font-mono text-[#00f3ff] font-bold">50/50 RECTIFIED ASSET</p>
                        <div className="aspect-[3/4] rounded-sm overflow-hidden border border-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.4)] bg-black" ref={cardRef}>
                          <img src={generatedImage} alt="Transformed" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode: Result Only */}
                  {comparisonMode === 'result-only' && (
                    <div className="w-full max-w-sm aspect-[3/4] rounded-sm overflow-hidden border-2 border-[#00f3ff] shadow-[0_0_35px_rgba(0,243,255,0.4)] bg-black relative" ref={cardRef}>
                      <img src={generatedImage} alt="Transformed Card" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {modelResponseText && (
                    <div className="mt-4 p-3 bg-black/80 border border-[rgba(0,243,255,0.2)] rounded-sm max-w-lg w-full text-left">
                      <p className="text-[10px] font-mono text-[rgba(0,243,255,0.8)] leading-relaxed">
                        <span className="text-[#00f3ff] font-bold">AI Rectification Telemetry: </span>{modelResponseText}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 2. CREATE MODE WITH GENERATED RESULT */}
              {mode === 'create' && generatedImage && (
                <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in duration-500">
                  <div className="aspect-[3/4] relative w-full rounded-sm overflow-hidden border-2 border-[#00f3ff] shadow-[0_0_35px_rgba(0,243,255,0.4)] bg-black" ref={cardRef}>
                    <img src={generatedImage} alt="Generated Card" className="w-full h-full object-cover" />
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[#00f3ff] shadow-[0_0_10px_#00f3ff] animate-[scanline_3s_linear_infinite]"></div>
                  </div>
                </div>
              )}

              {/* 3. AWAITING GENERATION STATE */}
              {!generatedImage && (
                <div className="flex flex-col items-center justify-center text-[rgba(0,243,255,0.4)] space-y-4 text-center">
                  {mode === 'edit' && sourceImage ? (
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-48 aspect-[3/4] rounded-sm overflow-hidden border border-[rgba(0,243,255,0.3)] bg-black relative opacity-80">
                        <img src={sourceImage} alt="Current Source" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          {isLoading ? (
                            <Loader2 size={36} className="animate-spin text-[#00f3ff]" />
                          ) : (
                            <Wand2 size={32} className="text-[#00f3ff]" />
                          )}
                        </div>
                      </div>
                      <p className="font-mono text-xs text-[#00f3ff] tracking-widest">
                        {isLoading ? 'EXECUTING HIGH-FIDELITY SURFACE ENHANCEMENT...' : 'SOURCE RECTIFIED · READY FOR STYLIZATION'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 border-2 border-dashed border-[rgba(0,243,255,0.3)] rounded-full flex items-center justify-center mb-4">
                        {isLoading ? <Loader2 size={32} className="animate-spin text-[#00f3ff]" /> : <ImageIcon size={32} />}
                      </div>
                      <p className="font-mono text-sm tracking-widest text-[#00f3ff]">
                        {isLoading ? 'RENDERING LATENT CARD TENSORS...' : 'AWAITING STYLIZATION DIRECTIVES'}
                      </p>
                      <p className="font-mono text-xs text-[rgba(0,243,255,0.5)] mt-1">
                        Select an approved preset above and execute transformation
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Canvas Footer Export Toolbar */}
            <div className="border-t border-[rgba(0,243,255,0.2)] pt-3 flex justify-between items-center z-10">
              <span className="text-[10px] font-mono text-[rgba(0,243,255,0.5)]">
                ASSET: 50/50 CENTERED · {aspectRatio} · {size}
              </span>

              {generatedImage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-[rgba(0,243,255,0.2)] hover:bg-[rgba(0,243,255,0.3)] border border-[#00f3ff] text-[#00f3ff] rounded-sm font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,243,255,0.3)]"
                  >
                    <Download size={14} />
                    <span>EXPORT RECTIFIED CARD</span>
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default ImageGenerator;
