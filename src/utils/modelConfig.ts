import { AIProvider } from '../types';

export interface ProviderConfig {
  endpoint: string;
  defaultModel: string;
}

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  [AIProvider.Gemini]: { endpoint: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-3-pro-image-preview' },
  [AIProvider.OpenRouter]: { endpoint: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-2.0-flash-001' },
  [AIProvider.Venice]: { endpoint: 'https://api.venice.ai/api/v1', defaultModel: 'flux-2-pro' },
  [AIProvider.OpenAI]: { endpoint: 'https://api.openai.com/v1', defaultModel: 'dall-e-3' },
  [AIProvider.xAI]: { endpoint: 'https://api.x.ai/v1', defaultModel: 'gpt-image-1.5' },
};

export const getHeaders = (provider: AIProvider, apiKey: string): Record<string, string> => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
};
