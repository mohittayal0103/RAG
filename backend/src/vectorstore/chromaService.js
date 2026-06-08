const { ChromaClient } = require('chromadb');
const logger = require('../utils/logger');
const { CHROMA_CONFIG } = require('../config/chromaConfig');

// Module-level client and collection — created once, reused across calls.
let client     = null;
let collection = null;

/**
 * Returns a connected ChromaClient, creating it on first call.
 * @returns {ChromaClient}
 */
function getClient() {
  if (!client) {
    client = new ChromaClient({
      ssl:  CHROMA_CONFIG.ssl,
      host: CHROMA_CONFIG.host,
      port: CHROMA_CONFIG.port,
    });
    logger.info(`ChromaDB client created → http${CHROMA_CONFIG.ssl ? 's' : ''}://${CHROMA_CONFIG.host}:${CHROMA_CONFIG.port}`);
  }
  return client;
}

/**
 * Connects to ChromaDB and gets-or-creates the target collection.
 * Safe to call multiple times — returns the cached collection after the first call.
 *
 * We disable the default embedding function (embeddingFunction: null) because
 * we supply our own pre-computed Gemini vectors; Chroma must not try to re-embed.
 *
 * @returns {Promise<Collection>}
 */
async function initializeCollection() {
  if (collection) {
    logger.info(`Collection "${CHROMA_CONFIG.collectionName}" already initialized — reusing`);
    return collection;
  }

  const c = getClient();

  // Verify the server is reachable before trying to create the collection.
  try {
    await c.heartbeat();
    logger.info('ChromaDB heartbeat OK');
  } catch (err) {
    throw new Error(
      `Cannot reach ChromaDB at ${CHROMA_CONFIG.host}:${CHROMA_CONFIG.port}. ` +
      `Start the server with: chroma run --path ./chroma-data --port ${CHROMA_CONFIG.port}\n` +
      `Original error: ${err.message}`
    );
  }

  collection = await c.getOrCreateCollection({
    name:              CHROMA_CONFIG.collectionName,
    // null tells Chroma we will always provide embeddings ourselves.
    embeddingFunction: null,
  });

  logger.info(`Collection "${CHROMA_CONFIG.collectionName}" ready`);
  return collection;
}

/**
 * Stores an array of embedded chunks into the ChromaDB collection.
 * Uses upsert so re-running the pipeline with the same IDs overwrites
 * existing records instead of throwing a duplicate-key error.
 *
 * @param {Array<{
 *   id:         string,
 *   source:     string,
 *   chunkIndex: number,
 *   text:       string,
 *   vector:     number[],
 *   dimensions: number
 * }>} embeddedChunks
 * @returns {Promise<{ stored: number, skipped: number }>}
 */
async function storeEmbeddings(embeddedChunks) {
  if (!Array.isArray(embeddedChunks) || embeddedChunks.length === 0) {
    logger.warn('storeEmbeddings: received empty array — nothing to store');
    return { stored: 0, skipped: 0 };
  }

  const col = await initializeCollection();
  logger.info(`Storing ${embeddedChunks.length} chunk(s) into "${CHROMA_CONFIG.collectionName}"...`);

  // Validate each chunk has a non-empty vector before sending to Chroma.
  const valid   = embeddedChunks.filter((c) => Array.isArray(c.vector) && c.vector.length > 0);
  const skipped = embeddedChunks.length - valid.length;

  if (skipped > 0) {
    logger.warn(`Skipping ${skipped} chunk(s) with missing or empty vectors`);
  }

  if (valid.length === 0) {
    logger.error('No valid embeddings to store');
    return { stored: 0, skipped };
  }

  // ChromaDB expects parallel arrays — extract each field in one pass.
  const ids        = valid.map((c) => c.id);
  const embeddings = valid.map((c) => c.vector);
  const documents  = valid.map((c) => c.text);
  const metadatas  = valid.map((c) => ({
    source:     c.source,
    chunkIndex: c.chunkIndex,
    ...(c.documentId  != null ? { documentId:  c.documentId  } : {}),
    ...(c.parentId    != null ? { parentId:    c.parentId    } : {}),
    ...(c.parentText  != null ? { parentText:  c.parentText  } : {}),
  }));

  await col.upsert({ ids, embeddings, documents, metadatas });

  logger.info(`Stored ${valid.length} record(s) successfully`);
  return { stored: valid.length, skipped };
}

/**
 * Returns a summary of the current collection state.
 *
 * @returns {Promise<{
 *   collectionName: string,
 *   totalRecords:   number,
 *   sample:         Array<{ id, source, chunkIndex, textPreview }>
 * }>}
 */
async function getCollectionStats() {
  const col = await initializeCollection();

  const totalRecords = await col.count();

  // Fetch up to 3 records as a representative sample.
  const sampleSize = Math.min(3, totalRecords);
  let sample = [];

  if (sampleSize > 0) {
    const raw = await col.get({
      limit:   sampleSize,
      include: ['documents', 'metadatas'],
    });

    sample = raw.ids.map((id, i) => ({
      id,
      source:      raw.metadatas[i]?.source     ?? 'unknown',
      chunkIndex:  raw.metadatas[i]?.chunkIndex ?? -1,
      textPreview: (raw.documents[i] ?? '').slice(0, 120).replace(/\n/g, ' '),
    }));
  }

  return {
    collectionName: CHROMA_CONFIG.collectionName,
    totalRecords,
    sample,
  };
}

module.exports = { initializeCollection, storeEmbeddings, getCollectionStats };
