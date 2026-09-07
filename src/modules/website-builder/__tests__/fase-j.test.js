const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

const { openDatabase } = require('../db/sqlite');
const { migrate } = require('../db/migrate');
const { createRouter } = require('../website-builder.routes');
const { createPublicRenderer } = require('../renderer/renderer.middleware');

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
    post: (url) => withUser(agent.post(url)),
    patch: (url) => withUser(agent.patch(url))
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
  app.use(createPublicRenderer(db));
  app.get('/dashboard', (_req, res) => res.status(200).send('GS-DASHBOARD'));
  app.use((req, res) => res.status(404).send('Pagina non trovata'));
  return app;
}

describe('website-builder Fase J limiti piano e hardening', () => {
  let app;
  let site;

  before(async () => {
    const db = openDatabase(':memory:');
    migrate(db);
    app = createBuilderApp(db);
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Sito J' });
    site = created.body.website;
  });

  it('enforces locale cap and does not capture GS dashboard host', async () => {
    const tooMany = await jsonAgent(app, USER_A)
      .patch(`/api/website-builder/websites/${site.id}`)
      .send({ locales: ['it', 'en', 'fr', 'de'] });
    assert.equal(tooMany.status, 403);

    const dash = await request(app).get('/dashboard').set('Host', 'localhost');
    assert.equal(dash.status, 200);
    assert.equal(dash.text, 'GS-DASHBOARD');
  });

  it('GET /status reports all fasi A–J completed on satellite', async () => {
    const res = await request(app).get('/api/website-builder/status');
    assert.equal(res.status, 200);
    assert.equal(res.body.fase, 'J');
    assert.equal(res.body.standalone, true);
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
      assert.ok(res.body.fasiCompletate.includes(letter), `manca fase ${letter}`);
    }
  });
});
