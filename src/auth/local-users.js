const crypto = require('crypto');

function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), usedSalt, 32).toString('hex');
  return { salt: usedSalt, hash };
}

function verifyPassword(password, salt, hash) {
  const next = crypto.scryptSync(String(password), salt, 32).toString('hex');
  const a = Buffer.from(next);
  const b = Buffer.from(String(hash));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function ensureTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      products TEXT NOT NULL DEFAULT '["sitoweb_pro"]',
      created_at TEXT NOT NULL
    )
  `);
}

function parseProducts(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) && v.length ? v : ['sitoweb_pro'];
  } catch {
    return ['sitoweb_pro'];
  }
}

function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    type: 'customer',
    role: 'customer',
    products: parseProducts(row.products)
  };
}

function createLocalUsers(db) {
  ensureTable(db);
  return {
    findByEmail(email) {
      return db.prepare('SELECT * FROM local_users WHERE email = ?').get(String(email || '').trim().toLowerCase());
    },
    create({ email, password, name }) {
      const normalized = String(email || '').trim().toLowerCase();
      if (!normalized || !normalized.includes('@')) {
        const err = new Error('Email non valida');
        err.status = 400;
        throw err;
      }
      if (!password || String(password).length < 8) {
        const err = new Error('Password troppo corta');
        err.status = 400;
        throw err;
      }
      if (this.findByEmail(normalized)) {
        const err = new Error('Email già registrata');
        err.status = 409;
        throw err;
      }
      const { salt, hash } = hashPassword(password);
      const id = 'usr_' + crypto.randomBytes(8).toString('hex');
      db.prepare(
        'INSERT INTO local_users (id, email, name, password_salt, password_hash, products, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        id,
        normalized,
        String(name || '').trim() || 'Utente',
        salt,
        hash,
        JSON.stringify(['sitoweb_pro']),
        new Date().toISOString()
      );
      return toPublic(this.findByEmail(normalized));
    },
    authenticate(email, password) {
      const row = this.findByEmail(email);
      if (!row || !verifyPassword(password, row.password_salt, row.password_hash)) return null;
      return toPublic(row);
    }
  };
}

module.exports = { createLocalUsers, hashPassword, verifyPassword };
