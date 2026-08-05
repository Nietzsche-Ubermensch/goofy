var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_axios = __toESM(require("axios"), 1);
var import_vite = require("vite");

// src/types.ts
var AIProvider = /* @__PURE__ */ ((AIProvider2) => {
  AIProvider2["OpenRouter"] = "OpenRouter";
  AIProvider2["Venice"] = "Venice";
  AIProvider2["OpenAI"] = "OpenAI";
  AIProvider2["xAI"] = "xAI";
  return AIProvider2;
})(AIProvider || {});

// src/utils/modelConfig.ts
var PROVIDER_CONFIGS = {
  ["OpenRouter" /* OpenRouter */]: {
    imageEndpoint: "https://openrouter.ai/api/v1/images/generations",
    defaultModel: "openai/gpt-image-1"
  },
  ["Venice" /* Venice */]: {
    imageEndpoint: "https://api.venice.ai/api/v1/image/generate",
    defaultModel: "flux-2-pro"
  },
  ["OpenAI" /* OpenAI */]: {
    imageEndpoint: "https://api.openai.com/v1/images/generations",
    defaultModel: "dall-e-3"
  },
  ["xAI" /* xAI */]: {
    imageEndpoint: "https://api.x.ai/v1/images/generations",
    defaultModel: "gpt-image-1.5"
  }
};
var getHeaders = (provider, apiKey) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: ["Bearer", apiKey].join(" ")
  };
  if (provider === "OpenRouter" /* OpenRouter */) {
    headers["X-Title"] = "CardCrop AI Suite";
  }
  return headers;
};
var IMAGE_SIZES = {
  "1K": "1024x1024",
  "2K": "2048x2048",
  "4K": "4096x4096"
};
var normalizeImageSize = (provider, size = "1024x1024") => {
  if (provider !== "Venice" /* Venice */ && size in IMAGE_SIZES) {
    return "1024x1024";
  }
  return IMAGE_SIZES[size] || size;
};
var createImageGenerationPayload = (provider, payload) => {
  const config = PROVIDER_CONFIGS[provider];
  const model = payload.model || config.defaultModel;
  const size = normalizeImageSize(provider, payload.size);
  if (provider === "Venice" /* Venice */) {
    const [width, height] = size.split("x").map(Number);
    return {
      model,
      prompt: payload.prompt,
      width: Number.isFinite(width) ? width : 1024,
      height: Number.isFinite(height) ? height : 1024
    };
  }
  return {
    model,
    prompt: payload.prompt,
    size,
    response_format: payload.response_format || "b64_json"
  };
};

// server.ts
import_dotenv.default.config();
var PROVIDER_ENV_KEYS = {
  ["OpenRouter" /* OpenRouter */]: "OPENROUTER_API_KEY",
  ["Venice" /* Venice */]: "VENICE_API_KEY",
  ["OpenAI" /* OpenAI */]: "OPENAI_API_KEY",
  ["xAI" /* xAI */]: "XAI_API_KEY"
};
var isProvider = (provider) => typeof provider === "string" && Object.values(AIProvider).includes(provider);
var getEffectiveKey = (provider, apiKey) => {
  if (typeof apiKey === "string" && apiKey.trim()) {
    return apiKey.trim();
  }
  return process.env[PROVIDER_ENV_KEYS[provider]];
};
var getErrorResponse = (error) => {
  if (import_axios.default.isAxiosError(error)) {
    return {
      status: error.response?.status || 500,
      body: error.response?.data || { error: error.message }
    };
  }
  return {
    status: 500,
    body: { error: error instanceof Error ? error.message : "Unexpected server error" }
  };
};
var parseJsonResponse = (response) => {
  let content = response.data.choices?.[0]?.message?.content || "";
  const match = content.match(/\{[\s\S]*\}/);
  if (match) content = match[0];
  return JSON.parse(content);
};
async function startServer() {
  const app = (0, import_express.default)();
  const port = Number(process.env.PORT) || 3e3;
  app.use((0, import_cors.default)());
  app.use(import_express.default.json({ limit: "50mb" }));
  app.post("/api/ai/chat", async (req, res) => {
    const { provider, modelId, messages, apiKey, stream } = req.body;
    if (!isProvider(provider)) {
      return res.status(400).json({ error: "Unsupported provider for chat proxy" });
    }
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }
    const chatEndpoints = {
      ["OpenRouter" /* OpenRouter */]: "https://openrouter.ai/api/v1/chat/completions",
      ["Venice" /* Venice */]: "https://api.venice.ai/api/v1/chat/completions",
      ["OpenAI" /* OpenAI */]: "https://api.openai.com/v1/chat/completions",
      ["xAI" /* xAI */]: "https://api.x.ai/v1/chat/completions"
    };
    try {
      const response = await import_axios.default.post(
        chatEndpoints[provider],
        { model: modelId, messages, stream: Boolean(stream) },
        {
          headers: getHeaders(provider, effectiveKey),
          responseType: stream ? "stream" : "json"
        }
      );
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        response.data.pipe(res);
        return;
      }
      return res.json(response.data);
    } catch (error) {
      const { status, body } = getErrorResponse(error);
      return res.status(status).json(body);
    }
  });
  app.post("/api/images/generations", async (req, res) => {
    const { provider, model, prompt, size, response_format: responseFormat, apiKey } = req.body;
    if (!isProvider(provider)) {
      return res.status(400).json({ error: "Unsupported provider for image generation" });
    }
    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "A non-empty image prompt is required" });
    }
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }
    const payload = {
      prompt: prompt.trim(),
      ...typeof model === "string" && model ? { model } : {},
      ...typeof size === "string" && size ? { size } : {},
      ...typeof responseFormat === "string" && responseFormat ? { response_format: responseFormat } : {}
    };
    try {
      const response = await import_axios.default.post(
        PROVIDER_CONFIGS[provider].imageEndpoint,
        createImageGenerationPayload(provider, payload),
        { headers: getHeaders(provider, effectiveKey) }
      );
      return res.json(response.data);
    } catch (error) {
      const { status, body } = getErrorResponse(error);
      return res.status(status).json(body);
    }
  });
  app.post("/api/ai/analyze", async (req, res) => {
    const { provider, modelId, imageBase64, mimeType, prompt, apiKey } = req.body;
    if (!isProvider(provider)) {
      return res.status(400).json({ error: "Unsupported provider for analysis proxy" });
    }
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }
    const analysisEndpoints = {
      ["OpenRouter" /* OpenRouter */]: "https://openrouter.ai/api/v1/chat/completions",
      ["Venice" /* Venice */]: "https://api.venice.ai/api/v1/chat/completions",
      ["OpenAI" /* OpenAI */]: "https://api.openai.com/v1/chat/completions",
      ["xAI" /* xAI */]: "https://api.x.ai/v1/chat/completions"
    };
    const defaultModels = {
      ["OpenRouter" /* OpenRouter */]: "meta-llama/llama-3.2-11b-vision-instruct",
      ["Venice" /* Venice */]: "llama-3.2-90b-vision",
      ["OpenAI" /* OpenAI */]: "gpt-4o-mini",
      ["xAI" /* xAI */]: "grok-2-vision-1212"
    };
    try {
      const response = await import_axios.default.post(
        analysisEndpoints[provider],
        {
          model: modelId || defaultModels[provider],
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        },
        { headers: getHeaders(provider, effectiveKey) }
      );
      return res.json(parseJsonResponse(response));
    } catch (error) {
      const { status, body } = getErrorResponse(error);
      return res.status(status).json(body);
    }
  });
  app.post("/api/ai/restore", async (req, res) => {
    const { provider, modelId, imageBase64, mimeType, prompt, apiKey } = req.body;
    if (provider !== "Venice" /* Venice */) {
      return res.status(400).json({ error: "Image restoration is only supported by Venice" });
    }
    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }
    try {
      const response = await import_axios.default.post(
        "https://api.venice.ai/api/v1/image/edit",
        {
          model: modelId || "qwen-image-2-pro-edit",
          prompt,
          image: `data:${mimeType};base64,${imageBase64}`
        },
        { headers: getHeaders(provider, effectiveKey) }
      );
      return res.json(response.data);
    } catch (error) {
      const { status, body } = getErrorResponse(error);
      return res.status(status).json(body);
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
