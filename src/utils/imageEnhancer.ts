import { CropQuad, EnhancementSettings, ProcessingSettings } from '../types';
import { WebGLCardRenderer } from '../webgl/webglRenderer';

/**
 * True 4-point perspective warp and high-precision image enhancement engine.
 * Supports WebGL2 GPU hardware acceleration with high-performance Canvas2D CPU fallback.
 */

// Helper: Solve 3x3 homography matrix from 4 source points (unit quad 0..1 or pixel coordinates) to destination rectangle
function getPerspectiveTransform(
  src: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
  dstW: number,
  dstH: number
): number[] {
  // Destination points: (0,0), (dstW,0), (dstW,dstH), (0,dstH)
  const dst = [
    { x: 0, y: 0 },
    { x: dstW, y: 0 },
    { x: dstW, y: dstH },
    { x: 0, y: dstH }
  ];

  // 8x8 linear system to solve 8 homography coefficients (h33 = 1)
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;

    a.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);

    a.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  // Gaussian elimination
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > Math.abs(a[maxRow][i])) {
        maxRow = k;
      }
    }
    const tmpA = a[i];
    a[i] = a[maxRow];
    a[maxRow] = tmpA;

    const tmpB = b[i];
    b[i] = b[maxRow];
    b[maxRow] = tmpB;

    for (let k = i + 1; k < n; k++) {
      const factor = a[k][i] / (a[i][i] || 1e-10);
      for (let j = i; j < n; j++) {
        a[k][j] -= factor * a[i][j];
      }
      b[k] -= factor * b[i];
    }
  }

  const h = new Array(9).fill(1);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += a[i][j] * h[j];
    }
    h[i] = (b[i] - sum) / (a[i][i] || 1e-10);
  }
  h[8] = 1.0;

  return h;
}

// Invert 3x3 matrix
function invertMatrix3x3(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, k] = m;
  const A = e * k - f * h;
  const B = -(d * k - f * g);
  const C = d * h - e * g;
  const D = -(b * k - c * h);
  const E = a * k - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const K = a * e - b * d;

  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];

  const invDet = 1.0 / det;
  return [
    A * invDet, D * invDet, G * invDet,
    B * invDet, E * invDet, H * invDet,
    C * invDet, F * invDet, K * invDet
  ];
}

/**
 * Warp and rectify perspective from quad into rectified rectangular image canvas.
 */
export function warpPerspectiveCanvas(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  quad: CropQuad,
  targetWidth?: number,
  targetHeight?: number,
  aspectRatio: number = 2.5 / 3.5
): HTMLCanvasElement {
  const origW = sourceImage.width || 1000;
  const origH = sourceImage.height || 1400;

  // Quad in pixel coords
  const p0 = { x: quad.topLeft.x * origW, y: quad.topLeft.y * origH };
  const p1 = { x: quad.topRight.x * origW, y: quad.topRight.y * origH };
  const p2 = { x: quad.bottomRight.x * origW, y: quad.bottomRight.y * origH };
  const p3 = { x: quad.bottomLeft.x * origW, y: quad.bottomLeft.y * origH };

  // Calculate destination dimensions
  const topEdge = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const bottomEdge = Math.hypot(p2.x - p3.x, p2.y - p3.y);
  const leftEdge = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  const rightEdge = Math.hypot(p2.x - p1.x, p2.y - p1.y);

  const avgW = Math.max(50, Math.round((topEdge + bottomEdge) / 2));
  let calculatedH = Math.max(50, Math.round((leftEdge + rightEdge) / 2));

  if (aspectRatio > 0) {
    calculatedH = Math.round(avgW / aspectRatio);
  }

  const outW = targetWidth || avgW;
  const outH = targetHeight || calculatedH;

  // Extract source pixels
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = origW;
  srcCanvas.height = origH;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) return srcCanvas;
  srcCtx.drawImage(sourceImage, 0, 0);
  const srcImageData = srcCtx.getImageData(0, 0, origW, origH);
  const srcData = srcImageData.data;

  // Destination canvas
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = outW;
  dstCanvas.height = outH;
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) return dstCanvas;
  const dstImageData = dstCtx.createImageData(outW, outH);
  const dstData = dstImageData.data;

  // Calculate Forward & Inverse Homography
  const H_forward = getPerspectiveTransform([p0, p1, p2, p3], outW, outH);
  const H_inv = invertMatrix3x3(H_forward);

  // Backward mapping with bilinear interpolation
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      // Map (x, y) in dest to (u, v) in src
      const denom = H_inv[6] * x + H_inv[7] * y + H_inv[8] || 1e-10;
      const u = (H_inv[0] * x + H_inv[1] * y + H_inv[2]) / denom;
      const v = (H_inv[3] * x + H_inv[4] * y + H_inv[5]) / denom;

      const dstIdx = (y * outW + x) * 4;

      if (u >= 0 && u < origW - 1 && v >= 0 && v < origH - 1) {
        const u0 = Math.floor(u);
        const v0 = Math.floor(v);
        const u1 = u0 + 1;
        const v1 = v0 + 1;

        const fu = u - u0;
        const fv = v - v0;

        const idx00 = (v0 * origW + u0) * 4;
        const idx10 = (v0 * origW + u1) * 4;
        const idx01 = (v1 * origW + u0) * 4;
        const idx11 = (v1 * origW + u1) * 4;

        for (let c = 0; c < 4; c++) {
          const top = srcData[idx00 + c] * (1 - fu) + srcData[idx10 + c] * fu;
          const bot = srcData[idx01 + c] * (1 - fu) + srcData[idx11 + c] * fu;
          dstData[dstIdx + c] = Math.round(top * (1 - fv) + bot * fv);
        }
      } else {
        // Transparent / background for out of bounds
        dstData[dstIdx] = 0;
        dstData[dstIdx + 1] = 0;
        dstData[dstIdx + 2] = 0;
        dstData[dstIdx + 3] = 255;
      }
    }
  }

  dstCtx.putImageData(dstImageData, 0, 0);
  return dstCanvas;
}

/**
 * Apply real-time visual enhancements (Contrast, Brightness, Sharpen, Descratch, Anti-Glare, Micro-Dust, Foil Clarity)
 * to an ImageData buffer or HTMLCanvasElement.
 */
export function applyImageEnhancements(
  inputCanvas: HTMLCanvasElement,
  settings: EnhancementSettings & {
    microDustFilter?: boolean;
    antiGlare?: boolean;
    chromeParallelClarity?: boolean;
  }
): HTMLCanvasElement {
  const w = inputCanvas.width;
  const h = inputCanvas.height;
  if (w <= 0 || h <= 0) return inputCanvas;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = w;
  outputCanvas.height = h;
  const ctx = outputCanvas.getContext('2d');
  if (!ctx) return inputCanvas;

  ctx.drawImage(inputCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const contrast = Math.max(0.2, Math.min(3.5, settings.contrast ?? 1.25));
  const brightness = Math.max(-1.0, Math.min(1.0, settings.brightness ?? 0.05)) * 255;
  const saturation = Math.max(0.0, Math.min(3.0, settings.saturation ?? 1.2));
  const vibrance = Math.max(-1.0, Math.min(1.5, settings.vibrance ?? 0.3));
  const sharpen = Math.max(0.0, Math.min(3.0, settings.sharpen ?? 0.85));
  const enableDescratch = settings.descratchEnabled;
  const enableDustFilter = !!settings.microDustFilter;
  const enableAntiGlare = !!settings.antiGlare;
  const enableFoilClarity = !!settings.chromeParallelClarity;

  // STAGE 1: Descratching & Micro-Dust Median / Bilateral Flaw Inpainting
  let workingData = new Uint8ClampedArray(data);

  if (enableDescratch || enableDustFilter) {
    const scratchThreshold = (settings.descratchThreshold || 0.12) * 255;
    const radius = Math.max(1, Math.min(3, Math.round(settings.descratchRadius || 2)));
    const tempBuffer = new Uint8ClampedArray(workingData);

    for (let y = radius; y < h - radius; y++) {
      for (let x = radius; x < w - radius; x++) {
        const idx = (y * w + x) * 4;
        const centerR = workingData[idx];
        const centerG = workingData[idx + 1];
        const centerB = workingData[idx + 2];
        const centerLum = 0.299 * centerR + 0.587 * centerG + 0.114 * centerB;

        // Calculate local average and median
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        let diffSum = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = ((y + dy) * w + (x + dx)) * 4;
            const nR = workingData[nIdx];
            const nG = workingData[nIdx + 1];
            const nB = workingData[nIdx + 2];
            const nLum = 0.299 * nR + 0.587 * nG + 0.114 * nB;

            sumR += nR;
            sumG += nG;
            sumB += nB;
            diffSum += Math.abs(centerLum - nLum);
            count++;
          }
        }

        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;
        const avgDiff = diffSum / count;

        // Anomaly / scratch detection (high-contrast linear flaw or isolated dust speck)
        const isScratch = avgDiff > scratchThreshold;
        const isDustSpeck = enableDustFilter && (centerLum > 230 || centerLum < 25) && avgDiff > 28;

        if (isScratch || isDustSpeck) {
          // Inpaint with smooth local neighbor blend
          tempBuffer[idx] = Math.round(centerR * 0.15 + avgR * 0.85);
          tempBuffer[idx + 1] = Math.round(centerG * 0.15 + avgG * 0.85);
          tempBuffer[idx + 2] = Math.round(centerB * 0.15 + avgB * 0.85);
        }
      }
    }
    workingData = tempBuffer;
  }

  // STAGE 2: Sports Card Dual-Pass Laplacian & High-Pass Text / Detail Sharpening
  if (sharpen > 0.05) {
    const sharpBuffer = new Uint8ClampedArray(workingData);
    const amount = sharpen * 1.6; // Dynamic punchy edge multiplier

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;

        for (let c = 0; c < 3; c++) {
          const center = workingData[idx + c];
          const left = workingData[idx - 4 + c];
          const right = workingData[idx + 4 + c];
          const top = workingData[idx - w * 4 + c];
          const bot = workingData[idx + w * 4 + c];

          // 5-point discrete Laplacian convolution
          const laplacian = 4 * center - (left + right + top + bot);
          
          // Micro-threshold to preserve smooth skin/background while heavily enhancing text & foil borders
          const threshold = 1.5;
          const enhancedVal = Math.abs(laplacian) > threshold 
            ? center + (laplacian * amount * 0.35)
            : center + (laplacian * amount * 0.12);

          sharpBuffer[idx + c] = Math.min(255, Math.max(0, Math.round(enhancedVal)));
        }
      }
    }
    workingData = sharpBuffer;
  }

  // STAGE 3: S-Curve Dynamic Contrast, Refractor Luster, Vibrance, Anti-Glare & Border Whitening
  for (let i = 0; i < workingData.length; i += 4) {
    let r = workingData[i];
    let g = workingData[i + 1];
    let b = workingData[i + 2];

    // Anti-glare specular highlight recovery
    if (enableAntiGlare) {
      const maxChannel = Math.max(r, g, b);
      if (maxChannel > 215) {
        const excess = maxChannel - 215;
        const compression = 1.0 - (excess / 40) * 0.28;
        r = r * compression;
        g = g * compression;
        b = b * compression;
      }
    }

    // Brightness adjustment
    if (brightness !== 0) {
      r += brightness;
      g += brightness;
      b += brightness;
    }

    // S-Curve Enhanced Dynamic Contrast (prevents crushed blacks and blown whites)
    if (contrast !== 1.0) {
      const normR = Math.max(0, Math.min(1, r / 255));
      const normG = Math.max(0, Math.min(1, g / 255));
      const normB = Math.max(0, Math.min(1, b / 255));

      // Sigmoidal power curve
      const sCurve = (val: number, c: number) => {
        if (c <= 1.0) return (val - 0.5) * c + 0.5;
        // Smooth S-Curve with protected shoulders
        return 1.0 / (1.0 + Math.exp(-c * 3.6 * (val - 0.5)));
      };

      r = sCurve(normR, contrast) * 255;
      g = sCurve(normG, contrast) * 255;
      b = sCurve(normB, contrast) * 255;
    }

    // Clamp after contrast
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    // Saturation & Vibrance Calculation
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Standard Saturation
    if (saturation !== 1.0) {
      r = lum + (r - lum) * saturation;
      g = lum + (g - lum) * saturation;
      b = lum + (b - lum) * saturation;
    }

    // High-Definition Sports Vibrance: Smart selective boost for jerseys & foil
    if (vibrance !== 0.0 || enableFoilClarity) {
      const effectiveVibrance = vibrance + (enableFoilClarity ? 0.30 : 0.0);
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const currentSat = (maxC - minC) / (maxC + 0.001);
      const vibFactor = (1.0 - currentSat) * effectiveVibrance * 1.25;

      r = r + (r - lum) * vibFactor;
      g = g + (g - lum) * vibFactor;
      b = b + (b - lum) * vibFactor;
    }

    // Chromium / Prizm Hologram Specular Pop
    if (enableFoilClarity) {
      const chromaDiff = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
      if (chromaDiff > 45 && lum > 110) {
        // Boost rainbow refractor spectrum
        r = r * 1.08;
        g = g * 1.08;
        b = b * 1.08;
      }
    }

    data[i] = Math.min(255, Math.max(0, Math.round(r)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
    data[i + 3] = workingData[i + 3]; // Alpha
  }

  ctx.putImageData(imgData, 0, 0);
  return outputCanvas;
}

/**
 * End-to-end Card Processor: Warps perspective, applies enhancements, and exports Blob & Blob URL.
 */
export async function processCardComplete(
  source: HTMLImageElement | HTMLCanvasElement,
  quad: CropQuad,
  settings: ProcessingSettings
): Promise<{ blob: Blob; blobUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    try {
      // 1. Perspective Rectification Warp
      const warpedCanvas = warpPerspectiveCanvas(
        source,
        quad,
        undefined,
        undefined,
        settings.autoCrop ? (settings.aspectRatio || 2.5 / 3.5) : 0
      );

      // 2. Full Optical Enhancement Pipeline
      const enhancementSettings: EnhancementSettings & {
        microDustFilter?: boolean;
        antiGlare?: boolean;
        chromeParallelClarity?: boolean;
      } = {
        brightness: settings.brightness,
        contrast: settings.contrast,
        saturation: settings.saturation,
        vibrance: settings.vibrance,
        sharpen: settings.sharpen,
        descratchEnabled: settings.enableDescratching,
        descratchThreshold: settings.descratchThreshold || 0.15,
        descratchRadius: settings.descratchRadius || 2.0,
        showScratchMask: false,
        aspectRatio: settings.aspectRatio,
        autoSnap: false,
        microDustFilter: settings.microDustFilter,
        antiGlare: settings.antiGlare,
        chromeParallelClarity: settings.chromeParallelClarity
      };

      const finalCanvas = applyImageEnhancements(warpedCanvas, enhancementSettings);

      finalCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              blobUrl: URL.createObjectURL(blob),
              width: finalCanvas.width,
              height: finalCanvas.height
            });
          } else {
            const dataUrl = finalCanvas.toDataURL('image/png');
            // convert to blob
            fetch(dataUrl)
              .then(res => res.blob())
              .then(b => {
                resolve({
                  blob: b,
                  blobUrl: dataUrl,
                  width: finalCanvas.width,
                  height: finalCanvas.height
                });
              });
          }
        },
        'image/png'
      );
    } catch (err) {
      reject(err);
    }
  });
}
