/**
 * Runtime satellite Website Builder.
 * Nessun secondo login: tenantId = sessione Gestione Semplificata (user.id).
 * In locale, WEBSITE_BUILDER_DEV_TENANT_ID simula quella sessione.
 */

require('dotenv').config();
process.env.WEBSITE_BUILDER_ENABLED = process.env.WEBSITE_BUILDER_ENABLED || 'true';

const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const { mount, getAppUrl } = require('./src/modules/website-builder');
const { requireCustomerAuth } = require('./src/middlewares/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '8mb' }));
app.use(
  session({
    name: 'gs.sid',
    secret: process.env.SESSION_SECRET || 'dev-website-builder-non-usare-in-produzione',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
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

const BUILDER_DIST = path.join(__dirname, 'website-builder-ui', 'dist');
app.use('/builder/assets', express.static(path.join(BUILDER_DIST, 'assets'), { maxAge: '1y' }));
function sendBuilder(_req, res) {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(BUILDER_DIST, 'index.html'), (err) => {
    if (err) {
      res
        .status(503)
        .type('text/plain')
        .send('Editor non compilato. Esegui: npm run build:ui');
    }
  });
}
app.get('/builder', requireCustomerAuth, sendBuilder);
app.get('/builder/*', requireCustomerAuth, sendBuilder);
app.get('/', (_req, res) => res.redirect('/builder'));

app.listen(PORT, () => {
  console.log(`Gestione Website Builder http://localhost:${PORT}`);
  console.log(`Health ${getAppUrl()}/api/website-builder/health`);
  console.log(`Editor  http://localhost:${PORT}/builder`);
});
