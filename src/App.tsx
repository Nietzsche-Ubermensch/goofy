import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { CardItem, CropQuad, EnhancementSettings, AppState, TelemetryPayload } from './types';
import { getPresetCards } from './data/presetCards';
import { detectCardEdges } from './utils/edgeDetection';
import { getRotatedCanvas } from './utils/imageRotation';
import { telemetry } from './utils/telemetry';
import { WebGLCardRenderer } from './webgl/webglRenderer';
import { CardEditorCanvas } from './components/CardEditorCanvas';
import { ToolbarControls } from './components/ToolbarControls';
import { PresetsBar } from './components/PresetsBar';
import { KeyboardShortcutsBadge } from './components/KeyboardShortcutsBadge';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { TelemetryAuditModal } from './components/TelemetryAuditModal';
import { LiquidGlassContainer } from './components/LiquidGlassContainer';
import Sidebar from './components/Sidebar';
import BatchCropper from './pages/BatchCropper';
import ImageGenerator from './pages/ImageGenerator';
import ChatBot from './pages/ChatBot';
import CardEnhancementSuite from './pages/CardEnhancementSuite';
import { Dashboard } from './pages/Dashboard';
import { scanDroppedItems } from './utils/dropzoneScanner';
import { Sparkles, Layers, Sliders, ShieldCheck, Download, Zap, RefreshCw, LayoutGrid, Layers3, Upload, HelpCircle, Keyboard, FolderCheck, CheckCircle2, FolderInput } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_SETTINGS: EnhancementSettings = {
  brightness: 0.0,
  contrast: 1.0,
  saturation: 1.1,
  vibrance: 0.2,
  sharpen: 0.35,
  descratchEnabled: true,
  descratchThreshold: 0.16,
  descratchRadius: 3.5,
  showScratchMask: false,
  aspectRatio: 2.5 / 3.5,
  autoSnap: true
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'cropper' | 'batch' | 'enhancer' | 'generator' | 'chat'>('enhancer');
  const [cropperMode, setCropperMode] = useState<'single' | 'batch'>('batch');

  const [cards, setCards] = useState<CardItem[]>(getPresetCards());
  const [activeCardId, setActiveCardId] = useState<string>('preset-psa-scratch');
  const [appState, setAppState] = useState<AppState>('Ready');
  const [settings, setSettings] = useState<EnhancementSettings>(() => {
    const savedSettings = localStorage.getItem('card-enhancement-settings');
    return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('card-enhancement-settings', JSON.stringify(settings));
  }, [settings]);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [telemetryPayload, setTelemetryPayload] = useState<TelemetryPayload>(
    telemetry.getPayload('Ready', 'PSA 10 Slab (Scratch Damaged)', '800x1120')
  );

  // Batch Queue & Directory Drop State
  const [batchInitialFiles, setBatchInitialFiles] = useState<File[]>([]);
  const [batchFolderName, setBatchFolderName] = useState<string | undefined>(undefined);
  const [dropToast, setDropToast] = useState<{
    id: string;
    type: 'single' | 'batch';
    title: string;
    description: string;
    count?: number;
  } | null>(null);

  // Auto-dismiss drop notification toast after 4.5s
  useEffect(() => {
    if (!dropToast) return;
    const timer = setTimeout(() => {
      setDropToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [dropToast]);

  const cardEditorRef = useRef<{ exportCard: () => void }>(null);

  const activeCard = cards.find((c) => c.id === activeCardId) || cards[0];

  // Synchronize view selection when sidebar switches
  const handleViewChange = (view: 'cropper' | 'batch' | 'enhancer' | 'generator' | 'chat') => {
    if (view === 'batch') {
      setCurrentView('cropper');
      setCropperMode('batch');
    } else {
      setCurrentView(view);
      if (view === 'cropper') setCropperMode('single');
    }
  };

  // Register telemetry audit callback
  useEffect(() => {
    telemetry.registerAuditCallback(() => {
      setTelemetryPayload(telemetry.getPayload(appState, activeCard.name, `${activeCard.width}x${activeCard.height}`));
      setIsAuditModalOpen(true);
    });
  }, [appState, activeCard]);

  // Handle Auto-Crop Edge Detection
  const handleAutoCrop = useCallback(() => {
    if (!activeCard) return;
    setAppState('Auto-Detecting');

    setTimeout(() => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const sourceImage = activeCard.rotation ? getRotatedCanvas(img, activeCard.rotation) : img;
        const detectedQuad = detectCardEdges(sourceImage, settings.aspectRatio);
        setCards((prev) =>
          prev.map((c) => (c.id === activeCard.id ? { ...c, quad: detectedQuad } : c))
        );
        setAppState('Ready');
      };
      img.src = activeCard.originalUrl;
    }, 50);
  }, [activeCard, settings.aspectRatio]);

  // Handle High-Res Export (Enter Key)
  const handleExport = useCallback(async () => {
    if (!activeCard) return;
    setAppState('Processing');

    try {
      if (cardEditorRef.current) {
        cardEditorRef.current.exportCard();
        setAppState('Ready');
        return;
      }

      const tempCanvas = document.createElement('canvas');
      const renderer = new WebGLCardRenderer(tempCanvas);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        const sourceImage = activeCard.rotation ? getRotatedCanvas(img, activeCard.rotation) : img;
        const blobUrl = await renderer.exportCroppedHighRes(sourceImage, activeCard.quad, settings);

        setCards((prev) =>
          prev.map((c) => (c.id === activeCard.id ? { ...c, processedBlobUrl: blobUrl, status: 'Ready' } : c))
        );

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${activeCard.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_enhanced.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setAppState('Ready');
      };
      img.src = activeCard.originalUrl;

    } catch (err: any) {
      setAppState('Ready');
    }
  }, [activeCard, settings]);

  // Handle Quad Corner Handle Nudges via Keyboard Arrows
  const handleNudge = useCallback(
    (key: string, isShift: boolean) => {
      if (!activeCard) return;
      const step = (isShift ? 0.015 : 0.002);

      const q: CropQuad = JSON.parse(JSON.stringify(activeCard.quad));

      let dx = 0;
      let dy = 0;

      if (key === 'ArrowLeft') dx = -step;
      if (key === 'ArrowRight') dx = step;
      if (key === 'ArrowUp') dy = -step;
      if (key === 'ArrowDown') dy = step;

      q.topLeft.x = clamp(q.topLeft.x + dx, 0, 1);
      q.topLeft.y = clamp(q.topLeft.y + dy, 0, 1);
      q.topRight.x = clamp(q.topRight.x + dx, 0, 1);
      q.topRight.y = clamp(q.topRight.y + dy, 0, 1);
      q.bottomRight.x = clamp(q.bottomRight.x + dx, 0, 1);
      q.bottomRight.y = clamp(q.bottomRight.y + dy, 0, 1);
      q.bottomLeft.x = clamp(q.bottomLeft.x + dx, 0, 1);
      q.bottomLeft.y = clamp(q.bottomLeft.y + dy, 0, 1);

      setCards((prev) =>
        prev.map((c) => (c.id === activeCard.id ? { ...c, quad: q } : c))
      );
    },
    [activeCard]
  );

  // Keyboard Hotkey Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        telemetry.triggerAudit();
        return;
      }

      if (e.key === '?' || (e.shiftKey && (e.key === '/' || e.code === 'Slash'))) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleAutoCrop();
        return;
      }

      if (e.code === 'Enter') {
        e.preventDefault();
        handleExport();
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        setSettings(DEFAULT_SETTINGS);
        return;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
        handleNudge(e.code, e.shiftKey);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAutoCrop, handleExport, handleNudge]);

  // Handle Custom File Uploads
  const handleFileUpload = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const item: CardItem = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name.replace(/\.[^/.]+$/, ''),
          originalUrl: url,
          imageElement: img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          quad: {
            topLeft: { x: 0.1, y: 0.1 },
            topRight: { x: 0.9, y: 0.1 },
            bottomRight: { x: 0.9, y: 0.9 },
            bottomLeft: { x: 0.1, y: 0.9 }
          },
          status: 'Ready'
        };
        setCards((prev) => [item, ...prev]);
        setActiveCardId(item.id);
      };
    });
  }, []);

  // Configure react-dropzone with intelligent directory & single-card detection
  const onDrop = useCallback(
    async (acceptedFiles: File[], _fileRejections: any[], event: any) => {
      const dataTransfer = (event as DragEvent)?.dataTransfer;
      const scanResult = await scanDroppedItems(dataTransfer, acceptedFiles);

      if (!scanResult.files || scanResult.files.length === 0) {
        return;
      }

      // DIRECTORY DROP OR MULTI-FILE DIRECTORY BATCH
      if (scanResult.isDirectory || scanResult.files.length > 1) {
        const folderTitle =
          scanResult.directoryName ||
          (scanResult.isDirectory ? 'Card Folder Batch' : 'Card Collection Batch');

        // Automatically switch to Batch Queue mode
        setCurrentView('cropper');
        setCropperMode('batch');
        setBatchInitialFiles(scanResult.files);
        setBatchFolderName(folderTitle);

        // Dispatch global enqueue event for mounted batch cropper
        window.dispatchEvent(
          new CustomEvent('batch-queue-enqueue', {
            detail: {
              files: scanResult.files,
              folderName: folderTitle
            }
          })
        );

        setDropToast({
          id: Math.random().toString(36).substring(2, 9),
          type: 'batch',
          title: 'Directory Batch Queue Created',
          description: `Folder "${folderTitle}" recognized with ${scanResult.files.length} card images. Switched to Batch Cropper.`,
          count: scanResult.files.length
        });
      } else {
        // SINGLE CARD IMAGE DROP
        const singleFile = scanResult.files[0];
        setCurrentView('cropper');
        setCropperMode('single');
        handleFileUpload([singleFile]);

        setDropToast({
          id: Math.random().toString(36).substring(2, 9),
          type: 'single',
          title: 'Single Card Loaded',
          description: `Loaded "${singleFile.name.replace(/\.[^/.]+$/, '')}" into Perspective & Shader Editor.`
        });
      }
    },
    [handleFileUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.heic', '.gif']
    },
    noClick: true,
    noKeyboard: true
  });

  return (
    <div {...getRootProps()} className="flex min-h-screen bg-[#090d16] text-slate-100 font-sans relative overflow-x-hidden">
      <input {...getInputProps()} />

      {/* Global Drag & Drop Overlay with Directory / Single Card Recognition */}
      {isDragActive && (
        <div className="fixed inset-0 z-50 bg-[#090d16]/92 backdrop-blur-md border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center p-8 transition-all pointer-events-none">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-5 rounded-2xl bg-cyan-400/20 border border-cyan-400/50 text-cyan-300 shadow-[0_0_30px_rgba(0,243,255,0.4)] animate-bounce">
              <Upload className="w-10 h-10" />
            </div>
            <div className="p-5 rounded-2xl bg-indigo-500/20 border border-indigo-400/50 text-indigo-300 shadow-[0_0_30px_rgba(99,102,241,0.4)] animate-bounce" style={{ animationDelay: '150ms' }}>
              <FolderInput className="w-10 h-10" />
            </div>
          </div>
          
          <h3 className="text-2xl font-bold font-mono text-cyan-300 tracking-tight">Drop Single Card or Entire Directory</h3>
          <p className="text-sm font-mono text-slate-300 mt-2 text-center max-w-lg">
            Directly drop a single card scan for manual perspective alignment or an entire folder to auto-generate a Batch Queue.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <div className="px-3.5 py-1.5 bg-cyan-500/10 border border-cyan-400/30 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>1 Card = Single Editor</span>
            </div>
            <div className="px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-400/30 rounded-lg text-xs font-mono text-indigo-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span>Folder Drop = Auto Batch Queue</span>
            </div>
          </div>
        </div>
      )}

      {/* Drop Event Notification Toast */}
      <AnimatePresence>
        {dropToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className={`fixed top-4 right-6 z-50 max-w-md p-4 rounded-xl border shadow-2xl backdrop-blur-xl flex items-start gap-3.5 ${
              dropToast.type === 'batch'
                ? 'bg-indigo-950/90 border-indigo-500/40 text-indigo-100 shadow-[0_0_25px_rgba(99,102,241,0.3)]'
                : 'bg-cyan-950/90 border-cyan-500/40 text-cyan-100 shadow-[0_0_25px_rgba(0,243,255,0.25)]'
            }`}
          >
            <div className={`p-2 rounded-lg ${dropToast.type === 'batch' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
              {dropToast.type === 'batch' ? <FolderCheck size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold font-mono tracking-wider uppercase">
                  {dropToast.title}
                </h4>
                {dropToast.count && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                    {dropToast.count} items
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                {dropToast.description}
              </p>
            </div>
            <button
              onClick={() => setDropToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            >
              <span className="sr-only">Close</span>
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView === 'cropper' && cropperMode === 'batch' ? 'batch' : currentView}
        onViewChange={handleViewChange}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
      />

      {/* Main Content Workspace Area */}
      <div className="flex-1 pl-64 flex flex-col min-h-screen relative">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 w-full px-6 py-3.5 border-b border-slate-800 bg-[#090d16]/90 backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Trading Card Cropper & Enhancer
              </h1>
              <p className="text-[11px] text-slate-400">
                Quad Perspective Correction • Local WebGL Shader Filtering • Surface Descratch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsShortcutsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-400/40 text-xs font-mono transition-all shadow-sm active:scale-95"
              title="Keyboard Shortcuts & Hotkey Guide (? or Shift+/)"
            >
              <Keyboard size={14} className="text-cyan-400" />
              <span>Hotkeys</span>
              <kbd className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-bold">?</kbd>
            </button>

            {currentView === 'cropper' && (
              <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
                <button
                  onClick={() => setCropperMode('single')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    cropperMode === 'single'
                      ? 'bg-indigo-600 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid size={14} />
                  <span>Single Card</span>
                </button>
                <button
                  onClick={() => setCropperMode('batch')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    cropperMode === 'batch'
                      ? 'bg-indigo-600 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers3 size={14} />
                  <span>Batch Queue</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* View Switcher Content */}
        {currentView === 'cropper' && (
          cropperMode === 'single' ? (
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
              {/* Hotkey Shortcuts Info Bar */}
              <KeyboardShortcutsBadge
                onOpenAudit={() => {
                  setTelemetryPayload(telemetry.getPayload(appState, activeCard.name, `${activeCard.width}x${activeCard.height}`));
                  setIsAuditModalOpen(true);
                }}
                onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
              />

              {/* 2-Column Core Interface */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left / Main Interactive Canvas Area (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="p-2 bg-slate-900/60 border border-slate-800 rounded-2xl w-full aspect-[4/3] sm:aspect-[16/11] relative shadow-xl">
                    <CardEditorCanvas
                      card={activeCard}
                      settings={settings}
                      appState={appState}
                      onQuadChange={(newQuad) => {
                        setCards((prev) =>
                          prev.map((c) => (c.id === activeCard.id ? { ...c, quad: newQuad } : c))
                        );
                      }}
                      onRotationChange={(newRotation) => {
                        setCards((prev) =>
                          prev.map((c) => (c.id === activeCard.id ? { ...c, rotation: newRotation } : c))
                        );
                      }}
                      onAutoCropTrigger={handleAutoCrop}
                      ref={cardEditorRef}
                    />
                  </div>
                </div>

                {/* Right / GPU Shader & Descratching Controls (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <ToolbarControls
                    settings={settings}
                    onChange={setSettings}
                    onReset={() => setSettings(DEFAULT_SETTINGS)}
                    cardEditorRef={cardEditorRef}
                  />
                </div>
              </div>

              {/* Bottom Presets & Queue Selector Bar */}
              <PresetsBar
                cards={cards}
                activeCardId={activeCardId}
                onSelectCard={setActiveCardId}
                onFileUpload={handleFileUpload}
              />
            </main>
          ) : (
            <main className="flex-1 w-full overflow-hidden">
              <BatchCropper
                initialFiles={batchInitialFiles}
                folderName={batchFolderName}
                onClearInitialFiles={() => setBatchInitialFiles([])}
              />
            </main>
          )
        )}

        {currentView === 'enhancer' && (
          <main className="flex-1 w-full overflow-y-auto">
            <CardEnhancementSuite />
          </main>
        )}

        {currentView === 'generator' && (
          <main className="flex-1 w-full overflow-hidden">
            <ImageGenerator />
          </main>
        )}

        {currentView === 'chat' && (
          <main className="flex-1 w-full overflow-hidden">
            <ChatBot />
          </main>
        )}

        {/* Telemetry & Hotkey Modals */}
        <TelemetryAuditModal
          payload={telemetryPayload}
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
        />

        <KeyboardShortcutsModal
          isOpen={isShortcutsModalOpen}
          onClose={() => setIsShortcutsModalOpen(false)}
        />
      </div>
    </div>
  );
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export default App;
