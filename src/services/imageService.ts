import axios from 'axios';
import { AIProvider } from '../types';
import { PROVIDER_CONFIGS, getHeaders } from '../utils/modelConfig';

export interface ImageGenerationPayload {
  prompt: string;
  model?: string;
  size?: string;
  response_format?: string;
}

export const generateImage = async (
  provider: AIProvider,
  payload: ImageGenerationPayload,
  apiKey: string
) => {
  const config = PROVIDER_CONFIGS[provider];
  const url = `${config.endpoint}/images/generations`;
  const headers = getHeaders(provider, apiKey);

  const response = await axios.post(url, {
      model: payload.model || config.defaultModel,
      prompt: payload.prompt,
      size: payload.size || '1024x1024',
      response_format: payload.response_format || 'b64_json',
  }, { headers });

  return response.data;
};
