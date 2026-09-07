const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

const { openDatabase } = require('../db/sqlite');
const { migrate } = require('../db/migrate');
const { createRouter } = require('../website-builder.routes');
const { fetchConnectedData } = require('../integrations/ristosimply.client');

const USER_A = {
  id: 'usr_tenant_a',
  email: 'a@example.com',
  type: 'customer',
  role: 'customer',
  products: ['sitoweb_pro']
};

function jsonAgent(app, user) {
  const agent = request.agent(app);
  function withUser(req) {
    req.set('Accept', 'application/json');
    if (user) req.set('Cookie', `test-user=${encodeURIComponent(JSON.stringify(user))}`);
    return req;
  }
  return {
    get: (url) => withUser(agent.get(url)),
    post: (url) => withUser(agent.post(url))
  };
}

function createBuilderApp(db) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    const raw = (req.headers.cookie || '')
      .split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith('test-user='));
    if (raw) {
      try {
        req.session.user = JSON.parse(decodeURIComponent(raw.slice('test-user='.length)));
      } catch (_) {
        req.session.user = null;
      }
    }
    next();
  });
  app.use('/api/website-builder', createRouter({ db }));
  return app;
}

describe('website-builder Fase I RistoSimply', () => {
  let app;
  let site;

  before(async () => {
    const db = openDatabase(':memory:');
    migrate(db);
    app = createBuilderApp(db);
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Sito I' });
    site = created.body.website;
  });

  it('RistoSimply integration does not duplicate restaurant data', async () => {
    const res = await jsonAgent(app, USER_A).get(
      `/api/website-builder/websites/${site.id}/ristosimply`
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.ristosimply.duplicated, false);
    assert.equal(res.body.ristosimply.source, 'ristosimply');
    const stub = await fetchConnectedData({ email: USER_A.email });
    assert.equal(stub.duplicated, false);
  });

  it('GET /status reports Fase I completed on satellite', async () => {
    const res = await request(app).get('/api/website-builder/status');
    assert.equal(res.status, 200);
    assert.ok(res.body.fasiCompletate.includes('I'));
  });
});
