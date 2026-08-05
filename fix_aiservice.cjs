const fs = require('fs');
let code = fs.readFileSync('src/services/aiService.ts', 'utf8');

code = code.replace(
  "export const generateCardImage = async (prompt: string, size: ImageSize, config?: AIModelConfig): Promise<string> => {",
  "export const generateCardImage = async (prompt: string, size: ImageSize, config?: AIModelConfig): Promise<string> => {\n  const provider = config?.provider || AIProvider.Gemini;\n  \n  let optimizedPrompt = prompt;\n  if (provider === AIProvider.Gemini) {\n      optimizedPrompt = `Highly detailed, 8k resolution, cinematic lighting, trading card asset, masterwork quality, ${prompt}`;\n  } else if (provider === AIProvider.OpenAI) {\n      optimizedPrompt = `Generate a photorealistic and highly detailed trading card asset. Concept: ${prompt}. Cinematic lighting, extreme focus, 8k rendering.`;\n  } else if (provider === AIProvider.Venice) {\n      optimizedPrompt = `masterpiece, best quality, highly detailed trading card, ${prompt}, vibrant colors, sharp focus, volumetric lighting`;\n  } else if (provider === AIProvider.OpenRouter) {\n      optimizedPrompt = `High fidelity, clear, professional trading card design element. Subject: ${prompt}. Masterpiece quality, intricate details.`;\n  }"
);
code = code.replace(
  "prompt: prompt,",
  "prompt: optimizedPrompt,"
);
code = code.replace(
  "prompt,",
  "prompt: optimizedPrompt,"
);

fs.writeFileSync('src/services/aiService.ts', code);
