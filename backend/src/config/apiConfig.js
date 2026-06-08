/**
 * apiConfig.js
 *
 * Single source of truth for all HTTP-server configuration values.
 * Values are read from environment variables with safe defaults so the
 * app starts in development without a fully populated .env file.
 *
 * Import this object anywhere in the API layer — never read process.env
 * directly in controllers or middleware.
 */

require('dotenv').config();

const API_CONFIG = {
  /** TCP port the HTTP server binds to. */
  port: parseInt(process.env.PORT, 10) || 5000,

  /**
   * Hard timeout (ms) applied to most requests.
   * If a handler has not finished within this window the server responds
   * with 503 and closes the connection, preventing indefinite hangs on
   * slow Gemini / ChromaDB calls.
   */
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30_000,

  /**
   * Extended timeout (ms) for ingestion routes (upload, reindex).
   * These call Gemini once per chunk with a 12-second rate-limit pause
   * between calls on the free tier.  A 10-minute ceiling covers documents
   * up to ~46 chunks (46 × 13s ≈ 598s) before force-killing the request.
   */
  ingestionTimeout: parseInt(process.env.INGESTION_TIMEOUT, 10) || 10 * 60 * 1000,

  /**
   * Minimum severity level emitted by the logger.
   * Accepted values: "info" | "warn" | "error"
   * (The logger implementation currently always emits all levels; this
   * field is here so a future structured logger can respect it.)
   */
  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = { API_CONFIG };
