const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// For chat proxy
code = code.replace(
  "} else if (provider === 'Venice') {\n          url = \"https://api.venice.ai/api/v1/chat/completions\";\n      }",
  "} else if (provider === 'Venice') {\n          url = \"https://api.venice.ai/api/v1/chat/completions\";\n      } else if (provider === 'OpenAI') {\n          url = \"https://api.openai.com/v1/chat/completions\";\n      } else if (provider === 'xAI') {\n          url = \"https://api.x.ai/v1/chat/completions\";\n      }"
);

// For analyze proxy
code = code.replace(
  "} else if (provider === 'Venice') {",
  "} else if (provider === 'OpenAI' || provider === 'xAI') {\n        const apiUrl = provider === 'OpenAI' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.x.ai/v1/chat/completions';\n        const response = await axios.post(apiUrl, {\n          model: modelId || (provider === 'OpenAI' ? 'gpt-4o' : 'grok-vision-beta'),\n          messages: [\n            {\n              role: 'user',\n              content: [\n                { type: 'text', text: prompt },\n                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }\n              ]\n            }\n          ]\n        }, { headers: { 'Authorization': `Bearer ${effectiveKey}` } });\n        let content = response.data.choices[0].message.content || '';\n        const match = content.match(/\\{[\\s\\S]*\\}/);\n        if (match) content = match[0];\n        return res.json(JSON.parse(content));\n      } else if (provider === 'Venice') {"
);

fs.writeFileSync('server.ts', code);
