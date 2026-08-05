const fs = require('fs');

let code = `
import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createServer as createViteServer } from "vite";

dotenv.config();

function getEffectiveKey(provider, apiKey) {
    if (apiKey) return apiKey;
    let openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey && openRouterKey.startsWith('OPENROUTER_API_KEY=')) {
        openRouterKey = openRouterKey.replace('OPENROUTER_API_KEY=', '');
    }
    if (!openRouterKey || openRouterKey.includes('sk-or-v1-2c21429c87eaf347') || openRouterKey === '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') {
        openRouterKey = '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';
    }
    let veniceKey = process.env.VENICE_API_KEY;
    if (provider === 'OpenRouter') return openRouterKey;
    if (provider === 'Venice') return veniceKey;
    if (provider === 'Gemini') return process.env.GEMINI_API_KEY;
    if (provider === 'OpenAI') return process.env.OPENAI_API_KEY;
    if (provider === 'xAI') return process.env.XAI_API_KEY;
    return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Route for Proxying AI requests
  app.post("/api/ai/chat", async (req, res) => {
    const { provider, modelId, messages, apiKey, stream } = req.body;
    
    // Use user-provided key if available, otherwise server-side key
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: \`API key missing for \${provider}\` });
    }

    try {
      let url = "";
      let headers = {
          "Authorization": \`Bearer \${effectiveKey}\`,
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

            const payload = {
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
                headers: { "Authorization": \`Bearer \${effectiveKey}\` }
            });
            return res.json(response.data);
        } else if (provider === 'OpenAI') {
            const response = await axios.post("https://api.openai.com/v1/images/generations", {
                model: modelId || "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024"
            }, {
                headers: { "Authorization": \`Bearer \${effectiveKey}\` }
            });
            return res.json(response.data);
        } else if (provider === 'xAI') {
             res.status(400).json({ error: "xAI image generation not supported yet." });
        } else if (provider === 'OpenRouter') {
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: modelId,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" } 
            }, {
                headers: { "Authorization": \`Bearer \${effectiveKey}\` }
            });
            return res.json(response.data);
        }
        res.status(400).json({ error: "Unsupported provider for image proxy" });
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // API Route for Vision/Analysis Proxy
  app.post("/api/ai/analyze", async (req, res) => {
    const { provider, modelId, imageBase64, mimeType, prompt, apiKey } = req.body;
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: \`API key missing for \${provider}\` });
    }

    try {
      if (provider === 'OpenRouter') {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
          model: modelId || "google/gemini-2.0-flash-001",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: \`data:\${mimeType};base64,\${imageBase64}\` } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        }, {
          headers: {
            "Authorization": \`Bearer \${effectiveKey}\`,
            "HTTP-Referer": "https://aistudio.google.com", 
            "X-Title": "CardCrop AI Suite",
          }
        });
        
        let content = response.data.choices[0].message.content || '';
        const match = content.match(/\\{[\\s\\S]*\\}/);
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
                { type: "image_url", image_url: { url: \`data:\${mimeType};base64,\${imageBase64}\` } }
              ]
            }
          ]
        }, {
           headers: { "Authorization": \`Bearer \${effectiveKey}\` }
        });
        let content = response.data.choices[0].message.content || '';
        const match = content.match(/\\{[\\s\\S]*\\}/);
        if (match) content = match[0];
        return res.json(JSON.parse(content));
      } else if (provider === 'OpenAI' || provider === 'xAI') {
        const apiUrl = provider === 'OpenAI' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.x.ai/v1/chat/completions';
        const response = await axios.post(apiUrl, {
          model: modelId || (provider === 'OpenAI' ? 'gpt-4o' : 'grok-vision-beta'),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: \`data:\${mimeType};base64,\${imageBase64}\` } }
              ]
            }
          ]
        }, { headers: { 'Authorization': \`Bearer \${effectiveKey}\` } });
        let content = response.data.choices[0].message.content || '';
        const match = content.match(/\\{[\\s\\S]*\\}/);
        if (match) content = match[0];
        return res.json(JSON.parse(content));
      } else if (provider === 'Gemini') {
         // Optionally support Gemini proxy here, but client uses direct SDK
      }
      
      res.status(400).json({ error: "Unsupported provider for analysis proxy" });
    } catch (error) {
      console.error("Analysis Proxy Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // API Route for Image Restoration Proxy
  app.post("/api/ai/restore", async (req, res) => {
      const { provider, modelId, imageBase64, mimeType, prompt, settings, apiKey } = req.body;
      const effectiveKey = getEffectiveKey(provider, apiKey);
  
      if (!effectiveKey) {
        return res.status(401).json({ error: \`API key missing for \${provider}\` });
      }

      try {
          if (provider === 'Venice') {
              const response = await axios.post("https://api.venice.ai/api/v1/image/edit", {
                  model: modelId || "qwen-image-2-pro-edit",
                  prompt: prompt,
                  image: \`data:\${mimeType};base64,\${imageBase64}\`,
              }, {
                  headers: { "Authorization": \`Bearer \${effectiveKey}\` }
              });
              return res.json(response.data);
          } else if (provider === 'OpenRouter') {
              res.status(400).json({ error: "OpenRouter does not support image-to-image visually yet." });
          }
          
          res.status(400).json({ error: "Unsupported provider for image restore proxy" });
      } catch (error) {
          console.error("Restore Proxy Error:", error.response?.data || error.message);
          res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
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
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

startServer();
`
fs.writeFileSync('server.ts', code);
