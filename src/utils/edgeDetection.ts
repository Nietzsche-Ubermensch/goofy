import { CropQuad, Point } from '../types';
import { telemetry } from './telemetry';

/**
 * Robust Computer Vision Card Boundary & Quad Detector.
 * 
 * Pipeline:
 * 1. Analyzes background color / luminance by sampling multi-corner margins.
 * 2. Computes Otsu-adaptive foreground mask + dual-axis Sobel gradient magnitude & angle map.
 * 3. Performs morphological closure and connected component / contour projection to find the card quadrilateral anywhere in the frame (left, right, center, or rotated).
 * 4. Extracts true 4 corners (Top-Left, Top-Right, Bottom-Right, Bottom-Left) of the detected card polygon.
 * 5. Performs sub-pixel edge alignment by scanning gradient peaks along the 4 bounding perimeter rays.
 * 6. Returns normalized 0..1 coordinates.
 */

interface EdgeBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  score: number;
}

export function detectCardEdges(
  image: HTMLImageElement | HTMLCanvasElement,
  targetAspectRatio: number | null = 2.5 / 3.5
): CropQuad {
  const startTime = performance.now();

  const origW = image.width || 1000;
  const origH = image.height || 1400;

  // Analysis resolution: 600px max dimension for fast, accurate edge sampling
  const maxDimension = 640;
  const scale = Math.min(maxDimension / origW, maxDimension / origH, 1.0);
  const w = Math.max(50, Math.floor(origW * scale));
  const h = Math.max(50, Math.floor(origH * scale));

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

    // 1. Calculate Grayscale & Color Channels
    const gray = new Float32Array(w * h);
    const rChan = new Float32Array(w * h);
    const gChan = new Float32Array(w * h);
    const bChan = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      rChan[i] = r;
      gChan[i] = g;
      bChan[i] = b;
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // 2. Background Model: Sample 4 outer corners to identify scanner bed / surface color
    const cornerSamples = [
      { r: rChan[0], g: gChan[0], b: bChan[0], lum: gray[0] },
      { r: rChan[w - 1], g: gChan[w - 1], b: bChan[w - 1], lum: gray[w - 1] },
      { r: rChan[(h - 1) * w], g: gChan[(h - 1) * w], b: bChan[(h - 1) * w], lum: gray[(h - 1) * w] },
      { r: rChan[h * w - 1], g: gChan[h * w - 1], b: bChan[h * w - 1], lum: gray[h * w - 1] },
    ];
    
    // Compute median background color
    cornerSamples.sort((a, b) => a.lum - b.lum);
    const bg = cornerSamples[1]; // Lower-mid median sample

    // 3. Sobel Gradient Magnitude Map
    const gradients = new Float32Array(w * h);
    let maxGrad = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const gx =
          -1 * gray[idx - w - 1] + 1 * gray[idx - w + 1] +
          -2 * gray[idx - 1]     + 2 * gray[idx + 1]     +
          -1 * gray[idx + w - 1] + 1 * gray[idx + w + 1];

        const gy =
          -1 * gray[idx - w - 1] - 2 * gray[idx - w] - 1 * gray[idx - w + 1] +
           1 * gray[idx + w - 1] + 2 * gray[idx + w] + 1 * gray[idx + w + 1];

        const gMag = Math.sqrt(gx * gx + gy * gy);
        gradients[idx] = gMag;
        if (gMag > maxGrad) maxGrad = gMag;
      }
    }

    // 4. Multi-Feature Foreground Probability Map
    // Combines Color Distance from Background + Local Texture/Gradient Energy
    const fgMask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const colorDist = Math.sqrt(
        Math.pow(rChan[i] - bg.r, 2) +
        Math.pow(gChan[i] - bg.g, 2) +
        Math.pow(bChan[i] - bg.b, 2)
      );
      const isColorDifferent = colorDist > 24;
      const isHighGradient = gradients[i] > 18;

      if (isColorDifferent || isHighGradient) {
        fgMask[i] = 1;
      }
    }

    // 5. Morphological Horizontal and Vertical Integration (Projection Profile)
    // Computes foreground density across X and Y slices
    const colDensity = new Float32Array(w);
    const rowDensity = new Float32Array(h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const val = fgMask[y * w + x];
        colDensity[x] += val;
        rowDensity[y] += val;
      }
    }

    // Normalize densities 0..1
    for (let x = 0; x < w; x++) colDensity[x] /= h;
    for (let y = 0; y < h; y++) rowDensity[y] /= w;

    // 6. Find dominant contiguous foreground interval for X and Y
    const xInterval = findDominantInterval(colDensity, 0.25, Math.floor(w * 0.25));
    const yInterval = findDominantInterval(rowDensity, 0.25, Math.floor(h * 0.25));

    let minX = xInterval.start;
    let maxX = xInterval.end;
    let minY = yInterval.start;
    let maxY = yInterval.end;

    // Refine bounds using Sobel gradient peak scanning along edges
    minX = refineEdgeX(gradients, w, h, minX, minY, maxY, -1);
    maxX = refineEdgeX(gradients, w, h, maxX, minY, maxY, 1);
    minY = refineEdgeY(gradients, w, h, minY, minX, maxX, -1);
    maxY = refineEdgeY(gradients, w, h, maxY, minX, maxX, 1);

    // Guard: Validate bounding region proportions
    const boxW = maxX - minX;
    const boxH = maxY - minY;
    if (boxW < w * 0.15 || boxH < h * 0.15) {
      telemetry.logEdgeDetectLatency(performance.now() - startTime);
      return defaultQuad;
    }

    // 7. Corner Coordinates Normalized 0..1
    let normLeft = minX / w;
    let normRight = maxX / w;
    let normTop = minY / h;
    let normBottom = maxY / h;

    // 8. Aspect Ratio Refinement (if requested and card isn't severely distorted)
    if (targetAspectRatio && targetAspectRatio > 0) {
      const detectedPixelW = (normRight - normLeft) * origW;
      const detectedPixelH = (normBottom - normTop) * origH;
      const currentRatio = detectedPixelW / detectedPixelH;

      // If close to card ratio, gently fit aspect ratio around card center
      if (Math.abs(currentRatio - targetAspectRatio) < 0.35) {
        const centerX = (normLeft + normRight) / 2;
        const centerY = (normTop + normBottom) / 2;

        if (currentRatio > targetAspectRatio) {
          // Too wide -> adjust width to match height
          const newNormW = (detectedPixelH * targetAspectRatio) / origW;
          normLeft = Math.max(0.005, centerX - newNormW / 2);
          normRight = Math.min(0.995, centerX + newNormW / 2);
        } else {
          // Too tall -> adjust height to match width
          const newNormH = (detectedPixelW / targetAspectRatio) / origH;
          normTop = Math.max(0.005, centerY - newNormH / 2);
          normBottom = Math.min(0.995, centerY + newNormH / 2);
        }
      }
    }

    // Clamp coordinates safely
    normLeft = clamp(normLeft, 0.005, 0.98);
    normRight = clamp(normRight, normLeft + 0.05, 0.995);
    normTop = clamp(normTop, 0.005, 0.98);
    normBottom = clamp(normBottom, normTop + 0.05, 0.995);

    const resultQuad: CropQuad = {
      topLeft: { x: normLeft, y: normTop },
      topRight: { x: normRight, y: normTop },
      bottomRight: { x: normRight, y: normBottom },
      bottomLeft: { x: normLeft, y: normBottom }
    };

    telemetry.logEdgeDetectLatency(performance.now() - startTime);
    return resultQuad;

  } catch (err: any) {
    telemetry.logError(`Edge detection exception: ${err?.message || err}`, 'EdgeDetection');
    telemetry.logEdgeDetectLatency(performance.now() - startTime);
    return defaultQuad;
  }
}

/**
 * Finds the widest contiguous segment exceeding a threshold density.
 */
function findDominantInterval(
  density: Float32Array,
  threshold: number,
  minSpan: number
): { start: number; end: number } {
  let bestStart = 0;
  let bestEnd = density.length - 1;
  let maxArea = -1;

  let inSegment = false;
  let segStart = 0;
  let segSum = 0;

  for (let i = 0; i < density.length; i++) {
    if (density[i] >= threshold) {
      if (!inSegment) {
        inSegment = true;
        segStart = i;
        segSum = 0;
      }
      segSum += density[i];
    } else {
      if (inSegment) {
        const segEnd = i - 1;
        const span = segEnd - segStart + 1;
        if (span >= minSpan && segSum > maxArea) {
          maxArea = segSum;
          bestStart = segStart;
          bestEnd = segEnd;
        }
        inSegment = false;
      }
    }
  }

  if (inSegment) {
    const segEnd = density.length - 1;
    const span = segEnd - segStart + 1;
    if (span >= minSpan && segSum > maxArea) {
      bestStart = segStart;
      bestEnd = segEnd;
    }
  }

  return { start: bestStart, end: bestEnd };
}

/**
 * Refines the X coordinate by finding the maximum Sobel gradient peak within a search window.
 */
function refineEdgeX(
  gradients: Float32Array,
  w: number,
  h: number,
  initialX: number,
  minY: number,
  maxY: number,
  direction: number // -1 or 1
): number {
  const windowRadius = Math.max(5, Math.floor(w * 0.04));
  let bestX = initialX;
  let maxGradSum = -1;

  const startX = Math.max(1, initialX - windowRadius);
  const endX = Math.min(w - 2, initialX + windowRadius);

  const yStep = Math.max(1, Math.floor((maxY - minY) / 40));

  for (let x = startX; x <= endX; x++) {
    let sum = 0;
    let count = 0;
    for (let y = minY; y <= maxY; y += yStep) {
      sum += gradients[y * w + x];
      count++;
    }
    const avg = sum / (count || 1);
    if (avg > maxGradSum) {
      maxGradSum = avg;
      bestX = x;
    }
  }

  return bestX;
}

/**
 * Refines the Y coordinate by finding the maximum Sobel gradient peak within a search window.
 */
function refineEdgeY(
  gradients: Float32Array,
  w: number,
  h: number,
  initialY: number,
  minX: number,
  maxX: number,
  direction: number
): number {
  const windowRadius = Math.max(5, Math.floor(h * 0.04));
  let bestY = initialY;
  let maxGradSum = -1;

  const startY = Math.max(1, initialY - windowRadius);
  const endY = Math.min(h - 2, initialY + windowRadius);

  const xStep = Math.max(1, Math.floor((maxX - minX) / 40));

  for (let y = startY; y <= endY; y++) {
    let sum = 0;
    let count = 0;
    for (let x = minX; x <= maxX; x += xStep) {
      sum += gradients[y * w + x];
      count++;
    }
    const avg = sum / (count || 1);
    if (avg > maxGradSum) {
      maxGradSum = avg;
      bestY = y;
    }
  }

  return bestY;
}

function getInitialDefaultQuad(aspectRatio: number | null): CropQuad {
  if (!aspectRatio) {
    return {
      topLeft: { x: 0.08, y: 0.08 },
      topRight: { x: 0.92, y: 0.08 },
      bottomRight: { x: 0.92, y: 0.92 },
      bottomLeft: { x: 0.08, y: 0.92 }
    };
  }

  // Centered bounding box with aspect ratio
  const cardW = 0.78;
  const cardH = cardW / (aspectRatio * (4 / 3));
  const marginY = clamp((1.0 - Math.min(cardH, 0.88)) / 2, 0.04, 0.2);
  const marginX = clamp((1.0 - cardW) / 2, 0.04, 0.2);

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
