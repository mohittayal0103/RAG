/**
 * uploadConfig.js
 *
 * All tunable knobs for the upload pipeline in one place.
 * Controllers and services import this object — nothing reads
 * process.env or hardcodes limits directly.
 */

const path = require('path');

const UPLOAD_CONFIG = {
  /** Absolute path where multer writes temporary files before ingestion. */
  uploadDir: path.resolve(__dirname, '../../src/uploads'),

  /** Absolute path to the JSON file that persists document metadata. */
  metadataFile: path.resolve(__dirname, '../../src/data/documents.json'),

  /** Maximum accepted file size in bytes (10 MB). */
  maxFileSizeBytes: 10 * 1024 * 1024,

  /**
   * Permitted file extensions (lower-case, with leading dot).
   * Multer's fileFilter uses this list — any other extension is rejected
   * with a structured 400 before the file reaches disk.
   */
  allowedExtensions: ['.pdf', '.txt'],
};

module.exports = { UPLOAD_CONFIG };
