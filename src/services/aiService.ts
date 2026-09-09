import axios from "axios";
import { 
  ImageSize, 
  ProcessingSettings, 
  AnalysisResult, 
  AIProvider, 
  AIModelConfig 
} from "../types";

const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1600;

        if (width > height && width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
        } else if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("No canvas context");

        ctx.drawImage(img, 0, 0, width, height);
        const result = canvas.toDataURL('image/jpeg', 0.85);
        resolve(result.split(',')[1]);
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const cropImage = async (file: File, box: number[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        if (!box || box.length < 4) {
             let width = img.width;
             let height = img.height;
             const maxDim = 1600;
             if (width > height && width > maxDim) {
                 height *= maxDim / width;
                 width = maxDim;
             } else if (height > maxDim) {
                 width *= maxDim / height;
                 height = maxDim;
             }
             canvas.width = width;
             canvas.height = height;
             const ctx = canvas.getContext('2d');
             if (ctx) ctx.drawImage(img, 0, 0, width, height);
             resolve(canvas.toDataURL('image/jpeg', 0.85));
             return;
        }
        let [ymin, xmin, ymax, xmax] = box;
        if (ymin > 1 || xmin > 1 || ymax > 1 || xmax > 1) {
            ymin /= 100; xmin /= 100; ymax /= 100; xmax /= 100;
        }
        ymin = Math.max(0, Math.min(1, ymin));
        xmin = Math.max(0, Math.min(1, xmin));
        ymax = Math.max(0, Math.min(1, ymax));
        xmax = Math.max(0, Math.min(1, xmax));

        let x = xmin * img.width;
        let y = ymin * img.height;
        let width = (xmax - xmin) * img.width;
        let height = (ymax - ymin) * img.height;

        if (width <= 0 || height <= 0) {
             let w = img.width;
             let h = img.height;
             const maxDim = 1600;
             if (w > h && w > maxDim) {
                 h *= maxDim / w;
                 w = maxDim;
             } else if (h > maxDim) {
                 w *= maxDim / h;
                 h = maxDim;
             }
             canvas.width = w;
             canvas.height = h;
             const ctx = canvas.getContext('2d');
             if (ctx) ctx.drawImage(img, 0, 0, w, h);
             resolve(canvas.toDataURL('image/jpeg', 0.85));
             return;
        }
        
        // downscale if cropped image is too large
        const maxDim = 1600;
        let canvasW = width;
        let canvasH = height;
        if (width > height && width > maxDim) {
             canvasH *= maxDim / width;
             canvasW = maxDim;
        } else if (height > maxDim) {
             canvasW *= maxDim / height;
             canvasH = maxDim;
        }
        
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, x, y, width, height, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getApiKeyForProvider = (provider: AIProvider): string | null => {
  const keyMap = {
      [AIProvider.Gemini]: 'CUSTOM_GEMINI_KEY',
      [AIProvider.OpenRouter]: 'CUSTOM_OPENROUTER_KEY',
      [AIProvider.Venice]: 'CUSTOM_VENICE_KEY',
      [AIProvider.OpenAI]: 'CUSTOM_OPENAI_KEY',
      [AIProvider.xAI]: 'CUSTOM_XAI_KEY'
  };
  const storageKey = keyMap[provider];
  return storageKey && typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
};

const extractAIErrorMessage = (error: any, provider: AIProvider): string => {
  let message = error.message || String(error);
  
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    const detail = typeof data.error === 'string' ? data.error : data.error?.message || JSON.stringify(data);
    
    if (status === 401 || status === 403) {
      return `Authentication failed for ${provider}. Please verify your API key in Settings. (${detail})`;
    } else if (status === 404) {
      return `Model not found on ${provider}. Please select a different model.`;
    } else if (status === 400) {
      return `Invalid request to ${provider}. (${detail})`;
    } else if (status === 429) {
      return `Rate limit exceeded for ${provider}. Please try again later.`;
    }
    return `Server error (${status}) from ${provider}: ${detail}`;
  } 
  
  if (message.toLowerCase().includes("api key") || message.toLowerCase().includes("auth")) {
    return `Authentication issue with ${provider}. Please verify your API key. (${message})`;
  }

  if (message.includes("not found")) {
      return `Model or resource not found on ${provider}. Please select a different model.`;
  }

  return `Communication error with ${provider}: ${message}`;
};

const executeWithFallback = async <T,>(
  provider: AIProvider,
  primaryModelId: string,
  fallbackModelId: string,
  operation: (modelId: string) => Promise<T>
): Promise<T> => {
  try {
    return await operation(primaryModelId);
  } catch (error: any) {
    const errMsg = extractAIErrorMessage(error, provider).toLowerCase();
    const isModelError = errMsg.includes("not found") || 
                         errMsg.includes("discontinued") ||
                         errMsg.includes("invalid request");
                         
    if (isModelError && primaryModelId !== fallbackModelId) {
      console.warn(`[Fallback] Model ${primaryModelId} failed on ${provider}, retrying with ${fallbackModelId}...`);
      try {
          return await operation(fallbackModelId);
      } catch (fallbackError) {
          throw new Error(`Primary model (${primaryModelId}) and fallback model (${fallbackModelId}) both failed.`);
      }
    }
    throw error;
  }
};

export const generateBotResponse = async (
    history: { role: string; parts: { text: string }[] }[], 
    newMessage: string,
    config?: AIModelConfig
): Promise<string> => {
  const provider = config?.provider || AIProvider.Gemini;
  const primaryModel = config?.modelId || (provider === AIProvider.OpenAI ? 'gpt-4o' : 'gemini-3.7-flash');
  let fallbackModel = 'gemini-2.5-flash';
  if (provider === AIProvider.OpenAI) fallbackModel = 'gpt-4o-mini';
  if (provider === AIProvider.OpenRouter) fallbackModel = 'google/gemini-2.5-flash';
  if (provider === AIProvider.Venice) fallbackModel = 'llama-3.3-70b';
  
  return executeWithFallback(provider, primaryModel, fallbackModel, async (modelId) => {
    try {
      const messages = [
        { role: 'system', content: "You are Lumina, an advanced AI assistant for sports card grading, centering, condition appraisal, and restoration." },
        ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0]?.text || '' })),
        { role: 'user', content: newMessage }
      ];
      const response = await axios.post("/api/ai/chat", {
        provider,
        modelId,
        messages,
        apiKey: getApiKeyForProvider(provider)
      });
      return response.data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
      console.error(`${provider} Chat Error:`, error.response?.data || error.message);
      throw new Error(extractAIErrorMessage(error, provider));
    }
  });
};

export const streamBotResponse = async (
    history: { role: string; parts: { text: string }[] }[], 
    newMessage: string,
    onChunk: (text: string) => void,
    config?: AIModelConfig
): Promise<void> => {
  const provider = config?.provider || AIProvider.Gemini;
  const modelId = config?.modelId || (provider === AIProvider.OpenAI ? 'gpt-4o' : 'gemini-2.5-flash');
  
  try {
    const messages = [
      { role: 'system', content: "You are Lumina, an advanced AI assistant for sports card grading, centering, condition appraisal, and restoration." },
      ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0]?.text || '' })),
      { role: 'user', content: newMessage }
    ];
    
    const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           provider,
           modelId,
           messages,
           apiKey: getApiKeyForProvider(provider),
           stream: true
        })
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Server returned ${res.status}: ${errBody}`);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    if (!reader) throw new Error("No response body");

    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed === 'data: [DONE]') return;
            if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.substring(6);
                try {
                   const data = JSON.parse(dataStr);
                   if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                       onChunk(data.choices[0].delta.content);
                   }
                } catch(e) {
                   // ignore JSON parse errors on partial stream chunks
                }
            }
        }
    }
  } catch (error) {
     console.error(`${provider} stream error:`, error);
     throw new Error(extractAIErrorMessage(error, provider));
  }
};

export interface ImageGenerationOptions {
  prompt: string;
  size?: ImageSize;
  aspectRatio?: string;
  config?: AIModelConfig;
}

export interface ImageEditOptions {
  prompt: string;
  imageBase64: string;
  mimeType?: string;
  size?: ImageSize;
  aspectRatio?: string;
  config?: AIModelConfig;
}

export const generateCardImage = async (
  promptOrOptions: string | ImageGenerationOptions, 
  legacySize?: ImageSize, 
  legacyConfig?: AIModelConfig
): Promise<string> => {
  const options: ImageGenerationOptions = typeof promptOrOptions === 'string'
    ? { prompt: promptOrOptions, size: legacySize || ImageSize.Size1K, config: legacyConfig }
    : promptOrOptions;

  const provider = options.config?.provider || AIProvider.Gemini;
  const prompt = options.prompt;
  const size = options.size || ImageSize.Size1K;
  const aspectRatio = options.aspectRatio || '3:4';
  
  let optimizedPrompt = prompt;
  if (provider === AIProvider.Gemini) {
      optimizedPrompt = `Highly detailed, 8k resolution, cinematic lighting, trading card asset, masterwork quality, ${prompt}`;
  } else if (provider === AIProvider.OpenAI) {
      optimizedPrompt = `Generate a photorealistic and highly detailed trading card asset. Concept: ${prompt}. Cinematic lighting, extreme focus, 8k rendering.`;
  } else if (provider === AIProvider.Venice) {
      optimizedPrompt = `masterpiece, best quality, highly detailed trading card, ${prompt}, vibrant colors, sharp focus, volumetric lighting`;
  } else if (provider === AIProvider.OpenRouter) {
      optimizedPrompt = `High fidelity, clear, professional trading card design element. Subject: ${prompt}. Masterpiece quality, intricate details.`;
  } else if (provider === AIProvider.xAI) {
      optimizedPrompt = `High resolution, crisp, beautifully lit trading card art. Prompt: ${prompt}. Photorealistic, vibrant, stunning details.`;
  }
  let primaryModel = options.config?.modelId;
  if (!primaryModel) {
    if (provider === AIProvider.OpenAI) primaryModel = 'gpt-image-2';
    else if (provider === AIProvider.xAI) primaryModel = 'grok-imagine-image-2.0';
    else if (provider === AIProvider.Venice) primaryModel = 'flux-2-pro';
    else if (provider === AIProvider.OpenRouter) primaryModel = 'black-forest-labs/flux.2-pro';
    else primaryModel = 'gemini-3.1-flash-image-preview';
  }

  let fallbackModel = 'gemini-3.1-flash-image';
  if (provider === AIProvider.OpenAI) fallbackModel = 'gpt-image-1.5';
  if (provider === AIProvider.xAI) fallbackModel = 'grok-imagine-image-2.0';
  if (provider === AIProvider.OpenRouter) fallbackModel = 'bytedance-seed/seedream-4.5';
  if (provider === AIProvider.Venice) fallbackModel = 'flux-2-pro';

  return executeWithFallback(provider, primaryModel, fallbackModel, async (modelId) => {
    try {
      const response = await axios.post("/api/ai/generate-image", {
        provider,
        modelId,
        prompt: optimizedPrompt,
        size,
        aspectRatio,
        apiKey: getApiKeyForProvider(provider)
      });
      
      if (response.data.data && response.data.data[0]?.b64_json) {
        return `data:image/png;base64,${response.data.data[0].b64_json}`;
      }
      if (response.data.images && response.data.images[0]?.url) {
        const url = response.data.images[0].url;
        return url.startsWith('data:') ? url : `data:image/png;base64,${url}`;
      }
      if (response.data.image_url) {
        return response.data.image_url;
      }
      throw new Error("No image data returned from generation proxy.");
    } catch (error: any) {
      console.error(`${provider} Image Error:`, error.response?.data || error.message);
      throw new Error(extractAIErrorMessage(error, provider));
    }
  });
};

export const editCardImage = async (options: ImageEditOptions): Promise<{ imageUrl: string; text?: string }> => {
  const provider = options.config?.provider || AIProvider.Gemini;
  const primaryModel = options.config?.modelId || 'gemini-3.1-flash-image-preview';
  const fallbackModel = 'gemini-3.1-flash-image';

  const fullPrompt = `TASK: Execute high-fidelity surface enhancement, denoising, and chromatic optimization on [INPUT_IMAGE: card_crop_rectified].
DO NOT alter the structural layout, typography characters, or player likeness.

1. EDGE RECTIFICATION & ALIGNMENT
- Enforce razor-sharp 90-degree outer card boundaries along the detected physical perimeter.
- Eliminate peripheral sensor noise, lens distortion aberrations, and background artifacts.

2. SURFACE DENOISING & TOTAL VARIATION FILTERING
- Apply flat pixel smoothing to the card stock background to eliminate high-frequency CMOS sensor grain.
- Prevent gradient stalls; isolate the structural line-art and text boundaries to maintain high localized contrast.

3. CHROMATIC REFRACTOR POLISH (SPECIFIC TO CARD STYLE)
- Cyberpunk / Prizm: Target the specular highlights on the chromium plate. Shift the reflection vector to map deep, vibrant color tracking without saturating core player midtones.
- Vintage Sepia: Smooth out modern digitizer artifacts while preserving coarse, organic paper-fiber texture matrix.

4. SHARPENING & CONTRAST MAXIMIZATION
- Sharpen micro-printed emblems, serial numbers, and foil-stamp boundaries by 25% localized edge contrast.
- Ensure all text characters are perfectly legible and free of anti-aliasing blur.

OUTPUT: Flat, top-down, clean 50/50 centered physical card asset matching input coordinates.

STYLE TRANSFORMATION:
${options.prompt}`;

  return executeWithFallback(provider, primaryModel, fallbackModel, async (modelId) => {
    try {
      const response = await axios.post("/api/ai/edit-image", {
        provider,
        modelId,
        prompt: fullPrompt,
        imageBase64: options.imageBase64,
        mimeType: options.mimeType || 'image/png',
        size: options.size || ImageSize.Size1K,
        aspectRatio: options.aspectRatio || '3:4',
        apiKey: getApiKeyForProvider(provider)
      });

      if (response.data.image_url) {
        return {
          imageUrl: response.data.image_url,
          text: response.data.text
        };
      }
      if (response.data.data && response.data.data[0]?.b64_json) {
        return {
          imageUrl: `data:image/png;base64,${response.data.data[0].b64_json}`,
          text: response.data.text
        };
      }
      throw new Error("No image data returned from image edit proxy.");
    } catch (error: any) {
      console.error(`${provider} Image Edit Error:`, error.response?.data || error.message);
      throw new Error(extractAIErrorMessage(error, provider));
    }
  });
};

export const analyzeCardDamage = async (file: File, config?: AIModelConfig): Promise<AnalysisResult> => {
    const provider = config?.provider || AIProvider.Gemini;
    const base64 = await fileToBase64(file);
    const primaryModel = config?.modelId || (provider === AIProvider.OpenAI ? 'gpt-4o' : 'gemini-3.7-flash');
    let fallbackModel = 'gemini-2.5-flash';
    if (provider === AIProvider.OpenAI) fallbackModel = 'gpt-4o-mini';
    if (provider === AIProvider.OpenRouter) fallbackModel = 'google/gemini-2.5-flash';
    if (provider === AIProvider.Venice) fallbackModel = 'llama-3.2-90b-vision';
    if (provider === AIProvider.xAI) fallbackModel = 'grok-2-vision-1212';

    const promptText = `Analyze this sports card image.
1. Detect the main bounding box of the card exactly [ymin, xmin, ymax, xmax] as floats between 0.0 and 1.0.
2. Identify specific condition issues (e.g., Scratches, Dust, Corner Wear, Centering, Creases).
3. For each issue, provide its type, a brief description, a severity score (0-100), and its specific bounding box [ymin, xmin, ymax, xmax] as floats between 0.0 and 1.0 relative to the overall image.
4. Provide an overall damage score (0-100) where 100 is pristine and 0 is destroyed.
Return JSON matching the schema.`;

    return executeWithFallback(provider, primaryModel, fallbackModel, async (modelId) => {
        try {
            const schemaPrompt = `${promptText}

Ensure your response is valid JSON matching this exact structure:
{
  "damageScore": 85,
  "issues": ["Minor surface scratch", "Top-right corner softness"],
  "detailedIssues": [
    {
       "type": "Scratch",
       "description": "Hairline surface scratch on bottom right gloss",
       "severity": 15,
       "boundingBox": [0.72, 0.65, 0.82, 0.78]
    }
  ],
  "recommendedFixes": ["Descratch surface mask", "Edge sharpening"],
  "boundingBox": [0.05, 0.05, 0.95, 0.95]
}`;
            const response = await axios.post("/api/ai/analyze", {
                provider,
                modelId,
                prompt: schemaPrompt,
                imageBase64: base64,
                mimeType: file.type || 'image/jpeg',
                apiKey: getApiKeyForProvider(provider)
            });
            return response.data;
        } catch (error: any) {
            console.error(`${provider} Analysis Error:`, error);
            throw new Error(extractAIErrorMessage(error, provider));
        }
    }).catch(error => {
        throw new Error(`Analysis failed: ${error.message}`);
    });
};

export const restoreCard = async (file: File, settings: ProcessingSettings, analysis?: AnalysisResult): Promise<string> => {
    const config = settings.aiConfig;
    const provider = config?.provider || AIProvider.Gemini;
    const primaryModel = config?.modelId || (provider === AIProvider.OpenAI ? 'gpt-image-2' : 'gemini-3.7-flash');
    let fallbackModel = 'gemini-2.5-flash';
    if (provider === AIProvider.OpenAI) fallbackModel = 'gpt-image-2';
    if (provider === AIProvider.OpenRouter) fallbackModel = 'google/gemini-2.5-flash';
    if (provider === AIProvider.Venice) fallbackModel = 'qwen-image-3-pro-edit';
    if (provider === AIProvider.xAI) fallbackModel = 'grok-imagine-image-2.0';

    let base64Image = '';
    let mimeType = file.type || 'image/jpeg';
    
    if (settings.autoCrop && analysis?.boundingBox) {
       const croppedDataUrl = await cropImage(file, analysis.boundingBox);
       base64Image = croppedDataUrl.split(',')[1];
       mimeType = 'image/jpeg';
    } else {
       base64Image = await fileToBase64(file);
    }

    let strengthPrompt = "";
    if (settings.restorationStrength < 0.33) {
        strengthPrompt = "Perform a conservative restoration. Only remove obvious dust. Do not alter texture.";
    } else if (settings.restorationStrength < 0.66) {
        strengthPrompt = "Balanced restoration. Remove scratches and dust. Sharpen text slightly. Keep paper grain visible.";
    } else {
        strengthPrompt = "Complete restoration. Remove all scratches, creases and surface wear. Reconstruct damaged corners. Crisp denoise and sharpening.";
    }

    const prompt = `Task: Sports Card Restoration.\n${strengthPrompt}\n${settings.enableUpscaling ? "Upscale the image resolution and enhance clarity." : ""}\nInput Context: Card issues: ${analysis?.issues?.join(", ") || "General surface wear"}.\nRequirement: Return clean high-definition scan of the card with flawless centering and edges.`;

    return executeWithFallback(provider, primaryModel, fallbackModel, async (modelId) => {
        try {
            const response = await axios.post("/api/ai/restore", {
                provider,
                modelId,
                prompt,
                imageBase64: base64Image,
                mimeType,
                settings,
                apiKey: getApiKeyForProvider(provider)
            });
            const imgData = response.data.images?.[0];
            if (imgData && imgData.url) {
                if (imgData.url.startsWith('data:')) return imgData.url;
                return `data:image/png;base64,${imgData.url}`;
            }
            if (response.data.image_url) return response.data.image_url;
            throw new Error("No image data received from restoration proxy.");
        } catch (error: any) {
            console.error(`${provider} Restore Error:`, error.response?.data || error.message);
            throw new Error(extractAIErrorMessage(error, provider));
        }
    });
};

