/**
 * documentController.js
 *
 * HTTP layer for all document-management endpoints.
 * All business logic lives in documentIngestionService — this file is
 * purely responsible for parsing HTTP input, calling the service, and
 * shaping HTTP responses.
 *
 * Endpoints handled:
 *   GET    /documents                    → list all indexed documents
 *   POST   /documents/upload             → upload + ingest a file
 *   GET    /documents/stats              → collection record count (Chroma)
 *   GET    /documents/:fileName          → single document details
 *   GET    /documents/:fileName/chunks   → chunk-level debug view
 *   POST   /documents/:fileName/reindex  → re-embed an existing document
 *   DELETE /documents/:fileName          → remove document and its vectors
 */

const {
  ingestDocument,
  reindexDocument,
  deleteDocument,
  listDocuments,
  getDocument,
  getDocumentChunks,
}                            = require('../../services/documentIngestionService');
const { getCollectionStats } = require('../../vectorstore/chromaService');
const logger                 = require('../../utils/logger');

// ── H-02: fileName sanitizer ──────────────────────────────────────────────────

/**
 * Validates a fileName coming from req.params.fileName.
 * Returns the fileName unchanged when safe.
 * Sends a 400 response and returns null when the name contains path-traversal
 * sequences, directory separators, null bytes, or characters outside the
 * allowed set [a-zA-Z0-9._-].
 *
 * @param {string} fileName
 * @param {import('express').Response} res
 * @param {string} requestId
 * @returns {string|null}
 */
function sanitizeFileName(fileName, res, requestId) {
  if (
    !fileName ||
    fileName.includes('..') ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('\0') ||
    /[^a-zA-Z0-9._\-]/.test(fileName)
  ) {
    res.status(400).json({ success: false, error: 'Invalid file name.', requestId });
    return null;
  }
  return fileName;
}

// ── GET /documents ────────────────────────────────────────────────────────────

/**
 * Returns the list of all documents that have been successfully ingested.
 * Data comes from documents.json, not ChromaDB, so the response is always fast.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function list(req, res) {
  const id = req.requestId;
  logger.info(`[${id}] GET /documents — listing documents`);

  const records = listDocuments();

  logger.info(`[${id}] GET /documents — ${records.length} document(s) found`);
  return res.json(records);
}

// ── POST /documents/upload ────────────────────────────────────────────────────

/**
 * Accepts a multipart file upload (field name: "file"), runs the full
 * ingest pipeline, and returns a result summary.
 *
 * Multer attaches the file to req.file before this handler runs.
 * If multer rejected the file (bad extension / oversized) it calls next(err),
 * which is caught by the multer-error middleware mounted in documentRoutes.js.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
async function upload(req, res, next) {
  const id = req.requestId;

  if (!req.file) {
    return res.status(400).json({
      success:   false,
      error:     'No file received. Send a multipart/form-data request with field name "file".',
      requestId: id,
    });
  }

  const { path: filePath, originalname: fileName } = req.file;
  logger.info(`[${id}] POST /documents/upload — received "${fileName}" (${req.file.size} bytes)`);

  const ac = new AbortController();
  req.on('close', () => {
    if (!res.headersSent) {
      logger.info(`[${id}] Client disconnected — aborting ingest for "${fileName}"`);
      ac.abort();
    }
  });

  try {
    const result = await ingestDocument({ filePath, fileName, requestId: id, signal: ac.signal });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    if (err.code === 'ABORTED') return; // client already gone, nothing to send
    if (err.code === 'DUPLICATE') {
      return res.status(409).json({ success: false, error: 'Document already exists', requestId: id });
    }
    if (err.code === 'UPLOAD_IN_PROGRESS') {
      return res.status(409).json({ success: false, error: err.message, requestId: id });
    }
    next(err);
  }
}

// ── GET /documents/stats ──────────────────────────────────────────────────────

/**
 * Returns the total number of vectors currently stored in the ChromaDB
 * collection.  Useful for a quick capacity / ingest-progress check.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
async function getStats(req, res, next) {
  const id = req.requestId;
  try {
    logger.info(`[${id}] GET /documents/stats — fetching collection stats`);
    const { collectionName, totalRecords } = await getCollectionStats();
    logger.info(`[${id}] GET /documents/stats — totalRecords: ${totalRecords}`);
    return res.json({ collectionName, totalRecords });
  } catch (err) {
    next(err);
  }
}

// ── GET /documents/:fileName ──────────────────────────────────────────────────

/**
 * Returns the full metadata record for a single document.
 * Reads from documents.json — fast and does not touch ChromaDB.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
function getDetails(req, res, next) {
  const id       = req.requestId;
  const fileName = sanitizeFileName(req.params.fileName, res, id);
  if (!fileName) return;

  logger.info(`[${id}] GET /documents/${fileName}`);

  try {
    const record = getDocument(fileName);

    if (!record) {
      return res.status(404).json({
        success:   false,
        error:     `Document not found: "${fileName}"`,
        requestId: id,
      });
    }

    return res.json(record);
  } catch (err) {
    next(err);
  }
}

// ── GET /documents/:fileName/chunks ──────────────────────────────────────────

/**
 * Returns per-chunk metadata for a single document.
 * Intended for debugging retrieval quality — shows how a file was split
 * and how long each chunk is.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
async function getChunks(req, res, next) {
  const id       = req.requestId;
  const fileName = sanitizeFileName(req.params.fileName, res, id);
  if (!fileName) return;

  logger.info(`[${id}] GET /documents/${fileName}/chunks`);

  try {
    const result = await getDocumentChunks(fileName);

    if (result.totalChunks === 0) {
      return res.status(404).json({
        success:   false,
        error:     `No chunks found for "${fileName}". It may not have been ingested.`,
        requestId: id,
      });
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

// ── POST /documents/:fileName/reindex ────────────────────────────────────────

/**
 * Re-indexes an existing document: deletes old vectors, re-extracts text,
 * re-chunks, re-embeds, and stores fresh vectors in ChromaDB.
 *
 * The document's permanent documentId is preserved so downstream references
 * stay valid across re-indexing runs.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
async function reindex(req, res, next) {
  const id       = req.requestId;
  const fileName = sanitizeFileName(req.params.fileName, res, id);
  if (!fileName) return;

  logger.info(`[${id}] POST /documents/${fileName}/reindex`);

  try {
    const result = await reindexDocument({ fileName, requestId: id });
    return res.json(result);
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'FILE_NOT_FOUND') {
      return res.status(404).json({ success: false, error: err.message, requestId: id });
    }
    if (err.code === 'MISSING_DOCUMENT_ID') {
      return res.status(409).json({ success: false, error: err.message, requestId: id });
    }
    next(err);
  }
}

// ── DELETE /documents/:fileName ───────────────────────────────────────────────

/**
 * Removes all vectors for a document from ChromaDB, its metadata entry,
 * and the uploaded file from disk.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
async function remove(req, res, next) {
  const id       = req.requestId;
  const fileName = sanitizeFileName(req.params.fileName, res, id);
  if (!fileName) return;

  logger.info(`[${id}] DELETE /documents/${fileName}`);

  try {
    const { deletedChunks } = await deleteDocument({ fileName, requestId: id });
    return res.json({ success: true, deletedChunks });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: `Document not found: "${fileName}"`, requestId: id });
    }
    if (err.code === 'MISSING_DOCUMENT_ID') {
      return res.status(409).json({ success: false, error: err.message, requestId: id });
    }
    next(err);
  }
}

module.exports = { list, upload, getStats, getDetails, getChunks, reindex, remove };
