const fs = require('fs');
let code = fs.readFileSync('src/pages/ImageGenerator.tsx', 'utf8');

code = code.replace(
  "<option value={AIProvider.Venice}>Venice</option>",
  "<option value={AIProvider.Venice}>Venice</option>\n                           <option value={AIProvider.OpenAI}>OpenAI</option>\n                           <option value={AIProvider.xAI}>xAI</option>"
);

code = code.replace(
  "if (provider === AIProvider.Venice) modelId = 'flux-2-pro';",
  "if (provider === AIProvider.Venice) modelId = 'flux-2-pro';\n                             if (provider === AIProvider.OpenAI) modelId = 'dall-e-3';\n                             if (provider === AIProvider.xAI) modelId = 'grok-vision-beta';"
);

code = code.replace(
  "{aiConfig.provider === AIProvider.Venice && (",
  "{aiConfig.provider === AIProvider.OpenAI && (\n                               <>\n                                   <option value=\"dall-e-3\">DALL-E 3</option>\n                                   <option value=\"dall-e-2\">DALL-E 2</option>\n                               </>\n                           )}\n                           {aiConfig.provider === AIProvider.xAI && (\n                               <>\n                                   <option value=\"grok-vision-beta\">Grok Vision</option>\n                               </>\n                           )}\n                           {aiConfig.provider === AIProvider.Venice && ("
);

fs.writeFileSync('src/pages/ImageGenerator.tsx', code);
