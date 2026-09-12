import { useState, useCallback, useRef } from 'react';
import { ComparisonMode } from '../types';

export function useComparisonSlider() {
  const [mode, setMode] = useState<ComparisonMode>('slider');
  const [sliderPos, setSliderPos] = useState(50); // percentage 0..100
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [showLoupe, setShowLoupe] = useState(false);

  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const resetView = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setSliderPos(50);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(z => Math.min(4.0, z + 0.25));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(z => Math.max(0.5, z - 0.25));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) { // Middle click or Alt+Drag to pan
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y
      });
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return {
    mode,
    setMode,
    sliderPos,
    setSliderPos,
    zoom,
    setZoom,
    pan,
    setPan,
    isPanning,
    loupePos,
    setLoupePos,
    showLoupe,
    setShowLoupe,
    resetView,
    zoomIn,
    zoomOut,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
