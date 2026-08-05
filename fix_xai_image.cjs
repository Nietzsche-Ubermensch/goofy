const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "} else if (provider === 'xAI') {\n             res.status(400).json({ error: \"xAI image generation not supported yet.\" });",
  "} else if (provider === 'xAI') {\n            const response = await axios.post(\"https://api.x.ai/v1/images/generations\", {\n                model: modelId || \"gpt-image-1.5\",\n                prompt: prompt,\n                n: 1,\n                size: \"1024x1024\",\n                response_format: \"b64_json\"\n            }, {\n                headers: { \"Authorization\": `Bearer ${effectiveKey}` }\n            });\n            return res.json(response.data);"
);

fs.writeFileSync('server.ts', code);
