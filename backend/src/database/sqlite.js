/**
 * sqlite.js
 *
 * Opens (or creates) the SQLite database file and exports a singleton getter.
 *
 * WAL mode is enabled so reads do not block writes and vice-versa — important
 * because Express handles concurrent requests and SQLite's default journal
 * mode serialises all access.
 *
 * Foreign-key enforcement is off by default in SQLite; the pragma turns it on
 * so the messages.session_id constraint is actually checked.
 */

const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = path.resolve(__dirname, 'rag.db');

let db = null;

/**
 * Returns the open database connection, creating it on first call.
 * @returns {import('better-sqlite3').Database}
 */
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

module.exports = { getDb, DB_PATH };
