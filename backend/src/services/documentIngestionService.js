/**
 * documentIngestionService.js
 *
 * Orchestrates the full ingest pipeline for a single uploaded file:
 *
 *   saved file on disk
 *     → extract text  (pdf-parse or plain-text read)
 *     → chunk         (existing chunkDocument)
 *     → embed         (existing generateEmbeddings)
 *     → store vectors (existing storeEmbeddings)
 *     → persist metadata to documents.json  (atomic write via .tmp + rename)
 *     (file is intentionally kept on disk for re-indexing / model migrations)
 *
 * This service is the only place that knows the full sequence.
 * Controllers call ingestDocument() and receive a result summary;
 * they never touch the filesystem or ChromaDB directly.
 *
 * Deletion is also handled here so the controller stays thin.
 *
 * Changes in this revision:
 *  - Fix 1: deleteDocument() and reindexDocument() now query Chroma using
 *            { documentId } instead of { source: fileName }.  documentId is
 *            stable across renames; fileName is not.
 *  - Fix 2: writeMetadata() now writes to a .tmp file first, then renames
 *            atomically.  A crash mid-write leaves the .tmp orphan; the live
 *            documents.json is never partially written.
 */

const fs           = require('fs');
const path         = require('path');
const crypto       = require('crypto');
const { PDFParse } = require('pdf-parse');

const { chunkDocument }                         = require('../chunkers/textChunker');
const { generateEmbeddings }                    = require('../embeddings/embeddingService');
const { storeEmbeddings, initializeCollection } = require('../vectorstore/chromaService');
const logger                                    = require('../utils/logger');
const { UPLOAD_CONFIG }                         = require('../config/uploadConfig');

// ── Concurrent-upload guard ───────────────────────────────────────────────────
// Prevents two simultaneous uploads of the same fileName from both passing the
// metadata duplicate-check before either one writes its record (TOCTOU race).
const _inProgress = new Set();

// ── Metadata helpers ──────────────────────────────────────────────────────────

/**
 * Reads the full metadata array from documents.json.
 * Returns an empty array if the file is empty or unreadable.
 *
 * @returns {Array<{documentId:string, fileName:string, uploadedAt:string, chunks:number}>}
 */
function readMetadata() {
  try {
    const raw = fs.readFileSync(UPLOAD_CONFIG.metadataFile, 'utf-8').trim();
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Writes the metadata array to documents.json using an atomic
 * write-then-rename pattern.
 *
 * WHY ATOMIC:
 *   A plain fs.writeFileSync() truncates the file before writing new content.
 *   If the process crashes (OOM kill, SIGKILL, power loss) between the
 *   truncation and the final flush, documents.json is left as an empty or
 *   partial file.  The next readMetadata() call then returns [] and the app
 *   silently loses all document history.
 *
 *   Writing to a sibling .tmp file first means the live documents.json is
 *   only ever replaced by a complete, valid file.  fs.renameSync() is an
 *   atomic syscall on POSIX filesystems (Linux/macOS) as long as both paths
 *   are on the same filesystem — which they always are here (same directory).
 *
 * @param {Array} records
 */
function writeMetadata(records) {
  const tmpFile = UPLOAD_CONFIG.metadataFile + '.tmp';

  // 1. Write the complete payload to the temp file.
  //    If this crashes, the live metadataFile is untouched.
  fs.writeFileSync(tmpFile, JSON.stringify(records, null, 2) + '\n', 'utf-8');

  // 2. Atomically swap the temp file into place.
  //    On POSIX this is a single syscall — no window where the file is absent
  //    or partially written.
  fs.renameSync(tmpFile, UPLOAD_CONFIG.metadataFile);
}

// ── Text extraction ───────────────────────────────────────────────────────────

/**
 * Extracts plain text from a file on disk.
 * Uses magic-byte detection so .pdf files are handled correctly regardless
 * of whether the caller double-checks the extension.
 *
 * @param {string} filePath  - Absolute path to the file.
 * @param {string} fileName  - Original file name (used only for logging).
 * @returns {Promise<string>} - Extracted text content.
 */
async function extractText(filePath, fileName) {
  const buffer      = fs.readFileSync(filePath);
  const ext         = path.extname(fileName).toLowerCase();
  const isBinaryPDF = buffer.slice(0, 5).toString('ascii') === '%PDF-';

  if (ext === '.pdf' && isBinaryPDF) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  // .txt, .md, or a plain-text .pdf
  return buffer.toString('utf-8').trim();
}

// ── Core pipeline step (shared by ingest and reindex) ────────────────────────

/**
 * Runs chunk → embed → store for the given content and documentId.
 * Used by both ingestDocument() and reindexDocument() to avoid duplicating
 * the embedding/storage logic.
 *
 * @param {{
 *   documentId: string,
 *   fileName:   string,
 *   content:    string,
 *   tag:        string,
 * }} opts
 * @returns {Promise<{ chunksCreated: number, vectorsStored: number }>}
 */
const EMBED_BATCH_SIZE = 25;

async function _embedAndStore({ documentId, fileName, content, tag, signal }) {
  // Chunk
  const rawChunks = chunkDocument({ fileName, content });
  logger.info(`${tag} produced ${rawChunks.length} chunk(s)`);

  if (signal?.aborted) throw Object.assign(new Error('Upload cancelled by client'), { code: 'ABORTED' });

  // Embed + store in batches so we never hold the full document in memory.
  let totalStored = 0;
  for (let start = 0; start < rawChunks.length; start += EMBED_BATCH_SIZE) {
    const batch = rawChunks.slice(start, start + EMBED_BATCH_SIZE).map((c) => ({ ...c, documentId }));
    const batchEnd = Math.min(start + EMBED_BATCH_SIZE, rawChunks.length);
    logger.info(`${tag} embedding batch ${start + 1}–${batchEnd} / ${rawChunks.length}`);

    const embedded = await generateEmbeddings(batch, signal);

    if (signal?.aborted) throw Object.assign(new Error('Upload cancelled by client'), { code: 'ABORTED' });

    const { stored } = await storeEmbeddings(embedded);
    totalStored += stored;
    logger.info(`${tag} stored ${stored} vector(s) (batch ${start + 1}–${batchEnd})`);
  }

  logger.info(`${tag} total stored: ${totalStored} vector(s) in ChromaDB`);
  return { chunksCreated: rawChunks.length, vectorsStored: totalStored };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Runs the full ingest pipeline for an uploaded file.
 *
 * The uploaded file is kept on disk after ingestion so it can be re-indexed,
 * re-chunked, or re-embedded in the future without requiring a new upload.
 * Deletion of the file only happens through deleteDocument().
 *
 * @param {{
 *   filePath:  string,  // absolute path on disk (multer destination)
 *   fileName:  string,  // original client-supplied filename
 *   requestId: string,  // for correlated logging
 * }} opts
 * @returns {Promise<{
 *   documentId:    string,
 *   fileName:      string,
 *   chunksCreated: number,
 *   vectorsStored: number,
 * }>}
 */
async function ingestDocument({ filePath, fileName, requestId, signal }) {
  const tag = `[${requestId}][ingest:${fileName}]`;
  logger.info(`${tag} starting ingest`);

  // H-01: Reject a second upload for the same fileName while the first is
  // still in-flight.  Without this guard, two concurrent requests both pass
  // the metadata duplicate-check before either one writes its record.
  if (_inProgress.has(fileName)) {
    const err = new Error(`Upload already in progress for "${fileName}"`);
    err.code  = 'UPLOAD_IN_PROGRESS';
    throw err;
  }
  _inProgress.add(fileName);

  try {
    // ── 1. Duplicate guard ─────────────────────────────────────────────────
    const existing = readMetadata().find((r) => r.fileName === fileName);
    if (existing) {
      // Do NOT delete the file — the caller's copy is still valid.
      const err = new Error(`Document already exists: ${fileName}`);
      err.code  = 'DUPLICATE';
      throw err;
    }

    // ── 2. Extract text ────────────────────────────────────────────────────
    logger.info(`${tag} extracting text`);
    const content = await extractText(filePath, fileName);
    if (!content) {
      throw new Error(`No text could be extracted from "${fileName}"`);
    }
    logger.info(`${tag} extracted ${content.length} chars`);

    // ── 3. Assign a permanent document ID ─────────────────────────────────
    const documentId = crypto.randomUUID();
    logger.info(`${tag} assigned documentId: ${documentId}`);

    // ── 4. Chunk → Embed → Store ───────────────────────────────────────────
    const { chunksCreated, vectorsStored } = await _embedAndStore({
      documentId,
      fileName,
      content,
      tag,
      signal,
    });

    // ── 5. Persist metadata (atomic write) ─────────────────────────────────
    const records = readMetadata();
    records.push({
      documentId,
      fileName,
      uploadedAt: new Date().toISOString(),
      chunks:     vectorsStored,
    });
    writeMetadata(records);
    logger.info(`${tag} metadata saved (documentId: ${documentId})`);

    // NOTE: uploaded file is intentionally kept on disk for future re-indexing.

    return { documentId, fileName, chunksCreated, vectorsStored };
  } finally {
    _inProgress.delete(fileName);
  }
}

/**
 * Re-indexes an already-ingested document.
 *
 * Reads the original file from uploads/, deletes old Chroma vectors using
 * documentId (stable identifier), then runs the full chunk → embed → store
 * pipeline again preserving the same documentId.
 *
 * WHY documentId FOR DELETION:
 *   Querying Chroma by { source: fileName } would break if a file were ever
 *   renamed or if two files had the same name in different ingestion runs.
 *   documentId is assigned once at first ingest and never changes, making it
 *   the correct key for all vector lifecycle operations.
 *
 * @param {{
 *   fileName:  string,
 *   requestId: string,
 * }} opts
 * @returns {Promise<{
 *   success:       boolean,
 *   chunksCreated: number,
 *   vectorsStored: number,
 * }>}
 */
async function reindexDocument({ fileName, requestId }) {
  const tag = `[${requestId}][reindex:${fileName}]`;
  logger.info(`${tag} starting re-index`);

  // ── 1. Verify document exists ────────────────────────────────────────────
  const records = readMetadata();
  const entry   = records.find((r) => r.fileName === fileName);
  if (!entry) {
    const err = new Error(`Document not found: ${fileName}`);
    err.code  = 'NOT_FOUND';
    throw err;
  }

  const { documentId } = entry;

  // C-03: Legacy records ingested before documentId was introduced will have
  // an undefined field.  Passing undefined to Chroma as a where-filter value
  // silently becomes {} and could wipe the entire collection.
  if (!documentId) {
    const err = new Error(`Document "${fileName}" has no documentId — re-upload to assign one`);
    err.code  = 'MISSING_DOCUMENT_ID';
    throw err;
  }
  logger.info(`${tag} documentId: ${documentId}`);

  // ── 2. Verify file exists ────────────────────────────────────────────────
  const filePath = path.join(UPLOAD_CONFIG.uploadDir, fileName);
  if (!fs.existsSync(filePath)) {
    const err = new Error(`Uploaded file not found on disk: ${fileName}`);
    err.code  = 'FILE_NOT_FOUND';
    throw err;
  }

  // ── 3. Extract text ──────────────────────────────────────────────────────
  // Extraction happens BEFORE any destructive Chroma operation so that a
  // Gemini or extraction failure leaves existing vectors fully intact.
  logger.info(`${tag} extracting text`);
  const content = await extractText(filePath, fileName);
  if (!content) {
    throw new Error(`No text could be extracted from "${fileName}" during re-index`);
  }
  logger.info(`${tag} extracted ${content.length} chars`);

  // ── 4. Chunk + embed + store in batches ─────────────────────────────────
  // Chunking first gives us the full ID set for orphan cleanup, but we
  // embed and store in batches to avoid holding all vectors in memory.
  const rawChunks = chunkDocument({ fileName, content });
  const newIdSet  = new Set(rawChunks.map((c) => c.id));
  logger.info(`${tag} produced ${rawChunks.length} chunk(s) — embedding in batches of ${EMBED_BATCH_SIZE}`);

  let totalStored = 0;
  for (let start = 0; start < rawChunks.length; start += EMBED_BATCH_SIZE) {
    const batch = rawChunks.slice(start, start + EMBED_BATCH_SIZE).map((c) => ({ ...c, documentId }));
    const batchEnd = Math.min(start + EMBED_BATCH_SIZE, rawChunks.length);
    logger.info(`${tag} embedding batch ${start + 1}–${batchEnd} / ${rawChunks.length}`);

    const embedded = await generateEmbeddings(batch);

    if (embedded.length === 0 && start === 0) {
      throw new Error(
        `No embeddings generated for "${fileName}" — aborting reindex to preserve existing vectors`
      );
    }

    const { stored } = await storeEmbeddings(embedded);
    totalStored += stored;
  }

  // ── 5. Verify store success ──────────────────────────────────────────────
  if (totalStored === 0) {
    throw new Error(
      `storeEmbeddings reported 0 stored for "${fileName}" — aborting reindex`
    );
  }
  logger.info(`${tag} stored ${totalStored} new vector(s)`);

  // ── 8. Delete orphaned old vectors ──────────────────────────────────────
  // Chunk IDs are ${fileName}::chunk::${index}.  If the re-chunked document
  // has fewer chunks than before, old high-index IDs are orphans that upsert
  // did not overwrite — delete them now.  We cannot delete by documentId
  // here because new and old chunks share the same documentId.
  const collection      = await initializeCollection();
  const { ids: allIds } = await collection.get({ where: { documentId }, include: [] });
  const orphanedIds     = allIds.filter((id) => !newIdSet.has(id));

  if (orphanedIds.length > 0) {
    await collection.delete({ ids: orphanedIds });
    logger.info(`${tag} deleted ${orphanedIds.length} orphaned old vector(s)`);
  } else {
    logger.info(`${tag} no orphaned vectors — collection is clean`);
  }

  // ── 9. Update metadata (atomic write) ───────────────────────────────────
  const updated = records.map((r) =>
    r.fileName === fileName ? { ...r, chunks: totalStored } : r
  );
  writeMetadata(updated);
  logger.info(`${tag} metadata updated — new chunk count: ${totalStored}`);

  return { success: true, chunksCreated: rawChunks.length, vectorsStored: totalStored };
}

/**
 * Removes all Chroma vectors, the metadata entry, and the uploaded file
 * for a given document.
 *
 * WHY documentId FOR DELETION:
 *   See reindexDocument() above — documentId is the stable key; fileName
 *   is mutable and not guaranteed unique across future ingestion runs.
 *
 * @param {{
 *   fileName:  string,
 *   requestId: string,
 * }} opts
 * @returns {Promise<{ deletedChunks: number }>}
 */
async function deleteDocument({ fileName, requestId }) {
  const tag = `[${requestId}][delete:${fileName}]`;
  logger.info(`${tag} starting deletion`);

  // ── 1. Confirm document exists in metadata ───────────────────────────────
  const records = readMetadata();
  const entry   = records.find((r) => r.fileName === fileName);
  if (!entry) {
    const err = new Error(`Document not found: ${fileName}`);
    err.code  = 'NOT_FOUND';
    throw err;
  }

  const { documentId } = entry;

  // C-03: guard against legacy records without documentId
  if (!documentId) {
    const err = new Error(`Document "${fileName}" has no documentId — re-upload to assign one`);
    err.code  = 'MISSING_DOCUMENT_ID';
    throw err;
  }
  logger.info(`${tag} documentId: ${documentId}`);

  // ── 2. Delete vectors from Chroma using documentId ───────────────────────
  // documentId is stored in every chunk's metadata at ingest time, so this
  // filter reliably captures all vectors for this document regardless of
  // whether the fileName ever changed.
  const collection    = await initializeCollection();
  const { ids }       = await collection.get({ where: { documentId }, include: [] });
  const deletedChunks = ids.length;

  if (deletedChunks > 0) {
    await collection.delete({ where: { documentId } });
    logger.info(`${tag} deleted ${deletedChunks} vector(s) from ChromaDB (documentId: ${documentId})`);
  } else {
    logger.warn(`${tag} no vectors found in ChromaDB for documentId "${documentId}"`);
  }

  // ── 3. Remove the uploaded file from disk (if it still exists) ───────────
  const uploadedPath = path.join(UPLOAD_CONFIG.uploadDir, fileName);
  safeDelete(uploadedPath, tag);

  // ── 4. Remove metadata entry (atomic write) ──────────────────────────────
  writeMetadata(records.filter((r) => r.fileName !== fileName));
  logger.info(`${tag} metadata entry removed`);

  return { deletedChunks };
}

/**
 * Returns all document metadata records.
 *
 * @returns {Array<{documentId:string, fileName:string, uploadedAt:string, chunks:number}>}
 */
function listDocuments() {
  return readMetadata();
}

/**
 * Returns the metadata record for a single document.
 *
 * @param {string} fileName
 * @returns {{ documentId:string, fileName:string, uploadedAt:string, chunks:number } | null}
 */
function getDocument(fileName) {
  return readMetadata().find((r) => r.fileName === fileName) ?? null;
}

/**
 * Returns chunk-level detail for one document (for debugging retrieval quality).
 * Reads from ChromaDB so the data reflects what is actually indexed.
 *
 * @param {string} fileName
 * @returns {Promise<{
 *   fileName:    string,
 *   totalChunks: number,
 *   chunks:      Array<{chunkIndex:number, length:number}>,
 * }>}
 */
async function getDocumentChunks(fileName) {
  const collection = await initializeCollection();
  const raw        = await collection.get({
    where:   { source: fileName },
    include: ['documents', 'metadatas'],
  });

  const chunks = raw.ids.map((id, i) => ({
    id:         id,
    chunkIndex: raw.metadatas[i]?.chunkIndex ?? -1,
    content:    raw.documents[i] ?? '',
    length:     (raw.documents[i] ?? '').length,
    metadata:   raw.metadatas[i] ?? {},
  }));

  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

  return { fileName, totalChunks: chunks.length, chunks };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Deletes a file from disk, silently ignoring ENOENT (already gone).
 *
 * @param {string} filePath
 * @param {string} tag       - Log prefix for context.
 */
function safeDelete(filePath, tag) {
  try {
    fs.unlinkSync(filePath);
    logger.info(`${tag} removed file: ${filePath}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`${tag} could not remove file "${filePath}": ${err.message}`);
    }
  }
}

module.exports = {
  ingestDocument,
  reindexDocument,
  deleteDocument,
  listDocuments,
  getDocument,
  getDocumentChunks,
};
