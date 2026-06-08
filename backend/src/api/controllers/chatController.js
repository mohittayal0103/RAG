/**
 * chatController.js
 *
 * Handles POST /chat.
 *
 * Request body: { sessionId: string, question: string }
 *
 * Pipeline:
 *  1. Validate sessionId + question
 *  2. Verify session exists in SQLite
 *  3. Load last 20 messages as conversation history
 *  4. Call answerQuestion({ question, history })
 *  5. Persist user question + assistant answer to messages table
 *  6. Set session title to first question (truncated to 100 chars) if unset
 */

const { answerQuestion }   = require('../../rag/answerGenerator');
const {
  getSession,
  getSessionMessages,
  saveExchange,
  MAX_SESSION_ID_LENGTH,
  MAX_QUESTION_LENGTH,
}                          = require('../../services/sessionService');
const logger               = require('../../utils/logger');

/**
 * POST /chat
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
async function chat(req, res, next) {
  const id               = req.requestId;
  const { sessionId, question } = req.body;

  // ── Input validation ────────────────────────────────────────────────────
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId is required', requestId: id });
  }
  if (typeof sessionId !== 'string') {
    return res.status(400).json({ success: false, error: 'sessionId must be a string', requestId: id });
  }
  if (sessionId.length > MAX_SESSION_ID_LENGTH) {
    return res.status(400).json({ success: false, error: `sessionId must not exceed ${MAX_SESSION_ID_LENGTH} characters`, requestId: id });
  }

  if (question === undefined || question === null) {
    return res.status(400).json({ success: false, error: 'question is required', requestId: id });
  }
  if (typeof question !== 'string') {
    return res.status(400).json({ success: false, error: 'question must be a string', requestId: id });
  }
  if (question.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'question must not be empty', requestId: id });
  }
  if (question.trim().length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ success: false, error: `question must not exceed ${MAX_QUESTION_LENGTH} characters`, requestId: id });
  }

  // ── Session lookup ───────────────────────────────────────────────────────
  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: `Session not found: "${sessionId}"`, requestId: id });
  }

  // ── Load conversation history ────────────────────────────────────────────
  const history = getSessionMessages(sessionId, 20).map((m) => ({
    role:    m.role,
    content: m.content,
  }));

  // ── RAG pipeline ─────────────────────────────────────────────────────────
  try {
    const trimmedQuestion = question.trim();
    logger.info(`[${id}] POST /chat — session: ${sessionId}, question: "${trimmedQuestion}"`);

    const { answer, sources, chunksUsed } = await answerQuestion({
      question: trimmedQuestion,
      history,
    });

    logger.info(`[${id}] POST /chat — answer generated, chunksUsed: ${chunksUsed}`);

    // ── Persist exchange atomically ────────────────────────────────────────
    saveExchange({
      sessionId,
      question: trimmedQuestion,
      answer,
      title: session.title ? null : trimmedQuestion.slice(0, 100),
    });

    return res.json({ success: true, answer, sources, chunksUsed });
  } catch (err) {
    next(err);
  }
}

module.exports = { chat };
