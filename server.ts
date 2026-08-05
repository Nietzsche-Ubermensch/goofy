import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import { AIProvider } from './src/types';
import {
  createImageGenerationPayload,
  getHeaders,
  ImageGenerationPayload,
  PROVIDER_CONFIGS,
} from './src/utils/modelConfig';

dotenv.config();

const PROVIDER_ENV_KEYS: Record<AIProvider, string> = {
  [AIProvider.OpenRouter]: 'OPENROUTER_API_KEY',
  [AIProvider.Venice]: 'VENICE_API_KEY',
  [AIProvider.OpenAI]: 'OPENAI_API_KEY',
  [AIProvider.xAI]: 'XAI_API_KEY',
};

const isProvider = (provider: unknown): provider is AIProvider =>
  typeof provider === 'string' && Object.values(AIProvider).includes(provider as AIProvider);

const getEffectiveKey = (provider: AIProvider, apiKey: unknown): string | undefined => {
  if (typeof apiKey === 'string' && apiKey.trim()) {
    return apiKey.trim();
  }

  return process.env[PROVIDER_ENV_KEYS[provider]];
};

const getErrorResponse = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return {
      status: error.response?.status || 500,
      body: error.response?.data || { error: error.message },
    };
  }

  return {
    status: 500,
    body: { error: error instanceof Error ? error.message : 'Unexpected server error' },
  };
};

const parseJsonResponse = (response: { data: { choices?: Array<{ message?: { content?: string } }> } }) => {
  let content = response.data.choices?.[0]?.message?.content || '';
  const match = content.match(/\{[\s\S]*\}/);
  if (match) content = match[0];
  return JSON.parse(content);
};

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.post('/api/ai/chat', async (req, res) => {
    const { provider, modelId, messages, apiKey, stream } = req.body;

    if (!isProvider(provider)) {
      return res.status(400).json({ error: 'Unsupported provider for chat proxy' });
    }

    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }

    const chatEndpoints: Record<AIProvider, string> = {
      [AIProvider.OpenRouter]: 'https://openrouter.ai/api/v1/chat/completions',
      [AIProvider.Venice]: 'https://api.venice.ai/api/v1/chat/completions',
      [AIProvider.OpenAI]: 'https://api.openai.com/v1/chat/completions',
      [AIProvider.xAI]: 'https://api.x.ai/v1/chat/completions',
    };

    try {
      const response = await axios.post(
        chatEndpoints[provider],
        { model: modelId, messages, stream: Boolean(stream) },
        {
          headers: getHeaders(provider, effectiveKey),
          responseType: stream ? 'stream' : 'json',
        },
      );

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        response.data.pipe(res);
        return;
      }

      return res.json(response.data);
    } catch (error) {
      const { status, body } = getErrorResponse(error);
      return res.status(status).json(body);
    }
  });

  app.post('/api/images/generations', async (req, res) => {
    const { provider, model, prompt, size, response_format: responseFormat, apiKey } = req.body;

    if (!isProvider(provider)) {
      return res.status(400).json({ error: 'Unsupported provider for image generation' });
    }

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'A non-empty image prompt is required' });
    }

    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }

    const payload: ImageGenerationPayload = {
      prompt: prompt.trim(),
      ...(typeof model === 'string' && model ? { model } : {}),
      ...(typeof size === 'string' && size ? { size } : {}),
      ...(typeof responseFormat === 'string' && responseFormat ? { response_format: responseFormat } : {}),
    };

    try {
      const response = await axios.post(
        PROVIDER_CONFIGS[provider].imageEndpoint,
        createImageGenerationPayload(provider, payload),
        { headers: getHeaders(provider, effectiveKey) },
      );
      return res.json(response.data);
    } catch (error) {
      const { status, body } = getErrorResponse(error);
      return res.status(status).json(body);
    }
  });

  app.post('/api/ai/analyze', async (req, res) => {
    const { provider, modelId, imageBase64, mimeType, prompt, apiKey } = req.body;

    if (!isProvider(provider)) {
      return res.status(400).json({ error: 'Unsupported provider for analysis proxy' });
    }

    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }

    const analysisEndpoints: Record<AIProvider, string> = {
      [AIProvider.OpenRouter]: 'https://openrouter.ai/api/v1/chat/completions',
      [AIProvider.Venice]: 'https://api.venice.ai/api/v1/chat/completions',
      [AIProvider.OpenAI]: 'https://api.openai.com/v1/chat/completions',
      [AIProvider.xAI]: 'https://api.x.ai/v1/chat/completions',
    };
    const defaultModels: Record<AIProvider, string> = {
      [AIProvider.OpenRouter]: 'meta-llama/llama-3.2-11b-vision-instruct',
      [AIProvider.Venice]: 'llama-3.2-90b-vision',
      [AIProvider.OpenAI]: 'gpt-4o-mini',
      [AIProvider.xAI]: 'grok-2-vision-1212',
    };

    try {
      const response = await axios.post(
        analysisEndpoints[provider],
        {
          model: modelId || defaultModels[provider],
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              ],
            },
          ],
          response_format: { type: 'json_object' },
        },
        { headers: getHeaders(provider, effectiveKey) },
      );

      return res.json(parseJsonResponse(response));
    } catch (error) {
      const { status, body } = getErrorResponse(error);
      return res.status(status).json(body);
    }
  });

  app.post('/api/ai/restore', async (req, res) => {
    const { provider, modelId, imageBase64, mimeType, prompt, apiKey } = req.body;

    if (provider !== AIProvider.Venice) {
      return res.status(400).json({ error: 'Image restoration is only supported by Venice' });
    }

    const effectiveKey = getEffectiveKey(provider, apiKey);
    if (!effectiveKey) {
      return res.status(401).json({ error: `API key missing for ${provider}` });
    }

    try {
      const response = await axios.post(
        'https://api.venice.ai/api/v1/image/edit',
        {
          model: modelId || 'qwen-image-2-pro-edit',
          prompt,
          image: `data:${mimeType};base64,${imageBase64}`,
        },
        { headers: getHeaders(provider, effectiveKey) },
      );
      return res.json(response.data);
    } catch (error) {
      const { status, body } = getErrorResponse(error);
      return res.status(status).json(body);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
