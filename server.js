/**
 * Runtime satellite Website Builder.
 * Avvio standalone (account locale) oppure SSO da Gestione Semplificata.
 */

require('dotenv').config();
process.env.WEBSITE_BUILDER_ENABLED = process.env.WEBSITE_BUILDER_ENABLED || 'true';

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const { mount, getAppUrl } = require('./src/modules/website-builder');
const { requireCustomerAuth } = require('./src/middlewares/auth.middleware');
const { getDb } = require('./src/modules/website-builder/db/sqlite');
const { createLocalUsers } = require('./src/auth/local-users');
const { verifyLaunch } = require('./src/auth/sso');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const PUBLIC_DIR = path.join(__dirname, 'public');
const GS_BASE = (process.env.GESTIONE_SEMPLIFICATA_BASE_URL || '').replace(/\/$/, '');

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: 'wb.sid',
    secret: process.env.SESSION_SECRET || 'dev-website-builder-non-usare-in-produzione',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction
    }
  })
);

if (process.env.WEBSITE_BUILDER_DEV_TENANT_ID) {
  app.use((req, _res, next) => {
    if (!req.session.user) {
      req.session.user = {
        id: process.env.WEBSITE_BUILDER_DEV_TENANT_ID,
        email: process.env.WEBSITE_BUILDER_DEV_EMAIL || 'dev@local.test',
        type: 'customer',
        role: 'customer',
        products: String(process.env.WEBSITE_BUILDER_DEV_PRODUCTS || 'sitoweb_pro')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      };
    }
    next();
  });
}

mount(app);

const db = getDb();
const localUsers = createLocalUsers(db);

app.use(express.static(PUBLIC_DIR, { index: false, maxAge: isProduction ? '1h' : 0 }));

app.get('/api/public-config', (_req, res) => {
  res.json({
    appUrl: getAppUrl(),
    standalone: true,
    gsBaseUrl: GS_BASE || null,
    gsLoginUrl: GS_BASE ? `${GS_BASE}/login?redirect=%2Fwebsite` : null
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ user: null });
  res.json({ user: req.session.user });
});

app.post('/api/auth/register', (req, res) => {
  try {
    const user = localUsers.create({
      email: req.body && req.body.email,
      password: req.body && req.body.password,
      name: req.body && req.body.name
    });
    req.session.user = user;
    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message || 'Errore' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const user = localUsers.authenticate(req.body && req.body.email, req.body && req.body.password);
  if (!user) return res.status(401).json({ success: false, error: 'Email o password non corretti' });
  req.session.user = user;
  res.json({ success: true, user });
});

app.get('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/website');
  });
});
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/auth/gs', (req, res) => {
  const user = verifyLaunch(req.query.p, req.query.s);
  if (!user) return res.redirect('/login?redirect=%2Fwebsite');
  req.session.user = {
    id: user.id,
    email: user.email,
    type: user.type || 'customer',
    role: user.role || 'customer',
    products: Array.isArray(user.products) && user.products.length ? user.products : ['sitoweb_pro']
  };
  const next = String(req.query.next || '/website');
  const safe = next.charAt(0) === '/' && next.charAt(1) !== '/' ? next : '/website';
  res.redirect(safe);
});

function sendPublic(file) {
  return (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(PUBLIC_DIR, file));
  };
}

app.get('/', (_req, res) => res.redirect('/website'));
app.get('/website', sendPublic('website.html'));
app.get('/login', sendPublic('login.html'));
app.get('/register', sendPublic('register.html'));

const BUILDER_DIST = path.join(__dirname, 'website-builder-ui', 'dist');
app.use('/builder/assets', express.static(path.join(BUILDER_DIST, 'assets'), { maxAge: '1y' }));
function sendBuilder(_req, res) {
  res.set('Cache-Control', 'no-store');
  const index = path.join(BUILDER_DIST, 'index.html');
  if (!fs.existsSync(index)) {
    return res.status(503).type('text/plain').send('Editor non compilato. Esegui: npm run build:ui');
  }
  res.sendFile(index);
}
app.get('/builder', requireCustomerAuth, sendBuilder);
app.get('/builder/*', requireCustomerAuth, sendBuilder);

app.listen(PORT, () => {
  console.log(`Gestione Website Builder http://localhost:${PORT}/website`);
  console.log(`Editor  http://localhost:${PORT}/builder`);
  console.log(`Health  http://localhost:${PORT}/api/website-builder/health`);
  console.log(`Standalone: sì (account locale). SSO GS: ${GS_BASE || 'non configurato'}`);
});
