import { AIProvider } from '../types';

export interface ProviderConfig {
  endpoint: string;
  defaultModel: string;
  supportedModels: string[];
  supportedSizes: string[];
  supportedResponseFormats: string[];
}

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  [AIProvider.OpenAI]: {
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-image-2',
    supportedModels: [
      'gpt-image-2',
      'gpt-image-2-2026-04-21',
      'gpt-image-1.5',
      'gpt-image-1',
      'gpt-image-1-mini',
      'chatgpt-image-latest',
      'dall-e-3',
      'dall-e-2',
      'gpt-4o',
      'gpt-4o-mini'
    ],
    supportedSizes: ['1024x1024', '1536x1024', '1024x1536', '2048x2048', 'auto'],
    supportedResponseFormats: ['b64_json', 'url'],
  },
  [AIProvider.Gemini]: {
    endpoint: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-3.1-flash-image',
    supportedModels: [
      'gemini-3.1-flash-image',
      'gemini-3.1-flash-lite-image',
      'gemini-3-pro-image',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'nano-banana-2',
      'imagen-3.0-generate-002'
    ],
    supportedSizes: ['1024x1024', '1536x1024', '1024x1536', '1K', '2K'],
    supportedResponseFormats: ['b64_json'],
  },
  [AIProvider.Venice]: {
    endpoint: 'https://api.venice.ai/api/v1',
    defaultModel: 'flux-2-pro',
    supportedModels: [
      // Text-to-Image Generation Models
      'grok-imagine-image-2-0',
      'grok-imagine-image-quality',
      'grok-imagine-image',
      'flux-2-pro',
      'flux-2-max',
      'gpt-image-2',
      'gpt-image-1-5',
      'krea-2-turbo',
      'krea-v2-large',
      'nano-banana-pro',
      'nano-banana-2',
      'nano-banana-2-lite',
      'qwen-image-3-pro',
      'qwen-image-3',
      'qwen-image-2-pro',
      'qwen-image-2',
      'wan-2-7-pro-text-to-image',
      'wan-2-7-text-to-image',
      'recraft-v4-pro',
      'recraft-v4',
      'seedream-v5-pro',
      'seedream-v5-lite',
      'seedream-v4',
      'ideogram-v4',
      'luma-uni-1-max',
      'luma-uni-1',
      'hunyuan-image-v3',
      'imagineart-1.5-pro',
      'venice-sd35',
      'chroma',
      'bria-bg-remover',
      // Multi-Edit / Inpaint Models
      'qwen-image-3-pro-edit',
      'qwen-image-3-edit',
      'grok-imagine-image-2-0-edit',
      'grok-imagine-quality-edit',
      'grok-imagine-edit',
      'gpt-image-2-edit',
      'gpt-image-1-5-edit',
      'nano-banana-pro-edit',
      'nano-banana-2-edit',
      'nano-banana-2-lite-edit',
      'wan-2-7-pro-edit',
      'flux-2-max-edit',
      'firered-image-edit',
      'qwen-edit-uncensored',
      'seedream-v5-pro-edit',
      'seedream-v5-lite-edit',
      'seedream-v4-edit',
      'luma-uni-1-max-edit',
      'luma-uni-1-edit',
      // Upscaler
      'upscaler'
    ],
    supportedSizes: ['1K', '2K', '4K', '1024x1024', '1024x1792', '1792x1024'],
    supportedResponseFormats: ['b64_json', 'url', 'png'],
  },
  [AIProvider.OpenRouter]: {
    endpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'black-forest-labs/flux.2-pro',
    supportedModels: [
      // OpenRouter 2026 Image Generation Models
      'openai/gpt-image-2',
      'openai/gpt-5.4-image-2',
      'openai/gpt-image-1-mini',
      'openai/gpt-image-1',
      'openai/gpt-5-image',
      'black-forest-labs/flux.2-klein-4b',
      'black-forest-labs/flux.2-pro',
      'black-forest-labs/flux.2-flex',
      'black-forest-labs/flux.2-max',
      'bytedance-seed/seedream-4.5',
      'bytedance-seed/seedream-5.0-lite',
      'bytedance-seed/seedream-5.0-pro',
      'recraft/recraft-v4.1',
      'recraft/recraft-v4.1-utility',
      'recraft/recraft-v4',
      'recraft/recraft-v3',
      'recraft/recraft-v4.1-pro',
      'recraft/recraft-v4-pro',
      'google/nano-banana-2-lite',
      'google/nano-banana-2',
      'google/nano-banana',
      'google/nano-banana-pro',
      'qwen/qwen-image-3',
      'qwen/qwen-image-3-pro',
      'krea/krea-2-medium-turbo',
      'krea/krea-2-medium',
      'krea/krea-2-large',
      'sourceful/riverflow-v2.5-fast',
      'sourceful/riverflow-v2-fast',
      'sourceful/riverflow-v2-pro',
      'sourceful/riverflow-v2.5-pro',
      'microsoft/mai-image-2.5',
      'microsoft/mai-image-2.5-pro',
      'x-ai/grok-imagine-image-2.0',
      'x-ai/grok-imagine-image-quality',
      // Chat / Multimodal / Vision
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro',
      'google/gemini-2.0-flash-001',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini'
    ],
    supportedSizes: ['1K', '2K', '4K', '1024x1024', '1536x1024', '1024x1536', 'auto'],
    supportedResponseFormats: ['b64_json', 'url'],
  },
  [AIProvider.xAI]: {
    endpoint: 'https://api.x.ai/v1',
    defaultModel: 'grok-imagine-image-2.0',
    supportedModels: [
      'grok-imagine-image-2.0',
      'grok-2-vision-1212',
      'grok-vision-beta',
      'grok-beta'
    ],
    supportedSizes: ['1024x1024', '1536x1024', '1024x1536', '1K', '2K', 'auto'],
    supportedResponseFormats: ['b64_json', 'url'],
  },
};

export const getHeaders = (provider: AIProvider, apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey,
  };

  if (provider === AIProvider.OpenRouter) {
    headers['HTTP-Referer'] = 'https://cardcrop-ai-suite.app';
    headers['X-Title'] = 'CardCrop AI Suite';
  }

  return headers;
};
