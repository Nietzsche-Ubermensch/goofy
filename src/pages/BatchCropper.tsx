import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, X, Loader2, Download, Settings2, Play, Trash2, Search, Sliders, Crop, Wand2, Key, Info, CheckCircle2 } from 'lucide-react';
import { CardImage, ProcessingStatus, ProcessingSettings, AIProvider, EnhancementSettings, CropQuad } from '../types';
import { analyzeCardDamage, restoreCard } from '../services/aiService';
import { WebGLCardRenderer } from '../webgl/webglRenderer';
import JSZip from 'jszip';

const BatchCropper: React.FC = () => {
  const [cards, setCards] = useState<CardImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [settings, setSettings] = useState<ProcessingSettings>({
    aspectRatio: 2.5 / 3.5,
    jpegQuality: 95,
    enableUpscaling: true,
    enableDescratching: true,
    restorationStrength: 0.5,
    upscalingScale: 4,
    backgroundColor: 'White',
    autoCrop: true,
    aiConfig: {
      provider: AIProvider.Gemini,
      modelId: 'gemini-3.1-flash-image-preview'
    },
    // Manual WebGL Enhancement defaults
    brightness: 0.0,
    contrast: 1.0,
    saturation: 1.1,
    vibrance: 0.2,
    sharpen: 0.35,
    descratchThreshold: 0.16,
    descratchRadius: 3.5
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Cleanup object URLs to prevent memory leaks when component unmounts
  useEffect(() => {
    return () => {
      cards.forEach(card => {
        URL.revokeObjectURL(card.previewUrl);
        if (card.processedUrl) URL.revokeObjectURL(card.processedUrl);
      });
    };
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const base64ToBlobUrl = (base64: string): string => {
    try {
      const byteCharacters = atob(base64.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("Failed to convert base64 to blob", e);
      return base64; // Fallback
    }
  };

  // Apply manual WebGL enhancements to an image
  const applyManualEnhancements = async (imageDataUrl: string, settings: ProcessingSettings): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          // Create temporary canvas for WebGL processing
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          
          const renderer = new WebGLCardRenderer(tempCanvas);
          
          // Convert settings to EnhancementSettings format
          const enhancementSettings: EnhancementSettings = {
            brightness: settings.brightness,
            contrast: settings.contrast,
            saturation: settings.saturation,
            vibrance: settings.vibrance,
            sharpen: settings.sharpen,
            descratchEnabled: settings.enableDescratching,
            descratchThreshold: settings.descratchThreshold,
            descratchRadius: settings.descratchRadius,
            showScratchMask: false,
            aspectRatio: null,
            autoSnap: false
          };
          
          // Create a simple quad that covers the entire image (no perspective crop)
          const fullImageQuad: CropQuad = {
            topLeft: { x: 0, y: 0 },
            topRight: { x: 1, y: 0 },
            bottomRight: { x: 1, y: 1 },
            bottomLeft: { x: 0, y: 1 }
          };
          
          // Apply enhancements using WebGL renderer
          const enhancedBlobUrl = await renderer.exportCroppedHighRes(img, fullImageQuad, enhancementSettings);
          resolve(enhancedBlobUrl);
        } catch (err) {
          console.error("Manual enhancement failed:", err);
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image for enhancement"));
      img.src = imageDataUrl;
    });
  };

  const processFiles = (fileList: FileList | File[]) => {
      const MAX_SIZE_MB = 20;
      const MAX_BATCH_SIZE = 50;
      
      const files = Array.from(fileList) as File[];
      
      if (files.length > MAX_BATCH_SIZE) {
          addLog(`Warning: Selecting >${MAX_BATCH_SIZE} files may slow down browser.`);
      }

      const newCards: CardImage[] = [];
      let skippedCount = 0;

      files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            skippedCount++;
            return;
        }

        newCards.push({
            id: Math.random().toString(36).substr(2, 9),
            file,
            previewUrl: URL.createObjectURL(file),
            status: ProcessingStatus.Pending,
            originalWidth: 0,
            originalHeight: 0
        });
      });

      if (skippedCount > 0) {
          addLog(`Skipped ${skippedCount} files larger than ${MAX_SIZE_MB}MB.`);
      }

      if (newCards.length > 0) {
        setCards(prev => [...prev, ...newCards]);
        addLog(`Added ${newCards.length} images to queue.`);
      }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        processFiles(event.target.files);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const clearAll = () => {
      if (isProcessing) {
          if(!window.confirm("Processing is active. Are you sure you want to clear and stop?")) return;
      }
      // Cleanup memory
      cards.forEach(c => {
          URL.revokeObjectURL(c.previewUrl);
          if (c.processedUrl) URL.revokeObjectURL(c.processedUrl);
      });
      setCards([]);
      addLog("Queue cleared. Memory released.");
  };

  const clearCompleted = () => {
      const completed = cards.filter(c => c.status === ProcessingStatus.Completed);
      const remaining = cards.filter(c => c.status !== ProcessingStatus.Completed);
      
      // Cleanup memory for completed items only
      completed.forEach(c => {
          URL.revokeObjectURL(c.previewUrl);
          if (c.processedUrl) URL.revokeObjectURL(c.processedUrl);
      });

      setCards(remaining);
      addLog(`Removed ${completed.length} completed items.`);
  };

  const processBatch = async () => {
    if (isProcessing) return;

    // Validate API Key based on provider
    setIsProcessing(true);
    
    // Filter pending items
    const pendingCards = cards.filter(c => c.status === ProcessingStatus.Pending);
    addLog(`Starting batch process (${pendingCards.length} pending items)`);
    
    // We iterate through the existing cards array by index to ensure we update state correctly
    // Note: We access the *current* state inside the loop via the card.id match
    
    for (const card of pendingCards) {
      // Check if user cleared queue mid-process
      // We can't easily check state inside loop without refs, but we can try-catch
      
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: ProcessingStatus.Processing } : c));
      
      try {
          // 1. Analyze & Detect Crop Box
          addLog(`[${card.file.name}] Analyzing & Detecting boundaries...`);
          const analysis = await analyzeCardDamage(card.file, settings.aiConfig);
          
          setCards(prev => prev.map(c => c.id === card.id ? { ...c, analysis } : c));
          addLog(`[${card.file.name}] Damage Score: ${analysis.damageScore} | Crop Conf: High`);

          // 2. Crop & Restore
          addLog(`[${card.file.name}] Applying ${(settings.restorationStrength * 100).toFixed(0)}% AI restoration...`);
          const restoredBase64 = await restoreCard(card.file, settings, analysis);
          
          // 3. Apply manual WebGL enhancements
          addLog(`[${card.file.name}] Applying manual enhancements (brightness, contrast, sharpen, etc.)...`);
          let finalImageUrl = restoredBase64;
          
          // Check if any manual enhancement is non-default
          const hasManualEnhancements = 
            settings.brightness !== 0.0 || 
            settings.contrast !== 1.0 || 
            settings.saturation !== 1.0 || 
            settings.vibrance !== 0.0 || 
            settings.sharpen !== 0.0 ||
            settings.enableDescratching;
          
          if (hasManualEnhancements) {
            finalImageUrl = await applyManualEnhancements(restoredBase64, settings);
            addLog(`[${card.file.name}] Manual enhancements applied.`);
          } else {
            addLog(`[${card.file.name}] Skipping manual enhancements (all at default values).`);
          }
          
          // Convert to Blob URL for memory efficiency
          const finalBlobUrl = finalImageUrl.startsWith('blob:') ? finalImageUrl : base64ToBlobUrl(finalImageUrl);

          setCards(prev => prev.map(c => 
             c.id === card.id ? { ...c, status: ProcessingStatus.Completed, processedUrl: finalBlobUrl } : c
          ));
          addLog(`[${card.file.name}] Finished.`);

      } catch (error: any) {
          console.error(error);
          addLog(`ERROR [${card.file.name}] ${error.message || 'Processing failed'}`);
          const errMsg = error.message?.toLowerCase();
          if (errMsg?.includes('401') || errMsg?.includes('auth') || errMsg?.includes('api key')) {
             addLog(`SYSTEM ALERT: Authentication failed. Update your API Key in Config.`);
             // Optionally open config right away if we have an open handler:
             // but we don't have a direct hook into SettingsModal here easily unless we use the handleApiKeyUpdate
             // Actually handleApiKeyUpdate opens aistudio key if gemini or we can just leave it as log
          } else if (errMsg?.includes('invalid')) {
              addLog(`SYSTEM ALERT: Invalid parameters or file format. Try a different format.`);
          } else if (errMsg?.includes('not found') || errMsg?.includes('fallback model')) {
              addLog(`SYSTEM ALERT: Model issue detected. We attempted to fallback. Try selecting a different AI provider.`);
          }
          
          setCards(prev => prev.map(c => 
             c.id === card.id ? { ...c, status: ProcessingStatus.Failed } : c
          ));
      }
    }
    setIsProcessing(false);
  };

  const handleDownloadBatch = async () => {
    const completedCards = cards.filter(c => c.status === ProcessingStatus.Completed && c.processedUrl);
    if (completedCards.length === 0) return;
    setIsDownloading(true);

    try {
      const zip = new JSZip();
      const promises = completedCards.map(async (card) => {
        if (card.processedUrl) {
           const response = await fetch(card.processedUrl);
           const blob = await response.blob();
           zip.file(`restored_${card.file.name.replace(/\.[^/.]+$/, "")}.png`, blob);
        }
      });
      await Promise.all(promises);
      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `lumina_batch_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      addLog("Zip generation failed.");
    } finally {
      setIsDownloading(false);
    }
  };

  const completedCount = cards.filter(c => c.status === ProcessingStatus.Completed).length;
  const progress = cards.length > 0 ? (completedCount / cards.length) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-transparent text-[#00f3ff] font-sans holo-text">
      {/* Top Navigation */}
      <div className="h-16 border-b border-[rgba(0,243,255,0.2)] bg-black/40 backdrop-blur-md flex items-center px-8 justify-between z-10 holo-border">
        <div className="flex items-center gap-6">
            <h2 className="text-sm font-semibold text-[#00f3ff] tracking-tight flex items-center gap-2 font-mono">
                <Wand2 size={16} className="text-[#00f3ff]" />
                WORKSTATION
            </h2>
            <div className="h-4 w-px bg-[rgba(0,243,255,0.2)]"></div>
            <div className="flex gap-6 text-sm">
                <div className="flex flex-col">
                    <span className="text-[9px] text-[rgba(0,243,255,0.6)] font-bold uppercase tracking-widest font-mono">Queue</span>
                    <span className="text-[#00f3ff] font-mono text-xs mt-0.5">{cards.length} Assets</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] text-[rgba(0,243,255,0.6)] font-bold uppercase tracking-widest font-mono">Status</span>
                    <span className={`${isProcessing ? 'text-[rgba(255,0,229,1)]' : 'text-[#00f3ff]'} font-mono text-xs mt-0.5`}>
                        {isProcessing ? 'Processing...' : 'Ready'}
                    </span>
                </div>
            </div>
        </div>

        <div className="flex gap-3">
             {completedCount > 0 && (
                <button 
                  onClick={clearCompleted}
                  className="px-3 py-1.5 text-xs font-semibold text-[#00f3ff] hover:bg-[rgba(0,243,255,0.1)] rounded-sm transition-colors flex items-center gap-2 border border-transparent hover:border-[rgba(0,243,255,0.3)] font-mono"
                  title="Remove completed items to free memory"
                >
                  <CheckCircle2 size={14} /> Prune Done
                </button>
             )}
             <button 
              onClick={clearAll}
              disabled={cards.length === 0}
              className="px-3 py-1.5 text-xs font-semibold text-[rgba(255,0,229,0.7)] hover:text-[#ff00e5] hover:bg-[rgba(255,0,229,0.1)] rounded-sm transition-colors flex items-center gap-2 border border-transparent hover:border-[rgba(255,0,229,0.3)] font-mono"
            >
              <Trash2 size={14} /> Clear Batch
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-1.5 bg-[rgba(0,243,255,0.05)] hover:bg-[rgba(0,243,255,0.15)] border border-[rgba(0,243,255,0.3)] text-[#00f3ff] rounded-sm text-xs font-semibold transition-all flex items-center gap-2 holo-border font-mono"
            >
              <Upload size={14} /> Import
            </button>
            <button 
              onClick={processBatch}
              disabled={isProcessing || cards.length === 0}
              className={`px-6 py-1.5 rounded-sm text-xs font-semibold flex items-center gap-2 transition-all font-mono holo-button ${
                isProcessing || cards.length === 0 
                  ? '' 
                  : ''
              }`}
            >
              {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
              {isProcessing ? 'PROCESSING' : 'START BATCH'}
            </button>
        </div>
        <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelect}/>
      </div>

      <div className="flex-1 flex overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
        {/* Main Grid */}
        <div className="flex-1 p-8 overflow-y-auto relative bg-transparent">
          {cards.length === 0 ? (
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="h-full border border-dashed border-[rgba(0,243,255,0.4)] bg-[rgba(0,243,255,0.02)] rounded-lg flex flex-col items-center justify-center text-[rgba(0,243,255,0.6)] cursor-pointer hover:border-[#00f3ff] hover:bg-[rgba(0,243,255,0.05)] transition-all group holo-border"
             >
               <div className="w-12 h-12 rounded flex items-center justify-center mb-4 bg-black/40 group-hover:bg-[rgba(0,243,255,0.2)] transition-colors holo-border">
                  <Upload size={20} className="text-[rgba(0,243,255,0.6)] group-hover:text-[#00f3ff]" />
               </div>
               <p className="font-mono text-sm text-[#00f3ff] holo-text">Drop cards here</p>
               <div className="flex items-center gap-4 mt-3">
                   <p className="text-[10px] text-[rgba(0,243,255,0.6)] font-mono flex items-center gap-1"><Info size={10}/> Max 20MB / file</p>
                   <p className="text-[10px] text-[rgba(0,243,255,0.6)] font-mono flex items-center gap-1"><Info size={10}/> Max 50 batch</p>
               </div>
             </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 relative z-0">
              {cards.map(card => (
                <div key={card.id} className="group relative bg-black/40 border border-[rgba(0,243,255,0.2)] rounded-sm overflow-hidden hover:border-[#00f3ff] hover:shadow-[0_4px_20px_rgba(0,243,255,0.3)] transition-all duration-300 holo-border">
                  <div className="aspect-[3/4] relative bg-black/60 p-2">
                    <img 
                      src={card.processedUrl || card.previewUrl} 
                      alt="Card" 
                      className={`w-full h-full object-contain rounded-sm shadow-sm ${card.status === ProcessingStatus.Processing ? 'opacity-50 blur-sm scale-[0.98]' : 'scale-100'} transition-all`} 
                    />
                    
                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                         {card.status === ProcessingStatus.Completed && (
                             <div className="bg-green-500/10 backdrop-blur-md border border-green-500/30 text-green-500 p-1 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.2)]">
                                 <Wand2 size={12} />
                             </div>
                         )}
                         {card.status === ProcessingStatus.Processing && (
                             <div className="bg-[#3274d9]/10 backdrop-blur-md border border-[#3274d9]/30 text-[#3274d9] p-1 rounded-sm animate-pulse shadow-[0_0_8px_rgba(50,116,217,0.3)]">
                                 <Loader2 size={12} className="animate-spin" />
                             </div>
                         )}
                         {card.status === ProcessingStatus.Failed && (
                             <div className="bg-[#e02f44]/10 backdrop-blur-md border border-[#e02f44]/30 text-[#e02f44] p-1 rounded-sm shadow-[0_0_8px_rgba(224,47,68,0.2)]">
                                 <X size={12} />
                             </div>
                         )}
                    </div>

                    {/* Analysis Overlay (Hover) */}
                    {card.analysis && (
                        <div className="absolute inset-0 bg-[#111217]/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center overflow-y-auto custom-scrollbar">
                            <div className="text-3xl font-mono font-bold text-[#f2cc0c] mb-1">{card.analysis.damageScore.toFixed(2)}</div>
                            <div className="text-[9px] uppercase tracking-widest text-[#8e99a8] mb-4">Damage Metric</div>
                            
                            {card.analysis.detailedIssues && card.analysis.detailedIssues.length > 0 ? (
                                <div className="flex flex-col gap-2 w-full text-left">
                                    {card.analysis.detailedIssues.slice(0, 4).map((issue, i) => (
                                        <div key={i} className="bg-[#e02f44]/5 border border-[#e02f44]/20 rounded-sm p-2 flex flex-col">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[#f2cc0c] text-[10px] font-mono font-bold">{issue.type}</span>
                                                <span className="text-[#e02f44] font-mono text-[10px]">{issue.severity}/100</span>
                                            </div>
                                            <span className="text-gray-400 text-[9px] line-clamp-2 leading-tight">{issue.description}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {card.analysis.issues.slice(0, 4).map((issue, i) => (
                                        <span key={i} className="px-2 py-1 rounded-sm bg-[#e02f44]/10 border border-[#e02f44]/20 text-[#e02f44] text-[9px] font-mono">{issue}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <button 
                      onClick={() => {
                          // Clean up specific card
                          URL.revokeObjectURL(card.previewUrl);
                          if(card.processedUrl) URL.revokeObjectURL(card.processedUrl);
                          setCards(prev => prev.filter(c => c.id !== card.id));
                      }}
                      className="absolute top-2 right-2 bg-[#2c3235]/80 hover:bg-[#e02f44] p-1 rounded-sm text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Settings Panel */}
        <div className="w-80 holo-panel border-l border-[rgba(0,243,255,0.2)] flex flex-col z-20">
          <div className="p-5 border-b border-[rgba(0,243,255,0.2)] flex items-center gap-3 bg-black/20">
            <div className="p-1.5 bg-[rgba(0,243,255,0.1)] rounded border border-[rgba(0,243,255,0.3)]">
                <Settings2 size={14} className="text-[#00f3ff]" />
            </div>
            <h3 className="font-semibold text-xs text-[#00f3ff] uppercase tracking-wide font-mono">Processing Config</h3>
          </div>

          <div className="p-5 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            
            {/* AI Engine Selection */}
            <div>
               <div className="flex items-center justify-between mb-2">
                   <label className="text-[10px] font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wide font-mono">AI Engine</label>
                   <Wand2 size={12} className="text-[rgba(0,243,255,0.7)]"/>
               </div>
               <div className="space-y-2">
                   <select 
                     value={settings.aiConfig.provider}
                     onChange={(e) => {
                       const provider = e.target.value as AIProvider;
                       let modelId = 'gemini-3.1-flash-image-preview';
                       if (provider === AIProvider.OpenRouter) modelId = 'google/gemini-2.0-flash-001';
                       if (provider === AIProvider.Venice) modelId = 'flux-pro';
                       setSettings({
                         ...settings, 
                         aiConfig: { provider, modelId }
                       });
                     }}
                     className="w-full bg-black/40 border border-[rgba(0,243,255,0.3)] rounded-sm px-2 py-1.5 text-[11px] font-mono text-[#00f3ff] focus:outline-none focus:border-[#00f3ff] transition-colors holo-border"
                   >
                       <option value={AIProvider.Gemini}>Google Gemini</option>
                       <option value={AIProvider.OpenRouter}>OpenRouter API</option>
                       <option value={AIProvider.Venice}>Venice API</option>
                   </select>

                   <div className="space-y-1">
                       <label className="text-[9px] text-[rgba(0,243,255,0.7)] font-mono uppercase px-1">Model ID</label>
                       <select 
                         value={settings.aiConfig.modelId}
                         onChange={(e) => setSettings({
                           ...settings, 
                           aiConfig: { ...settings.aiConfig, modelId: e.target.value }
                         })}
                         className="w-full bg-black/40 border border-[rgba(0,243,255,0.3)] rounded-sm px-2 py-1.5 text-[10px] font-mono text-[#00f3ff] focus:outline-none focus:border-[#00f3ff] transition-colors holo-border"
                       >
                           {settings.aiConfig.provider === AIProvider.Gemini && (
                               <>
                                   <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                                   <option value="gemini-3.1-flash-image-preview">gemini-3.1-flash-preview</option>
                               </>
                           )}
                           {settings.aiConfig.provider === AIProvider.OpenRouter && (
                               <>
                                   <option value="google/gemini-2.0-flash-001">gemini-2.0-flash-001</option>
                                   <option value="anthropic/claude-3.5-sonnet">claude-3.5-sonnet</option>
                               </>
                           )}
                           {settings.aiConfig.provider === AIProvider.Venice && (
                               <>
                                   <option value="flux-pro">flux-pro</option>
                                   <option value="flux-dev">flux-dev</option>
                                   <option value="llama-3.3-70b">llama-3.3-70b</option>
                               </>
                           )}
                       </select>
                   </div>
               </div>
            </div>

            {/* Smart Crop */}
            <div>
               <div className="flex items-center justify-between mb-2">
                   <label className="text-[10px] font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wide font-mono">Heuristics</label>
                   <Crop size={12} className="text-[rgba(0,243,255,0.7)]"/>
               </div>
               <div className="flex items-center justify-between p-2 px-3 bg-black/40 rounded-sm border border-[rgba(0,243,255,0.3)] holo-border">
                   <span className="text-[11px] font-mono text-[#00f3ff]">Auto-Detect Bounds</span>
                   <div 
                      onClick={() => setSettings({...settings, autoCrop: !settings.autoCrop})}
                      className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${settings.autoCrop ? 'bg-[rgba(0,243,255,0.8)] shadow-[0_0_8px_rgba(0,243,255,0.8)]' : 'bg-[rgba(0,243,255,0.2)]'}`}
                   >
                       <div className={`w-3 h-3 bg-white rounded-full transition-transform ${settings.autoCrop ? 'translate-x-4' : 'translate-x-0'}`}></div>
                   </div>
               </div>
            </div>

            {/* Restoration Strength Slider */}
            <div>
               <div className="flex items-center justify-between mb-2">
                   <label className="text-[10px] font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wide font-mono">Restoration Delta</label>
                   <Sliders size={12} className="text-[rgba(0,243,255,0.7)]"/>
               </div>
               <div className="flex items-center gap-3">
                 <input
                   type="range"
                   min="0"
                   max="1"
                   step="0.01"
                   value={settings.restorationStrength}
                   onChange={(e) => setSettings({...settings, restorationStrength: parseFloat(e.target.value)})}
                   className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer border border-[rgba(0,243,255,0.3)] shadow-[0_0_5px_rgba(0,243,255,0.3)]"
                 />
                 <span className="text-[11px] font-mono text-[#00f3ff] holo-text w-8 text-right bg-black/40 px-1 py-0.5 rounded border border-[rgba(0,243,255,0.3)] holo-border">
                   {Math.round(settings.restorationStrength * 100)}
                 </span>
               </div>
               <p className="text-[9px] font-mono text-[rgba(0,243,255,0.5)] mt-2 px-1">
                   {settings.restorationStrength < 0.33 && "> Conservative. Focuses on dust removal."}
                   {settings.restorationStrength >= 0.33 && settings.restorationStrength < 0.66 && "> Standard. Repairs minor scratches."}
                   {settings.restorationStrength >= 0.66 && "> Aggressive. Heavy surface reconstruction."}
               </p>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
               <label className="flex items-center justify-between p-2 px-3 bg-black/40 rounded-sm border border-[rgba(0,243,255,0.3)] cursor-pointer hover:border-[#00f3ff] transition-colors holo-border">
                  <span className="text-[11px] font-mono text-[#00f3ff]">Neural Upscale [4x]</span>
                  <input 
                    type="checkbox" 
                    checked={settings.enableUpscaling}
                    onChange={(e) => setSettings({...settings, enableUpscaling: e.target.checked})}
                    className="w-3.5 h-3.5 accent-[#00f3ff] bg-black/60 border border-[rgba(0,243,255,0.5)] rounded-sm"
                  />
               </label>
            </div>

            {/* Manual Enhancement Controls */}
            <div>
               <div className="flex items-center justify-between mb-2">
                   <label className="text-[10px] font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wide font-mono">Manual Enhancements</label>
                   <Sliders size={12} className="text-[rgba(0,243,255,0.7)]"/>
               </div>
               <div className="space-y-3 p-3 bg-black/40 rounded-sm border border-[rgba(0,243,255,0.3)] holo-border">
                  {/* Brightness */}
                  <div className="space-y-1">
                     <div className="flex justify-between items-center">
                        <span className="text-[9px] font-mono text-[rgba(0,243,255,0.8)]">Brightness</span>
                        <span className="text-[9px] font-mono text-[#00f3ff] bg-black/60 px-1.5 py-0.5 rounded border border-[rgba(0,243,255,0.3)]">
                           {settings.brightness.toFixed(2)}
                        </span>
                     </div>
                     <input
                        type="range"
                        min="-0.3"
                        max="0.3"
                        step="0.01"
                        value={settings.brightness}
                        onChange={(e) => setSettings({...settings, brightness: parseFloat(e.target.value)})}
                        className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer border border-[rgba(0,243,255,0.3)]"
                     />
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1">
                     <div className="flex justify-between items-center">
                        <span className="text-[9px] font-mono text-[rgba(0,243,255,0.8)]">Contrast</span>
                        <span className="text-[9px] font-mono text-[#00f3ff] bg-black/60 px-1.5 py-0.5 rounded border border-[rgba(0,243,255,0.3)]">
                           {settings.contrast.toFixed(2)}
                        </span>
                     </div>
                     <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.01"
                        value={settings.contrast}
                        onChange={(e) => setSettings({...settings, contrast: parseFloat(e.target.value)})}
                        className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer border border-[rgba(0,243,255,0.3)]"
                     />
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1">
                     <div className="flex justify-between items-center">
                        <span className="text-[9px] font-mono text-[rgba(0,243,255,0.8)]">Saturation</span>
                        <span className="text-[9px] font-mono text-[#00f3ff] bg-black/60 px-1.5 py-0.5 rounded border border-[rgba(0,243,255,0.3)]">
                           {settings.saturation.toFixed(2)}
                        </span>
                     </div>
                     <input
                        type="range"
                        min="0.0"
                        max="2.0"
                        step="0.01"
                        value={settings.saturation}
                        onChange={(e) => setSettings({...settings, saturation: parseFloat(e.target.value)})}
                        className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer border border-[rgba(0,243,255,0.3)]"
                     />
                  </div>

                  {/* Vibrance */}
                  <div className="space-y-1">
                     <div className="flex justify-between items-center">
                        <span className="text-[9px] font-mono text-[rgba(0,243,255,0.8)]">Vibrance</span>
                        <span className="text-[9px] font-mono text-[#00f3ff] bg-black/60 px-1.5 py-0.5 rounded border border-[rgba(0,243,255,0.3)]">
                           {settings.vibrance.toFixed(2)}
                        </span>
                     </div>
                     <input
                        type="range"
                        min="-0.5"
                        max="0.5"
                        step="0.01"
                        value={settings.vibrance}
                        onChange={(e) => setSettings({...settings, vibrance: parseFloat(e.target.value)})}
                        className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer border border-[rgba(0,243,255,0.3)]"
                     />
                  </div>

                  {/* Sharpen */}
                  <div className="space-y-1">
                     <div className="flex justify-between items-center">
                        <span className="text-[9px] font-mono text-[rgba(0,243,255,0.8)]">Sharpen</span>
                        <span className="text-[9px] font-mono text-[#00f3ff] bg-black/60 px-1.5 py-0.5 rounded border border-[rgba(0,243,255,0.3)]">
                           {settings.sharpen.toFixed(2)}
                        </span>
                     </div>
                     <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.01"
                        value={settings.sharpen}
                        onChange={(e) => setSettings({...settings, sharpen: parseFloat(e.target.value)})}
                        className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer border border-[rgba(0,243,255,0.3)]"
                     />
                  </div>
               </div>
            </div>

            {/* Descratch Fine-Tuning */}
            {settings.enableDescratching && (
               <div>
                  <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wide font-mono">Descratch Control</label>
                      <Sliders size={12} className="text-[rgba(0,243,255,0.7)]"/>
                  </div>
                  <div className="space-y-3 p-3 bg-black/40 rounded-sm border border-[rgba(0,243,255,0.3)] holo-border">
                     {/* Threshold */}
                     <div className="space-y-1">
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-mono text-[rgba(0,243,255,0.8)]">Sensitivity</span>
                           <span className="text-[9px] font-mono text-[#00f3ff] bg-black/60 px-1.5 py-0.5 rounded border border-[rgba(0,243,255,0.3)]">
                              {settings.descratchThreshold.toFixed(2)}
                           </span>
                        </div>
                        <input
                           type="range"
                           min="0.05"
                           max="0.4"
                           step="0.01"
                           value={settings.descratchThreshold}
                           onChange={(e) => setSettings({...settings, descratchThreshold: parseFloat(e.target.value)})}
                           className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer border border-[rgba(0,243,255,0.3)]"
                        />
                     </div>

                     {/* Radius */}
                     <div className="space-y-1">
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-mono text-[rgba(0,243,255,0.8)]">Inpaint Radius</span>
                           <span className="text-[9px] font-mono text-[#00f3ff] bg-black/60 px-1.5 py-0.5 rounded border border-[rgba(0,243,255,0.3)]">
                              {settings.descratchRadius.toFixed(1)}px
                           </span>
                        </div>
                        <input
                           type="range"
                           min="1.0"
                           max="8.0"
                           step="0.5"
                           value={settings.descratchRadius}
                           onChange={(e) => setSettings({...settings, descratchRadius: parseFloat(e.target.value)})}
                           className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer border border-[rgba(0,243,255,0.3)]"
                        />
                     </div>
                  </div>
               </div>
            )}

            {/* Console */}
            <div className="flex-1 flex flex-col min-h-[150px]">
                <label className="text-[10px] font-bold text-[rgba(0,243,255,0.7)] uppercase tracking-wide mb-2 flex items-center justify-between font-mono">
                    System Log
                    <span className="text-[9px] font-mono text-[rgba(0,243,255,1)] animate-pulse shadow-[0_0_5px_rgba(0,243,255,0.5)]">LIVE</span>
                </label>
                <div className="flex-1 bg-black/60 border border-[rgba(0,243,255,0.3)] p-2.5 rounded-sm overflow-y-auto max-h-[200px] text-[9px] font-mono text-[rgba(0,243,255,0.8)] custom-scrollbar holo-border">
                    {logs.length === 0 && <span className="opacity-50">System ready. Waiting for input...</span>}
                    {logs.map((log, i) => (
                        <div key={i} className="mb-1 leading-relaxed">
                            <span className="text-[rgba(0,243,255,0.4)] mr-2">{'>'}</span>
                            {log.includes('SYSTEM ALERT') ? <span className="text-[rgba(255,0,229,1)] holo-text">{log}</span> :
                             log.includes('ERROR') ? <span className="text-red-500">{log}</span> : 
                             log.includes('Finished') ? <span className="text-[#00f3ff] holo-text">{log}</span> : log}
                        </div>
                    ))}
                    <div ref={logsEndRef}></div>
                </div>
            </div>

            {/* Footer */}
            <div className="pt-2">
               {cards.length > 0 && progress > 0 && (
                   <div className="mb-4">
                       <div className="flex justify-between text-[9px] font-mono text-[rgba(0,243,255,0.7)] mb-1">
                           <span>BATCH_PROGRESS</span>
                           <span className="text-[#00f3ff]">{Math.round(progress)}%</span>
                       </div>
                       <div className="h-1 bg-black/40 rounded-none overflow-hidden border border-[rgba(0,243,255,0.3)]">
                           <div className="h-full bg-[#00f3ff] transition-all duration-300 shadow-[0_0_8px_rgba(0,243,255,0.8)]" style={{width: `${progress}%`}}></div>
                       </div>
                   </div>
               )}
               
               {completedCount > 0 && (
                   <div className="mb-4 bg-black/40 border border-[rgba(0,243,255,0.3)] p-2 rounded-sm holo-border">
                       <span className="text-[9px] text-[rgba(0,243,255,0.7)] font-mono uppercase mb-2 block">Latest Enhancement Preview</span>
                       <div className="flex gap-2">
                           <div className="flex-1 relative aspect-[3/4] border border-gray-800">
                               <img src={cards.find(c => c.status === ProcessingStatus.Completed)?.previewUrl} className="w-full h-full object-contain bg-black/60 opacity-60" />
                               <span className="absolute bottom-1 left-1 text-[8px] font-mono bg-black/80 px-1 text-gray-400">ORIGINAL</span>
                           </div>
                           <div className="flex-1 relative aspect-[3/4] border border-[rgba(0,243,255,0.3)]">
                               <img src={cards.find(c => c.status === ProcessingStatus.Completed)?.processedUrl} className="w-full h-full object-contain bg-black/60" />
                               <span className="absolute bottom-1 right-1 text-[8px] font-mono bg-[#00f3ff]/20 text-[#00f3ff] px-1 border border-[#00f3ff]/30">ENHANCED</span>
                           </div>
                       </div>
                   </div>
               )}

               <button 
                  onClick={handleDownloadBatch}
                  disabled={completedCount === 0 || isDownloading}
                  className={`w-full py-2.5 rounded-sm text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all font-mono holo-button ${
                    completedCount > 0 && !isDownloading
                      ? '' 
                      : ''
                  }`}
                >
                    {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    {isDownloading ? 'COMPRESSING...' : 'EXPORT ARCHIVE'}
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchCropper;