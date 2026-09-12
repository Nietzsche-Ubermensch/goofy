import { BlemishItem } from '../../types';

export class BlemishEngine {
  /**
   * Scans an image element and extracts candidate blemishes using high-pass edge analysis
   */
  public static async analyzeImage(img: HTMLImageElement, sensitivity = 0.5): Promise<BlemishItem[]> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    // Scale down to max 1024 for lightning-fast analysis
    const maxDim = 1024;
    const scale = Math.min(1.0, maxDim / Math.max(img.width, img.height));
    const w = Math.floor(img.width * scale);
    const h = Math.floor(img.height * scale);

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const blemishes: BlemishItem[] = [];

    // Compute luminance array
    const lums = new Float32Array(w * h);
    for (let i = 0; i < data.length; i += 4) {
      lums[i / 4] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }

    const threshold = 35 * (1.2 - sensitivity * 0.4);
    const visited = new Uint8Array(w * h);

    // Search for clusters of high-contrast laplacian gradient anomalies
    for (let y = 4; y < h - 4; y += 3) {
      for (let x = 4; x < w - 4; x += 3) {
        const idx = y * w + x;
        if (visited[idx]) continue;

        const centerLum = lums[idx];
        const laplacian = Math.abs(
          4 * centerLum -
          (lums[idx - 1] + lums[idx + 1] + lums[idx - w] + lums[idx + w])
        );

        if (laplacian > threshold) {
          // Trace connected defect component
          let minX = x, maxX = x, minY = y, maxY = y;
          let count = 0;

          // Simple local flood/bounding
          for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
              const nIdx = (y + dy) * w + (x + dx);
              if (nIdx >= 0 && nIdx < w * h && !visited[nIdx]) {
                if (Math.abs(lums[nIdx] - centerLum) > threshold * 0.7) {
                  visited[nIdx] = 1;
                  minX = Math.min(minX, x + dx);
                  maxX = Math.max(maxX, x + dx);
                  minY = Math.min(minY, y + dy);
                  maxY = Math.max(maxY, y + dy);
                  count++;
                }
              }
            }
          }

          if (count >= 3) {
            const boxW = (maxX - minX + 2) / w;
            const boxH = (maxY - minY + 2) / h;
            const normX = minX / w;
            const normY = minY / h;
            const isLinear = boxW / boxH > 2.5 || boxH / boxW > 2.5;

            const type: BlemishItem['type'] = isLinear 
              ? 'scratch' 
              : count < 8 
                ? 'dust' 
                : 'scuff';

            const severity: BlemishItem['severity'] = 
              laplacian > threshold * 2.0 ? 'high' : 
              laplacian > threshold * 1.4 ? 'medium' : 'low';

            blemishes.push({
              id: `blemish_${Date.now()}_${blemishes.length}`,
              type,
              confidence: Math.min(0.98, 0.65 + (laplacian / 100)),
              bbox: [normX, normY, boxW, boxH],
              severity,
              repaired: false,
            });

            if (blemishes.length >= 25) break; // Limit candidate clusters
          }
        }
      }
      if (blemishes.length >= 25) break;
    }

    return blemishes;
  }
}
