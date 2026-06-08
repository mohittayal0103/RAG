/**
 * documentRoutes.js
 *
 * Registers all document-management endpoints under the /documents prefix.
 * This file owns the multer configuration — keeping upload mechanics here
 * means neither the controller nor the service needs to know about multer.
 *
 * Route table:
 *   GET    /documents                    → list all ingested documents
 *   GET    /documents/stats              → ChromaDB collection stats
 *   POST   /documents/upload             → upload + ingest a file
 *   GET    /documents/:fileName          → single document details
 *   GET    /documents/:fileName/chunks   → per-chunk debug view
 *   POST   /documents/:fileName/reindex  → re-embed an existing document
 *   DELETE /documents/:fileName          → remove document + vectors
 *
 * IMPORTANT — route ordering:
 *   Express matches routes top-to-bottom.  The static segments /stats and
 *   /upload must be registered BEFORE /:fileName so they are never mistaken
 *   for a fileName parameter.
 */

const path      = require('path');
const multer    = require('multer');
const rateLimit = require('express-rate-limit');
const { Router } = require('express');

const { UPLOAD_CONFIG } = require('../../config/uploadConfig');
const { list, upload, getStats, getDetails, getChunks, reindex, remove } = require('../controllers/documentController');

// ── Multer configuration ──────────────────────────────────────────────────────

/**
 * diskStorage writes the file to UPLOAD_CONFIG.uploadDir using the original
 * client filename.  We preserve the original name so ingestDocument() can
 * derive the correct extension and use the same name as the Chroma `source`
 * metadata value.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_CONFIG.uploadDir),
  filename: (_req, file, cb) => {
    // H-03: strip path components and replace characters outside [a-zA-Z0-9._-]
    // with underscores so the saved filename cannot contain traversal sequences.
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._\-]/g, '_');
    cb(null, safe);
  },
});

/**
 * fileFilter runs before the file is written to disk.
 * Rejecting here means an invalid file never touches the filesystem.
 *
 * @param {import('express').Request} _req
 * @param {Express.Multer.File} file
 * @param {multer.FileFilterCallback} cb
 */
function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (UPLOAD_CONFIG.allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    const err  = new Error(
      `Unsupported file type "${ext}". Allowed: ${UPLOAD_CONFIG.allowedExtensions.join(', ')}`
    );
    err.code   = 'INVALID_EXTENSION';
    cb(err, false);
  }
}

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: UPLOAD_CONFIG.maxFileSizeBytes },
}).single('file');

/**
 * Wraps the multer single-file middleware so multer errors (wrong extension,
 * file too large) are converted into structured JSON responses instead of
 * falling through to the generic 500 error handler.
 *
 * Multer signals a size limit breach with err.code === 'LIMIT_FILE_SIZE'.
 * Our custom filter uses err.code === 'INVALID_EXTENSION'.
 *
 * @type {import('express').RequestHandler}
 */
function handleUpload(req, res, next) {
  uploadMiddleware(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success:   false,
        error:     `File exceeds the ${UPLOAD_CONFIG.maxFileSizeBytes / (1024 * 1024)} MB limit`,
        requestId: req.requestId,
      });
    }

    if (err.code === 'INVALID_EXTENSION') {
      return res.status(400).json({
        success:   false,
        error:     err.message,
        requestId: req.requestId,
      });
    }

    // Unknown multer error — pass to centralized error handler
    next(err);
  });
}

// ── H-04: Rate limiters ───────────────────────────────────────────────────────

const uploadLimiter = rateLimit({
  windowMs:       60 * 1000,
  max:            5,
  standardHeaders: true,
  legacyHeaders:  false,
  handler: (req, res) => res.status(429).json({
    success:   false,
    error:     'Too many upload requests — try again later.',
    requestId: req.requestId,
  }),
});

const reindexLimiter = rateLimit({
  windowMs:       60 * 1000,
  max:            5,
  standardHeaders: true,
  legacyHeaders:  false,
  handler: (req, res) => res.status(429).json({
    success:   false,
    error:     'Too many reindex requests — try again later.',
    requestId: req.requestId,
  }),
});

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();

/** @type {import('express').RequestHandler} */
router.get('/',                        list);

/** @type {import('express').RequestHandler} */
router.get('/stats',                   getStats);

/** @type {import('express').RequestHandler} */
router.post('/upload', uploadLimiter, handleUpload, upload);

/** @type {import('express').RequestHandler} */
router.get('/:fileName/chunks',        getChunks);

/** @type {import('express').RequestHandler} */
router.post('/:fileName/reindex', reindexLimiter, reindex);

// /:fileName must come AFTER the two sub-path routes above so Express does
// not greedily consume "chunks" or "reindex" as the fileName parameter.
/** @type {import('express').RequestHandler} */
router.get('/:fileName',               getDetails);

/** @type {import('express').RequestHandler} */
router.delete('/:fileName',            remove);

module.exports = router;
