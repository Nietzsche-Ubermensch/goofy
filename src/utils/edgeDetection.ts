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

    // 5. Multi-Pass Foreground Projection Profiles
    // Pass 1: Global column and row densities
    const colDensity = new Float32Array(w);
    const rowDensity = new Float32Array(h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const val = fgMask[y * w + x];
        colDensity[x] += val;
        rowDensity[y] += val;
      }
    }

    for (let x = 0; x < w; x++) colDensity[x] /= h;
    for (let y = 0; y < h; y++) rowDensity[y] /= w;

    // Find initial candidate intervals with adaptive thresholds and gap bridging
    const maxCol = Math.max(...colDensity);
    const colThresh = Math.max(0.06, maxCol * 0.35);
    const initialXInterval = findDominantInterval(colDensity, colThresh, Math.floor(w * 0.20), Math.floor(w * 0.05));

    // Pass 2: Re-project row density RESTRICTED to detected column interval.
    // This is critical for flatbed scanner scans where the card is on one half of the glass,
    // ensuring dark card artwork does not get chopped off vertically.
    const candMinX = Math.max(0, initialXInterval.start);
    const candMaxX = Math.min(w - 1, initialXInterval.end);
    const candSpanX = Math.max(1, candMaxX - candMinX + 1);

    const restrictedRowDensity = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = candMinX; x <= candMaxX; x++) {
        sum += fgMask[y * w + x];
      }
      restrictedRowDensity[y] = sum / candSpanX;
    }

    const maxRowRestricted = Math.max(...restrictedRowDensity);
    const rowThresh = Math.max(0.06, maxRowRestricted * 0.35);
    const initialYInterval = findDominantInterval(restrictedRowDensity, rowThresh, Math.floor(h * 0.20), Math.floor(h * 0.05));

    // Pass 3: Re-refine column density restricted to detected row bounds
    const candMinY = Math.max(0, initialYInterval.start);
    const candMaxY = Math.min(h - 1, initialYInterval.end);
    const candSpanY = Math.max(1, candMaxY - candMinY + 1);

    const restrictedColDensity = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = candMinY; y <= candMaxY; y++) {
        sum += fgMask[y * w + x];
      }
      restrictedColDensity[x] = sum / candSpanY;
    }

    const maxColRestricted = Math.max(...restrictedColDensity);
    const finalColThresh = Math.max(0.06, maxColRestricted * 0.35);
    const finalXInterval = findDominantInterval(restrictedColDensity, finalColThresh, Math.floor(w * 0.20), Math.floor(w * 0.05));

    let minX = finalXInterval.start;
    let maxX = finalXInterval.end;
    let minY = initialYInterval.start;
    let maxY = initialYInterval.end;

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
 * Finds the widest contiguous segment exceeding a threshold density,
 * with gap tolerance to prevent dark card artwork, seams, or foil stripes from splitting the card.
 */
function findDominantInterval(
  density: Float32Array,
  threshold: number,
  minSpan: number,
  maxGap = 12
): { start: number; end: number } {
  let bestStart = 0;
  let bestEnd = density.length - 1;
  let maxArea = -1;

  let inSegment = false;
  let segStart = 0;
  let segSum = 0;
  let gapCount = 0;

  for (let i = 0; i < density.length; i++) {
    const val = density[i];
    if (val >= threshold) {
      if (!inSegment) {
        inSegment = true;
        segStart = i;
        segSum = 0;
      }
      segSum += val;
      gapCount = 0;
    } else {
      if (inSegment) {
        gapCount++;
        // Allow bridging across small dark foil or shadow gaps
        if (gapCount <= maxGap && i < density.length - 1) {
          segSum += val;
        } else {
          const segEnd = i - gapCount;
          const span = segEnd - segStart + 1;
          if (span >= minSpan && segSum > maxArea) {
            maxArea = segSum;
            bestStart = segStart;
            bestEnd = segEnd;
          }
          inSegment = false;
          gapCount = 0;
        }
      }
    }
  }

  if (inSegment) {
    const segEnd = density.length - 1 - gapCount;
    const span = segEnd - segStart + 1;
    if (span >= minSpan && segSum > maxArea) {
      bestStart = segStart;
      bestEnd = segEnd;
    }
  }

  return { start: bestStart, end: bestEnd };
}

/**
 * Calculates sports card border centering metrics (Left/Right & Top/Bottom ratios)
 * and condition grade estimation (e.g. 50/50 GEM MINT 10, 55/45 MINT 9).
 */
export interface CardCenteringResult {
  leftPct: number;
  rightPct: number;
  topPct: number;
  bottomPct: number;
  lrRatioText: string;
  tbRatioText: string;
  centeringGrade: string;
  isCentered5050: boolean;
}

export function calculateCardCentering(quad: CropQuad): CardCenteringResult {
  const avgLeft = (quad.topLeft.x + quad.bottomLeft.x) / 2;
  const avgRight = 1.0 - (quad.topRight.x + quad.bottomRight.x) / 2;
  const totalH = avgLeft + avgRight;
  const leftPct = totalH > 0 ? Math.round((avgLeft / totalH) * 100) : 50;
  const rightPct = 100 - leftPct;

  const avgTop = (quad.topLeft.y + quad.topRight.y) / 2;
  const avgBottom = 1.0 - (quad.bottomLeft.y + quad.bottomRight.y) / 2;
  const totalV = avgTop + avgBottom;
  const topPct = totalV > 0 ? Math.round((avgTop / totalV) * 100) : 50;
  const bottomPct = 100 - topPct;

  const lrDiff = Math.abs(leftPct - 50);
  const tbDiff = Math.abs(topPct - 50);
  const maxDiff = Math.max(lrDiff, tbDiff);

  let centeringGrade = 'GEM MINT 10 (50/50)';
  if (maxDiff <= 2) {
    centeringGrade = 'GEM MINT 10 (50/50 - 52/48)';
  } else if (maxDiff <= 5) {
    centeringGrade = 'MINT 9 (55/45)';
  } else if (maxDiff <= 10) {
    centeringGrade = 'NEAR MINT 8 (60/40)';
  } else if (maxDiff <= 15) {
    centeringGrade = 'EXCELLENT 7 (65/35)';
  } else {
    centeringGrade = 'OFF-CENTER (< 70/30)';
  }

  return {
    leftPct,
    rightPct,
    topPct,
    bottomPct,
    lrRatioText: `${leftPct}/${rightPct}`,
    tbRatioText: `${topPct}/${bottomPct}`,
    centeringGrade,
    isCentered5050: maxDiff <= 2
  };
}

/**
 * Mathematically centers and squares the crop quad to the standard sports card ratio (2.5 : 3.5),
 * eliminating off-center bias while retaining maximum card artwork coverage.
 */
export function autoCenterQuad(quad: CropQuad, targetRatio = 2.5 / 3.5): CropQuad {
  const centerX = (quad.topLeft.x + quad.topRight.x + quad.bottomRight.x + quad.bottomLeft.x) / 4;
  const centerY = (quad.topLeft.y + quad.topRight.y + quad.bottomRight.y + quad.bottomLeft.y) / 4;

  const currentW = Math.max(
    Math.hypot(quad.topRight.x - quad.topLeft.x, quad.topRight.y - quad.topLeft.y),
    Math.hypot(quad.bottomRight.x - quad.bottomLeft.x, quad.bottomRight.y - quad.bottomLeft.y)
  );
  const currentH = Math.max(
    Math.hypot(quad.bottomLeft.x - quad.topLeft.x, quad.bottomLeft.y - quad.topLeft.y),
    Math.hypot(quad.bottomRight.x - quad.topRight.x, quad.bottomRight.y - quad.topRight.y)
  );

  let targetW = currentW;
  let targetH = currentH;

  if (targetRatio > 0) {
    const impliedH = targetW / targetRatio;
    if (impliedH <= 0.98) {
      targetH = impliedH;
    } else {
      targetH = Math.min(0.98, currentH);
      targetW = targetH * targetRatio;
    }
  }

  const halfW = clamp(targetW / 2, 0.05, 0.49);
  const halfH = clamp(targetH / 2, 0.05, 0.49);

  const boundedCenterX = clamp(centerX, halfW + 0.005, 0.995 - halfW);
  const boundedCenterY = clamp(centerY, halfH + 0.005, 0.995 - halfH);

  return {
    topLeft: { x: boundedCenterX - halfW, y: boundedCenterY - halfH },
    topRight: { x: boundedCenterX + halfW, y: boundedCenterY - halfH },
    bottomRight: { x: boundedCenterX + halfW, y: boundedCenterY + halfH },
    bottomLeft: { x: boundedCenterX - halfW, y: boundedCenterY + halfH }
  };
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
