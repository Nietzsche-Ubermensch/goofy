import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CardItem, CropQuad, EnhancementSettings, Point, AppState } from '../types';
import { WebGLCardRenderer } from '../webgl/webglRenderer';
import { Sparkles } from 'lucide-react';

interface CardEditorCanvasProps {
  card: CardItem;
  settings: EnhancementSettings;
  appState: AppState;
  onQuadChange: (newQuad: CropQuad) => void;
  onAutoCropTrigger: () => void;
}

type SelectedHandle = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft' | 'quad' | null;

export const CardEditorCanvas = React.forwardRef<{ exportCard: () => void }, CardEditorCanvasProps>(({ card, settings, appState, onQuadChange, onAutoCropTrigger }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<WebGLCardRenderer | null>(null);

  React.useImperativeHandle(ref, () => ({
    exportCard: async () => {
      if (!rendererRef.current || !card.imageElement) return;
      const blobUrl = await rendererRef.current.exportCroppedHighRes(card.imageElement, card.quad, settings);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${card.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_enhanced.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }));

  const [selectedHandle, setSelectedHandle] = useState<SelectedHandle>('topLeft');
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialQuad: CropQuad }>({
    mouseX: 0,
    mouseY: 0,
    initialQuad: { ...card.quad }
  });

  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  // Initialize WebGL Renderer & load image
  useEffect(() => {
    if (!webglCanvasRef.current) return;
    if (!rendererRef.current) {
      rendererRef.current = new WebGLCardRenderer(webglCanvasRef.current);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      card.imageElement = img;
      card.width = img.width;
      card.height = img.height;
      if (rendererRef.current) {
        rendererRef.current.loadSourceImage(img);
        rendererRef.current.render(settings);
      }
      drawOverlay();
    };
    img.src = card.originalUrl;
  }, [card.id, card.originalUrl]);

  // Re-render WebGL when settings change
  useEffect(() => {
    if (rendererRef.current && card.imageElement) {
      rendererRef.current.render(settings);
    }
    drawOverlay();
  }, [settings, card.quad, containerSize]);

  // Handle ResizeObserver for dynamic stage sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Draw crop handle overlay lines and handles
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = containerSize.width;
    const h = containerSize.height;

    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    const quad = card.quad;
    const tl = { x: quad.topLeft.x * w, y: quad.topLeft.y * h };
    const tr = { x: quad.topRight.x * w, y: quad.topRight.y * h };
    const br = { x: quad.bottomRight.x * w, y: quad.bottomRight.y * h };
    const bl = { x: quad.bottomLeft.x * w, y: quad.bottomLeft.y * h };

    // Dim area outside cropping polygon
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fill('evenodd');

    // High contrast quad line
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.stroke();

    // Draw Rule of Thirds Inner Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.0;

    ctx.beginPath();
    for (let i = 1; i <= 2; i++) {
      const frac = i / 3;
      ctx.moveTo(tl.x + (bl.x - tl.x) * frac, tl.y + (bl.y - tl.y) * frac);
      ctx.lineTo(tr.x + (br.x - tr.x) * frac, tr.y + (br.y - tr.y) * frac);
    }
    for (let i = 1; i <= 2; i++) {
      const frac = i / 3;
      ctx.moveTo(tl.x + (tr.x - tl.x) * frac, tl.y + (tr.y - tl.y) * frac);
      ctx.lineTo(bl.x + (br.x - bl.x) * frac, bl.y + (br.y - bl.y) * frac);
    }
    ctx.stroke();

    // Draw Corner Handles
    const handles: { key: SelectedHandle; pt: Point }[] = [
      { key: 'topLeft', pt: tl },
      { key: 'topRight', pt: tr },
      { key: 'bottomRight', pt: br },
      { key: 'bottomLeft', pt: bl }
    ];

    handles.forEach(({ key, pt }) => {
      const isSelected = selectedHandle === key;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 10 : 8, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#38bdf8' : '#6366f1';
      ctx.fill();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    });
  }, [card.quad, selectedHandle, containerSize]);

  // Handle Mouse Down on Corner Handles or Quad Body
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const w = containerSize.width;
    const h = containerSize.height;

    const quad = card.quad;
    const handles: { key: SelectedHandle; x: number; y: number }[] = [
      { key: 'topLeft', x: quad.topLeft.x * w, y: quad.topLeft.y * h },
      { key: 'topRight', x: quad.topRight.x * w, y: quad.topRight.y * h },
      { key: 'bottomRight', x: quad.bottomRight.x * w, y: quad.bottomRight.y * h },
      { key: 'bottomLeft', x: quad.bottomLeft.x * w, y: quad.bottomLeft.y * h }
    ];

    let clickedHandle: SelectedHandle = null;
    for (const handle of handles) {
      const dist = Math.hypot(mouseX - handle.x, mouseY - handle.y);
      if (dist <= 22) {
        clickedHandle = handle.key;
        break;
      }
    }

    if (!clickedHandle) {
      clickedHandle = 'quad';
    }

    setSelectedHandle(clickedHandle);
    setIsDragging(true);
    dragStartRef.current = {
      mouseX,
      mouseY,
      initialQuad: JSON.parse(JSON.stringify(card.quad))
    };
  };

  // Handle Dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedHandle) return;

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const w = containerSize.width;
    const h = containerSize.height;

    const deltaX = (mouseX - dragStartRef.current.mouseX) / w;
    const deltaY = (mouseY - dragStartRef.current.mouseY) / h;

    const init = dragStartRef.current.initialQuad;
    const updatedQuad: CropQuad = JSON.parse(JSON.stringify(card.quad));

    if (selectedHandle === 'quad') {
      updatedQuad.topLeft.x = clamp(init.topLeft.x + deltaX, 0, 1);
      updatedQuad.topLeft.y = clamp(init.topLeft.y + deltaY, 0, 1);
      updatedQuad.topRight.x = clamp(init.topRight.x + deltaX, 0, 1);
      updatedQuad.topRight.y = clamp(init.topRight.y + deltaY, 0, 1);
      updatedQuad.bottomRight.x = clamp(init.bottomRight.x + deltaX, 0, 1);
      updatedQuad.bottomRight.y = clamp(init.bottomRight.y + deltaY, 0, 1);
      updatedQuad.bottomLeft.x = clamp(init.bottomLeft.x + deltaX, 0, 1);
      updatedQuad.bottomLeft.y = clamp(init.bottomLeft.y + deltaY, 0, 1);
    } else {
      updatedQuad[selectedHandle].x = clamp(init[selectedHandle].x + deltaX, 0, 1);
      updatedQuad[selectedHandle].y = clamp(init[selectedHandle].y + deltaY, 0, 1);
    }

    onQuadChange(updatedQuad);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] flex items-center justify-center overflow-hidden rounded-2xl bg-[#070b14] border border-slate-800 select-none"
    >
      {/* WebGL Canvas Shader Output */}
      <canvas
        ref={webglCanvasRef}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{
          filter: `brightness(${100 + settings.brightness * 30}%) contrast(${settings.contrast * 100}%) saturate(${settings.saturation * 100}%)`
        }}
      />

      {/* Interactive Crop Handles Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="absolute inset-0 w-full h-full object-contain cursor-crosshair z-10"
      />

      {/* Top Left Status Badge */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs text-slate-300 font-mono shadow-md">
        <span className={`w-2 h-2 rounded-full ${appState === 'Ready' ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
        <span>{appState.toUpperCase()}</span>
        <span className="text-slate-600">|</span>
        <span className="text-indigo-300 font-semibold">{card.width}×{card.height} px</span>
      </div>

      {/* Top Right Quick Auto-Crop Button */}
      <button
        onClick={onAutoCropTrigger}
        title="Auto-Detect Card Edge (Spacebar)"
        className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 hover:text-white text-xs font-semibold backdrop-blur-md transition-all shadow-md active:scale-95"
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span>Auto Snap Edge (Space)</span>
      </button>

      {/* Bottom Center Active Handle Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs text-slate-400 font-mono flex items-center gap-3 shadow-md">
        <span>Active Corner: <strong className="text-indigo-300">{selectedHandle || 'topLeft'}</strong></span>
        <span>•</span>
        <span>Nudge: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Shift + Arrows</kbd></span>
      </div>
    </div>
  );
});

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
