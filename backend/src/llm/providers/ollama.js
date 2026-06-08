require('dotenv').config();
const { Ollama } = require('ollama');

const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
let _client = null;

function getClient() {
  if (!_client) _client = new Ollama({ host });
  return _client;
}

async function generate(model, prompt) {
  const response = await getClient().generate({ model, prompt, stream: false });
  return response.response?.trim() ?? '';
}

module.exports = { generate };
