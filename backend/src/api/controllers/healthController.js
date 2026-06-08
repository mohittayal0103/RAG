/**
 * healthController.js
 *
 * Two endpoints:
 *
 *  GET /health       — liveness check (no external calls, always fast)
 *  GET /health/ready — readiness check (probes all hard dependencies)
 *
 * The split follows the Kubernetes liveness/readiness convention:
 *  - Liveness answers "is the process alive?" — never hits dependencies.
 *  - Readiness answers "can the process serve traffic?" — fails if a
 *    required dependency is unreachable, so load balancers can temporarily
 *    pull the instance from rotation.
 *
 * Changes in this revision:
 *  - Fix 6: getReadiness() now also verifies that the uploads directory and
 *    the metadata file exist on disk.  If either is missing the server can
 *    accept requests but will fail on the first upload or list call — better
 *    to surface that at startup via the readiness probe than as a mid-flight
 *    500 error.  In normal operation bootstrap.js creates both at startup, so
 *    these checks serve as a safety net for misconfigured deployments.
 */

const fs             = require('fs');
const { ChromaClient }   = require('chromadb');
const { CHROMA_CONFIG }  = require('../../config/chromaConfig');
const { UPLOAD_CONFIG }  = require('../../config/uploadConfig');
const logger             = require('../../utils/logger');

// ── Liveness ─────────────────────────────────────────────────────────────────

/**
 * GET /health
 *
 * Returns 200 immediately.  No external I/O — this handler must never block.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function getHealth(req, res) {
  logger.info(`[${req.requestId}] health check OK`);
  res.json({
    status:  'ok',
    service: 'rag-document-assistant',
  });
}

// ── Readiness ─────────────────────────────────────────────────────────────────

/**
 * GET /health/ready
 *
 * Probes every hard dependency the API needs before it can serve requests:
 *
 *  1. GEMINI_API_KEY is present in the environment.
 *  2. ChromaDB server is reachable (heartbeat ping).
 *  3. The target collection exists and is accessible (count() call).
 *  4. The uploads directory exists on disk.
 *  5. The metadata file (documents.json) exists on disk.
 *
 * Returns 200 { status: "ready" } when all checks pass.
 * Returns 503 { status: "not_ready", reason } on the first failure so the
 * caller knows exactly what is wrong without reading server logs.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function getReadiness(req, res) {
  const id = req.requestId;
  logger.info(`[${id}] readiness check started`);

  // ── 1. Gemini API key ──────────────────────────────────────────────────
  if (!process.env.GEMINI_API_KEY) {
    logger.warn(`[${id}] readiness FAIL — GEMINI_API_KEY not set`);
    return res.status(503).json({ status: 'not_ready', reason: 'GEMINI_API_KEY is not set' });
  }

  // ── 2. ChromaDB heartbeat ──────────────────────────────────────────────
  // Create a short-lived client just for the probe — we must not mutate the
  // module-level cached client in chromaService from here.
  const client = new ChromaClient({
    ssl:  CHROMA_CONFIG.ssl,
    host: CHROMA_CONFIG.host,
    port: CHROMA_CONFIG.port,
  });

  try {
    await client.heartbeat();
  } catch {
    logger.warn(`[${id}] readiness FAIL — ChromaDB unreachable`);
    return res.status(503).json({ status: 'not_ready', reason: 'ChromaDB is unreachable' });
  }

  // ── 3. Collection accessible ───────────────────────────────────────────
  try {
    const col = await client.getOrCreateCollection({
      name:              CHROMA_CONFIG.collectionName,
      embeddingFunction: null,
    });
    await col.count();
  } catch {
    logger.warn(`[${id}] readiness FAIL — collection inaccessible`);
    return res.status(503).json({ status: 'not_ready', reason: 'ChromaDB collection is inaccessible' });
  }

  // ── 4. Uploads directory exists ────────────────────────────────────────
  // bootstrap.js creates this at startup; its absence means bootstrap did
  // not run or the directory was deleted after startup.
  if (!fs.existsSync(UPLOAD_CONFIG.uploadDir)) {
    logger.warn(`[${id}] readiness FAIL — uploads directory missing: ${UPLOAD_CONFIG.uploadDir}`);
    return res.status(503).json({
      status: 'not_ready',
      reason: `Uploads directory does not exist: ${UPLOAD_CONFIG.uploadDir}`,
    });
  }

  // ── 5. Metadata file exists ────────────────────────────────────────────
  // Without documents.json every list/delete/reindex call will silently
  // operate on an empty dataset or fail on write.
  if (!fs.existsSync(UPLOAD_CONFIG.metadataFile)) {
    logger.warn(`[${id}] readiness FAIL — metadata file missing: ${UPLOAD_CONFIG.metadataFile}`);
    return res.status(503).json({
      status: 'not_ready',
      reason: `Metadata file does not exist: ${UPLOAD_CONFIG.metadataFile}`,
    });
  }

  logger.info(`[${id}] readiness check PASS`);
  return res.json({ status: 'ready' });
}

module.exports = { getHealth, getReadiness };
