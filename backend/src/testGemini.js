require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

console.log(
  "API Key Found:",
  !!process.env.GEMINI_API_KEY
);

async function test() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Explain React useState in one sentence",
  });

  console.log(response.text);
}

test();