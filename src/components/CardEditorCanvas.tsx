import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CardItem, CropQuad, EnhancementSettings, Point, AppState } from '../types';
import { WebGLCardRenderer } from '../webgl/webglRenderer';
import { getRotatedCanvas, rotateQuad90Step } from '../utils/imageRotation';
import {
  Sparkles,
  RotateCcw,
  RotateCw,
  Grid,
  Rotate3d,
  RefreshCw,
  Compass
} from 'lucide-react';

interface CardEditorCanvasProps {
  card: CardItem;
  settings: EnhancementSettings;
  appState: AppState;
  onQuadChange: (newQuad: CropQuad) => void;
  onAutoCropTrigger: () => void;
  onRotationChange?: (newRotation: number) => void;
}

type SelectedHandle = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft' | 'quad' | null;

export const CardEditorCanvas = React.forwardRef<{ exportCard: () => void }, CardEditorCanvasProps>(({
  card,
  settings,
  appState,
  onQuadChange,
  onAutoCropTrigger,
  onRotationChange
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<WebGLCardRenderer | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const currentRotatedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [rotation, setRotation] = useState<number>(card.rotation || 0);
  const [showAlignmentGrid, setShowAlignmentGrid] = useState<boolean>(false);
  const [isStraightenExpanded, setIsStraightenExpanded] = useState<boolean>(true);

  // Sync state if card changes
  useEffect(() => {
    setRotation(card.rotation || 0);
  }, [card.id, card.rotation]);

  React.useImperativeHandle(ref, () => ({
    exportCard: async () => {
      const source = currentRotatedCanvasRef.current || card.imageElement;
      if (!rendererRef.current || !source) return;
      const blobUrl = await rendererRef.current.exportCroppedHighRes(source, card.quad, settings);
      
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

  // Update rotated image representation and load into WebGL
  const applyRotation = useCallback((angleDeg: number) => {
    if (!baseImageRef.current) return;
    const rotatedCanvas = getRotatedCanvas(baseImageRef.current, angleDeg);
    currentRotatedCanvasRef.current = rotatedCanvas;
    card.imageElement = rotatedCanvas as any;
    card.width = rotatedCanvas.width;
    card.height = rotatedCanvas.height;

    if (rendererRef.current) {
      rendererRef.current.loadSourceImage(rotatedCanvas);
      rendererRef.current.render(settings);
    }
    drawOverlay();
  }, [card, settings]);

  // Initialize WebGL Renderer & load base unrotated image
  useEffect(() => {
    if (!webglCanvasRef.current) return;
    if (!rendererRef.current) {
      rendererRef.current = new WebGLCardRenderer(webglCanvasRef.current);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      baseImageRef.current = img;
      const currentAngle = card.rotation || 0;
      const rotatedCanvas = getRotatedCanvas(img, currentAngle);
      currentRotatedCanvasRef.current = rotatedCanvas;

      card.imageElement = rotatedCanvas as any;
      card.width = rotatedCanvas.width;
      card.height = rotatedCanvas.height;

      if (rendererRef.current) {
        rendererRef.current.loadSourceImage(rotatedCanvas);
        rendererRef.current.render(settings);
      }
      drawOverlay();
    };
    img.src = card.originalUrl;
  }, [card.id, card.originalUrl]);

  // When rotation angle changes, update the rotated image representation
  useEffect(() => {
    if (baseImageRef.current) {
      applyRotation(rotation);
    }
  }, [rotation, applyRotation]);

  // Re-render WebGL when settings change
  useEffect(() => {
    if (rendererRef.current && (currentRotatedCanvasRef.current || card.imageElement)) {
      rendererRef.current.render(settings);
    }
    drawOverlay();
  }, [settings, card.quad, containerSize, showAlignmentGrid]);

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

  // Update rotation angle handler
  const handleSetRotation = (newAngle: number, rotateQuad: boolean = false, clockwise: boolean = true) => {
    // Keep angle normalized between -180 and 180 or rounded to 1 decimal
    const normalized = Math.round((((newAngle + 180) % 360) - 180) * 10) / 10;
    setRotation(normalized);
    if (onRotationChange) {
      onRotationChange(normalized);
    }
    if (rotateQuad) {
      const updatedQuad = rotateQuad90Step(card.quad, clockwise);
      onQuadChange(updatedQuad);
    }
  };

  const handleRotate90CCW = () => {
    handleSetRotation(rotation - 90, true, false);
  };

  const handleRotate90CW = () => {
    handleSetRotation(rotation + 90, true, true);
  };

  const handleFineTuneChange = (delta: number) => {
    const next = Math.round((rotation + delta) * 10) / 10;
    handleSetRotation(next, false);
  };

  const handleResetRotation = () => {
    handleSetRotation(0, false);
  };

  // Listen to keyboard shortcuts for rotation & alignment grid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Hotkey: '[' = Rotate 90 CCW
      if (e.key === '[') {
        e.preventDefault();
        handleRotate90CCW();
        return;
      }

      // Hotkey: ']' = Rotate 90 CW
      if (e.key === ']') {
        e.preventDefault();
        handleRotate90CW();
        return;
      }

      // Hotkey: 'g' or 'G' = Toggle Alignment Grid
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setShowAlignmentGrid((prev) => !prev);
        return;
      }

      // Hotkey: Alt + Left = Fine rotate -0.5 deg
      if (e.altKey && e.code === 'ArrowLeft') {
        e.preventDefault();
        handleFineTuneChange(-0.5);
        return;
      }

      // Hotkey: Alt + Right = Fine rotate +0.5 deg
      if (e.altKey && e.code === 'ArrowRight') {
        e.preventDefault();
        handleFineTuneChange(0.5);
        return;
      }

      // Hotkey: Shift + R = Reset rotation
      if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        handleResetRotation();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rotation, card.quad]);

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

    // Optional Fine Alignment Grid for Straightening Skewed Scans
    if (showAlignmentGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.12)';
      ctx.lineWidth = 1.0;
      const gridSize = 40;
      for (let x = 0; x <= w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center crosshair guides
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.restore();
    }

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
  }, [card.quad, selectedHandle, containerSize, showAlignmentGrid]);

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
      className="relative w-full h-full min-h-[520px] flex items-center justify-center overflow-hidden rounded-2xl bg-[#070b14] border border-slate-800 select-none shadow-2xl"
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

      {/* Top Right Quick Auto-Crop & Tools */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={() => setShowAlignmentGrid((prev) => !prev)}
          title="Toggle Straighten Alignment Grid (G)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border transition-all shadow-md active:scale-95 ${
            showAlignmentGrid
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_12px_rgba(0,243,255,0.25)]'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700/80'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Grid (G)</span>
        </button>

        <button
          onClick={onAutoCropTrigger}
          title="Auto-Detect Card Edge (Spacebar)"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 hover:text-white text-xs font-semibold backdrop-blur-md transition-all shadow-md active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Auto Snap Edge (Space)</span>
        </button>
      </div>

      {/* Floating Manual Rotation & Straighten Toolbar (Top Center) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-lg text-xs font-mono text-slate-300">
          {/* Rotate 90 CCW */}
          <button
            onClick={handleRotate90CCW}
            title="Rotate 90° Counter-Clockwise (Key: [ )"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600/40 text-slate-300 hover:text-white border border-slate-700/60 hover:border-indigo-400/40 transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
            <span>-90°</span>
          </button>

          {/* Rotate 90 CW */}
          <button
            onClick={handleRotate90CW}
            title="Rotate 90° Clockwise (Key: ] )"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600/40 text-slate-300 hover:text-white border border-slate-700/60 hover:border-indigo-400/40 transition-all active:scale-95"
          >
            <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>+90°</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-700/80 mx-0.5" />

          {/* Expand/Collapse Fine Straighten Tool */}
          <button
            onClick={() => setIsStraightenExpanded((prev) => !prev)}
            title="Fine-Tune Angle & Skew Correction"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all border ${
              isStraightenExpanded
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{rotation > 0 ? `+${rotation.toFixed(1)}°` : `${rotation.toFixed(1)}°`}</span>
          </button>

          {/* Reset button if rotated */}
          {Math.abs(rotation) > 0.05 && (
            <button
              onClick={handleResetRotation}
              title="Reset Rotation Angle to 0° (Shift+R)"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              <span>0°</span>
            </button>
          )}
        </div>

        {/* Expanded Fine-Tune Straighten Sub-Bar */}
        {isStraightenExpanded && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-indigo-500/30 shadow-xl text-xs font-mono animate-in fade-in slide-in-from-top-1 duration-200">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Rotate3d className="w-3 h-3 text-indigo-400" />
              Straighten:
            </span>

            {/* Stepper Down -0.5 */}
            <button
              onClick={() => handleFineTuneChange(-0.5)}
              title="Fine tilt -0.5° (Alt + ←)"
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px]"
            >
              -0.5°
            </button>

            {/* Fine Range Slider (-45 to +45) */}
            <input
              type="range"
              min="-45.0"
              max="45.0"
              step="0.1"
              value={rotation % 90 > 45 ? (rotation % 90) - 90 : rotation % 90 < -45 ? (rotation % 90) + 90 : rotation % 90}
              onChange={(e) => {
                const base90 = Math.round(rotation / 90) * 90;
                const fineAngle = parseFloat(e.target.value);
                handleSetRotation(base90 + fineAngle, false);
              }}
              title="Drag to fine-tune skew angle"
              className="w-28 sm:w-36 accent-indigo-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />

            {/* Stepper Up +0.5 */}
            <button
              onClick={() => handleFineTuneChange(0.5)}
              title="Fine tilt +0.5° (Alt + →)"
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px]"
            >
              +0.5°
            </button>

            <span className="text-cyan-300 font-bold min-w-[45px] text-right">
              {rotation > 0 ? `+${rotation.toFixed(1)}°` : `${rotation.toFixed(1)}°`}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Center Active Handle Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs text-slate-400 font-mono flex items-center gap-3 shadow-md">
        <span>Active Corner: <strong className="text-indigo-300">{selectedHandle || 'topLeft'}</strong></span>
        <span>•</span>
        <span>Rotate: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">[ / ]</kbd></span>
        <span>•</span>
        <span>Nudge: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Shift + Arrows</kbd></span>
      </div>
    </div>
  );
});

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
