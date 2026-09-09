import { CropQuad, Point } from '../types';

/**
 * Creates an offscreen canvas with the image rotated by angleDegrees.
 * Calculates exact new bounding box dimensions so corners are not clipped.
 */
export function getRotatedCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  angleDegrees: number
): HTMLCanvasElement {
  const origW = source.width || 1;
  const origH = source.height || 1;

  // Normalized angle in range [-180, 180]
  const normalized = ((angleDegrees % 360) + 540) % 360 - 180;
  
  if (Math.abs(normalized) < 0.001) {
    const canvas = document.createElement('canvas');
    canvas.width = origW;
    canvas.height = origH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, 0, 0);
    }
    return canvas;
  }

  const rad = (normalized * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const newW = Math.max(1, Math.round(origW * cos + origH * sin));
  const newH = Math.max(1, Math.round(origW * sin + origH * cos));

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(newW / 2, newH / 2);
    ctx.rotate(rad);
    ctx.drawImage(source, -origW / 2, -origH / 2);
  }

  return canvas;
}

/**
 * Rotates a 0..1 normalized Quad by a 90-degree step (+90 CW or -90 CCW).
 */
export function rotateQuad90Step(quad: CropQuad, clockwise: boolean): CropQuad {
  const rotatePoint = (pt: Point): Point => {
    if (clockwise) {
      return { x: 1 - pt.y, y: pt.x };
    } else {
      return { x: pt.y, y: 1 - pt.x };
    }
  };

  if (clockwise) {
    return {
      topLeft: rotatePoint(quad.bottomLeft),
      topRight: rotatePoint(quad.topLeft),
      bottomRight: rotatePoint(quad.topRight),
      bottomLeft: rotatePoint(quad.bottomRight)
    };
  } else {
    return {
      topLeft: rotatePoint(quad.topRight),
      topRight: rotatePoint(quad.bottomRight),
      bottomRight: rotatePoint(quad.bottomLeft),
      bottomLeft: rotatePoint(quad.topLeft)
    };
  }
}
