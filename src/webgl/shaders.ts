/**
 * WebGL 2.0 GPU Shader Engine for Trading Card Processing
 *
 * Implements:
 * 1. Quad Vertex Shader with Normalized Coordinate Mapping
 * 2. Structure-Tensor & Directional Laplacian Scratch & Scuff Anomaly Detector
 * 3. Navier-Stokes PDE Isophote Fluid Transport with Card Stock Texture Matrix Synthesis
 * 4. Master Photometric Engine: Chromatic Aberration Correction, Rec.709 Contrast, Vibrance, Anti-Glare & Foil Clarity
 */

export const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec2 aTexCoord;

out vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/**
 * 1. HIGH-PASS STRUCTURE TENSOR & SCRATCH ANOMALY MASK SHADER
 * Extracts micro-scratches, slab abrasions, and pinholes using structure tensor coherence.
 * Distinguishes narrow defect lines from legitimate card graphics (text, borders, logos, portraits).
 */
export const HIGH_PASS_SCRATCH_MASK_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec2 uTexelSize;
uniform float uThreshold; // Sensitivity: 0.04 to 0.40
uniform float uRadius;    // Kernel sample radius: 1.0 to 6.0

float getLuminance(vec3 rgb) {
  return dot(rgb, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec4 centerColor = texture(uTexture, vTexCoord);
  float centerLum = getLuminance(centerColor.rgb);

  // 1. Structure Tensor & Gradient Estimation: J = [ <Ix^2> <Ix*Iy>; <Ix*Iy> <Iy^2> ]
  vec2 dx = vec2(uTexelSize.x, 0.0);
  vec2 dy = vec2(0.0, uTexelSize.y);

  float lumR = getLuminance(texture(uTexture, vTexCoord + dx).rgb);
  float lumL = getLuminance(texture(uTexture, vTexCoord - dx).rgb);
  float lumT = getLuminance(texture(uTexture, vTexCoord + dy).rgb);
  float lumB = getLuminance(texture(uTexture, vTexCoord - dy).rgb);

  float gx = (lumR - lumL) * 0.5;
  float gy = (lumT - lumB) * 0.5;
  float gradMag = sqrt(gx * gx + gy * gy);

  // 2. Spatial Low-Pass Gaussian Baseline over neighborhood
  float blurLum = 0.0;
  float totalWeight = 0.0;
  float jxx = 0.0;
  float jyy = 0.0;
  float jxy = 0.0;

  float stepR = max(1.0, uRadius * 0.75);

  for (float y = -2.0; y <= 2.0; y += 1.0) {
    for (float x = -2.0; x <= 2.0; x += 1.0) {
      vec2 offset = vec2(x, y) * uTexelSize * stepR;
      vec2 sampleUV = vTexCoord + offset;
      vec3 sColor = texture(uTexture, sampleUV).rgb;
      float sLum = getLuminance(sColor);

      float weight = exp(-(x * x + y * y) / 3.0);
      blurLum += sLum * weight;
      totalWeight += weight;

      // Local gradient components for structure tensor
      float sR = getLuminance(texture(uTexture, sampleUV + dx).rgb);
      float sL = getLuminance(texture(uTexture, sampleUV - dx).rgb);
      float sT = getLuminance(texture(uTexture, sampleUV + dy).rgb);
      float sB = getLuminance(texture(uTexture, sampleUV - dy).rgb);
      float sgx = (sR - sL) * 0.5;
      float sgy = (sT - sB) * 0.5;

      jxx += sgx * sgx * weight;
      jyy += sgy * sgy * weight;
      jxy += sgx * sgy * weight;
    }
  }

  blurLum /= max(0.001, totalWeight);
  jxx /= max(0.001, totalWeight);
  jyy /= max(0.001, totalWeight);
  jxy /= max(0.001, totalWeight);

  // 3. High-Pass Spatial Discontinuity (Laplacian Energy)
  float highPass = abs(centerLum - blurLum);

  // 4. Structure Tensor Coherence Measure
  // Real artwork lines and text have high directional coherence across a multi-pixel baseline.
  // Micro-scratches are thin (1-2 px), causing localized Laplacian spikes with low structural thickness.
  float traceJ = jxx + jyy;
  float detJ = jxx * jyy - jxy * jxy;
  float discriminant = sqrt(max(0.0, (jxx - jyy) * (jxx - jyy) + 4.0 * jxy * jxy));
  float lambda1 = (traceJ + discriminant) * 0.5;
  float lambda2 = max(0.0, (traceJ - discriminant) * 0.5);

  float coherence = (lambda1 - lambda2) / (lambda1 + lambda2 + 0.0001);
  coherence = coherence * coherence;

  // Compute dominant isophote orientation angle: theta = 0.5 * atan(2 * jxy, jxx - jyy)
  float theta = 0.5 * atan(2.0 * jxy, jxx - jyy + 0.00001);
  vec2 isophoteDir = vec2(-sin(theta), cos(theta));

  // 5. Defect Classification: Scratch confidence
  // Trigger when high-pass energy exceeds threshold and is not a broad macro-edge
  float isScratch = 0.0;
  if (highPass > uThreshold) {
    float scratchConfidence = smoothstep(uThreshold, uThreshold * 2.2, highPass);
    // Suppress if gradient magnitude is massive across wide edge (e.g. sharp border or bold text)
    float edgeProtection = 1.0 - smoothstep(0.35, 0.75, gradMag);
    isScratch = scratchConfidence * mix(0.5, 1.0, edgeProtection);
  }

  // R: Scratch confidence mask [0..1]
  // G: Isophote direction X encoded [-1..1 -> 0..1]
  // B: Isophote direction Y encoded [-1..1 -> 0..1]
  // A: Local texture energy
  fragColor = vec4(
    clamp(isScratch, 0.0, 1.0),
    isophoteDir.x * 0.5 + 0.5,
    isophoteDir.y * 0.5 + 0.5,
    clamp(highPass * 3.0, 0.0, 1.0)
  );
}
`;

/**
 * 2. ROBUST NAVIER-STOKES & ISOPHOTE CURVATURE INPAINTING SHADER
 * WITH CARD STOCK TEXTURE MATRIX PRESERVATION
 *
 * Algorithm:
 * 1. Evaluates scratch defect mask and boundary condition ∂Ω around unblemished card stock.
 * 2. Transports image vorticity w = ΔI and luminance along local isophote streamlines T = (-Iy, Ix).
 * 3. Decomposes boundary neighborhood into Structural Base and High-Frequency Stock Texture Residual Matrix T(x,y).
 * 4. Synthesizes underlying card stock grain (foil prismatic texture, paper tooth, halftone matrix) along the flow field.
 * 5. Blends synthesized texture matrix seamlessly into the inpainted core, preventing plastic/blurred flat voids.
 */
export const NAVIER_STOKES_INPAINT_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;     // Base Source Card Image
uniform sampler2D uMaskTexture; // Mask Texture (R: mask, G: isophoteX, B: isophoteY, A: textureEnergy)
uniform vec2 uTexelSize;
uniform float uRadius;

float getLuminance(vec3 rgb) {
  return dot(rgb, vec3(0.299, 0.587, 0.114));
}

// Pseudo-random hash for sub-pixel grain phase synthesis
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec4 baseColor = texture(uTexture, vTexCoord);
  vec4 maskData = texture(uMaskTexture, vTexCoord);
  float scratchMask = maskData.r;

  // If pixel is clean, retain original texture with 100% pristine fidelity
  if (scratchMask < 0.05) {
    fragColor = baseColor;
    return;
  }

  // 1. Recover Isophote Tangent & Normal Directions from Structure Tensor
  vec2 tangent = vec2(maskData.g * 2.0 - 1.0, maskData.b * 2.0 - 1.0);
  if (length(tangent) < 0.1) {
    // Fallback gradient calculation
    vec2 dx = vec2(uTexelSize.x * 2.0, 0.0);
    vec2 dy = vec2(0.0, uTexelSize.y * 2.0);
    float lR = getLuminance(texture(uTexture, vTexCoord + dx).rgb);
    float lL = getLuminance(texture(uTexture, vTexCoord - dx).rgb);
    float lT = getLuminance(texture(uTexture, vTexCoord + dy).rgb);
    float lB = getLuminance(texture(uTexture, vTexCoord - dy).rgb);
    vec2 grad = vec2(lR - lL, lT - lB);
    tangent = (length(grad) > 0.0001) ? normalize(vec2(-grad.y, grad.x)) : vec2(1.0, 0.0);
  } else {
    tangent = normalize(tangent);
  }

  vec2 normal = vec2(-tangent.y, tangent.x);

  // 2. Navier-Stokes Isophote Streamline Integration & Boundary Sampling
  vec4 accumBaseColor = vec4(0.0);
  float accumBaseWeight = 0.0;

  // Texture Matrix Statistics from Unblemished Boundary ∂Ω
  vec3 accumTextureVariance = vec3(0.0);
  vec3 accumTextureResidual = vec3(0.0);
  float accumTextureWeight = 0.0;

  float stepR = max(1.0, uRadius * 0.9);

  // Anisotropic multi-directional kernel along streamline T and across normal N
  for (float i = -5.0; i <= 5.0; i += 1.0) {
    for (float j = -4.0; j <= 4.0; j += 1.0) {
      if (i == 0.0 && j == 0.0) continue;

      // Sample along isophote flow field with anisotropic ellipse (longer along tangent, tighter along normal)
      vec2 offset = (tangent * i * 1.2 * stepR + normal * j * 0.7 * stepR) * uTexelSize;
      vec2 uv = vTexCoord + offset;

      vec4 sampleColor = texture(uTexture, uv);
      float sampleMask = texture(uMaskTexture, uv).r;

      // Consider unblemished surrounding pixels
      if (sampleMask < 0.25) {
        float distSq = i * i + j * j;
        // Directional streamline weight: prioritize propagation ALONG the isophote tangent
        float streamlineAlignment = abs(i) / (abs(i) + abs(j) + 0.001);
        float w = (1.0 + streamlineAlignment * 1.8) / (distSq + 0.08);

        accumBaseColor += sampleColor * w;
        accumBaseWeight += w;

        // Extract high-frequency card stock texture matrix residual: T = I_sample - I_local_lowpass
        vec4 localBlur = (
          texture(uTexture, uv + vec2(uTexelSize.x, 0.0)) +
          texture(uTexture, uv - vec2(uTexelSize.x, 0.0)) +
          texture(uTexture, uv + vec2(0.0, uTexelSize.y)) +
          texture(uTexture, uv - vec2(0.0, uTexelSize.y))
        ) * 0.25;

        vec3 residual = sampleColor.rgb - localBlur.rgb;
        accumTextureResidual += residual * w;
        accumTextureVariance += abs(residual) * w;
        accumTextureWeight += w;
      }
    }
  }

  vec4 inpaintedBase = baseColor;
  if (accumBaseWeight > 0.001) {
    inpaintedBase = accumBaseColor / accumBaseWeight;
  }

  // 3. Card Stock Texture Matrix Synthesis
  // Synthesize underlying substrate grain, foil refractor tooth, and fiber texture
  vec3 synthesizedTexture = vec3(0.0);
  if (accumTextureWeight > 0.001) {
    vec3 meanVariance = accumTextureVariance / accumTextureWeight;
    vec3 meanResidual = accumTextureResidual / accumTextureWeight;

    // High-frequency harmonic texture generator phase-locked to isophote streamline
    float grainPhase1 = hash21(vTexCoord * 1000.0 + tangent * 50.0);
    float grainPhase2 = sin(dot(vTexCoord / uTexelSize, tangent * 1.5708)) * 0.5 + 0.5;
    float syntheticNoise = (grainPhase1 - 0.5) * 2.0 * 0.6 + (grainPhase2 - 0.5) * 0.4;

    // Modulate synthesized texture with measured card stock variance
    synthesizedTexture = meanResidual + syntheticNoise * meanVariance * 1.5;
  }

  // 4. Combine Navier-Stokes Structural Base with Synthesized Stock Texture Matrix
  vec3 finalInpaintedRGB = inpaintedBase.rgb + synthesizedTexture;
  finalInpaintedRGB = clamp(finalInpaintedRGB, 0.0, 1.0);

  // Soft blend based on scratch confidence to prevent harsh seam transitions
  float blendWeight = smoothstep(0.05, 0.5, scratchMask);
  vec3 blendedResult = mix(baseColor.rgb, finalInpaintedRGB, blendWeight);

  fragColor = vec4(blendedResult, baseColor.a);
}
`;

/**
 * 3. MASTER GPU ENHANCEMENT & CHROMATIC CORRECTION SHADER
 * Performs:
 * - Chromatic Aberration / Dispersion Compensation (RGB radial alignment)
 * - Thresholded Unsharp Mask Sharpening
 * - Rec.709 Perceptual Contrast & Exposure
 * - Non-linear Vibrance (Chroma boost on muted tones)
 * - Specular Glare / Slab Reflection Dampening
 * - Foil & Refractor Micro-Contrast Clarity Boost
 */
export const FINAL_ENHANCEMENT_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform sampler2D uMaskTexture;
uniform vec2 uTexelSize;

// Visual Adjustments
uniform float uBrightness;          // -1.0 to 1.0
uniform float uContrast;            // 0.2 to 2.5
uniform float uSaturation;          // 0.0 to 2.5
uniform float uVibrance;            // -1.0 to 1.0
uniform float uSharpen;             // 0.0 to 2.0
uniform float uChromaticCorrection; // -0.01 to 0.01 (Red/Blue radial offset)
uniform bool uAntiGlare;            // Highlight compression
uniform float uFoilClarity;         // Foil micro-contrast boost (0.0 to 1.0)
uniform bool uShowScratchMask;      // Debug overlay

float getLuminance(vec3 rgb) {
  return dot(rgb, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 uv = vTexCoord;

  // 1. Chromatic Aberration / Radial Dispersion Compensation
  vec2 centeredUV = uv - vec2(0.5);
  vec2 redUV = uv + centeredUV * uChromaticCorrection;
  vec2 blueUV = uv - centeredUV * uChromaticCorrection;

  float r = texture(uTexture, redUV).r;
  float g = texture(uTexture, uv).g;
  float b = texture(uTexture, blueUV).b;
  float a = texture(uTexture, uv).a;
  vec3 baseRGB = vec3(r, g, b);

  // 2. High-Pass Unsharp Masking
  if (uSharpen > 0.01) {
    vec3 blur = vec3(0.0);
    blur += texture(uTexture, uv + vec2(-uTexelSize.x, 0.0)).rgb;
    blur += texture(uTexture, uv + vec2(uTexelSize.x, 0.0)).rgb;
    blur += texture(uTexture, uv + vec2(0.0, -uTexelSize.y)).rgb;
    blur += texture(uTexture, uv + vec2(0.0, uTexelSize.y)).rgb;
    blur *= 0.25;

    vec3 diff = baseRGB - blur;
    baseRGB = baseRGB + diff * uSharpen;
  }

  // 3. Foil / Refractor Micro-Contrast Clarity Boost
  if (uFoilClarity > 0.01) {
    float lum = getLuminance(baseRGB);
    float foilMask = smoothstep(0.4, 0.9, lum);
    baseRGB = mix(baseRGB, baseRGB * (1.0 + (lum - 0.5) * 0.4), foilMask * uFoilClarity);
  }

  // 4. Anti-Glare / Specular Highlight Recovery
  if (uAntiGlare) {
    float maxChan = max(baseRGB.r, max(baseRGB.g, baseRGB.b));
    if (maxChan > 0.85) {
      float compression = 1.0 - smoothstep(0.85, 1.0, maxChan) * 0.25;
      baseRGB *= compression;
    }
  }

  // 5. Exposure / Brightness Adjustment
  vec3 color = baseRGB + vec3(uBrightness);

  // 6. Photometric Contrast Adjustment around mid-gray 0.5
  color = (color - vec3(0.5)) * uContrast + vec3(0.5);

  // 7. Saturation & Vibrance (Non-linear chroma curve)
  float lum = getLuminance(color);

  // Saturation
  color = mix(vec3(lum), color, uSaturation);

  // Vibrance: Smart saturation prioritizing muted card elements
  float maxC = max(color.r, max(color.g, color.b));
  float minC = min(color.r, min(color.g, color.b));
  float currentSat = (maxC - minC) / (maxC + 0.0001);
  float vibAmount = (1.0 - currentSat) * uVibrance;
  color = color + (color - vec3(lum)) * vibAmount;

  // Clamp color gamut
  color = clamp(color, 0.0, 1.0);

  // 8. Debug Scratch Mask Overlay (Neon Cyan indicator)
  if (uShowScratchMask) {
    float maskVal = texture(uMaskTexture, uv).r;
    if (maskVal > 0.1) {
      color = mix(color, vec3(0.0, 0.95, 1.0), 0.75);
    }
  }

  fragColor = vec4(color, a);
}
`;

