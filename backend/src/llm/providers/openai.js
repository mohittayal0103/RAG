require('dotenv').config();

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
    // Lazy-load so missing the package only errors when actually used
    const { OpenAI } = require('openai');
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

async function generate(model, prompt) {
  const response = await getClient().chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0]?.message?.content?.trim() ?? '';
}

module.exports = { generate };
