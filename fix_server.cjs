const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  "if (provider === 'Gemini') return process.env.GEMINI_API_KEY;",
  "if (provider === 'Gemini') return process.env.GEMINI_API_KEY;\n    if (provider === 'OpenAI') return process.env.OPENAI_API_KEY;\n    if (provider === 'xAI') return process.env.XAI_API_KEY;"
);
fs.writeFileSync('server.ts', code);
