import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.generateImages({
      model: 'gemini-3-pro-image-preview',
      prompt: 'a futuristic trading card',
      config: {
         outputMimeType: 'image/png',
         aspectRatio: '3:4'
      }
    });
    console.log(response.generatedImages[0].image.imageBytes.length);
  } catch (e) {
    console.error(e);
  }
}
run();
