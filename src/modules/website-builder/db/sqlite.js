/**
 * SQLite connection for Website Builder data only.
 * Users/licenses remain in JSON — this file must never store GS accounts.
 *
 * Prefer better-sqlite3 when the native binary is present.
 * On Windows without Visual Studio C++ tools, fall back to Node.js node:sqlite.
 */

const fs = require('fs');
const path = require('path');

let singleton = null;
let engine = null;

function resolveSqlitePath() {
  const override = (process.env.WEBSITE_BUILDER_SQLITE_PATH || '').trim();
  if (override) return override;
  return path.join(__dirname, '..', '..', '..', '..', 'data', 'website-builder.sqlite');
}

function wrapNodeSqlite(raw) {
  return {
    prepare(sql) {
      const stmt = raw.prepare(sql);
      return {
        run: (...args) => stmt.run(...args),
        get: (...args) => stmt.get(...args),
        all: (...args) => stmt.all(...args)
      };
    },
    exec(sql) {
      return raw.exec(sql);
    },
    pragma(pragma) {
      raw.exec(`PRAGMA ${pragma}`);
    },
    transaction(fn) {
      return (...args) => {
        raw.exec('BEGIN');
        try {
          const result = fn(...args);
          raw.exec('COMMIT');
          return result;
        } catch (err) {
          try {
            raw.exec('ROLLBACK');
          } catch (_) {
            /* ignore */
          }
          throw err;
        }
      };
    },
    close() {
      raw.close();
    }
  };
}

function openWithBetterSqlite3(filePath) {
  const Database = require('better-sqlite3');
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  engine = 'better-sqlite3';
  return db;
}

function openWithNodeSqlite(filePath) {
  const { DatabaseSync } = require('node:sqlite');
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const raw = new DatabaseSync(filePath);
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec('PRAGMA foreign_keys = ON');
  engine = 'node:sqlite';
  return wrapNodeSqlite(raw);
}

function openDatabase(filePath) {
  try {
    return openWithBetterSqlite3(filePath);
  } catch (err) {
    const msg = String((err && err.message) || err);
    const missingNative =
      err.code === 'MODULE_NOT_FOUND' ||
      /better-sqlite3|Could not locate the bindings|node-gyp|was compiled against/i.test(msg);
    if (!missingNative) throw err;
    return openWithNodeSqlite(filePath);
  }
}

function getDb() {
  if (singleton) return singleton;
  singleton = openDatabase(resolveSqlitePath());
  return singleton;
}

function closeDb() {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
}

function getEngine() {
  return engine;
}

module.exports = {
  getDb,
  openDatabase,
  resolveSqlitePath,
  closeDb,
  getEngine
};
