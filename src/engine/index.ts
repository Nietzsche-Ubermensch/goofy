/**
 * Unified Card Engine Module
 * Re-exports card enhancement pipelines, edge detection, perspective warping,
 * defect inspection, and WebGL rendering engines.
 */

// Card Enhancer V2 Suite & Presets
export * from '../card_enhancer_v2';

// Image Enhancement & Perspective Warping Utilities
export { 
  warpPerspectiveCanvas, 
  applyImageEnhancements, 
  processCardComplete 
} from '../utils/imageEnhancer';

export { 
  detectCardEdges 
} from '../utils/edgeDetection';

export { 
  getRotatedCanvas, 
  rotateQuad90Step 
} from '../utils/imageRotation';
