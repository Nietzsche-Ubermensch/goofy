import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CardItem, CropQuad, EnhancementSettings, AppState, TelemetryPayload } from './types';
import { getPresetCards } from './data/presetCards';
import { detectCardEdges } from './utils/edgeDetection';
import { telemetry } from './utils/telemetry';
import { WebGLCardRenderer } from './webgl/webglRenderer';
import { CardEditorCanvas } from './components/CardEditorCanvas';
import { ToolbarControls } from './components/ToolbarControls';
import { PresetsBar } from './components/PresetsBar';
import { KeyboardShortcutsBadge } from './components/KeyboardShortcutsBadge';
import { TelemetryAuditModal } from './components/TelemetryAuditModal';
import { LiquidGlassContainer } from './components/LiquidGlassContainer';
import Sidebar from './components/Sidebar';
import BatchCropper from './pages/BatchCropper';
import ImageGenerator from './pages/ImageGenerator';
import ChatBot from './pages/ChatBot';
import { Dashboard } from './pages/Dashboard';
import { Sparkles, Layers, Sliders, ShieldCheck, Download, Zap, RefreshCw, LayoutGrid, Layers3 } from 'lucide-react';

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
  const [currentView, setCurrentView] = useState<'cropper' | 'batch' | 'generator' | 'chat'>('cropper');
  const [cropperMode, setCropperMode] = useState<'single' | 'batch'>('single');

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
  const [telemetryPayload, setTelemetryPayload] = useState<TelemetryPayload>(
    telemetry.getPayload('Ready', 'PSA 10 Slab (Scratch Damaged)', '800x1120')
  );

  const cardEditorRef = useRef<{ exportCard: () => void }>(null);

  const activeCard = cards.find((c) => c.id === activeCardId) || cards[0];

  // Synchronize view selection when sidebar switches
  const handleViewChange = (view: 'cropper' | 'batch' | 'generator' | 'chat') => {
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
        const detectedQuad = detectCardEdges(img, settings.aspectRatio);
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
      const tempCanvas = document.createElement('canvas');
      const renderer = new WebGLCardRenderer(tempCanvas);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        const blobUrl = await renderer.exportCroppedHighRes(img, activeCard.quad, settings);

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
  const handleFileUpload = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const item: CardItem = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name.replace(/\.[^/.]+$/, ''),
          originalUrl: url,
          imageElement: img,
          width: img.width,
          height: img.height,
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
  };

  return (
    <div className="flex min-h-screen bg-[#090d16] text-slate-100 font-sans relative overflow-x-hidden">
      {/* Sidebar Navigation */}
      <Sidebar currentView={currentView === 'cropper' && cropperMode === 'batch' ? 'batch' : currentView} onViewChange={handleViewChange} />

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
              <BatchCropper />
            </main>
          )
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

        {/* Telemetry & Modal */}
        <TelemetryAuditModal
          payload={telemetryPayload}
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
        />
      </div>
    </div>
  );
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export default App;
