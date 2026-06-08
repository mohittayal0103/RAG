const EMBEDDING_CONFIG = {
  model: 'gemini-embedding-001',

  // Milliseconds to wait between embedding API calls.
  // gemini-embedding-001 free tier: 1500 RPM — no delay needed.
  // (The 5 RPM limit applies to generative models like Gemini Flash/Pro, not embedding models.)
  requestDelayMs: 0,

  // Retry configuration for transient Gemini API failures (429, 503, network).
  // attempt 1 → immediate, attempt 2 → 2 s, attempt 3 → 5 s
  maxRetries:    3,
  retryDelaysMs: [0, 2000, 5000],
};

module.exports = { EMBEDDING_CONFIG };
