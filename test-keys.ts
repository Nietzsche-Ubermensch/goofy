import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";

async function testKeys() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const veniceKey = process.env.VENICE_API_KEY;

  console.log("Testing Gemini API...");
  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'hello',
    });
    console.log("✅ Gemini works:", response.text ? "Yes" : "No");
  } catch(e: any) {
    console.log("❌ Gemini failed:", e.message);
  }

  console.log("Testing OpenRouter API...");
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "HTTP-Referer": "https://aistudio.google.com",
        "X-Title": "CardCrop AI Suite",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: "hello" }]
      })
    });
    if(res.ok) {
        console.log("✅ OpenRouter works");
    } else {
        const err = await res.text();
        console.log("❌ OpenRouter failed:", res.status, err);
    }
  } catch(e: any) {
    console.log("❌ OpenRouter failed:", e.message);
  }

  console.log("Testing Venice API...");
  try {
    const res = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${veniceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [{ role: "user", content: "hello" }]
      })
    });
    if(res.ok) {
        console.log("✅ Venice works");
    } else {
        const err = await res.text();
        console.log("❌ Venice failed:", res.status, err);
    }
  } catch(e: any) {
    console.log("❌ Venice failed:", e.message);
  }
}

testKeys();
