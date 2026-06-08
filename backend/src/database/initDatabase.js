/**
 * initDatabase.js
 *
 * Creates the sessions and messages tables if they do not already exist.
 * Called once at server startup (server.js) before the HTTP server binds
 * to its port so all tables are guaranteed to exist before the first request.
 *
 * CREATE TABLE IF NOT EXISTS is idempotent — safe to run on every startup.
 */

const { getDb } = require('./sqlite');
const logger    = require('../utils/logger');

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      title      TEXT,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         TEXT PRIMARY KEY,
      session_id TEXT    NOT NULL,
      role       TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      created_at DATETIME NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_id
      ON messages(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
      ON sessions(updated_at DESC);
  `);

  logger.info('[database] SQLite ready — tables: sessions, messages');
}

module.exports = { initDatabase };
