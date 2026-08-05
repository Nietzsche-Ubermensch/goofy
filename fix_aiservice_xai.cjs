const fs = require('fs');

let code = fs.readFileSync('src/services/aiService.ts', 'utf8');

code = code.replace(
  "} else if (provider === AIProvider.OpenRouter) {\n      optimizedPrompt = `High fidelity, clear, professional trading card design element. Subject: ${prompt}. Masterpiece quality, intricate details.`;\n  }",
  "} else if (provider === AIProvider.OpenRouter) {\n      optimizedPrompt = `High fidelity, clear, professional trading card design element. Subject: ${prompt}. Masterpiece quality, intricate details.`;\n  } else if (provider === AIProvider.xAI) {\n      optimizedPrompt = `High resolution, crisp, beautifully lit trading card art. Prompt: ${prompt}. Photorealistic, vibrant, stunning details.`;\n  }"
);

code = code.replace(
  "} else {\n      try {\n        const response = await axios.post(\"/api/ai/generate-image\", {\n          provider,\n          modelId,\n          prompt: optimizedPrompt,\n          size,\n          apiKey: getApiKeyForProvider(provider)\n        });\n        \n        if (provider === AIProvider.Venice) {\n            const imgData = response.data.images[0];\n            if (imgData.url.startsWith('data:')) return imgData.url;\n            return `data:image/png;base64,${imgData.url}`;\n        }\n        return response.data.image_url || response.data.images?.[0]?.url || \"\";",
  "} else {\n      try {\n        const response = await axios.post(\"/api/ai/generate-image\", {\n          provider,\n          modelId,\n          prompt: optimizedPrompt,\n          size,\n          apiKey: getApiKeyForProvider(provider)\n        });\n        \n        if (provider === AIProvider.Venice) {\n            const imgData = response.data.images[0];\n            if (imgData.url.startsWith('data:')) return imgData.url;\n            return `data:image/png;base64,${imgData.url}`;\n        } else if (provider === AIProvider.OpenAI || provider === AIProvider.xAI) {\n             return `data:image/png;base64,${response.data.data[0].b64_json}`;\n        }\n        return response.data.image_url || response.data.images?.[0]?.url || \"\";"
);

fs.writeFileSync('src/services/aiService.ts', code);
