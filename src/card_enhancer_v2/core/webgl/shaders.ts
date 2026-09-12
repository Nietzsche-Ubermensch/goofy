/**
 * Card Enhancer V2 - High Performance WebGL Shaders
 */

export const VERTEX_SHADER_SOURCE = `
  attribute vec2 aPosition;
  attribute vec2 aTexCoord;
  varying vec2 vTexCoord;
  
  void main() {
    vTexCoord = aTexCoord;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

export const FRAGMENT_SHADER_SOURCE = `
  precision highp float;
  varying vec2 vTexCoord;
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  
  // Basic & Exposure Uniforms
  uniform float uBrightness;     // -1.0 to 1.5
  uniform float uContrast;       // 0.5 to 2.5
  uniform float uSaturation;     // 0.0 to 2.5
  uniform float uVibrance;       // -1.0 to 1.5
  uniform float uTemperature;    // -1.0 to 1.0
  
  // Sharpening & Micro-contrast
  uniform float uSharpenFine;    // 0.0 to 3.0
  uniform float uSharpenWide;    // 0.0 to 2.0
  uniform float uClarity;        // 0.0 to 1.5
  
  // Inpainting & Descratch
  uniform int uDescratchEnabled;
  uniform float uDescratchThreshold;
  uniform float uDescratchRadius;
  uniform int uShowScratchMask;
  
  // Specialty Collectible Filters
  uniform int uHoloFoilClarity;
  uniform int uAntiGlare;
  uniform float uSpecularBoost;
  uniform int uVintagePaperPreserve;

  // RGB to Luminance
  float getLuminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  void main() {
    vec2 onePixel = vec2(1.0) / uResolution;
    vec4 centerSample = texture2D(uTexture, vTexCoord);
    vec3 baseColor = centerSample.rgb;

    // --- 1. Navier-Stokes Inspired Scratch & Dust Inpainting Sample ---
    float centerLum = getLuminance(baseColor);
    float laplacian = 0.0;
    vec3 avgNeighbor = vec3(0.0);
    float validNeighbors = 0.0;

    // Sample 8-neighborhood for defect gradient
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        if (x == 0 && y == 0) continue;
        vec3 nColor = texture2D(uTexture, vTexCoord + vec2(float(x), float(y)) * onePixel * uDescratchRadius * 0.5).rgb;
        float nLum = getLuminance(nColor);
        laplacian += abs(centerLum - nLum);
        avgNeighbor += nColor;
        validNeighbors += 1.0;
      }
    }
    laplacian /= validNeighbors;
    avgNeighbor /= validNeighbors;

    bool isScratch = (uDescratchEnabled == 1) && (laplacian > uDescratchThreshold);

    if (uShowScratchMask == 1) {
      if (isScratch) {
        gl_FragColor = vec4(1.0, 0.1, 0.3, 1.0); // Vivid neon red scratch mask
        return;
      }
    }

    // Blend inpainting if defect detected
    if (isScratch) {
      baseColor = mix(baseColor, avgNeighbor, 0.85);
    }

    // --- 2. Dual-Scale Unsharp Masking (Fine Text + Structural Edges) ---
    // Fine 3x3 Kernel
    vec3 blurFine = (
      texture2D(uTexture, vTexCoord + vec2(-1.0, 0.0) * onePixel).rgb +
      texture2D(uTexture, vTexCoord + vec2(1.0, 0.0) * onePixel).rgb +
      texture2D(uTexture, vTexCoord + vec2(0.0, -1.0) * onePixel).rgb +
      texture2D(uTexture, vTexCoord + vec2(0.0, 1.0) * onePixel).rgb
    ) * 0.25;

    // Wide 5x5 Kernel
    vec3 blurWide = (
      texture2D(uTexture, vTexCoord + vec2(-2.0, 0.0) * onePixel).rgb +
      texture2D(uTexture, vTexCoord + vec2(2.0, 0.0) * onePixel).rgb +
      texture2D(uTexture, vTexCoord + vec2(0.0, -2.0) * onePixel).rgb +
      texture2D(uTexture, vTexCoord + vec2(0.0, 2.0) * onePixel).rgb
    ) * 0.25;

    vec3 highPassFine = baseColor - blurFine;
    vec3 highPassWide = baseColor - blurWide;
    
    vec3 sharpened = baseColor + (highPassFine * uSharpenFine * 1.5) + (highPassWide * uSharpenWide * 1.0);
    sharpened = clamp(sharpened, 0.0, 1.0);

    // --- 3. Clarity (Local Micro-Contrast) ---
    if (uClarity > 0.0) {
      vec3 clarityDiff = sharpened - blurWide;
      sharpened = clamp(sharpened + clarityDiff * uClarity * 0.8, 0.0, 1.0);
    }

    // --- 4. High-Dynamic Range EV Brightness Gain ---
    vec3 exposed = sharpened * pow(2.0, uBrightness * 1.5) + (uBrightness * 0.35);
    exposed = clamp(exposed, 0.0, 1.0);

    // --- 5. Contrast centered at Mid-Gray (0.5) ---
    vec3 contrasted = (exposed - 0.5) * uContrast + 0.5;
    contrasted = clamp(contrasted, 0.0, 1.0);

    // --- 6. Temperature Adjustment (Warm/Cool) ---
    if (abs(uTemperature) > 0.001) {
      if (uTemperature > 0.0) {
        contrasted.r = clamp(contrasted.r + uTemperature * 0.15, 0.0, 1.0);
        contrasted.b = clamp(contrasted.b - uTemperature * 0.12, 0.0, 1.0);
      } else {
        contrasted.r = clamp(contrasted.r + uTemperature * 0.12, 0.0, 1.0);
        contrasted.b = clamp(contrasted.b - uTemperature * 0.18, 0.0, 1.0);
      }
    }

    // --- 7. Holo/Prizm Specular Refractor Boost ---
    if (uHoloFoilClarity == 1 || uSpecularBoost > 0.0) {
      float specLum = getLuminance(contrasted);
      if (specLum > 0.65) {
        float boost = pow((specLum - 0.65) / 0.35, 1.5) * max(0.4, uSpecularBoost);
        contrasted = clamp(contrasted + vec3(boost * 0.25, boost * 0.35, boost * 0.50), 0.0, 1.0);
      }
    }

    // --- 8. Anti-Glare Suppression ---
    if (uAntiGlare == 1) {
      float highlightLum = getLuminance(contrasted);
      if (highlightLum > 0.92) {
        float glareSuppression = (highlightLum - 0.92) * 0.7;
        contrasted = clamp(contrasted - vec3(glareSuppression), 0.0, 1.0);
      }
    }

    // --- 9. Luminance-Weighted Saturation & Vibrance ---
    float lum = getLuminance(contrasted);
    vec3 satColor = mix(vec3(lum), contrasted, uSaturation);

    // Vibrance: intelligently boosts less-saturated pixels more
    float maxComponent = max(satColor.r, max(satColor.g, satColor.b));
    float minComponent = min(satColor.r, min(satColor.g, satColor.b));
    float currentSat = maxComponent - minComponent;
    float vibranceFactor = (1.0 - currentSat) * uVibrance;
    vec3 finalColor = mix(satColor, mix(vec3(lum), satColor, 1.0 + vibranceFactor), 0.7);

    // --- 10. Vintage Paper Fiber Tone Preservation ---
    if (uVintagePaperPreserve == 1) {
      finalColor = mix(finalColor, finalColor * vec3(1.03, 0.98, 0.92), 0.25);
    }

    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), centerSample.a);
  }
`;
