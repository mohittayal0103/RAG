/**
 * bootstrap.js
 *
 * Ensures all runtime directories and seed files exist before the server
 * begins accepting traffic.  Called once at process startup (server.js).
 *
 * Why this exists:
 *   - A fresh clone of the repo has no src/uploads/ or src/data/ directories,
 *     and no documents.json.  Without them multer throws on the first upload
 *     and readMetadata() silently returns [] but writeMetadata() fails.
 *   - Doing this at startup rather than inside each handler means the error
 *     surfaces immediately with a clear message, not buried in a 500 response.
 *   - fs.mkdirSync({ recursive: true }) is idempotent — safe to call every time.
 */

const fs   = require('fs');
const path = require('path');

const { UPLOAD_CONFIG } = require('../config/uploadConfig');
const logger            = require('./logger');

/**
 * Creates any missing runtime directories and seed files the application
 * needs before it can serve requests.
 *
 * Directories created if absent:
 *   - UPLOAD_CONFIG.uploadDir          (multer destination)
 *   - dirname(UPLOAD_CONFIG.metadataFile)  (parent folder of documents.json)
 *
 * Files seeded if absent:
 *   - UPLOAD_CONFIG.metadataFile       (written as "[]" so JSON.parse never fails)
 *
 * This function is synchronous because it must complete before the HTTP
 * server binds to its port — async startup would require awaiting the call
 * chain all the way through server.js, adding complexity for no real benefit
 * at startup time.
 */
function ensureDirectoriesExist() {
  const uploadsDir  = UPLOAD_CONFIG.uploadDir;
  const dataDir     = path.dirname(UPLOAD_CONFIG.metadataFile);
  const metaFile    = UPLOAD_CONFIG.metadataFile;

  // Create uploads/ if it does not exist.
  // { recursive: true } means no error is thrown if the directory is already there.
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.info(`[bootstrap] Created uploads directory: ${uploadsDir}`);
  } else {
    logger.info(`[bootstrap] uploads directory OK: ${uploadsDir}`);
  }

  // Create src/data/ (or wherever documents.json lives) if absent.
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info(`[bootstrap] Created data directory: ${dataDir}`);
  } else {
    logger.info(`[bootstrap] data directory OK: ${dataDir}`);
  }

  // Seed documents.json with an empty array so every subsequent read finds
  // valid JSON rather than hitting the catch-block in readMetadata().
  if (!fs.existsSync(metaFile)) {
    fs.writeFileSync(metaFile, '[]\n', 'utf-8');
    logger.info(`[bootstrap] Created metadata file: ${metaFile}`);
  } else {
    logger.info(`[bootstrap] metadata file OK: ${metaFile}`);
  }
}

module.exports = { ensureDirectoriesExist };
