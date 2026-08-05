const fs = require('fs');
let code = fs.readFileSync('src/pages/ChatBot.tsx', 'utf8');

code = code.replace(
  "        const keyMap = {\n            [AIProvider.OpenRouter]: 'CUSTOM_OPENROUTER_KEY',\n            [AIProvider.Venice]: 'CUSTOM_VENICE_KEY'\n        };",
  "        const keyMap = {\n            [AIProvider.OpenRouter]: 'CUSTOM_OPENROUTER_KEY',\n            [AIProvider.Venice]: 'CUSTOM_VENICE_KEY',\n            [AIProvider.OpenAI]: 'CUSTOM_OPENAI_KEY',\n            [AIProvider.xAI]: 'CUSTOM_XAI_KEY'\n        };"
);

code = code.replace(
  "<option value={AIProvider.Venice}>Venice</option>",
  "<option value={AIProvider.Venice}>Venice</option>\n                    <option value={AIProvider.OpenAI}>OpenAI</option>\n                    <option value={AIProvider.xAI}>xAI</option>"
);

code = code.replace(
  "if (provider === AIProvider.Venice) modelId = 'llama-3.3-70b';",
  "if (provider === AIProvider.Venice) modelId = 'llama-3.3-70b';\n                        if (provider === AIProvider.OpenAI) modelId = 'gpt-4o';\n                        if (provider === AIProvider.xAI) modelId = 'grok-beta';"
);

code = code.replace(
  "{aiConfig.provider === AIProvider.Venice && (",
  "{aiConfig.provider === AIProvider.OpenAI && (\n                        <>\n                            <option value=\"gpt-4o\">GPT-4o</option>\n                            <option value=\"gpt-4o-mini\">GPT-4o Mini</option>\n                        </>\n                    )}\n                    {aiConfig.provider === AIProvider.xAI && (\n                        <>\n                            <option value=\"grok-beta\">Grok</option>\n                        </>\n                    )}\n                    {aiConfig.provider === AIProvider.Venice && ("
);

fs.writeFileSync('src/pages/ChatBot.tsx', code);
