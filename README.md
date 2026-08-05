# CardCrop AI Suite

A modern, GPU-accelerated card cropping and enhancement application with AI-powered features including chat, image generation, and automated card processing.

## Features

- **Card Cropping & Enhancement**: GPU-accelerated WebGL processing with real-time edge detection
- **AI Chat Bot**: Multi-provider AI chat (OpenRouter, Venice, OpenAI, xAI, Gemini)
- **AI Image Generation**: Generate images with multiple AI providers
- **Batch Processing**: Process multiple cards simultaneously
- **Dashboard**: Overview and management interface

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS
- **Backend**: Express, Node.js
- **AI Integration**: Google Gemini, OpenRouter, Venice, OpenAI, xAI
- **Graphics**: WebGL, Custom Shaders

## Setup

### Prerequisites

- Node.js 18+ 
- npm or bun

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Nietzsche-Ubermensch/goofy.git
   cd goofy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   - `GEMINI_API_KEY` - Required for Google AI features
   - `OPENROUTER_API_KEY` - Optional, for OpenRouter
   - `VENICE_API_KEY` - Optional, for Venice AI
   - `OPENAI_API_KEY` - Optional, for OpenAI
   - `XAI_API_KEY` - Optional, for xAI

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Production Build

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Project Structure

```
goofy/
├── src/
│   ├── components/     # React components
│   ├── pages/          # Page components (ChatBot, ImageGenerator, etc.)
│   ├── services/       # API services (AI, image processing)
│   ├── utils/          # Utilities (telemetry, edge detection, config)
│   ├── webgl/          # WebGL shaders and rendering
│   ├── server/         # Server utilities (API keys, etc.)
│   └── types.ts        # TypeScript type definitions
├── server.ts           # Express server with API routes
├── index.tsx           # React entry point
└── vite.config.ts      # Vite configuration
```

## API Endpoints

- `POST /api/ai/chat` - AI chat proxy
- `POST /api/ai/generate-image` - Image generation proxy
- `POST /api/ai/analyze` - Vision/analysis proxy

## License

MIT

## Links

- AI Studio App: https://ai.studio/apps/1aac4d74-9aa0-4e1b-b088-29519ec58169

