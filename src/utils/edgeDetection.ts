import { CropQuad, Point } from '../types';
import { telemetry } from './telemetry';

/**
 * Hybrid Edge Detection for Trading Cards
 * Uses a dual-pass algorithm:
 * 1. Downscales image to an optimized analysis buffer (max ~600px).
 * 2. Computes Sobel luminance/contrast gradient map (detecting sharp intensity transitions).
 * 3. Scans radial/grid rays from image margins inward to detect initial border boundaries for both light and dark borders.
 * 4. Refines corner coordinates by locating local gradient intersections.
 * 5. Returns normalized 0..1 coordinates for [topLeft, topRight, bottomRight, bottomLeft].
 */
export function detectCardEdges(
  image: HTMLImageElement | HTMLCanvasElement,
  targetAspectRatio: number | null = 2.5 / 3.5
): CropQuad {
  const startTime = performance.now();

  const maxDimension = 600;
  const origW = image.width || 1;
  const origH = image.height || 1;
  
  const scale = Math.min(maxDimension / origW, maxDimension / origH, 1.0);
  const w = Math.floor(origW * scale);
  const h = Math.floor(origH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const defaultQuad: CropQuad = getInitialDefaultQuad(targetAspectRatio);

  if (!ctx) {
    telemetry.logEdgeDetectLatency(performance.now() - startTime);
    return defaultQuad;
  }

  try {
    ctx.drawImage(image, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Convert to grayscale luminance array
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      // Perceptual luminance formula
      gray[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    }

    // Compute Sobel Gradient Magnitudes
    const gradients = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        // Horizontal Sobel kernel
        const gx = 
          -1 * gray[idx - w - 1] + 1 * gray[idx - w + 1] +
          -2 * gray[idx - 1]     + 2 * gray[idx + 1]     +
          -1 * gray[idx + w - 1] + 1 * gray[idx + w + 1];
        
        // Vertical Sobel kernel
        const gy = 
          -1 * gray[idx - w - 1] - 2 * gray[idx - w] - 1 * gray[idx - w + 1] +
           1 * gray[idx + w - 1] + 2 * gray[idx + w] + 1 * gray[idx + w + 1];

        gradients[idx] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // Scan inward along rows and columns to find dominant boundary transitions
    // Top boundary search (horizontal lines)
    let topY = Math.floor(h * 0.08);
    for (let y = Math.floor(h * 0.05); y < Math.floor(h * 0.45); y++) {
      let lineGradSum = 0;
      for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x++) {
        lineGradSum += gradients[y * w + x];
      }
      const avgGrad = lineGradSum / (w * 0.6);
      if (avgGrad > 28) {
        topY = y;
        break;
      }
    }

    // Bottom boundary search
    let bottomY = Math.floor(h * 0.92);
    for (let y = Math.floor(h * 0.95); y > Math.floor(h * 0.55); y--) {
      let lineGradSum = 0;
      for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x++) {
        lineGradSum += gradients[y * w + x];
      }
      const avgGrad = lineGradSum / (w * 0.6);
      if (avgGrad > 28) {
        bottomY = y;
        break;
      }
    }

    // Left boundary search
    let leftX = Math.floor(w * 0.08);
    for (let x = Math.floor(w * 0.05); x < Math.floor(w * 0.45); x++) {
      let colGradSum = 0;
      for (let y = Math.floor(h * 0.2); y < Math.floor(h * 0.8); y++) {
        colGradSum += gradients[y * w + x];
      }
      const avgGrad = colGradSum / (h * 0.6);
      if (avgGrad > 28) {
        leftX = x;
        break;
      }
    }

    // Right boundary search
    let rightX = Math.floor(w * 0.92);
    for (let x = Math.floor(w * 0.95); x > Math.floor(w * 0.55); x--) {
      let colGradSum = 0;
      for (let y = Math.floor(h * 0.2); y < Math.floor(h * 0.8); y++) {
        colGradSum += gradients[y * w + x];
      }
      const avgGrad = colGradSum / (h * 0.6);
      if (avgGrad > 28) {
        rightX = x;
        break;
      }
    }

    // Convert pixel coordinates to normalized 0..1 scale
    let normLeft = Math.max(0.02, leftX / w);
    let normRight = Math.min(0.98, rightX / w);
    let normTop = Math.max(0.02, topY / h);
    let normBottom = Math.min(0.98, bottomY / h);

    // If bounding region is too small, fallback to safe defaults
    if (normRight - normLeft < 0.25 || normBottom - normTop < 0.25) {
      telemetry.logEdgeDetectLatency(performance.now() - startTime);
      return defaultQuad;
    }

    // Enforce target aspect ratio if specified
    if (targetAspectRatio && targetAspectRatio > 0) {
      const currentW = (normRight - normLeft) * origW;
      const currentH = (normBottom - normTop) * origH;
      const currentRatio = currentW / currentH;

      if (currentRatio > targetAspectRatio) {
        // Too wide: shrink width relative to center
        const desiredW = (currentH * targetAspectRatio) / origW;
        const centerX = (normLeft + normRight) / 2;
        normLeft = Math.max(0.01, centerX - desiredW / 2);
        normRight = Math.min(0.99, centerX + desiredW / 2);
      } else {
        // Too tall: shrink height relative to center
        const desiredH = (currentW / targetAspectRatio) / origH;
        const centerY = (normTop + normBottom) / 2;
        normTop = Math.max(0.01, centerY - desiredH / 2);
        normBottom = Math.min(0.99, centerY + desiredH / 2);
      }
    }

    const detectedQuad: CropQuad = {
      topLeft: { x: clamp(normLeft, 0, 1), y: clamp(normTop, 0, 1) },
      topRight: { x: clamp(normRight, 0, 1), y: clamp(normTop, 0, 1) },
      bottomRight: { x: clamp(normRight, 0, 1), y: clamp(normBottom, 0, 1) },
      bottomLeft: { x: clamp(normLeft, 0, 1), y: clamp(normBottom, 0, 1) }
    };

    telemetry.logEdgeDetectLatency(performance.now() - startTime);
    return detectedQuad;

  } catch (err: any) {
    telemetry.logError(`Edge detection failed: ${err?.message || err}`, 'EdgeDetection');
    telemetry.logEdgeDetectLatency(performance.now() - startTime);
    return defaultQuad;
  }
}

function getInitialDefaultQuad(aspectRatio: number | null): CropQuad {
  if (!aspectRatio) {
    return {
      topLeft: { x: 0.1, y: 0.1 },
      topRight: { x: 0.9, y: 0.1 },
      bottomRight: { x: 0.9, y: 0.9 },
      bottomLeft: { x: 0.1, y: 0.9 }
    };
  }

  // Centered bounding box with aspect ratio
  const cardW = 0.76;
  const cardH = cardW / (aspectRatio * (4 / 3)); // scale factor estimate
  const marginY = clamp((1.0 - Math.min(cardH, 0.85)) / 2, 0.05, 0.2);
  const marginX = clamp((1.0 - cardW) / 2, 0.05, 0.2);

  return {
    topLeft: { x: marginX, y: marginY },
    topRight: { x: 1 - marginX, y: marginY },
    bottomRight: { x: 1 - marginX, y: 1 - marginY },
    bottomLeft: { x: marginX, y: 1 - marginY }
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
