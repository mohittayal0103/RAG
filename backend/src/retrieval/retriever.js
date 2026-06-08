/**
 * retriever.js
 *
 * Embeds a natural-language question, queries ChromaDB for the most
 * semantically similar stored chunks, and returns only those that meet
 * the minimum similarity threshold defined in retrievalConfig.js.
 *
 * Changes in this revision:
 *  - Fix 4: After Chroma results are shaped, any chunk whose similarityScore
 *    is below RETRIEVAL_CONFIG.minimumSimilarity is filtered out.  If every
 *    chunk fails the threshold the function returns [] so that answerQuestion()
 *    can short-circuit without calling Gemini.
 *  - topK is now read from RETRIEVAL_CONFIG so it is tunable in one place.
 */

const { generateEmbedding }    = require('../embeddings/embeddingService');
const { initializeCollection } = require('../vectorstore/chromaService');
const { RETRIEVAL_CONFIG }     = require('../config/retrievalConfig');
const logger                   = require('../utils/logger');

/**
 * Converts a ChromaDB L2 distance to a 0-1 similarity score.
 *
 * Gemini embeddings are L2-normalised (unit vectors), so the squared L2
 * distance between two of them equals:
 *
 *   d² = 2 - 2 * cos_sim   →   cos_sim = 1 - d²/2
 *
 * We clamp to [0, 1] because floating-point noise can push results just
 * outside that range.
 *
 * @param {number} l2Distance
 * @returns {number}  similarity in [0, 1]
 */
function l2ToSimilarity(l2Distance) {
  const cosineSim = 1 - (l2Distance * l2Distance) / 2;
  return Math.max(0, Math.min(1, cosineSim));
}

/**
 * Embeds a natural-language question, queries ChromaDB for the most
 * semantically similar stored chunks, and returns them filtered by the
 * minimum similarity threshold.
 *
 * The threshold filter prevents weakly-related chunks from reaching the
 * prompt builder.  If all candidates fall below the threshold the caller
 * receives [] and must return NOT_FOUND without calling Gemini — saving
 * both latency and token cost.
 *
 * @param {string} question            - The user's question in plain text.
 * @param {number} [topK]              - Candidates to fetch from Chroma before
 *                                       filtering; defaults to RETRIEVAL_CONFIG.topK.
 * @returns {Promise<Array<{
 *   id:              string,
 *   source:          string,
 *   chunkIndex:      number,
 *   text:            string,
 *   similarityScore: number   // 0 (unrelated) → 1 (identical)
 * }>>}
 */
async function searchSimilarChunks(question, topK = RETRIEVAL_CONFIG.topK) {
  if (!question || question.trim().length === 0) {
    throw new Error('searchSimilarChunks: question must be a non-empty string');
  }

  logger.info(`Retrieval query: "${question}" (topK=${topK}, minSimilarity=${RETRIEVAL_CONFIG.minimumSimilarity})`);

  // ── 1. Embed the question ────────────────────────────────────────────────
  logger.info('  Generating question embedding...');
  const { vector } = await generateEmbedding(question);
  logger.info(`  Question embedded — ${vector.length} dimensions`);

  // ── 2. Query ChromaDB ────────────────────────────────────────────────────
  const collection   = await initializeCollection();
  const totalRecords = await collection.count();

  if (totalRecords === 0) {
    logger.warn('  Collection is empty — no results to return');
    return [];
  }

  // Clamp topK so we never ask for more results than records exist
  const effectiveK = Math.min(topK, totalRecords);
  if (effectiveK < topK) {
    logger.warn(`  Collection has only ${totalRecords} record(s); returning ${effectiveK} instead of ${topK}`);
  }

  logger.info(`  Querying ChromaDB for top ${effectiveK} match(es)...`);

  const result = await collection.query({
    queryEmbeddings: [vector],
    nResults:        effectiveK,
    include:         ['documents', 'metadatas', 'distances'],
  });

  // result.*  are arrays-of-arrays (one inner array per query vector).
  // We sent exactly one query vector, so we always read index [0].
  const ids       = result.ids[0]       ?? [];
  const documents = result.documents[0] ?? [];
  const metadatas = result.metadatas[0] ?? [];
  const distances = result.distances[0] ?? [];

  // ── 3. Shape and rank the results ────────────────────────────────────────
  const chunks = ids.map((id, i) => ({
    id,
    source:          metadatas[i]?.source     ?? 'unknown',
    chunkIndex:      metadatas[i]?.chunkIndex ?? -1,
    parentId:        metadatas[i]?.parentId   ?? null,
    // Use the full parent section as context if available, else fall back to child text.
    text:            metadatas[i]?.parentText ?? documents[i] ?? '',
    childText:       documents[i]             ?? '',
    similarityScore: parseFloat(l2ToSimilarity(distances[i]).toFixed(6)),
  }));

  // ChromaDB already returns results sorted ascending by distance (= descending
  // by similarity), but we sort explicitly to guarantee the contract.
  chunks.sort((a, b) => b.similarityScore - a.similarityScore);

  // ── 4. Apply minimum similarity threshold ────────────────────────────────
  // Chunks below this score are semantically unrelated to the question.
  // Passing them to Gemini would produce confabulated or off-topic answers,
  // and would waste tokens on every such request.
  const qualified = chunks.filter(
    (c) => c.similarityScore >= RETRIEVAL_CONFIG.minimumSimilarity
  );

  const dropped = chunks.length - qualified.length;
  if (dropped > 0) {
    logger.warn(
      `  Dropped ${dropped} chunk(s) below similarity threshold ` +
      `(${RETRIEVAL_CONFIG.minimumSimilarity}) — scores: ` +
      chunks.slice(qualified.length).map((c) => c.similarityScore).join(', ')
    );
  }

  if (qualified.length === 0) {
    logger.warn('  No chunks met the similarity threshold — returning []');
    return [];
  }

  // Deduplicate by parentId: if multiple children share a parent, keep only the
  // highest-scoring one (the parent text is the same for all siblings).
  const seen = new Set();
  const deduped = [];
  for (const chunk of qualified) {
    const key = chunk.parentId ?? chunk.id;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(chunk);
    }
  }

  logger.info(
    `  ${deduped.length} unique parent section(s) after dedup — top score: ${deduped[0].similarityScore}`
  );
  return deduped;
}

module.exports = { searchSimilarChunks };
