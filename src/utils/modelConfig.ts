import { AIProvider } from '../types';

export interface ProviderConfig {
  imageEndpoint: string;
  defaultModel: string;
}

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  [AIProvider.OpenRouter]: {
    imageEndpoint: 'https://openrouter.ai/api/v1/images/generations',
    defaultModel: 'openai/gpt-image-1',
  },
  [AIProvider.Venice]: {
    imageEndpoint: 'https://api.venice.ai/api/v1/image/generate',
    defaultModel: 'flux-2-pro',
  },
  [AIProvider.OpenAI]: {
    imageEndpoint: 'https://api.openai.com/v1/images/generations',
    defaultModel: 'dall-e-3',
  },
  [AIProvider.xAI]: {
    imageEndpoint: 'https://api.x.ai/v1/images/generations',
    defaultModel: 'gpt-image-1.5',
  },
};

export const getHeaders = (provider: AIProvider, apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: ['Bearer', apiKey].join(' '),
  };

  if (provider === AIProvider.OpenRouter) {
    headers['X-Title'] = 'CardCrop AI Suite';
  }

  return headers;
};

export interface ImageGenerationPayload {
  prompt: string;
  model?: string;
  size?: string;
  response_format?: string;
}

const IMAGE_SIZES: Record<string, string> = {
  '1K': '1024x1024',
  '2K': '2048x2048',
  '4K': '4096x4096',
};

const VENICE_ASPECT_RATIO_MODELS = ['qwen-image-2', 'wan', 'flux-2'];
const VENICE_RESOLUTION_MODELS = ['imagineart', 'gpt-image', 'nano-banana'];

export const normalizeImageSize = (provider: AIProvider, size = '1024x1024'): string => {
  if (provider !== AIProvider.Venice && size in IMAGE_SIZES) {
    return '1024x1024';
  }

  return IMAGE_SIZES[size] || size;
};

export const createImageGenerationPayload = (
  provider: AIProvider,
  payload: ImageGenerationPayload,
): Record<string, string | number> => {
  const config = PROVIDER_CONFIGS[provider];
  const model = payload.model || config.defaultModel;
  const size = normalizeImageSize(provider, payload.size);

  if (provider === AIProvider.Venice) {
    const normalizedModel = model.toLowerCase();

    if (VENICE_ASPECT_RATIO_MODELS.some((modelName) => normalizedModel.includes(modelName))) {
      return {
        model,
        prompt: payload.prompt,
        aspect_ratio: '3:4',
      };
    }

    if (VENICE_RESOLUTION_MODELS.some((modelName) => normalizedModel.includes(modelName))) {
      return {
        model,
        prompt: payload.prompt,
        resolution: payload.size || '1K',
        aspect_ratio: '3:4',
      };
    }

    const [width, height] = size.split('x').map(Number);
    return {
      model,
      prompt: payload.prompt,
      width: Number.isFinite(width) ? width : 1024,
      height: Number.isFinite(height) ? height : 1024,
    };
  }

  return {
    model,
    prompt: payload.prompt,
    size,
    response_format: payload.response_format || 'b64_json',
  };
};
