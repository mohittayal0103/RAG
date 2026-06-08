/**
 * retrievalConfig.js
 *
 * Tunable knobs for the semantic retrieval pipeline.
 *
 * minimumSimilarity acts as a quality gate: chunks whose cosine similarity
 * to the query falls below this threshold are discarded before the prompt
 * is built.  This prevents Gemini from being called with unrelated context,
 * which both wastes tokens and produces confabulated answers.
 *
 * Calibration guide:
 *   >= 0.80  → very strict; only near-exact semantic matches pass
 *   0.65–0.79 → recommended default; filters clearly unrelated chunks
 *   0.50–0.64 → loose; accepts weakly related chunks (higher recall, lower precision)
 *   < 0.50   → not recommended; most chunks will pass regardless of relevance
 */

const RETRIEVAL_CONFIG = {
  /** Number of candidate chunks to request from ChromaDB before filtering. */
  topK: 3,

  /**
   * Minimum cosine similarity score (0–1) a chunk must reach to be included
   * in the prompt sent to Gemini.  Chunks below this score are silently
   * dropped.  If all chunks are dropped the caller receives an empty array
   * and must return NOT_FOUND without calling Gemini.
   */
  minimumSimilarity: 0.65,
};

module.exports = { RETRIEVAL_CONFIG };
