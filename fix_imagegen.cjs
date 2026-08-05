const fs = require('fs');
let code = fs.readFileSync('src/pages/ImageGenerator.tsx', 'utf8');

code = code.replace(
  "        const keyMap = {\n            [AIProvider.OpenRouter]: 'CUSTOM_OPENROUTER_KEY',\n            [AIProvider.Venice]: 'CUSTOM_VENICE_KEY'\n        };",
  "        const keyMap = {\n            [AIProvider.OpenRouter]: 'CUSTOM_OPENROUTER_KEY',\n            [AIProvider.Venice]: 'CUSTOM_VENICE_KEY',\n            [AIProvider.OpenAI]: 'CUSTOM_OPENAI_KEY',\n            [AIProvider.xAI]: 'CUSTOM_XAI_KEY'\n        };"
);

fs.writeFileSync('src/pages/ImageGenerator.tsx', code);
