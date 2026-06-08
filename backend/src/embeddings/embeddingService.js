/**
 * embeddingService.js
 *
 * Wraps the Gemini embedding API.
 *
 * Changes in this revision:
 *  - generateEmbedding() now retries on transient failures (429, 503,
 *    network errors) using the backoff schedule in EMBEDDING_CONFIG.
 *  - generateEmbeddings() passes the documentId through so Chroma metadata
 *    can store it alongside source and chunkIndex.
 */

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const logger          = require('../utils/logger');
const { EMBEDDING_CONFIG } = require('../config/embeddingConfig');

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment / .env file');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns true for error conditions that are safe to retry:
 *  - HTTP 429 (rate-limited)
 *  - HTTP 503 (service unavailable)
 *  - Network-level failures ("fetch failed", ECONNRESET, etc.)
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isRetryable(err) {
  const msg = err.message?.toLowerCase() ?? '';
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('network')
  );
}

/**
 * Generates an embedding vector for a single piece of text.
 * Retries up to EMBEDDING_CONFIG.maxRetries times on transient errors,
 * waiting EMBEDDING_CONFIG.retryDelaysMs[attempt] milliseconds before each retry.
 *
 * @param {string} text
 * @returns {Promise<{ vector: number[], dimensions: number }>}
 */
async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot embed empty text');
  }

  const maxRetries  = EMBEDDING_CONFIG.maxRetries   ?? 3;
  const retryDelays = EMBEDDING_CONFIG.retryDelaysMs ?? [0, 2000, 5000];
  let   lastErr;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Wait before retries (attempt 1 delay is 0 — immediate)
    const delay = retryDelays[attempt - 1] ?? retryDelays[retryDelays.length - 1];
    if (attempt > 1) {
      logger.info(`  Retrying embedding (attempt ${attempt}/${maxRetries}) after ${delay}ms...`);
      await sleep(delay);
    }

    try {
      const response = await ai.models.embedContent({
        model:    EMBEDDING_CONFIG.model,
        contents: text,
      });

      const vector = response.embeddings[0].values;
      return { vector, dimensions: vector.length };
    } catch (err) {
      lastErr = err;

      if (!isRetryable(err) || attempt === maxRetries) {
        // Non-retryable error or final attempt — bubble up immediately
        throw err;
      }

      logger.warn(`  Embedding attempt ${attempt}/${maxRetries} failed (${err.message}) — will retry`);
    }
  }

  // Unreachable, but satisfies linters
  throw lastErr;
}

/**
 * Generates embedding vectors for an array of chunks.
 * Accepts chunks that may carry an optional documentId field and passes it
 * through to the result so Chroma can store it in chunk metadata.
 *
 * @param {Array<{
 *   id:          string,
 *   source:      string,
 *   chunkIndex:  number,
 *   text:        string,
 *   documentId?: string,
 * }>} chunks
 * @returns {Promise<Array<{
 *   id, source, chunkIndex, text, documentId, vector, dimensions
 * }>>}
 */
async function generateEmbeddings(chunks, signal) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    logger.warn('generateEmbeddings received an empty array — returning []');
    return [];
  }

  logger.info(`Generating embeddings for ${chunks.length} chunk(s) using "${EMBEDDING_CONFIG.model}"...`);

  const results = [];
  let successCount = 0;
  let failCount    = 0;

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) {
      logger.info(`  Embedding cancelled by client at chunk ${i + 1}/${chunks.length}`);
      throw Object.assign(new Error('Upload cancelled by client'), { code: 'ABORTED' });
    }

    const chunk = chunks[i];
    logger.info(`  [${i + 1}/${chunks.length}] Embedding "${chunk.id}" (${chunk.text.length} chars)`);

    try {
      const { vector, dimensions } = await generateEmbedding(chunk.text);

      results.push({
        id:         chunk.id,
        source:     chunk.source,
        chunkIndex: chunk.chunkIndex,
        documentId: chunk.documentId ?? null,
        parentId:   chunk.parentId   ?? null,
        parentText: chunk.parentText ?? null,
        text:       chunk.text,
        vector,
        dimensions,
      });

      successCount++;
    } catch (err) {
      if (err.code === 'ABORTED') throw err;
      logger.error(`  Failed to embed "${chunk.id}" after all retries: ${err.message}`);
      failCount++;
    }

    if (i < chunks.length - 1 && EMBEDDING_CONFIG.requestDelayMs > 0) {
      logger.info(`  Rate-limit pause: ${EMBEDDING_CONFIG.requestDelayMs / 1000}s...`);
      await sleep(EMBEDDING_CONFIG.requestDelayMs);
    }
  }

  logger.info(`Embeddings complete — success: ${successCount}, failed: ${failCount}`);
  return results;
}

module.exports = { generateEmbedding, generateEmbeddings };
