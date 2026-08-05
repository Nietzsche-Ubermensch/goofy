import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

async function run() {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: ['Bearer', apiKey].join(' '),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: 'a futuristic trading card',
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    throw new Error(`Image generation failed: ${response.status} ${await response.text()}`);
  }

  console.log('Image generation endpoint is reachable.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
