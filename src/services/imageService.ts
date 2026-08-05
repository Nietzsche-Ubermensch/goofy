import axios from 'axios';
import { AIProvider } from '../types';
import {
  createImageGenerationPayload,
  getHeaders,
  ImageGenerationPayload,
  PROVIDER_CONFIGS,
} from '../utils/modelConfig';

export type { ImageGenerationPayload } from '../utils/modelConfig';

export const generateImage = async (
  provider: AIProvider,
  payload: ImageGenerationPayload,
  apiKey: string,
) => {
  const config = PROVIDER_CONFIGS[provider];
  const headers = getHeaders(provider, apiKey);
  const requestPayload = createImageGenerationPayload(provider, payload);
  const response = await axios.post(config.imageEndpoint, requestPayload, { headers });

  return response.data;
};
