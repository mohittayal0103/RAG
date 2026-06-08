/**
 * llmConfig.js
 *
 * Catalogue of supported LLM providers and their models.
 * Each provider entry lists its models and which env var is required.
 * `available` is computed at runtime based on env vars present.
 */

const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', default: true },
      { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-4o',       name: 'GPT-4o',       default: true },
      { id: 'gpt-4o-mini',  name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo',  name: 'GPT-4 Turbo' },
    ],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    envKey: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-sonnet-4-6',  name: 'Claude Sonnet 4.6', default: true },
      { id: 'claude-opus-4-8',    name: 'Claude Opus 4.8' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    envKey: null, // no API key needed — available if OLLAMA_ENABLED=true
    models: [
      { id: 'llama3.2',  name: 'Llama 3.2',  default: true },
      { id: 'mistral',   name: 'Mistral 7B' },
      { id: 'phi4',      name: 'Phi-4' },
    ],
  },
];

const DEFAULT_PROVIDER = 'gemini';
const DEFAULT_MODEL    = 'gemini-2.5-flash';

/**
 * Returns providers with an `available` flag set based on current env vars.
 */
function getProviders() {
  return PROVIDERS.map((p) => ({
    ...p,
    available: p.id === 'ollama'
      ? process.env.OLLAMA_ENABLED === 'true'
      : !!process.env[p.envKey],
  }));
}

/**
 * Validates that the given provider/model combination exists in the catalogue.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
function validateProviderModel(providerId, modelId) {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return { valid: false, reason: `Unknown provider: "${providerId}"` };

  const model = provider.models.find((m) => m.id === modelId);
  if (!model) return { valid: false, reason: `Unknown model "${modelId}" for provider "${providerId}"` };

  const available = provider.id === 'ollama'
    ? process.env.OLLAMA_ENABLED === 'true'
    : !!process.env[provider.envKey];

  if (!available) {
    return { valid: false, reason: `Provider "${providerId}" is not configured (missing ${provider.envKey || 'OLLAMA_ENABLED'})` };
  }

  return { valid: true };
}

module.exports = { PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL, getProviders, validateProviderModel };
