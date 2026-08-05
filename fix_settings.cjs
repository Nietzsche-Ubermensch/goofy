const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');
code = code.replace(
  "<li>VENICE_API_KEY</li>",
  "<li>VENICE_API_KEY</li>\n                      <li>OPENAI_API_KEY</li>\n                      <li>XAI_API_KEY</li>"
);
fs.writeFileSync('src/components/SettingsModal.tsx', code);
