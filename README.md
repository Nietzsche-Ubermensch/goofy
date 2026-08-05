# CardCrop AI Suite

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and configure the provider keys you intend to use:

   ```bash
   cp .env.example .env
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

## Production

Build the React assets and Express server bundle:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

The server listens on port `3000` by default. Set `PORT` to use a different port.

## Image generation API

`POST /api/images/generations` accepts an OpenAI-compatible request body:

```json
{
  "provider": "OpenAI",
  "model": "dall-e-3",
  "prompt": "A futuristic trading card",
  "size": "1024x1024",
  "response_format": "b64_json"
}
```

Supported providers are `OpenRouter`, `Venice`, `OpenAI`, and `xAI`. The server selects the matching image-generation endpoint and uses the provider key from the environment when a request does not supply one.
