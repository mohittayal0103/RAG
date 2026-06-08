/**
 * sessionController.js
 *
 * HTTP handlers for session management endpoints:
 *
 *   POST /sessions                      → create session
 *   GET  /sessions                      → list all sessions
 *   GET  /sessions/:sessionId/messages  → message history for one session
 */

const {
  createSession,
  getSession,
  listSessions,
  getSessionMessages,
  deleteSession,
} = require('../../services/sessionService');
const logger = require('../../utils/logger');

// ── POST /sessions ────────────────────────────────────────────────────────────

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function create(req, res) {
  const id      = req.requestId;
  logger.info(`[${id}] POST /sessions`);
  const session = createSession();
  return res.status(201).json({ sessionId: session.id });
}

// ── GET /sessions ─────────────────────────────────────────────────────────────

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function list(req, res) {
  const id = req.requestId;
  logger.info(`[${id}] GET /sessions`);
  return res.json(listSessions());
}

// ── GET /sessions/:sessionId/messages ─────────────────────────────────────────

/**
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
function getMessages(req, res, next) {
  const id        = req.requestId;
  const { sessionId } = req.params;

  logger.info(`[${id}] GET /sessions/${sessionId}/messages`);

  try {
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success:   false,
        error:     `Session not found: "${sessionId}"`,
        requestId: id,
      });
    }

    const messages = getSessionMessages(sessionId);
    return res.json(messages.map((m) => ({ role: m.role, content: m.content })));
  } catch (err) {
    next(err);
  }
}

// ── DELETE /sessions/:sessionId ───────────────────────────────────────────────

/**
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
function remove(req, res, next) {
  const id = req.requestId;
  const { sessionId } = req.params;

  logger.info(`[${id}] DELETE /sessions/${sessionId}`);

  try {
    const deleted = deleteSession(sessionId);
    if (!deleted) {
      return res.status(404).json({
        success:   false,
        error:     `Session not found: "${sessionId}"`,
        requestId: id,
      });
    }
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getMessages, remove };
