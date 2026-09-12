import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Crop, 
  Sliders, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  RotateCw, 
  RefreshCw, 
  Check, 
  Eye, 
  Layers, 
  Maximize2,
  Wand2,
  AlertCircle,
  Award
} from 'lucide-react';
import { CardImage, CropQuad, ProcessingSettings, Point } from '../types';
import { detectCardEdges, autoCenterQuad, calculateCardCentering } from '../utils/edgeDetection';
import { processCardComplete } from '../utils/imageEnhancer';
import { getRotatedCanvas, rotateQuad90Step } from '../utils/imageRotation';

interface BatchItemEditorModalProps {
  card: CardImage | null;
  globalSettings: ProcessingSettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCard: CardImage) => void;
}

type HandleKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft' | null;

export const BatchItemEditorModal: React.FC<BatchItemEditorModalProps> = ({
  card,
  globalSettings,
  isOpen,
  onClose,
  onSave
}) => {
  if (!isOpen || !card) return null;

  // Active Quad
  const [quad, setQuad] = useState<CropQuad>(() => {
    if (card.quad) return card.quad;
    if (card.analysis?.boundingBox) {
      const [ymin, xmin, ymax, xmax] = card.analysis.boundingBox;
      return {
        topLeft: { x: xmin, y: ymin },
        topRight: { x: xmax, y: ymin },
        bottomRight: { x: xmax, y: ymax },
        bottomLeft: { x: xmin, y: ymax }
      };
    }
    return {
      topLeft: { x: 0.05, y: 0.05 },
      topRight: { x: 0.95, y: 0.05 },
      bottomRight: { x: 0.95, y: 0.95 },
      bottomLeft: { x: 0.05, y: 0.95 }
    };
  });

  const [rotation, setRotation] = useState<number>(card.rotation || 0);

  // Active Enhancement Settings (merged with customSettings if any)
  const [localSettings, setLocalSettings] = useState<ProcessingSettings>(() => ({
    ...globalSettings,
    ...(card.customSettings || {})
  }));

  const [activeTab, setActiveTab] = useState<'crop' | 'enhance' | 'preview'>('crop');
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(card.processedUrl || null);
  const [isPreviewRendering, setIsPreviewRendering] = useState<boolean>(false);

  // Canvas Refs for Interactive Quad Adjustment
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  const [selectedHandle, setSelectedHandle] = useState<HandleKey>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number; imgX: number; imgY: number; imgW: number; imgH: number }>({
    width: 600,
    height: 450,
    imgX: 0,
    imgY: 0,
    imgW: 600,
    imgH: 450
  });

  // Load Image on mount or card change
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageElementRef.current = img;
      renderImageAndOverlay();
    };
    img.src = card.previewUrl;
  }, [card.id, card.previewUrl, rotation]);

  // Handle Container Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      renderImageAndOverlay();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Recalculate Stage Layout & Render Background Image
  const renderImageAndOverlay = useCallback(() => {
    const container = containerRef.current;
    const imgCanvas = imageCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const rawImg = imageElementRef.current;

    if (!container || !imgCanvas || !overlayCanvas || !rawImg) return;

    const img = rotation ? getRotatedCanvas(rawImg, rotation) : rawImg;

    const cW = container.clientWidth || 550;
    const cH = container.clientHeight || 420;

    imgCanvas.width = cW;
    imgCanvas.height = cH;
    overlayCanvas.width = cW;
    overlayCanvas.height = cH;

    const imgAspect = img.width / img.height;
    const containerAspect = cW / cH;

    let dW = cW;
    let dH = cH;
    let dX = 0;
    let dY = 0;

    if (imgAspect > containerAspect) {
      dW = cW;
      dH = cW / imgAspect;
      dX = 0;
      dY = (cH - dH) / 2;
    } else {
      dH = cH;
      dW = cH * imgAspect;
      dX = (cW - dW) / 2;
      dY = 0;
    }

    setStageDimensions({
      width: cW,
      height: cH,
      imgX: dX,
      imgY: dY,
      imgW: dW,
      imgH: dH
    });

    const ctx = imgCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, cW, cH);
      ctx.drawImage(img, dX, dY, dW, dH);
    }

    drawQuadOverlay(quad, { imgX: dX, imgY: dY, imgW: dW, imgH: dH }, overlayCanvas);
  }, [rotation, quad]);

  // Draw Quad, Lines, Handles, and Dimensions
  const drawQuadOverlay = (
    currentQuad: CropQuad, 
    dims: { imgX: number; imgY: number; imgW: number; imgH: number },
    canvas: HTMLCanvasElement
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const toScreen = (p: Point): Point => ({
      x: dims.imgX + p.x * dims.imgW,
      y: dims.imgY + p.y * dims.imgH
    });

    const tl = toScreen(currentQuad.topLeft);
    const tr = toScreen(currentQuad.topRight);
    const br = toScreen(currentQuad.bottomRight);
    const bl = toScreen(currentQuad.bottomLeft);

    // Dimmed darkened backdrop outside quad
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cut out quad hole
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Quad Border with Neon Cyan Glow
    ctx.save();
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 243, 255, 0.8)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Rule of Thirds Inside Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 1; i <= 2; i++) {
      const t = i / 3;
      // Horizontal grid lines
      const lx1 = tl.x + (bl.x - tl.x) * t;
      const ly1 = tl.y + (bl.y - tl.y) * t;
      const lx2 = tr.x + (br.x - tr.x) * t;
      const ly2 = tr.y + (br.y - tr.y) * t;
      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
      ctx.stroke();

      // Vertical grid lines
      const vx1 = tl.x + (tr.x - tl.x) * t;
      const vy1 = tl.y + (tr.y - tl.y) * t;
      const vx2 = bl.x + (br.x - bl.x) * t;
      const vy2 = bl.y + (br.y - bl.y) * t;
      ctx.beginPath();
      ctx.moveTo(vx1, vy1);
      ctx.lineTo(vx2, vy2);
      ctx.stroke();
    }
    ctx.restore();

    // Corner Handles
    const drawHandle = (pos: Point, name: string, isSelected: boolean) => {
      ctx.save();
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = isSelected ? 12 : 6;
      ctx.fillStyle = isSelected ? '#ff00e5' : '#00f3ff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isSelected ? 9 : 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Corner Label Tag
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
      ctx.lineWidth = 1;
      const label = name === 'topLeft' ? 'TL' : name === 'topRight' ? 'TR' : name === 'bottomRight' ? 'BR' : 'BL';
      ctx.font = '9px monospace';
      const textMetrics = ctx.measureText(label);
      const tagW = textMetrics.width + 6;
      const tagH = 12;
      const offset = 14;

      let tagX = pos.x + offset;
      let tagY = pos.y + offset;
      if (name === 'topRight' || name === 'bottomRight') tagX = pos.x - offset - tagW;
      if (name === 'bottomLeft' || name === 'bottomRight') tagY = pos.y - offset;

      ctx.fillRect(tagX, tagY - 9, tagW, tagH);
      ctx.strokeRect(tagX, tagY - 9, tagW, tagH);
      ctx.fillStyle = '#00f3ff';
      ctx.fillText(label, tagX + 3, tagY);
      ctx.restore();
    };

    drawHandle(tl, 'topLeft', selectedHandle === 'topLeft');
    drawHandle(tr, 'topRight', selectedHandle === 'topRight');
    drawHandle(br, 'bottomRight', selectedHandle === 'bottomRight');
    drawHandle(bl, 'bottomLeft', selectedHandle === 'bottomLeft');
  };

  // Mouse / Touch Event Handlers for Quad
  const getHandleAtPosition = (x: number, y: number): HandleKey => {
    const toScreen = (p: Point): Point => ({
      x: stageDimensions.imgX + p.x * stageDimensions.imgW,
      y: stageDimensions.imgY + p.y * stageDimensions.imgH
    });

    const handles: { key: HandleKey; point: Point }[] = [
      { key: 'topLeft', point: toScreen(quad.topLeft) },
      { key: 'topRight', point: toScreen(quad.topRight) },
      { key: 'bottomRight', point: toScreen(quad.bottomRight) },
      { key: 'bottomLeft', point: toScreen(quad.bottomLeft) }
    ];

    const hitRadius = 24;
    for (const h of handles) {
      const dist = Math.hypot(x - h.point.x, y - h.point.y);
      if (dist <= hitRadius) return h.key;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const handle = getHandleAtPosition(x, y);
    if (handle) {
      setSelectedHandle(handle);
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!isDragging || !selectedHandle) {
      const hoverHandle = getHandleAtPosition(x, y);
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.style.cursor = hoverHandle ? 'crosshair' : 'default';
      }
      return;
    }

    // Convert screen coord to normalized 0..1 coord
    const normX = Math.max(0, Math.min(1, (x - stageDimensions.imgX) / stageDimensions.imgW));
    const normY = Math.max(0, Math.min(1, (y - stageDimensions.imgY) / stageDimensions.imgH));

    const updatedQuad = { ...quad, [selectedHandle]: { x: normX, y: normY } };
    setQuad(updatedQuad);

    if (overlayCanvasRef.current) {
      drawQuadOverlay(updatedQuad, stageDimensions, overlayCanvasRef.current);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Run Edge Auto-Detect Specifically for this card
  const handleAutoDetectCorners = () => {
    if (!imageElementRef.current) return;
    const img = rotation ? getRotatedCanvas(imageElementRef.current, rotation) : imageElementRef.current;
    const detected = detectCardEdges(img, localSettings.aspectRatio);
    setQuad(detected);
    if (overlayCanvasRef.current) {
      drawQuadOverlay(detected, stageDimensions, overlayCanvasRef.current);
    }
  };

  // Mathematically square and center the quad to 50/50 ratio
  const handleAutoCenterCard = () => {
    const centered = autoCenterQuad(quad, localSettings.aspectRatio);
    setQuad(centered);
    if (overlayCanvasRef.current) {
      drawQuadOverlay(centered, stageDimensions, overlayCanvasRef.current);
    }
  };

  // Complete one-click Restore & Center: auto-detect borders, center to 50/50, and render enhanced preview
  const handleRestoreAndCenterCard = async () => {
    if (!imageElementRef.current) return;
    const img = rotation ? getRotatedCanvas(imageElementRef.current, rotation) : imageElementRef.current;
    const detected = detectCardEdges(img, localSettings.aspectRatio);
    const centered = autoCenterQuad(detected, localSettings.aspectRatio);
    setQuad(centered);
    if (overlayCanvasRef.current) {
      drawQuadOverlay(centered, stageDimensions, overlayCanvasRef.current);
    }

    setIsPreviewRendering(true);
    try {
      const result = await processCardComplete(img, centered, localSettings);
      setLivePreviewUrl(result.blobUrl);
      setActiveTab('preview');
    } catch (e) {
      console.error("Restore and center preview failed", e);
    } finally {
      setIsPreviewRendering(false);
    }
  };

  // Reset to full frame corners
  const handleResetFullFrame = () => {
    const fullQuad: CropQuad = {
      topLeft: { x: 0.02, y: 0.02 },
      topRight: { x: 0.98, y: 0.02 },
      bottomRight: { x: 0.98, y: 0.98 },
      bottomLeft: { x: 0.02, y: 0.98 }
    };
    setQuad(fullQuad);
    if (overlayCanvasRef.current) {
      drawQuadOverlay(fullQuad, stageDimensions, overlayCanvasRef.current);
    }
  };

  // Rotate Image & Quad 90 deg clockwise
  const handleRotate = () => {
    const nextRotation = (rotation + 90) % 360;
    setRotation(nextRotation);
    setQuad(rotateQuad90Step(quad, true));
  };

  // Render Live Enhanced Preview
  const handleRenderLivePreview = async () => {
    if (!imageElementRef.current) return;
    setIsPreviewRendering(true);
    try {
      const img = rotation ? getRotatedCanvas(imageElementRef.current, rotation) : imageElementRef.current;
      const result = await processCardComplete(img, quad, localSettings);
      setLivePreviewUrl(result.blobUrl);
      setActiveTab('preview');
    } catch (e) {
      console.error("Live preview render failed", e);
    } finally {
      setIsPreviewRendering(false);
    }
  };

  // Save changes to card item and close modal
  const handleApplySave = () => {
    const updatedCard: CardImage = {
      ...card,
      quad,
      rotation,
      customSettings: {
        brightness: localSettings.brightness,
        contrast: localSettings.contrast,
        saturation: localSettings.saturation,
        vibrance: localSettings.vibrance,
        sharpen: localSettings.sharpen,
        restorationStrength: localSettings.restorationStrength,
        enableDescratching: localSettings.enableDescratching,
        microDustFilter: localSettings.microDustFilter,
        antiGlare: localSettings.antiGlare,
        chromeParallelClarity: localSettings.chromeParallelClarity
      },
      isCustomConfigured: true,
      processedUrl: livePreviewUrl || card.processedUrl
    };

    onSave(updatedCard);
    onClose();
  };

  // Reset item overrides to global batch defaults
  const handleResetToBatchDefaults = () => {
    setLocalSettings({ ...globalSettings });
    handleAutoDetectCorners();
  };

  const centering = calculateCardCentering(quad);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 holo-text">
      <div className="w-full max-w-5xl bg-black/90 holo-panel rounded-sm relative overflow-hidden flex flex-col max-h-[95vh] border border-[#00f3ff]/40 shadow-[0_0_30px_rgba(0,243,255,0.2)]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[rgba(0,243,255,0.25)] bg-black/70">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[rgba(0,243,255,0.15)] rounded-sm border border-[rgba(0,243,255,0.4)] text-[#00f3ff]">
              <Crop size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#00f3ff] font-mono truncate max-w-sm md:max-w-md">
                  {card.file.name}
                </h3>
                {card.isCustomConfigured && (
                  <span className="text-[8px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 px-1.5 py-0.5 rounded">
                    CUSTOM OVERRIDE
                  </span>
                )}
              </div>
              <span className="text-[9px] font-mono text-[rgba(0,243,255,0.6)]">
                Per-Card Quad Geometry & GPU Shader Parameter Tuning
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex bg-black/60 border border-[rgba(0,243,255,0.3)] rounded-sm p-0.5 font-mono text-[10px]">
              <button
                onClick={() => setActiveTab('crop')}
                className={`px-3 py-1 rounded-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'crop'
                    ? 'bg-[#00f3ff] text-black font-bold shadow-[0_0_8px_rgba(0,243,255,0.6)]'
                    : 'text-[rgba(0,243,255,0.7)] hover:text-[#00f3ff]'
                }`}
              >
                <Crop size={12} /> Quad Crop
              </button>
              <button
                onClick={() => setActiveTab('enhance')}
                className={`px-3 py-1 rounded-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'enhance'
                    ? 'bg-[#00f3ff] text-black font-bold shadow-[0_0_8px_rgba(0,243,255,0.6)]'
                    : 'text-[rgba(0,243,255,0.7)] hover:text-[#00f3ff]'
                }`}
              >
                <Sliders size={12} /> Intensity
              </button>
              <button
                onClick={() => {
                  setActiveTab('preview');
                  if (!livePreviewUrl) handleRenderLivePreview();
                }}
                className={`px-3 py-1 rounded-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'preview'
                    ? 'bg-[#00f3ff] text-black font-bold shadow-[0_0_8px_rgba(0,243,255,0.6)]'
                    : 'text-[rgba(0,243,255,0.7)] hover:text-[#00f3ff]'
                }`}
              >
                <Eye size={12} /> Live Preview
              </button>
            </div>

            <button 
              onClick={onClose}
              className="text-[rgba(0,243,255,0.6)] hover:text-[#00f3ff] p-1 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
          
          {/* Main Visual Stage (Canvas / Quad Editor / Live Preview) */}
          <div className="lg:col-span-7 bg-black/80 flex flex-col p-4 border-b lg:border-b-0 lg:border-r border-[rgba(0,243,255,0.2)]">
            
            {/* Quick Geometry Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-[rgba(0,243,255,0.15)]">
              <span className="text-[10px] font-mono text-[rgba(0,243,255,0.8)] flex items-center gap-1.5">
                <Maximize2 size={12} className="text-cyan-400" />
                {activeTab === 'preview' ? 'GPU Shader Render Result' : 'Drag 4 Corner Pins to Crop Card'}
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  id="btn-restore-center-modal"
                  onClick={handleRestoreAndCenterCard}
                  className="px-2.5 py-1 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-400 text-cyan-300 rounded-xs text-[10px] font-mono transition-all flex items-center gap-1 shadow-[0_0_10px_rgba(0,243,255,0.35)] font-semibold"
                  title="Detect boundaries, square 50/50 centering, and render GPU enhancement pass"
                >
                  <Sparkles size={11} className="text-cyan-300 animate-pulse" /> Restore & Center
                </button>
                <button
                  id="btn-auto-center-modal"
                  onClick={handleAutoCenterCard}
                  className="px-2.5 py-1 bg-black/60 hover:bg-[rgba(0,243,255,0.15)] border border-[rgba(0,243,255,0.4)] text-[#00f3ff] rounded-xs text-[10px] font-mono transition-all flex items-center gap-1"
                  title="Square quad and snap to 50/50 mathematical centering ratio"
                >
                  <Crop size={11} className="text-cyan-300" /> Center (50/50)
                </button>
                <button
                  onClick={handleAutoDetectCorners}
                  className="px-2.5 py-1 bg-black/60 hover:bg-[rgba(0,243,255,0.15)] border border-[rgba(0,243,255,0.4)] text-[#00f3ff] rounded-xs text-[10px] font-mono transition-all flex items-center gap-1"
                  title="Detect card borders with Sobel gradient detector"
                >
                  <Wand2 size={11} className="text-cyan-300" /> Auto-Detect
                </button>
                <button
                  onClick={handleRotate}
                  className="px-2 py-1 bg-black/60 hover:bg-[rgba(0,243,255,0.15)] border border-[rgba(0,243,255,0.4)] text-[#00f3ff] rounded-xs text-[10px] font-mono transition-all flex items-center gap-1"
                  title="Rotate image 90° clockwise"
                >
                  <RotateCw size={11} /> 90°
                </button>
                <button
                  onClick={handleResetFullFrame}
                  className="px-2 py-1 bg-black/60 hover:bg-[rgba(0,243,255,0.15)] border border-[rgba(0,243,255,0.4)] text-[rgba(0,243,255,0.8)] rounded-xs text-[10px] font-mono transition-all flex items-center gap-1"
                  title="Reset corners to full frame margins"
                >
                  <RefreshCw size={11} /> Full
                </button>
              </div>
            </div>

            {/* Stage Canvas Area */}
            <div 
              ref={containerRef} 
              className="flex-1 min-h-[350px] relative bg-black/90 rounded-sm border border-[rgba(0,243,255,0.2)] overflow-hidden flex items-center justify-center"
            >
              {activeTab === 'preview' && livePreviewUrl ? (
                <div className="w-full h-full p-2 flex flex-col items-center justify-center relative">
                  <img 
                    src={livePreviewUrl} 
                    alt="Live GPU render preview"
                    className="max-h-full max-w-full object-contain rounded-sm shadow-[0_0_20px_rgba(0,243,255,0.3)]"
                  />
                  <div className="absolute bottom-4 left-4 bg-black/80 border border-cyan-400/40 text-cyan-300 px-2 py-1 rounded text-[9px] font-mono">
                    WebGL GPU Shader Pass Applied
                  </div>
                </div>
              ) : (
                <>
                  <canvas ref={imageCanvasRef} className="absolute inset-0 pointer-events-none" />
                  <canvas 
                    ref={overlayCanvasRef} 
                    className="absolute inset-0 z-10"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  />
                </>
              )}
            </div>

            {/* Centering & Corner Coordinates Readout */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] font-mono text-[rgba(0,243,255,0.7)] border-t border-[rgba(0,243,255,0.15)] mt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-cyan-300 font-semibold">Centering:</span>
                <span className="bg-black/70 px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-200">
                  L/R: {centering.lrRatioText} ({centering.leftPct}% / {centering.rightPct}%)
                </span>
                <span className="bg-black/70 px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-200">
                  T/B: {centering.tbRatioText} ({centering.topPct}% / {centering.bottomPct}%)
                </span>
                <span className={`px-2 py-0.5 rounded border flex items-center gap-1 font-bold ${
                  centering.centeringGrade.includes('10')
                    ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300'
                    : 'bg-cyan-950/80 border-cyan-400/50 text-cyan-300'
                }`}>
                  <Award size={10} />
                  {centering.centeringGrade}
                </span>
              </div>

              <div className="text-[8px] text-slate-400 hidden sm:flex gap-2">
                <span>TL: [{quad.topLeft.x.toFixed(2)}, {quad.topLeft.y.toFixed(2)}]</span>
                <span>BR: [{quad.bottomRight.x.toFixed(2)}, {quad.bottomRight.y.toFixed(2)}]</span>
              </div>
            </div>
          </div>

          {/* Right Parameters & Tuning Sidebar */}
          <div className="lg:col-span-5 flex flex-col p-4 bg-black/60 overflow-y-auto custom-scrollbar space-y-4">
            
            <div className="flex items-center justify-between border-b border-[rgba(0,243,255,0.2)] pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#00f3ff] font-mono flex items-center gap-1.5">
                <Sliders size={13} /> Card Override Parameters
              </span>
              <button
                onClick={handleResetToBatchDefaults}
                className="text-[9px] font-mono text-[rgba(0,243,255,0.7)] hover:text-[#00f3ff] underline"
              >
                Reset to Batch Defaults
              </button>
            </div>

            {/* Restoration Intensity */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[rgba(0,243,255,0.8)] font-bold">Restoration Intensity</span>
                <span className="text-[#00f3ff] bg-black/80 px-1.5 py-0.5 rounded border border-[rgba(0,243,255,0.3)]">
                  {Math.round(localSettings.restorationStrength * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={localSettings.restorationStrength}
                onChange={(e) => setLocalSettings({...localSettings, restorationStrength: parseFloat(e.target.value)})}
                className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer"
              />
            </div>

            {/* Manual Color & Shader Sliders */}
            <div className="p-3 bg-black/40 border border-[rgba(0,243,255,0.25)] rounded-sm space-y-3 holo-border">
              {/* Sharpening */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[9.5px] font-mono">
                  <span className="text-[rgba(0,243,255,0.8)]">Sharpening</span>
                  <span className="text-[#00f3ff]">{Math.round(localSettings.sharpen * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={localSettings.sharpen}
                  onChange={(e) => setLocalSettings({...localSettings, sharpen: parseFloat(e.target.value)})}
                  className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[9.5px] font-mono">
                  <span className="text-[rgba(0,243,255,0.8)]">Contrast</span>
                  <span className="text-[#00f3ff]">{localSettings.contrast.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.5"
                  step="0.05"
                  value={localSettings.contrast}
                  onChange={(e) => setLocalSettings({...localSettings, contrast: parseFloat(e.target.value)})}
                  className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer"
                />
              </div>

              {/* Vibrance */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[9.5px] font-mono">
                  <span className="text-[rgba(0,243,255,0.8)]">Vibrance / Color Balance</span>
                  <span className="text-[#00f3ff]">
                    {localSettings.vibrance > 0 ? `+${localSettings.vibrance.toFixed(2)}` : localSettings.vibrance.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.3"
                  max="0.5"
                  step="0.05"
                  value={localSettings.vibrance}
                  onChange={(e) => setLocalSettings({...localSettings, vibrance: parseFloat(e.target.value)})}
                  className="w-full accent-[#00f3ff] h-1 bg-[rgba(0,243,255,0.2)] rounded-none appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Specialized Scanner Flaw Filters */}
            <div className="space-y-2">
              <label className="flex items-center justify-between p-2 bg-black/40 rounded-sm border border-[rgba(0,243,255,0.25)] cursor-pointer hover:border-[#00f3ff] transition-colors holo-border">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-[#00f3ff] flex items-center gap-1.5">
                    <ShieldCheck size={11} className="text-cyan-400" /> Micro-Dust & Speckle Filter
                  </span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!localSettings.microDustFilter}
                  onChange={(e) => setLocalSettings({...localSettings, microDustFilter: e.target.checked})}
                  className="w-3.5 h-3.5 accent-[#00f3ff] bg-black/60 border border-[rgba(0,243,255,0.5)] rounded-sm"
                />
              </label>

              <label className="flex items-center justify-between p-2 bg-black/40 rounded-sm border border-[rgba(0,243,255,0.25)] cursor-pointer hover:border-[#00f3ff] transition-colors holo-border">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-[#00f3ff] flex items-center gap-1.5">
                    <Zap size={11} className="text-amber-400" /> Anti-Glare Equalizer
                  </span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!localSettings.antiGlare}
                  onChange={(e) => setLocalSettings({...localSettings, antiGlare: e.target.checked})}
                  className="w-3.5 h-3.5 accent-[#00f3ff] bg-black/60 border border-[rgba(0,243,255,0.5)] rounded-sm"
                />
              </label>

              <label className="flex items-center justify-between p-2 bg-black/40 rounded-sm border border-[rgba(0,243,255,0.25)] cursor-pointer hover:border-[#00f3ff] transition-colors holo-border">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-[#00f3ff] flex items-center gap-1.5">
                    <Sparkles size={11} className="text-purple-400" /> Holographic / Refractor Clarity
                  </span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!localSettings.chromeParallelClarity}
                  onChange={(e) => setLocalSettings({...localSettings, chromeParallelClarity: e.target.checked})}
                  className="w-3.5 h-3.5 accent-[#00f3ff] bg-black/60 border border-[rgba(0,243,255,0.5)] rounded-sm"
                />
              </label>
            </div>

            {/* Test Render Live Preview Action */}
            <button
              onClick={handleRenderLivePreview}
              disabled={isPreviewRendering}
              className="w-full py-2 bg-black/70 hover:bg-[rgba(0,243,255,0.2)] border border-[rgba(0,243,255,0.4)] text-[#00f3ff] rounded-sm text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(0,243,255,0.2)]"
            >
              {isPreviewRendering ? <RefreshCw size={13} className="animate-spin text-cyan-300" /> : <Eye size={13} />}
              {isPreviewRendering ? 'RENDERING SHADERS...' : 'TEST RENDER (GPU PREVIEW)'}
            </button>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-[rgba(0,243,255,0.25)] bg-black/80 flex items-center justify-between">
          <span className="text-[9px] font-mono text-[rgba(0,243,255,0.6)]">
            Changes will be stored exclusively for this queue card and preserved during batch export.
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-sm text-xs font-mono text-[rgba(0,243,255,0.7)] hover:text-[#00f3ff] hover:bg-black/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplySave}
              className="px-5 py-1.5 bg-gradient-to-r from-[rgba(0,243,255,0.25)] to-[rgba(255,0,229,0.25)] hover:from-[rgba(0,243,255,0.4)] hover:to-[rgba(255,0,229,0.4)] border border-[#00f3ff] text-[#00f3ff] rounded-sm text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-[0_0_12px_rgba(0,243,255,0.3)]"
            >
              <Check size={14} className="text-[#00f3ff]" />
              APPLY & SAVE TO ITEM
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
