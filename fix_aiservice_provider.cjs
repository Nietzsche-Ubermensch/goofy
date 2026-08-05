const fs = require('fs');
let code = fs.readFileSync('src/services/aiService.ts', 'utf8');

code = code.replace(
  "  }\n  const provider = config?.provider || AIProvider.Gemini;",
  "  }"
);

fs.writeFileSync('src/services/aiService.ts', code);
