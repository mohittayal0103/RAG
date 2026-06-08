/**
 * llmService.js
 *
 * Dispatches generate() calls to the correct provider adapter.
 * Provider modules are lazy-loaded so missing optional packages
 * (openai, @anthropic-ai/sdk) only throw when that provider is
 * actually used, not at startup.
 */

const { DEFAULT_PROVIDER, DEFAULT_MODEL } = require('./llmConfig');
const logger = require('../utils/logger');

const ADAPTERS = {
  gemini: () => require('./providers/gemini'),
  openai: () => require('./providers/openai'),
  claude: () => require('./providers/claude'),
  ollama: () => require('./providers/ollama'),
};

/**
 * Generate a completion using the specified provider and model.
 *
 * @param {string} prompt
 * @param {string} [provider]
 * @param {string} [model]
 * @returns {Promise<string>}
 */
async function generate(prompt, provider = DEFAULT_PROVIDER, model = DEFAULT_MODEL) {
  const adapterFactory = ADAPTERS[provider];
  if (!adapterFactory) throw new Error(`Unsupported LLM provider: "${provider}"`);

  logger.info(`  LLM: ${provider}/${model}`);
  const adapter = adapterFactory();
  return adapter.generate(model, prompt);
}

module.exports = { generate };
