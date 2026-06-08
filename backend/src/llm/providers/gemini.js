require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _client;
}

async function generate(model, prompt) {
  const response = await getClient().models.generateContent({ model, contents: prompt });
  return response.text?.trim() ?? '';
}

module.exports = { generate };
