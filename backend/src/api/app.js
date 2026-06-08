/**
 * app.js
 *
 * Builds and exports the Express application without starting the HTTP
 * listener.  Keeping app creation separate from server.listen() means:
 *
 *  - Integration tests can import `app` and call supertest(app) without
 *    binding to a port.
 *  - server.js stays a one-liner whose only job is to call listen().
 *  - Circular-import risk between middleware and server is eliminated.
 *
 * Middleware order matters — do not reorder without reading the comments.
 */

const express        = require('express');
const cors           = require('cors');
const { randomUUID } = require('crypto');
const { API_CONFIG } = require('../config/apiConfig');
const logger         = require('../utils/logger');

const healthRoutes   = require('./routes/healthRoutes');
const chatRoutes     = require('./routes/chatRoutes');
const documentRoutes = require('./routes/documentRoutes');
const sessionRoutes  = require('./routes/sessionRoutes');

const app = express();

// ── 1. Request ID ───────────────────────────────────────────────────────────
// Runs first so every subsequent middleware and controller has access to
// req.requestId.  UUID v4 is used because it is available in Node's built-in
// `crypto` module — no extra dependency needed.

/**
 * Attaches a unique UUID v4 to every incoming request as `req.requestId`.
 * The ID is also echoed back in the X-Request-Id response header so clients
 * can correlate their own logs with server-side logs.
 *
 * @type {import('express').RequestHandler}
 */
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── 2. Request timeout ──────────────────────────────────────────────────────
// Sets a hard ceiling on how long any handler may run.  When the timeout
// fires we respond immediately and close the socket — this prevents Gemini
// or ChromaDB slow-paths from exhausting the server's file-descriptor budget.

/**
 * Aborts requests that have not resolved within their route-appropriate timeout.
 *
 * Upload and reindex routes call Gemini once per chunk with a 12-second
 * rate-limit pause between each call on the free tier, so they need a much
 * longer ceiling than ordinary API calls.  All other routes use the standard
 * 30-second timeout.
 *
 * @type {import('express').RequestHandler}
 */
app.use((req, res, next) => {
  const isIngestion =
    req.method === 'POST' &&
    (req.originalUrl === '/documents/upload' ||
     req.originalUrl.includes('/reindex'));

  const timeoutMs = isIngestion
    ? API_CONFIG.ingestionTimeout
    : API_CONFIG.requestTimeout;

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      logger.warn(`[${req.requestId}] Request timeout on ${req.method} ${req.originalUrl}`);
      res.status(503).json({
        success:   false,
        error:     'Request timed out',
        requestId: req.requestId,
      });
    }
  }, timeoutMs);

  // Clear the timer the moment the response is finished so it does not fire
  // after the connection is already closed.
  res.on('finish', () => clearTimeout(timer));
  next();
});

// ── 3. CORS + body parser ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── 4. Request logger ───────────────────────────────────────────────────────
// Runs after body parsing so Content-Length is available if needed in future.
// The `finish` event fires after the last byte is flushed, giving an accurate
// end-to-end response-time measurement.

/**
 * Logs method, path, status code, and wall-clock response time for every
 * request.  The requestId links this log line to any controller logs emitted
 * during the same request.
 *
 * Format: [<requestId>] METHOD /path → STATUS (Xms)
 *
 * @type {import('express').RequestHandler}
 */
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info(`[${req.requestId}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ── 5. Routes ───────────────────────────────────────────────────────────────
app.use('/health',    healthRoutes);
app.use('/chat',      chatRoutes);
app.use('/documents', documentRoutes);
app.use('/sessions',  sessionRoutes);

// ── 6. 404 handler ──────────────────────────────────────────────────────────
/**
 * Catches any request that did not match a registered route.
 *
 * @type {import('express').RequestHandler}
 */
app.use((req, res) => {
  res.status(404).json({
    error:     `Cannot ${req.method} ${req.originalUrl}`,
    requestId: req.requestId,
  });
});

// ── 7. Centralized error handler ────────────────────────────────────────────
// Express identifies error-handling middleware by its 4-parameter signature.
// All controllers call next(err) to reach this handler, which guarantees a
// consistent error envelope regardless of which route threw.

/**
 * Handles any error passed via next(err) from a controller or middleware.
 * Logs the full error with requestId, then returns a sanitized 500 response
 * that includes the requestId so the client can report it for debugging.
 *
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(`[${req.requestId}] ${req.method} ${req.originalUrl} — ${err.message}`);
  if (!res.headersSent) {
    res.status(500).json({
      success:   false,
      error:     'Internal server error',
      requestId: req.requestId,
    });
  }
});

module.exports = app;
