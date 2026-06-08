const { getProviders } = require('../../llm/llmConfig');

/**
 * GET /llm/providers
 * Returns the full provider/model catalogue with availability flags.
 */
function listProviders(req, res) {
  const providers = getProviders();
  return res.json({ success: true, providers });
}

module.exports = { listProviders };
