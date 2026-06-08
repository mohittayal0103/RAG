/**
 * sessionService.js
 *
 * All database operations for sessions and messages.
 * Uses better-sqlite3 synchronous API — no async/await needed.
 * Queries are prepared once and reused across calls.
 */

const { randomUUID } = require('crypto');
const { getDb }      = require('../database/sqlite');

const MAX_SESSION_ID_LENGTH = 128;
const MAX_QUESTION_LENGTH   = 2000;
const MAX_ANSWER_LENGTH     = 4000;

// ── Sessions ──────────────────────────────────────────────────────────────────

/**
 * Creates a new session with no title and returns its record.
 *
 * @returns {{ id: string, title: null, createdAt: string, updatedAt: string }}
 */
function createSession() {
  const db  = getDb();
  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(id, null, now, now);

  return { id, title: null, createdAt: now, updatedAt: now };
}

/**
 * Returns a single session record, or null if not found.
 *
 * @param {string} sessionId
 * @returns {{ id, title, createdAt, updatedAt } | null}
 */
function getSession(sessionId) {
  const row = getDb()
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(sessionId);

  if (!row) return null;
  return { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
}

/**
 * Returns all sessions ordered by most-recently-updated first.
 *
 * @returns {Array<{ id, title, createdAt, updatedAt }>}
 */
function listSessions() {
  return getDb()
    .prepare('SELECT * FROM sessions ORDER BY updated_at DESC')
    .all()
    .map((row) => ({
      id:        row.id,
      title:     row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
}

/**
 * Sets the title of a session (used to name it after the first question).
 *
 * @param {string} sessionId
 * @param {string} title
 */
function updateSessionTitle(sessionId, title) {
  const now = new Date().toISOString();
  getDb()
    .prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
    .run(title, now, sessionId);
}

// ── Messages ──────────────────────────────────────────────────────────────────

/**
 * Returns the most-recent `limit` messages for a session, ordered
 * oldest-to-newest so they read naturally as conversation history.
 *
 * The inner query sorts DESC + LIMIT to select the latest window; the outer
 * query re-orders ASC so the array the caller receives is chronological.
 *
 * @param {string} sessionId
 * @param {number} [limit=20]
 * @returns {Array<{ id, sessionId, role, content, createdAt }>}
 */
function getSessionMessages(sessionId, limit = 20) {
  const rows = getDb().prepare(`
    SELECT * FROM (
      SELECT * FROM messages
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    )
    ORDER BY created_at ASC
  `).all(sessionId, limit);

  return rows.map((row) => ({
    id:        row.id,
    sessionId: row.session_id,
    role:      row.role,
    content:   row.content,
    createdAt: row.created_at,
  }));
}

/**
 * Persists one message and bumps the session's updated_at timestamp.
 *
 * @param {{ sessionId: string, role: string, content: string }} opts
 * @returns {{ id, sessionId, role, content, createdAt }}
 */
function saveMessage({ sessionId, role, content }) {
  const db  = getDb();
  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, sessionId, role, content, now);

  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

  return { id, sessionId, role, content, createdAt: now };
}

/**
 * Persists a full question–answer exchange in a single SQLite transaction.
 *
 * Inserts the user message and the assistant message, then either sets the
 * session title (if `title` is provided and the session has no title yet) or
 * just bumps `updated_at`.  All four operations commit together or not at all,
 * preventing orphaned messages on crash or storage error.
 *
 * Content is truncated to the module-level length constants before storage so
 * the persistence layer remains safe even if a future caller skips validation.
 *
 * @param {{
 *   sessionId: string,
 *   question:  string,
 *   answer:    string,
 *   title:     string | null
 * }} opts
 */
function saveExchange({ sessionId, question, answer, title }) {
  const db        = getDb();
  const userNow   = new Date().toISOString();
  const asstNow   = new Date(Date.now() + 1).toISOString();
  const userMsgId = randomUUID();
  const asstMsgId = randomUUID();
  const safeQ     = question.slice(0, MAX_QUESTION_LENGTH);
  const safeA     = answer.slice(0, MAX_ANSWER_LENGTH);

  db.transaction(() => {
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userMsgId, sessionId, 'user', safeQ, userNow);

    db.prepare(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(asstMsgId, sessionId, 'assistant', safeA, asstNow);

    if (title) {
      // Only sets the title if the session currently has none — atomic check+set.
      db.prepare(
        'UPDATE sessions SET title = ?, updated_at = ? WHERE id = ? AND title IS NULL'
      ).run(title, asstNow, sessionId);
    } else {
      db.prepare(
        'UPDATE sessions SET updated_at = ? WHERE id = ?'
      ).run(asstNow, sessionId);
    }
  })();
}

/**
 * Deletes a session and all its messages in a single transaction.
 *
 * @param {string} sessionId
 * @returns {boolean} true if a session was deleted, false if it didn't exist
 */
function deleteSession(sessionId) {
  const db = getDb();
  let deleted = false;

  db.transaction(() => {
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    deleted = result.changes > 0;
  })();

  return deleted;
}

module.exports = {
  createSession,
  getSession,
  listSessions,
  updateSessionTitle,
  getSessionMessages,
  saveMessage,
  saveExchange,
  deleteSession,
  MAX_SESSION_ID_LENGTH,
  MAX_QUESTION_LENGTH,
  MAX_ANSWER_LENGTH,
};
