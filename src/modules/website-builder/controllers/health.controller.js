const { getAppUrl } = require('../config/env');
const { listSectionTypes } = require('../config/section-registry');
const { getEngine } = require('../db/sqlite');
const { completed, railway, hubPath } = require('../config/fasi-runtime');

function createHealthController(db) {
  function sqliteOk() {
    try {
      db.prepare('SELECT 1 AS n').get();
      return true;
    } catch (_) {
      return false;
    }
  }

  function payload() {
    return {
      module: 'website-builder',
      fase: 'J',
      enabled: true,
      standalone: true,
      sqlite: sqliteOk() ? 'ok' : 'error',
      sqliteEngine: getEngine(),
      appUrl: getAppUrl(),
      hub: `${railway}${hubPath}`,
      fasiCompletate: completed,
      sectionTypes: listSectionTypes().length
    };
  }

  return {
    health(_req, res) {
      const body = payload();
      res.status(body.sqlite === 'ok' ? 200 : 503).json({ ok: body.sqlite === 'ok', ...body });
    },
    status(_req, res) {
      const body = payload();
      res.status(body.sqlite === 'ok' ? 200 : 503).json(body);
    }
  };
}

module.exports = { createHealthController };
