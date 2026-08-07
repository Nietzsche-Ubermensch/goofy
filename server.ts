import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import { getEffectiveKey, type AIProvider } from "./src/server/apiKeys";
import { healthRouter } from "./src/server/healthRoute";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Health check endpoint — mounted early so it is always accessible
  // without authentication or other middleware interference.
  app.use('/health', healthRouter);

  // API Route for Proxying AI requests
  app.post("/api/ai/chat", async (req, res) => {
    const { provider, modelId, messages, apiKey, stream } = req.body;
    
    // Use user-provided key if available, otherwise server-side key
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }

    try {
      let url = "";
      let headers = {
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
              model: modelId,
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
    } catch (error) {
      console.error("AI Proxy Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // API Route for Image Generation Proxy
  app.post("/api/ai/generate-image", async (req, res) => {
    const { provider, modelId, prompt, size, apiKey } = req.body;
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
        return res.status(401).json({ error: "API key missing" });
    }
    try {
        if (provider === 'Venice') {
            const isAspectRatioModel = modelId.includes('qwen-image-2') || modelId.includes('wan') || modelId.includes('flux-2');
            const isResolutionModel = modelId.includes('imagineart') || modelId.includes('gpt-image') || modelId.includes('nano-banana');

            const payload: Record<string, any> = {
                model: modelId || "flux-2-pro",
                prompt: prompt,
                steps: 30,
            };

            if (isAspectRatioModel) {
                 payload.aspect_ratio = "3:4";
            } else if (isResolutionModel) {
                 payload.resolution = size; 
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
            const response = await axios.post("https://api.openai.com/v1/images/generations", {
                model: modelId || "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024"
            }, {
                headers: { "Authorization": `Bearer ${effectiveKey}` }
            });
            return res.json(response.data);
        } else if (provider === 'xAI') {
            const response = await axios.post("https://api.x.ai/v1/images/generations", {
                model: modelId || "gpt-image-1.5",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json"
            }, {
                headers: { "Authorization": `Bearer ${effectiveKey}` }
            });
            return res.json(response.data);
        } else if (provider === 'OpenRouter') {
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: modelId,
                messages: [{ role: "user", content: prompt }]
            }, {
                headers: {
                    "Authorization": `Bearer ${effectiveKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://aistudio.google.com",
                    "X-Title": "CardCrop AI Suite"
                }
            });
            return res.json(response.data);
        }

        res.status(400).json({ error: "Unsupported provider for image generation" });
    } catch (error) {
        console.error("Image Generation Proxy Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // Serve static files from the dist directory in production
  app.use(express.static(path.join(__dirname, "dist")));

  // Fallback to index.html for client-side routing
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
