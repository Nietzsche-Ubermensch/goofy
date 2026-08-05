import { GoogleGenAI, Type } from "@google/genai";
import axios from "axios";
import { 
  ImageSize, 
  ProcessingSettings, 
  AnalysisResult, 
  AIProvider, 
  AIModelConfig 
} from "../types";

// Helper to get the AI client for Gemini
const getGeminiClient = async (useUserSelectedKey: boolean = false) => {
  let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey && typeof window !== 'undefined') {
    apiKey = localStorage.getItem('CUSTOM_GEMINI_KEY') || '';
  }
  return new GoogleGenAI({ apiKey });
};

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
  return storageKey ? localStorage.getItem(storageKey) : null;
}

const extractAIErrorMessage = (error: any, provider: AIProvider): string => {
  let message = error.message || String(error);
  
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    const detail = typeof data.error === 'string' ? data.error : data.error?.message || JSON.stringify(data);
    
    if (status === 401 || status === 403) {
      return `Authentication failed for ${provider}. Please verify your API key in Settings. (${detail})`;
    } else if (status === 404) {
      return `Model not found on ${provider}. It may have been discontinued. Please select a different model.`;
    } else if (status === 400) {
      return `Invalid request to ${provider}. The model might not support this operation, or the input format is incorrect. (${detail})`;
    } else if (status === 429) {
      return `Rate limit exceeded for ${provider}. Please try again later or check your account tier.`;
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
                         errMsg.includes("invalid request"); // 400 can be model doesn't support format
                         
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
  const primaryModel = config?.modelId || 'gemini-3.1-flash-lite';
  let fallbackModel = 'gemini-1.5-pro';
  if (provider === AIProvider.OpenRouter) fallbackModel = 'google/gemini-2.0-flash-001';
  if (provider === AIProvider.Venice) fallbackModel = 'llama-3.2-3b';
  
  return executeWithFallback(provider, primaryModel, fallbackModel, async (modelId) => {
    if (provider === AIProvider.Gemini) {
      try {
        const ai = await getGeminiClient();
        const chat = ai.chats.create({
          model: modelId,
          history: history,
          config: {
            systemInstruction: "You are 'Lumina', an advanced AI assistant for Sports Card restoration. You are concise, professional, and knowledgeable about card grading (PSA/BGS), surface damage, and value.",
          }
        });
        const result = await chat.sendMessage({ message: newMessage });
        return result.text || "I couldn't generate a response.";
      } catch (error) {
        console.error("Gemini Chat Error:", error);
        throw new Error(extractAIErrorMessage(error, AIProvider.Gemini));
      }
    } else {
      // OpenRouter or Venice
      try {
        const messages = [
          { role: 'system', content: "You are 'Lumina', an advanced AI assistant for Sports Card restoration. You are concise, professional, and knowledgeable about card grading (PSA/BGS), surface damage, and value." },
          ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
          { role: 'user', content: newMessage }
        ];
        const response = await axios.post("/api/ai/chat", {
          provider,
          modelId,
          messages,
          apiKey: getApiKeyForProvider(provider)
        });
        return response.data.choices[0].message.content;
      } catch (error: any) {
        console.error(`${provider} Chat Error:`, error.response?.data || error.message);
        throw new Error(extractAIErrorMessage(error, provider));
      }
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
  const modelId = config?.modelId || 'gemini-3.1-flash-lite';
  
  if (provider === AIProvider.Gemini) {
      try {
        const ai = await getGeminiClient();
        const chat = ai.chats.create({
          model: modelId,
          history: history,
          config: {
            systemInstruction: "You are 'Lumina', an advanced AI assistant for Sports Card restoration. You are concise, professional, and knowledgeable about card grading (PSA/BGS), surface damage, and value.",
          }
        });
        const resultStream = await chat.sendMessageStream({ message: newMessage });
        for await (const chunk of resultStream) {
           onChunk(chunk.text || "");
        }
      } catch (error) {
        console.error("Gemini stream error:", error);
        throw new Error(extractAIErrorMessage(error, AIProvider.Gemini));
      }
  } else {
      try {
        const messages = [
          { role: 'system', content: "You are 'Lumina', an advanced AI assistant for Sports Card restoration. You are concise, professional, and knowledgeable about card grading (PSA/BGS), surface damage, and value." },
          ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
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
            buffer = lines.pop() || ""; // keep the last incomplete line in the buffer
            
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
                       // ignore JSON parse errors
                    }
                }
            }
        }
      } catch (error) {
         console.error(`${provider} stream error:`, error);
         throw new Error(extractAIErrorMessage(error, provider));
      }
  }
};

export const generateCardImage = async (prompt: string, size: ImageSize, config?: AIModelConfig): Promise<string> => {
  const provider = config?.provider || AIProvider.Gemini;
  
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
  const primaryModel = config?.modelId || 'gemini-3-pro-image-preview';
  let fallbackModel = 'gemini-1.5-flash';
  if (provider === AIProvider.OpenRouter) fallbackModel = 'google/gemini-2.0-flash-001';
  if (provider === AIProvider.Venice) fallbackModel = 'flux-2-pro';

  return executeWithFallback(provider, primaryModel, fallbackModel, async (modelId) => {
    if (provider === AIProvider.Gemini) {
      try {
        const ai = await getGeminiClient(true);
        const response = await ai.models.generateImages({
          model: modelId,
          prompt: optimizedPrompt,
          config: {
             outputMimeType: 'image/png',
             aspectRatio: '3:4',
             imageSize: size as any
          }
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
           return `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
        }
        throw new Error("No image data received from the model.");
      } catch (error) {
        console.error("Image Generation Error:", error);
        throw new Error(extractAIErrorMessage(error, AIProvider.Gemini));
      }
    } else {
      try {
        const response = await axios.post("/api/ai/generate-image", {
          provider,
          modelId,
          prompt: optimizedPrompt,
          size,
          apiKey: getApiKeyForProvider(provider)
        });
        
        if (provider === AIProvider.Venice) {
            const imgData = response.data.images[0];
            if (imgData.url.startsWith('data:')) return imgData.url;
            return `data:image/png;base64,${imgData.url}`;
        } else if (provider === AIProvider.OpenAI || provider === AIProvider.xAI) {
             return `data:image/png;base64,${response.data.data[0].b64_json}`;
        }
        return response.data.image_url || response.data.images?.[0]?.url || "";
      } catch (error: any) {
        console.error(`${provider} Image Error:`, error.response?.data || error.message);
        throw new Error(extractAIErrorMessage(error, provider));
      }
    }
  });
};

export const analyzeCardDamage = async (file: File, config?: AIModelConfig): Promise<AnalysisResult> => {
    const provider = config?.provider || AIProvider.Gemini;
    const base64 = await fileToBase64(file);
    const primaryModel = config?.modelId || 'gemini-3.1-pro-preview';
    let fallbackModel = 'gemini-1.5-flash';
    if (provider === AIProvider.OpenRouter) fallbackModel = 'google/gemini-2.0-flash-001';
    if (provider === AIProvider.Venice) fallbackModel = 'llama-3.2-11b-vision';

    const promptText = `Analyze this sports card image.
1. Detect the main bounding box of the card exactly [ymin, xmin, ymax, xmax] as floats between 0.0 and 1.0.
2. Identify specific condition issues (e.g., Scratches, Dust, Corner Wear, Centering, Creases).
3. For each issue, provide its type, a brief description, a severity score (0-100), and its specific bounding box [ymin, xmin, ymax, xmax] as floats between 0.0 and 1.0 relative to the overall image.
4. Provide an overall damage score (0-100) where 100 is pristine and 0 is destroyed.
Return JSON matching the schema.`;

    return executeWithFallback(provider, primaryModel, fallbackModel, async (modelId) => {
        if (provider === AIProvider.Gemini) {
            try {
                const ai = await getGeminiClient(true);
                const response = await ai.models.generateContent({
                    model: modelId,
                    contents: {
                        parts: [
                            { inlineData: { mimeType: file.type, data: base64 } },
                            { text: promptText }
                        ]
                    },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                damageScore: { type: Type.NUMBER },
                                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                                detailedIssues: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            type: { type: Type.STRING, description: "Type of damage (e.g., Scratch, Corner Wear)" },
                                            description: { type: Type.STRING, description: "Brief description of the issue" },
                                            severity: { type: Type.NUMBER, description: "Severity score 0-100" },
                                            boundingBox: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "ymin, xmin, ymax, xmax relative to image" }
                                        }
                                    }
                                },
                                recommendedFixes: { type: Type.ARRAY, items: { type: Type.STRING } },
                                boundingBox: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Main card bounding box: ymin, xmin, ymax, xmax" }
                            }
                        }
                    }
                });
                
                if (response.text) {
                    return JSON.parse(response.text);
                }
                throw new Error("No text received from Gemini");
            } catch (error) {
                console.error("Gemini Analysis Error:", error);
                const errMsg = extractAIErrorMessage(error, AIProvider.Gemini);
                // Throw so executeWithFallback can catch it
                throw new Error(errMsg);
            }
        } else {
            // OpenRouter or Venice
            try {
                const schemaPrompt = `${promptText}

Ensure your response is valid JSON that strictly matches this structure:
{
  "damageScore": number (0-100),
  "issues": string[],
  "detailedIssues": [
    {
       "type": string,
       "description": string,
       "severity": number (0-100),
       "boundingBox": number[] (4 floats: ymin, xmin, ymax, xmax)
    }
  ],
  "recommendedFixes": string[],
  "boundingBox": number[] (4 floats: ymin, xmin, ymax, xmax)
}`;
                const response = await axios.post("/api/ai/analyze", {
                    provider,
                    modelId,
                    prompt: schemaPrompt,
                    imageBase64: base64,
                    mimeType: file.type,
                    apiKey: getApiKeyForProvider(provider)
                });
                return response.data;
            } catch (error) {
                console.error(`${provider} Analysis Error:`, error);
                throw new Error(extractAIErrorMessage(error, provider));
            }
        }
    }).catch(error => {
        throw new Error(`Analysis failed: ${error.message}`);
    });
};

export const restoreCard = async (file: File, settings: ProcessingSettings, analysis?: AnalysisResult): Promise<string> => {
    const config = settings.aiConfig;
    const provider = config?.provider || AIProvider.Gemini;
    const primaryModel = config?.modelId || 'gemini-3.1-flash-image-preview';
    let fallbackModel = 'gemini-1.5-flash';
    if (provider === AIProvider.OpenRouter) fallbackModel = 'google/gemini-2.0-flash-001';
    if (provider === AIProvider.Venice) fallbackModel = 'qwen-image-2-pro-edit';

    let base64Image = '';
    let mimeType = file.type;
    
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
        strengthPrompt = "Balance restoration. Remove scratches and dust. Sharpen text slightly. Keep paper grain visible.";
    } else {
        strengthPrompt = "Heavy restoration. Completely remove all scratches, creases and surface wear. Reconstruct damaged corners. Aggressive denoise and sharpening.";
    }

    const prompt = `Task: Sports Card Restoration.\n${strengthPrompt}\n${settings.enableUpscaling ? "Upscale the image resolution and enhance clarity." : ""}\nInput Context: The card has ${analysis?.issues.join(", ")}.\nRequirement: You MUST return a single image as the output. The image should be a restored version of the input card.\nConstraint: Preserve player face, team logos, and text PERFECTLY. Output as a clean, high-quality scan. If you cannot generate an image, tell me why in one sentence.`;

    return executeWithFallback(provider, primaryModel, fallbackModel, async (modelId) => {
        if (provider === AIProvider.Gemini) {
            try {
                const ai = await getGeminiClient(true);
                const response = await ai.models.generateContent({
                    model: modelId,
                    contents: {
                        parts: [
                            { inlineData: { mimeType: mimeType, data: base64Image } },
                            { text: prompt }
                        ]
                    },
                    config: {
                        imageConfig: {
                            imageSize: "1K",
                            aspectRatio: "3:4"
                        }
                    }
                });
                
                const parts = response.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                    if (part.inlineData) {
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
                
                if (response.text) {
                    throw new Error(`Restoration failed (Safety/Text): ${response.text}`);
                }
                
                throw new Error("Restoration failed: No image returned from model.");
            } catch (error) {
                console.error("Gemini Restore Error:", error);
                throw new Error(extractAIErrorMessage(error, AIProvider.Gemini));
            }
        } else {
            // OpenRouter or Venice
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
                throw new Error("No image data received from proxy.");
            } catch (error: any) {
                console.error(`${provider} Restore Error:`, error.response?.data || error.message);
                throw new Error(extractAIErrorMessage(error, provider));
            }
        }
    });
};
