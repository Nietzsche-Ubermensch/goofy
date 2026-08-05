import React, { useState, useRef } from 'react';
import { Sparkles, Loader2, Download, Image as ImageIcon, AlertCircle, Cpu } from 'lucide-react';
import { ImageSize, AIProvider, AIModelConfig } from '../types';
import { generateCardImage } from '../services/aiService';
import html2canvas from 'html2canvas';

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<ImageSize>(ImageSize.Size1K);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AIModelConfig>({
    provider: AIProvider.Gemini,
    modelId: 'gemini-3-pro-image-preview'
  });
  
  const cardRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
      if (cardRef.current) {
          const canvas = await html2canvas(cardRef.current);
          const link = document.createElement('a');
          link.download = `ai-card-${Date.now()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
      }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    // ... (rest of the handleGenerate function)

    if (aiConfig.provider === AIProvider.Gemini) {
        if (typeof window !== 'undefined' && window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                setError('Gemini API Key not selected. Please click UPDATE_API_KEY to configure it.');
                return;
            }
        } else {
            const geminiKey = typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_GEMINI_KEY') : null;
            if (!geminiKey) {
                setError(`Gemini API Key is missing. Please configure it in the global Settings modal.`);
                return;
            }
        }
    } else {
        const keyMap = {
            [AIProvider.OpenRouter]: 'CUSTOM_OPENROUTER_KEY',
            [AIProvider.Venice]: 'CUSTOM_VENICE_KEY',
            [AIProvider.OpenAI]: 'CUSTOM_OPENAI_KEY',
            [AIProvider.xAI]: 'CUSTOM_XAI_KEY'
        };
        const storageKey = keyMap[aiConfig.provider as keyof typeof keyMap];
        const hasCustomKey = storageKey && typeof window !== 'undefined' && localStorage.getItem(storageKey);
        
        if (!hasCustomKey) {
            setError(`${aiConfig.provider} API Key is missing. Please enter it in the global Settings modal.`);
            return;
        }
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const imageData = await generateCardImage(prompt, size, aiConfig);
      setGeneratedImage(imageData);
    } catch (err: any) {
      setError(err.message || 'Failed to generate image. Please check your API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectKey = async () => {
    try {
        if(window.aistudio) {
            await window.aistudio.openSelectKey();
        }
    } catch(e) {
        console.error(e);
        setError("Could not open key selection dialog.");
    }
  }

  return (
    <div className="h-full bg-transparent p-6 md:p-12 overflow-y-auto holo-text">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        
        {/* Left Column: Controls */}
        <div className="flex flex-col justify-center space-y-8">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold text-[#00f3ff] flex items-center gap-3 font-mono holo-text">
                    <Cpu size={32} className="text-[#00f3ff]" />
                    <span>GEN_ENGINE_V3</span>
                </h2>
                <p className="text-[rgba(0,243,255,0.6)] font-mono text-sm">
                    Latent space generation for sports card assets via Gemini Nano Banana Pro.
                </p>
            </div>

            <div className="bg-black/40 border border-[rgba(0,243,255,0.3)] p-6 rounded-sm space-y-6 holo-border">
                <div>
                   <label className="block text-xs font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wider mb-2 font-mono">Model Configuration</label>
                   <div className="grid grid-cols-2 gap-2">
                       <select 
                         value={aiConfig.provider}
                         onChange={(e) => {
                             const provider = e.target.value as AIProvider;
                             let modelId = 'gemini-3.1-flash-image-preview';
                             if (provider === AIProvider.OpenRouter) modelId = 'google/gemini-2.0-flash-001';
                             if (provider === AIProvider.Venice) modelId = 'flux-2-pro';
                             if (provider === AIProvider.OpenAI) modelId = 'dall-e-3';
                             if (provider === AIProvider.xAI) modelId = 'grok-vision-beta';
                             setAiConfig({ provider, modelId });
                         }}
                         className="bg-black/60 border border-[rgba(0,243,255,0.3)] rounded-sm p-2 text-[10px] text-[#00f3ff] font-mono outline-none focus:border-[#00f3ff] holo-border"
                       >
                           <option value={AIProvider.Gemini}>Gemini</option>
                           <option value={AIProvider.OpenRouter}>OpenRouter</option>
                           <option value={AIProvider.Venice}>Venice</option>
                           <option value={AIProvider.OpenAI}>OpenAI</option>
                           <option value={AIProvider.xAI}>xAI</option>
                       </select>
                       <select 
                         value={aiConfig.modelId}
                         onChange={(e) => setAiConfig({ ...aiConfig, modelId: e.target.value })}
                         className="bg-black/60 border border-[rgba(0,243,255,0.3)] rounded-sm p-2 text-[10px] text-[#00f3ff] font-mono outline-none focus:border-[#00f3ff] holo-border"
                       >
                           {aiConfig.provider === AIProvider.Gemini && (
                               <>
                                   <option value="gemini-3.1-flash-image-preview">3.1 Flash</option>
                                   <option value="gemini-2.0-flash">2.0 Flash</option>
                               </>
                           )}
                           {aiConfig.provider === AIProvider.OpenRouter && (
                               <>
                                   <option value="google/gemini-2.0-flash-001">Gemini 2.0</option>
                               </>
                           )}
                           {aiConfig.provider === AIProvider.OpenAI && (
                               <>
                                   <option value="dall-e-3">DALL-E 3</option>
                                   <option value="dall-e-2">DALL-E 2</option>
                               </>
                           )}
                           {aiConfig.provider === AIProvider.xAI && (
                               <>
                                   <option value="grok-vision-beta">Grok Vision</option>
                               </>
                           )}
                           {aiConfig.provider === AIProvider.Venice && (
                               <>
                                   <option value="venice-sd35">Venice SD35</option>
                                   <option value="flux-2-pro">Flux 2 Pro</option>
                                   <option value="flux-2-max">Flux 2 Max</option>
                                   <option value="grok-imagine-image-quality">Grok Imagine HQ</option>
                                   <option value="gpt-image-2">GPT Image 2</option>
                                   <option value="hunyuan-image-v3">Hunyuan Image 3.0</option>
                                   <option value="imagineart-1.5-pro">ImagineArt 1.5 Pro</option>
                                   <option value="nano-banana-pro">Nano Banana Pro</option>
                                   <option value="recraft-v4-pro">Recraft V4 Pro</option>
                                   <option value="seedream-v5-lite">Seedream V5 Lite</option>
                                   <option value="qwen-image-2-pro">Qwen Image 2 Pro</option>
                                   <option value="wan-2-7-pro-text-to-image">Wan 2.7 Pro</option>
                               </>
                           )}
                       </select>
                   </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wider mb-2 font-mono">Prompt Input</label>
                   <textarea
                     className="w-full h-32 bg-black/60 border border-[rgba(0,243,255,0.3)] rounded-sm p-3 focus:border-[#00f3ff] focus:shadow-[0_0_15px_rgba(0,243,255,0.3)] outline-none resize-none text-[#00f3ff] font-mono text-sm holo-border transition-all"
                     placeholder="> Describe asset parameters..."
                     value={prompt}
                     onChange={(e) => setPrompt(e.target.value)}
                   ></textarea>
                </div>

                <div>
                   <label className="block text-xs font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wider mb-2 font-mono">Resolution Output</label>
                   <div className="grid grid-cols-3 gap-2">
                      {Object.values(ImageSize).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSize(s)}
                          className={`py-2 px-3 rounded-sm text-xs font-bold font-mono border transition-all ${
                            size === s 
                             ? 'bg-[rgba(0,243,255,0.2)] border-[#00f3ff] text-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.5)] holo-text' 
                             : 'bg-black/40 border-[rgba(0,243,255,0.2)] text-[rgba(0,243,255,0.5)] hover:text-[#00f3ff] hover:border-[rgba(0,243,255,0.5)]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                   </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt.trim()}
                    className={`w-full py-3 rounded-sm font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all font-mono holo-button ${
                        isLoading || !prompt.trim()
                        ? ''
                        : ''
                    }`}
                >
                    {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    {isLoading ? 'PROCESSING...' : 'INITIALIZE GENERATION'}
                </button>
                
                <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-2 text-[10px] text-[rgba(0,243,255,0.7)] font-mono">
                        <div className="w-2 h-2 bg-[#00f3ff] rounded-full animate-pulse shadow-[0_0_5px_rgba(0,243,255,0.8)]"></div>
                        SYSTEM READY
                    </div>
                    <button onClick={selectKey} className="text-[10px] text-[rgba(255,0,229,0.9)] hover:text-[#ff00e5] hover:underline font-mono holo-text">
                        SYS_CONFIG
                    </button>
                </div>
            </div>
            
            {error && (
                <div className="bg-[rgba(255,0,229,0.1)] border border-[#ff00e5] text-[#ff00e5] px-4 py-3 rounded-sm flex items-center gap-3 font-mono text-xs holo-border-magenta shadow-[0_0_15px_rgba(255,0,229,0.3)]">
                    <AlertCircle size={16} />
                    <p>{error}</p>
                </div>
            )}
        </div>

        {/* Right Column: Preview */}
        <div className="bg-black/40 border border-[rgba(0,243,255,0.2)] rounded-sm p-8 flex flex-col items-center justify-center min-h-[400px] holo-panel relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,243,255,0.05)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[bg-pan_10s_linear_infinite]"></div>
            <div className="relative z-10 w-full flex flex-col items-center">
            {generatedImage ? (
              <div className="w-full max-w-sm animate-in fade-in duration-700">
                 <div className="aspect-[3/4] relative rounded-sm overflow-hidden border border-[#00f3ff] shadow-[0_0_30px_rgba(0,243,255,0.4)] bg-black" ref={cardRef}>
                    <img 
                        src={generatedImage} 
                        alt="Generated Card" 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[#00f3ff] shadow-[0_0_10px_#00f3ff] animate-[scanline_3s_linear_infinite]"></div>
                 </div>
                 <div className="mt-6 flex justify-center">
                    <button 
                       onClick={handleExport}
                       className="inline-flex items-center gap-2 px-6 py-2 holo-button rounded-sm text-xs font-bold uppercase tracking-wider font-mono"
                    >
                       <Download size={14} />
                       Export Card
                    </button>
                 </div>
              </div>
            ) : (
                <div className="flex flex-col items-center justify-center text-[rgba(0,243,255,0.3)]">
                    <div className="w-24 h-24 border-2 border-dashed border-[rgba(0,243,255,0.3)] rounded-full flex items-center justify-center mb-6">
                        {isLoading ? <Loader2 size={32} className="animate-spin text-[#00f3ff]" /> : <ImageIcon size={32} />}
                    </div>
                    <p className="font-mono text-sm tracking-widest text-[#00f3ff] holo-text">{isLoading ? 'RENDERING...' : 'AWAITING INPUT'}</p>
                </div>
            )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;