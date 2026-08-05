# Contributing to CardCrop AI Suite

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites
- Node.js 18 or higher
- npm (comes with Node.js)
- A text editor (VS Code recommended)
- Git

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/goofy.git
   cd goofy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

## Project Structure

```
goofy/
├── src/
│   ├── components/     # Reusable React components
│   │   ├── CardEditorCanvas.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── SettingsModal.tsx
│   │   └── ...
│   ├── pages/          # Page-level components
│   │   ├── ChatBot.tsx
│   │   ├── ImageGenerator.tsx
│   │   ├── BatchCropper.tsx
│   │   └── Dashboard.tsx
│   ├── services/       # API integrations
│   │   ├── aiService.ts
│   │   └── imageService.ts
│   ├── utils/          # Utility functions
│   │   ├── edgeDetection.ts
│   │   ├── modelConfig.ts
│   │   └── telemetry.ts
│   ├── webgl/          # WebGL shaders and rendering
│   │   ├── shaders.ts
│   │   └── webglRenderer.ts
│   ├── server/         # Server-side utilities
│   │   └── apiKeys.ts
│   ├── types.ts        # TypeScript type definitions
│   └── index.css       # Global styles
├── server.ts           # Express server (API proxy)
├── index.tsx           # React entry point
├── index.html          # HTML template
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies and scripts
```

## Development Workflow

### Code Style

- Use TypeScript for all new code
- Follow existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic
- Use functional components with hooks (not class components)

### Before Committing

1. **Lint your code**
   ```bash
   npm run lint
   ```

2. **Test the build**
   ```bash
   npm run build
   ```

3. **Test manually**
   - Check all features still work
   - Test with different AI providers
   - Verify no console errors

### Commit Messages

Use clear, descriptive commit messages:
- `feat: add new image filter`
- `fix: resolve memory leak in WebGL renderer`
- `chore: update dependencies`
- `docs: improve README setup instructions`
- `refactor: simplify API key management`

## Adding New Features

### Adding a New AI Provider

1. Add the provider to `src/types.ts`:
   ```typescript
   export enum AIProvider {
     // ... existing providers
     NewProvider = 'NewProvider'
   }
   ```

2. Update `src/server/apiKeys.ts`:
   ```typescript
   const keyMap: Record<AIProvider, string | undefined> = {
     // ... existing providers
     'NewProvider': process.env.NEWPROVIDER_API_KEY
   };
   ```

3. Add proxy routes in `server.ts`

4. Update frontend services in `src/services/`

5. Update `.env.example` with the new key

### Adding a New Component

1. Create the component in `src/components/`
2. Use TypeScript for props and state
3. Import and use in parent components
4. Add to exports if needed globally

## Common Tasks

### Update Dependencies
```bash
npm update
npm audit fix
```

### Clear Cache/Build
```bash
rm -rf node_modules dist
npm install
npm run build
```

### Debug Server
The server runs on port 3000 and includes proxy endpoints for AI providers. Check the browser's Network tab and server console logs for debugging.

### Debug WebGL Issues
- Check browser console for WebGL errors
- Verify GPU compatibility
- Test in different browsers

## Testing

Currently, the project uses manual testing. When adding features:
- Test in Chrome, Firefox, and Safari
- Test with different API keys
- Test error handling (missing keys, network failures)
- Test with large files/batches

## Documentation

When adding features:
- Update README.md if it affects setup or usage
- Update this CONTRIBUTING.md if it affects development
- Add JSDoc comments for public APIs
- Update type definitions in `src/types.ts`

## Getting Help

- Check existing issues on GitHub
- Review code comments and documentation
- Ask questions in discussions

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Help others learn and grow
- Keep discussions relevant and professional

Thank you for contributing! 🎉
