
import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import multer from "multer";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { getEffectiveKey, type AIProvider } from "./src/server/apiKeys";
import { 
  APPROVED_PRESETS, 
  getAuthenticatedSession, 
  createEnhancementJob, 
  getJobById, 
  cancelJobById,
  initStorageDirectories 
} from "./src/server/cardEnhancementPipeline";

dotenv.config();
initStorageDirectories();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, JPEG, WEBP) are supported.'));
    }
  }
});

let geminiClientInstance: GoogleGenAI | null = null;
function getGemini(apiKey?: string): GoogleGenAI {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenAI({ apiKey: key });
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Route for Proxying AI chat requests
  app.post("/api/ai/chat", async (req, res) => {
    const { provider, modelId, messages, apiKey, stream } = req.body;
    
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey && provider !== 'Gemini') {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }

    try {
      if (provider === 'Gemini') {
        const ai = getGemini(effectiveKey || undefined);
        const model = modelId || "gemini-3.7-flash";
        
        // Extract history and prompt
        const formattedHistory = (messages || [])
          .filter((m: any, idx: number) => idx < messages.length - 1 && m.role !== 'system')
          .map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
          }));

        const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : { content: "" };
        const promptText = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);

        const systemMsg = messages?.find((m: any) => m.role === 'system');
        const systemInstruction = systemMsg ? (typeof systemMsg.content === 'string' ? systemMsg.content : JSON.stringify(systemMsg.content)) : "You are Lumina, an expert sports card restoration and grading assistant.";

        if (stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          const chat = ai.chats.create({
            model,
            history: formattedHistory,
            config: {
              systemInstruction,
            }
          });

          const resultStream = await chat.sendMessageStream({ message: promptText });
          for await (const chunk of resultStream) {
            const deltaText = chunk.text || "";
            const payload = {
              choices: [{ delta: { content: deltaText } }]
            };
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
          }
          res.write("data: [DONE]\n\n");
          return res.end();
        } else {
          const chat = ai.chats.create({
            model,
            history: formattedHistory,
            config: {
              systemInstruction,
            }
          });
          const result = await chat.sendMessage({ message: promptText });
          return res.json({
            choices: [{
              message: { role: 'assistant', content: result.text || "" }
            }]
          });
        }
      }

      let url = "";
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${effectiveKey}`,
        "Content-Type": "application/json"
      };

      if (provider === 'OpenRouter') {
        url = "https://openrouter.ai/api/v1/chat/completions";
        headers["HTTP-Referer"] = "https://aistudio.google.com";
        headers["X-Title"] = "CardCrop AI Suite";
      } else if (provider === 'Venice') {
        url = "https://api.venice.ai/api/v1/chat/completions";
      } else if (provider === 'OpenAI') {
        url = "https://api.openai.com/v1/chat/completions";
      } else if (provider === 'xAI') {
        url = "https://api.x.ai/v1/chat/completions";
      }

      if (url) {
        const response = await axios.post(url, {
          model: modelId || (provider === 'OpenAI' ? 'gpt-4o' : provider === 'OpenRouter' ? 'openai/gpt-4o' : 'llama-3.3-70b'),
          messages: messages,
          stream: !!stream
        }, {
          headers,
          responseType: stream ? 'stream' : 'json'
        });

        if (stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          response.data.pipe(res);
          return;
        } else {
          return res.json(response.data);
        }
      }
      
      res.status(400).json({ error: "Unsupported provider for chat proxy" });
    } catch (error: any) {
      console.error("AI Proxy Chat Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // API Route for Image Generation and Editing Proxy
  app.post("/api/ai/generate-image", async (req, res) => {
    const { provider, modelId, prompt, size, aspectRatio, imageBase64, mimeType, apiKey } = req.body;
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey && provider !== 'Gemini') {
      return res.status(401).json({ error: "API key missing" });
    }
    
    try {
      if (provider === 'Gemini') {
        const ai = getGemini(effectiveKey || undefined);
        let model = modelId || "gemini-3.1-flash-image";
        if (model === "gemini-3.1-flash-image-preview" || model === "nano-banana-2") {
          model = "gemini-3.1-flash-image";
        }

        // Check if legacy Imagen model requested
        if (model.startsWith('imagen-')) {
          try {
            const response = await ai.models.generateImages({
              model,
              prompt,
              config: {
                outputMimeType: 'image/png',
                aspectRatio: (aspectRatio as any) || '3:4',
                numberOfImages: 1
              }
            });
            if (response.generatedImages && response.generatedImages.length > 0) {
              const b64 = response.generatedImages[0].image.imageBytes;
              return res.json({
                data: [{ b64_json: b64 }],
                image_url: `data:image/png;base64,${b64}`,
                modelUsed: model
              });
            }
          } catch (imagenErr) {
            console.warn("Imagen fallback to Gemini flash image:", imagenErr);
            model = "gemini-3.1-flash-image";
          }
        }

        // Modern Gemini 3.1 Flash Image / Nano Banana generation & editing via generateContent
        const parts: any[] = [];
        if (imageBase64) {
          const cleanB64 = imageBase64.replace(/^data:image\/[a-z0-9]+;base64,/, '');
          parts.push({
            inlineData: {
              data: cleanB64,
              mimeType: mimeType || 'image/png'
            }
          });
        }
        parts.push({ text: prompt });

        const imageConfig: any = {
          aspectRatio: aspectRatio || "3:4"
        };
        if (size) {
          imageConfig.imageSize = size;
        }

        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            imageConfig
          }
        });

        let foundImageUrl = "";
        let textResult = "";

        if (response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              const b64 = part.inlineData.data;
              const mime = part.inlineData.mimeType || 'image/png';
              foundImageUrl = `data:${mime};base64,${b64}`;
            } else if (part.text) {
              textResult += part.text;
            }
          }
        }

        if (foundImageUrl) {
          return res.json({
            data: [{ b64_json: foundImageUrl.replace(/^data:image\/[a-z0-9]+;base64,/, '') }],
            image_url: foundImageUrl,
            text: textResult,
            modelUsed: model
          });
        }

        if (textResult) {
          return res.json({
            data: [],
            image_url: "",
            text: textResult,
            modelUsed: model
          });
        }

        return res.status(500).json({ error: "No image content returned by Gemini image model" });
      } else if (provider === 'Venice') {
        const isAspectRatioModel = modelId?.includes('qwen-image-2') || modelId?.includes('wan') || modelId?.includes('flux-2');
        const isResolutionModel = modelId?.includes('imagineart') || modelId?.includes('gpt-image') || modelId?.includes('nano-banana');

        const payload: Record<string, any> = {
          model: modelId || "flux-2-pro",
          prompt: prompt,
          steps: 30,
        };

        if (isAspectRatioModel) {
          payload.aspect_ratio = "3:4";
        } else if (isResolutionModel) {
          payload.resolution = size || '1K'; 
          payload.aspect_ratio = "3:4";
        } else {
          payload.width = size === '2K' ? 2048 : 1024;
          payload.height = size === '2K' ? 2048 : 1024;
        }

        const response = await axios.post("https://api.venice.ai/api/v1/image/generate", payload, {
          headers: { "Authorization": `Bearer ${effectiveKey}` }
        });
        return res.json(response.data);
      } else if (provider === 'OpenAI') {
        const selectedModel = modelId || "gpt-image-2";
        const isLegacyDallE = selectedModel.startsWith('dall-e');
        const payload: Record<string, any> = {
          model: selectedModel,
          prompt: prompt,
          n: 1,
          size: size || "1024x1024",
          quality: "high"
        };
        if (isLegacyDallE) {
          payload.response_format = "b64_json";
        }
        const response = await axios.post("https://api.openai.com/v1/images/generations", payload, {
          headers: { "Authorization": `Bearer ${effectiveKey}` }
        });
        return res.json(response.data);
      } else if (provider === 'xAI') {
        const selectedModel = modelId || "grok-imagine-image-2.0";
        const resolution = (size === '2K' || size === '4K') ? '2k' : '1k';
        const response = await axios.post("https://api.x.ai/v1/images/generations", {
          model: selectedModel,
          prompt: prompt,
          n: 1,
          aspect_ratio: "1:1",
          resolution: resolution,
          quality: "medium",
          response_format: "b64_json"
        }, {
          headers: { 
            "Authorization": `Bearer ${effectiveKey}`,
            "Content-Type": "application/json"
          }
        });
        return res.json(response.data);
      } else if (provider === 'OpenRouter') {
        const selectedModel = modelId || "black-forest-labs/flux.2-pro";
        try {
          const response = await axios.post("https://openrouter.ai/api/v1/images/generations", {
            model: selectedModel,
            prompt: prompt,
            n: 1,
            size: size || "1024x1024",
            response_format: "b64_json"
          }, {
            headers: { 
              "Authorization": `Bearer ${effectiveKey}`,
              "HTTP-Referer": "https://aistudio.google.com",
              "X-Title": "CardCrop AI Suite"
            }
          });
          return res.json(response.data);
        } catch (imgGenErr: any) {
          const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: selectedModel,
            messages: [{ role: "user", content: prompt }]
          }, {
            headers: { 
              "Authorization": `Bearer ${effectiveKey}`,
              "HTTP-Referer": "https://aistudio.google.com",
              "X-Title": "CardCrop AI Suite"
            }
          });
          return res.json(response.data);
        }
      }
      res.status(400).json({ error: "Unsupported provider for image proxy" });
    } catch (error: any) {
      console.error("Generate Image Proxy Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // Dedicated Image Editing route using Gemini 3.1 Flash Image
  app.post("/api/ai/edit-image", async (req, res) => {
    const { prompt, imageBase64, mimeType, modelId, aspectRatio, size, apiKey, provider } = req.body;
    const selectedProvider = provider || 'Gemini';
    const effectiveKey = getEffectiveKey(selectedProvider, apiKey);

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required for image editing." });
    }
    if (!imageBase64) {
      return res.status(400).json({ error: "Input image is required for image editing." });
    }

    try {
      if (selectedProvider === 'Gemini') {
        const ai = getGemini(effectiveKey || undefined);
        let model = modelId || "gemini-3.1-flash-image";
        if (model === "gemini-3.1-flash-image-preview" || model === "nano-banana-2") {
          model = "gemini-3.1-flash-image";
        }

        const cleanB64 = imageBase64.replace(/^data:image\/[a-z0-9]+;base64,/, '');
        const parts = [
          {
            inlineData: {
              data: cleanB64,
              mimeType: mimeType || 'image/png'
            }
          },
          {
            text: prompt
          }
        ];

        const imageConfig: any = {};
        if (aspectRatio) imageConfig.aspectRatio = aspectRatio;
        if (size) imageConfig.imageSize = size;

        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {})
          }
        });

        let editedImageUrl = "";
        let explanationText = "";

        if (response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              const b64 = part.inlineData.data;
              const mime = part.inlineData.mimeType || 'image/png';
              editedImageUrl = `data:${mime};base64,${b64}`;
            } else if (part.text) {
              explanationText += part.text;
            }
          }
        }

        if (editedImageUrl) {
          return res.json({
            image_url: editedImageUrl,
            text: explanationText,
            modelUsed: model,
            success: true
          });
        }

        return res.status(500).json({ 
          error: "Model did not return an edited image part.",
          text: explanationText 
        });
      }

      res.status(400).json({ error: `Image editing is not supported on provider ${selectedProvider}` });
    } catch (error: any) {
      console.error("Image Edit API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // API Route for Vision/Analysis Proxy
  app.post("/api/ai/analyze", async (req, res) => {
    const { provider, modelId, imageBase64, mimeType, prompt, apiKey } = req.body;
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey && provider !== 'Gemini') {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }

    try {
      if (provider === 'Gemini') {
        const ai = getGemini(effectiveKey || undefined);
        const model = modelId || "gemini-3.7-flash";
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
              { text: prompt }
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
          return res.json(JSON.parse(response.text));
        }
        throw new Error("No analysis data returned from Gemini");
      } else if (provider === 'OpenRouter') {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
          model: modelId || "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        }, {
          headers: {
            "Authorization": `Bearer ${effectiveKey}`,
            "HTTP-Referer": "https://aistudio.google.com", 
            "X-Title": "CardCrop AI Suite",
          }
        });
        
        let content = response.data.choices[0].message.content || '';
        const match = content.match(/\{[\s\S]*\}/);
        if (match) content = match[0];
        return res.json(JSON.parse(content));
      } else if (provider === 'Venice') {
        const response = await axios.post("https://api.venice.ai/api/v1/chat/completions", {
          model: modelId || "llama-3.2-90b-vision",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        }, {
          headers: { "Authorization": `Bearer ${effectiveKey}` }
        });
        let content = response.data.choices[0].message.content || '';
        const match = content.match(/\{[\s\S]*\}/);
        if (match) content = match[0];
        return res.json(JSON.parse(content));
      } else if (provider === 'OpenAI' || provider === 'xAI') {
        const apiUrl = provider === 'OpenAI' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.x.ai/v1/chat/completions';
        const response = await axios.post(apiUrl, {
          model: modelId || (provider === 'OpenAI' ? 'gpt-4o' : 'grok-2-vision-1212'),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        }, { headers: { 'Authorization': `Bearer ${effectiveKey}` } });
        let content = response.data.choices[0].message.content || '';
        const match = content.match(/\{[\s\S]*\}/);
        if (match) content = match[0];
        return res.json(JSON.parse(content));
      }
      
      res.status(400).json({ error: "Unsupported provider for analysis proxy" });
    } catch (error: any) {
      console.error("Analysis Proxy Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // API Route for Image Restoration Proxy
  app.post("/api/ai/restore", async (req, res) => {
    const { provider, modelId, imageBase64, mimeType, prompt, settings, apiKey } = req.body;
    const effectiveKey = getEffectiveKey(provider, apiKey);

    if (!effectiveKey && provider !== 'Gemini') {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }

    try {
      if (provider === 'Gemini') {
        const ai = getGemini(effectiveKey || undefined);
        const model = modelId || "gemini-3.7-flash";
        
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
              { text: prompt }
            ]
          }
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData) {
            return res.json({
              image_url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
              images: [{ url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` }]
            });
          }
        }

        // If returned text (e.g. restoration summary or instructions), return clean dataUrl pass-through
        return res.json({
          image_url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
          images: [{ url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` }],
          text: response.text
        });
      } else if (provider === 'Venice') {
        const response = await axios.post("https://api.venice.ai/api/v1/image/edit", {
          model: modelId || "qwen-image-2-pro-edit",
          prompt: prompt,
          image: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
        }, {
          headers: { "Authorization": `Bearer ${effectiveKey}` }
        });
        return res.json(response.data);
      } else if (provider === 'OpenAI') {
        const editModel = (modelId && (modelId.startsWith('gpt-image') || modelId.startsWith('chatgpt-image')))
          ? modelId 
          : 'gpt-image-2';

        try {
          // Use OpenAI official /images/edits endpoint with base64 data URL
          const editResponse = await axios.post("https://api.openai.com/v1/images/edits", {
            images: [
              {
                image_url: `data:${mimeType || 'image/png'};base64,${imageBase64}`
              }
            ],
            prompt: `Flawlessly restore and clean this sports trading card scan. ${prompt}. Pristine centering, sharp edges, clean gloss surface, remove dust, scratches, creases and corner wear. Preserve original player, graphics, and card text authentically.`,
            model: editModel,
            quality: "high",
            size: "1024x1024",
            output_format: "png"
          }, {
            headers: { 
              "Authorization": `Bearer ${effectiveKey}`,
              "Content-Type": "application/json"
            }
          });

          if (editResponse.data.data && editResponse.data.data[0]?.b64_json) {
            const b64 = editResponse.data.data[0].b64_json;
            return res.json({
              image_url: `data:image/png;base64,${b64}`,
              images: [{ url: `data:image/png;base64,${b64}` }]
            });
          }
          return res.json(editResponse.data);
        } catch (editErr: any) {
          console.warn("OpenAI /images/edits error, falling back to /images/generations:", editErr.response?.data || editErr.message);
          const response = await axios.post("https://api.openai.com/v1/images/generations", {
            model: "gpt-image-2",
            prompt: `Flawlessly restored high-definition sports trading card scan. ${prompt}. Pristine centering, sharp edges, clean gloss surface.`,
            n: 1,
            size: "1024x1024",
            quality: "high"
          }, {
            headers: { "Authorization": `Bearer ${effectiveKey}` }
          });
          
          if (response.data.data && response.data.data[0]?.b64_json) {
            const b64 = response.data.data[0].b64_json;
            return res.json({
              image_url: `data:image/png;base64,${b64}`,
              images: [{ url: `data:image/png;base64,${b64}` }]
            });
          }
          return res.json(response.data);
        }
      } else if (provider === 'xAI') {
        const editModel = modelId || 'grok-imagine-image-2.0';
        try {
          const editResponse = await axios.post("https://api.x.ai/v1/images/edits", {
            model: editModel,
            prompt: `Flawlessly restore and clean this sports trading card scan. ${prompt}. Pristine centering, sharp edges, clean gloss surface, remove dust, scratches, creases and corner wear. Preserve original player, graphics, and card text authentically.`,
            image: {
              url: `data:${mimeType || 'image/png'};base64,${imageBase64}`,
              type: "image_url"
            },
            image_url: `data:${mimeType || 'image/png'};base64,${imageBase64}`,
            response_format: "b64_json"
          }, {
            headers: {
              "Authorization": `Bearer ${effectiveKey}`,
              "Content-Type": "application/json"
            }
          });

          if (editResponse.data.data && editResponse.data.data[0]?.b64_json) {
            const b64 = editResponse.data.data[0].b64_json;
            return res.json({
              image_url: `data:image/png;base64,${b64}`,
              images: [{ url: `data:image/png;base64,${b64}` }]
            });
          }
          if (editResponse.data.data && editResponse.data.data[0]?.url) {
            return res.json({
              image_url: editResponse.data.data[0].url,
              images: [{ url: editResponse.data.data[0].url }]
            });
          }
          if (editResponse.data.url) {
            return res.json({
              image_url: editResponse.data.url,
              images: [{ url: editResponse.data.url }]
            });
          }
          return res.json(editResponse.data);
        } catch (editErr: any) {
          console.warn("xAI /images/edits error, falling back to /images/generations:", editErr.response?.data || editErr.message);
          const genResponse = await axios.post("https://api.x.ai/v1/images/generations", {
            model: "grok-imagine-image-2.0",
            prompt: `Flawlessly restored high-definition sports trading card scan. ${prompt}. Pristine centering, sharp edges, clean gloss surface.`,
            n: 1,
            aspect_ratio: "1:1",
            resolution: "1k",
            response_format: "b64_json"
          }, {
            headers: { 
              "Authorization": `Bearer ${effectiveKey}`,
              "Content-Type": "application/json"
            }
          });
          if (genResponse.data.data && genResponse.data.data[0]?.b64_json) {
            const b64 = genResponse.data.data[0].b64_json;
            return res.json({
              image_url: `data:image/png;base64,${b64}`,
              images: [{ url: `data:image/png;base64,${b64}` }]
            });
          }
          return res.json(genResponse.data);
        }
      } else if (provider === 'OpenRouter') {
        // Fallback for providers that don't have dedicated image-edit endpoints
        return res.json({
          image_url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
          images: [{ url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` }]
        });
      }
      
      res.status(400).json({ error: "Unsupported provider for image restore proxy" });
    } catch (error: any) {
      console.error("Restore Proxy Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // ==========================================
  // CARD ENHANCEMENT SUITE API (NON-S3 PIPELINE)
  // Protected with Better Auth session checks
  // ==========================================

  // 1. Approved Models & Presets Catalog
  app.get("/api/card-enhancement/models", (req, res) => {
    const session = getAuthenticatedSession(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication required." });
    }

    return res.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        entitlements: session.user.entitlements
      },
      models: APPROVED_PRESETS,
      engines: [
        { id: 'ComfyUI_UltimateSDUpscale', name: 'ComfyUI UltimateSDUpscale Workflow', status: 'available' },
        { id: 'Neural_Precision_Engine', name: 'Neural Precision Restoration Engine', status: 'available' },
        { id: 'Gemini_Vision_Restore', name: 'Gemini 3.7 / 2.5 Flash Neural Restoration', status: 'available' }
      ]
    });
  });

  // 2. Submit Enhancement Job (Accepts Multipart File or JSON Base64)
  app.post("/api/card-enhancement/jobs", upload.single('file'), async (req, res) => {
    const session = getAuthenticatedSession(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication required." });
    }

    try {
      let inputBuffer: Buffer;
      let fileName: string = 'card.png';
      let contentType: string = 'image/png';

      // Multipart Upload Check
      if (req.file) {
        inputBuffer = req.file.buffer;
        fileName = req.file.originalname;
        contentType = req.file.mimetype;
      } else if (req.body?.imageBase64) {
        // Base64 JSON fallback
        const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        inputBuffer = Buffer.from(base64Data, 'base64');
        fileName = req.body.fileName || 'card_upload.png';
        contentType = req.body.mimeType || 'image/png';
      } else {
        return res.status(400).json({ error: "No image file or image data provided." });
      }

      const presetId = (req.body?.preset || req.body?.model || 'standard-card-cleanup') as string;
      const requestedScale = req.body?.scale ? parseFloat(req.body.scale) : undefined;

      const job = await createEnhancementJob({
        userId: session.user.id,
        userName: session.user.name,
        fileName,
        presetId,
        scale: requestedScale,
        inputBuffer,
        contentType
      });

      return res.status(202).json({
        jobId: job.id,
        status: job.status,
        stage: job.stage,
        preset: job.preset,
        scale: job.scale,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt
      });
    } catch (err: any) {
      console.error("Job Creation Error:", err);
      return res.status(500).json({ error: err.message || "Failed to create enhancement job." });
    }
  });

  // 3. Get Job Status & Real-time Progress
  app.get("/api/card-enhancement/jobs/:jobId", (req, res) => {
    const session = getAuthenticatedSession(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const { jobId } = req.params;
    const job = getJobById(jobId);

    if (!job) {
      return res.status(404).json({ error: "Enhancement job not found." });
    }

    if (job.userId !== session.user.id && session.user.role !== 'admin') {
      return res.status(403).json({ error: "You are not authorized to view this job." });
    }

    return res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      preset: job.preset,
      scale: job.scale,
      resultUrl: job.resultUrl,
      error: job.error,
      originalDimensions: job.originalDimensions,
      enhancedDimensions: job.enhancedDimensions,
      metrics: job.metrics,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      expiresAt: job.expiresAt
    });
  });

  // 4. Download / Stream Enhanced Card Result
  app.get("/api/card-enhancement/jobs/:jobId/result", (req, res) => {
    const session = getAuthenticatedSession(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const { jobId } = req.params;
    const job = getJobById(jobId);

    if (!job) {
      return res.status(404).json({ error: "Enhancement job not found." });
    }

    if (job.userId !== session.user.id && session.user.role !== 'admin') {
      return res.status(403).json({ error: "You are not authorized to access this result." });
    }

    if (job.status !== 'completed' || !job.outputPath || !fs.existsSync(job.outputPath)) {
      return res.status(404).json({ error: "Enhanced image result is not ready or has expired." });
    }

    res.setHeader('Content-Type', job.contentType || 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${job.downloadName}"`);
    res.setHeader('Cache-Control', 'private, no-store');

    const fileStream = fs.createReadStream(job.outputPath);
    fileStream.pipe(res);
  });

  // 5. Cancel Job
  app.post("/api/card-enhancement/jobs/:jobId/cancel", (req, res) => {
    const session = getAuthenticatedSession(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const { jobId } = req.params;
    const canceled = cancelJobById(jobId, session.user.id);

    if (!canceled) {
      return res.status(400).json({ error: "Could not cancel job (it may not exist, belong to another user, or have already completed)." });
    }

    return res.json({ success: true, message: "Job canceled successfully." });
  });

  // 6. Batch Auto-Enhance Dispatch Endpoint
  app.post("/api/card-enhancement/batch-jobs", async (req, res) => {
    const session = getAuthenticatedSession(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const { items, preset, scale } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No card items provided for batch auto-enhancement." });
    }

    try {
      const createdJobs = [];
      for (const item of items) {
        const base64Data = (item.imageBase64 || item.dataUrl || '').replace(/^data:image\/\w+;base64,/, '');
        const inputBuffer = Buffer.from(base64Data, 'base64');
        
        const job = await createEnhancementJob({
          userId: session.user.id,
          userName: session.user.name,
          fileName: item.fileName || `batch_card_${Date.now()}.png`,
          presetId: preset || item.preset || 'high-detail-restoration',
          scale: scale || item.scale || 2,
          inputBuffer,
          contentType: 'image/png'
        });

        createdJobs.push({
          cardId: item.cardId || item.id,
          jobId: job.id,
          fileName: job.inputFileName,
          status: job.status,
          preset: job.preset,
          scale: job.scale
        });
      }

      return res.status(202).json({
        total: createdJobs.length,
        jobs: createdJobs
      });
    } catch (err: any) {
      console.error("Batch Job Creation Error:", err);
      return res.status(500).json({ error: err.message || "Failed to create batch enhancement jobs." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

