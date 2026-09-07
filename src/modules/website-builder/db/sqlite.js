/**
 * SQLite connection for Website Builder data only.
 * Users/licenses remain in JSON — this file must never store GS accounts.
 *
 * Prefer better-sqlite3 when the native binary is present.
 * Fall back to node:sqlite, then a writable path, then :memory:.
 * Never crash the process because the primary path is read-only or Node 20 lacks node:sqlite.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let singleton = null;
let engine = null;

function projectRoot() {
  return path.join(__dirname, '..', '..', '..', '..');
}

function resolveSqlitePath() {
  const override = (process.env.WEBSITE_BUILDER_SQLITE_PATH || '').trim();
  if (override) return override;
  return path.join(projectRoot(), 'data', 'website-builder.sqlite');
}

function sqliteCandidates(preferred) {
  const out = [];
  const add = (p) => {
    if (p && !out.includes(p)) out.push(p);
  };
  add(preferred);
  add(resolveSqlitePath());
  add(path.join(projectRoot(), 'data', 'website-builder.sqlite'));
  add(path.join(os.tmpdir(), 'gestione-website-builder.sqlite'));
  add(':memory:');
  return out;
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

function ensureDir(filePath) {
  if (filePath === ':memory:') return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function openWithBetterSqlite3(filePath) {
  const Database = require('better-sqlite3');
  ensureDir(filePath);
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  engine = 'better-sqlite3';
  return db;
}

function openWithNodeSqlite(filePath) {
  const { DatabaseSync } = require('node:sqlite');
  ensureDir(filePath);
  const raw = new DatabaseSync(filePath);
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec('PRAGMA foreign_keys = ON');
  engine = 'node:sqlite';
  return wrapNodeSqlite(raw);
}

function tryOpen(filePath) {
  try {
    return openWithBetterSqlite3(filePath);
  } catch (err) {
    console.warn('[website-builder] better-sqlite3:', filePath, err && err.message);
  }
  try {
    return openWithNodeSqlite(filePath);
  } catch (err) {
    console.warn('[website-builder] node:sqlite:', filePath, err && err.message);
  }
  return null;
}

function openDatabase(filePath) {
  const candidates = sqliteCandidates(filePath);
  for (const candidate of candidates) {
    const db = tryOpen(candidate);
    if (db) {
      if (candidate !== filePath) {
        console.warn('[website-builder] sqlite aperto su fallback', candidate, 'engine', engine);
      }
      return db;
    }
  }
  throw new Error('Website Builder: SQLite non disponibile (better-sqlite3 e node:sqlite falliti)');
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
    engine = null;
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
