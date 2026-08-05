import dotenv from 'dotenv';

dotenv.config();

const providers = [
  {
    name: 'OpenRouter',
    key: process.env.OPENROUTER_API_KEY,
    endpoint: 'https://openrouter.ai/api/v1/images/generations',
    payload: {
      model: 'openai/gpt-image-1',
      prompt: 'A simple trading card illustration',
      size: '1024x1024',
      response_format: 'b64_json',
    },
  },
  {
    name: 'Venice',
    key: process.env.VENICE_API_KEY,
    endpoint: 'https://api.venice.ai/api/v1/image/generate',
    payload: {
      model: 'flux-2-pro',
      prompt: 'A simple trading card illustration',
      aspect_ratio: '3:4',
    },
  },
  {
    name: 'OpenAI',
    key: process.env.OPENAI_API_KEY,
    endpoint: 'https://api.openai.com/v1/images/generations',
    payload: {
      model: 'dall-e-3',
      prompt: 'A simple trading card illustration',
      size: '1024x1024',
      response_format: 'b64_json',
    },
  },
  {
    name: 'xAI',
    key: process.env.XAI_API_KEY,
    endpoint: 'https://api.x.ai/v1/images/generations',
    payload: {
      model: 'gpt-image-1.5',
      prompt: 'A simple trading card illustration',
      size: '1024x1024',
      response_format: 'b64_json',
    },
  },
];

async function testKeys() {
  for (const provider of providers) {
    if (!provider.key) {
      console.log(`⚠️ ${provider.name} skipped: API key is not configured.`);
      continue;
    }

    try {
      const response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          Authorization: ['Bearer', provider.key].join(' '),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(provider.payload),
      });
      console.log(`${response.ok ? '✅' : '❌'} ${provider.name}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

testKeys();
