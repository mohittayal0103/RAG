/**
 * server.js
 *
 * Process entry point.  Its only responsibility is to run startup validation,
 * then import the Express application from app.js and bind it to a TCP port.
 *
 * Keeping this separate from app.js means integration tests can import
 * `app` directly (via supertest) without ever calling listen() or occupying
 * a port.
 *
 * Changes in this revision:
 *  - Fix 3: ensureDirectoriesExist() is called before app.listen() so that
 *    uploads/ and src/data/ are guaranteed to exist and documents.json is
 *    seeded before the first request arrives.  A missing directory would
 *    cause multer to throw on the first upload and writeMetadata() to fail
 *    silently — surfacing it here as a startup log is far easier to diagnose.
 */

require('dotenv').config();
const { API_CONFIG }            = require('../config/apiConfig');
const logger                    = require('../utils/logger');
const { ensureDirectoriesExist } = require('../utils/bootstrap');
const { initDatabase }           = require('../database/initDatabase');
const app                        = require('./app');

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Both calls are synchronous and must complete before listen() so the server
// never binds to a port while required files or tables are absent.
ensureDirectoriesExist();
initDatabase();

// ── Start HTTP server ─────────────────────────────────────────────────────────
const server = app.listen(API_CONFIG.port, () => {
  logger.info(`RAG API listening on http://localhost:${API_CONFIG.port}`);
  logger.info('  GET    /health');
  logger.info('  GET    /health/ready');
  logger.info('  POST   /chat');
  logger.info('  GET    /documents');
  logger.info('  GET    /documents/stats');
  logger.info('  POST   /documents/upload');
  logger.info('  GET    /documents/:fileName');
  logger.info('  GET    /documents/:fileName/chunks');
  logger.info('  POST   /documents/:fileName/reindex');
  logger.info('  DELETE /documents/:fileName');
  logger.info('  POST   /sessions');
  logger.info('  GET    /sessions');
  logger.info('  GET    /sessions/:sessionId/messages');
});

// ── H-05: Graceful shutdown ───────────────────────────────────────────────────
// Stops accepting new connections, waits for in-flight requests to drain,
// then exits cleanly.  A 10-second hard timeout prevents the process from
// hanging if a long-running Gemini call never returns.

function gracefulShutdown(signal) {
  logger.info(`Received ${signal} — closing HTTP server`);
  server.close(() => {
    logger.info('All connections closed — exiting');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10s — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
