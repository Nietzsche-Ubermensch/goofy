import { AIProvider } from '../types';

export interface ProviderConfig {
  endpoint: string;
  defaultModel: string;
  supportedModels: string[];
  supportedSizes: string[];
  supportedResponseFormats: string[];
}

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  [AIProvider.Venice]: {
    endpoint: 'https://api.venice.ai/api/v1',
    defaultModel: 'flux-2-pro',
    supportedModels: ['flux-2-pro', 'flux-dev', 'fluently-xl'],
    supportedSizes: ['1024x1024', '1024x1792', '1792x1024'],
    supportedResponseFormats: ['b64_json', 'url'],
  },
  [AIProvider.OpenAI]: {
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'dall-e-3',
    supportedModels: ['dall-e-3', 'dall-e-2'],
    supportedSizes: ['1024x1024', '1024x1792', '1792x1024', '256x256', '512x512'],
    supportedResponseFormats: ['b64_json', 'url'],
  },
  [AIProvider.OpenRouter]: {
    endpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.0-flash-001',
    supportedModels: ['google/gemini-2.0-flash-001', 'openai/dall-e-3', 'stability/sdxl'],
    supportedSizes: ['1024x1024', '1024x1792', '1792x1024'],
    supportedResponseFormats: ['b64_json', 'url'],
  },
  [AIProvider.xAI]: {
    endpoint: 'https://api.x.ai/v1',
    defaultModel: 'gpt-image-1.5',
    supportedModels: ['gpt-image-1.5', 'gpt-image-1'],
    supportedSizes: ['1024x1024', '1024x1536', '1536x1024'],
    supportedResponseFormats: ['b64_json', 'url'],
  },
  [AIProvider.Gemini]: {
    endpoint: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-3-pro-image-preview',
    supportedModels: ['gemini-3-pro-image-preview', 'gemini-2.0-flash-001'],
    supportedSizes: ['1024x1024', '1536x1024', '1024x1536'],
    supportedResponseFormats: ['b64_json'],
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
