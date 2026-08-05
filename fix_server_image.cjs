const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "} else if (provider === 'OpenRouter') {",
  "} else if (provider === 'OpenAI') {\n            const response = await axios.post(\"https://api.openai.com/v1/images/generations\", {\n                model: modelId || \"dall-e-3\",\n                prompt: prompt,\n                n: 1,\n                size: \"1024x1024\"\n            }, {\n                headers: { \"Authorization\": `Bearer ${effectiveKey}` }\n            });\n            return res.json(response.data);\n        } else if (provider === 'xAI') {\n             res.status(400).json({ error: \"xAI image generation not supported yet.\" });\n        } else if (provider === 'OpenRouter') {"
);

fs.writeFileSync('server.ts', code);
