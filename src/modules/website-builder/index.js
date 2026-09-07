/**
 * Website Builder module (Fasi A–J).
 * Identity stays on Gestione Semplificata sessions: tenantId = req.session.user.id.
 * Mount only when WEBSITE_BUILDER_ENABLED=true — otherwise existing behaviour is unchanged.
 */

const { isEnabled, getAppUrl, DEFAULT_APP_URL } = require('./config/env');

/**
 * Mount /api/website-builder on the Express app.
 * Caller must invoke this AFTER webhook raw + json + /api/admin and BEFORE /api limiter.
 */
function mount(app) {
  if (!isEnabled()) return false;
  const { getDb } = require('./db/sqlite');
  const { migrate } = require('./db/migrate');
  const { createRouter } = require('./website-builder.routes');
  const db = getDb();
  migrate(db);
  const { createTemplatesRepository } = require('./repositories/templates.repository');
  createTemplatesRepository(db).seed();
  app.use('/api/website-builder', createRouter({ db }));
  const { createPublicRenderer } = require('./renderer/renderer.middleware');
  app.use(createPublicRenderer(db));
  return true;
}

module.exports = {
  isEnabled,
  getAppUrl,
  mount,
  DEFAULT_APP_URL
};
