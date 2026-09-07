const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

const { openDatabase } = require('../db/sqlite');
const { migrate } = require('../db/migrate');
const { createRouter } = require('../website-builder.routes');
const { createPublicRenderer } = require('../renderer/renderer.middleware');
const { fetchConnectedData } = require('../integrations/ristosimply.client');

const USER_A = {
  id: 'usr_tenant_a',
  email: 'a@example.com',
  type: 'customer',
  role: 'customer',
  products: ['sitoweb_pro']
};
const USER_B = {
  id: 'usr_tenant_b',
  email: 'b@example.com',
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

describe('website-builder Fasi H–J AI, RistoSimply, hardening', () => {
  let app;
  let site;

  before(async () => {
    process.env.WEBSITE_AI_OFFLINE = 'true';
    const db = openDatabase(':memory:');
    migrate(db);
    app = createBuilderApp(db);
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Sito GJ' });
    site = created.body.website;
  });

  it('AI generate returns a validated patch then apply', async () => {
    const gen = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${site.id}/ai/generate`)
      .send({ prompt: 'Crea una sezione menu e faq' });
    assert.equal(gen.status, 201, JSON.stringify(gen.body));
    assert.equal(gen.body.job.status, 'ready');
    assert.ok(Array.isArray(gen.body.job.patch.sections));
    const homeId = site.pages[0].id;
    const applied = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${site.id}/ai/jobs/${gen.body.job.id}/apply`)
      .send({ pageId: homeId });
    assert.equal(applied.status, 200, JSON.stringify(applied.body));
    assert.equal(applied.body.job.status, 'applied');
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

  it('enforces locale cap and does not capture GS dashboard host', async () => {
    const tooMany = await jsonAgent(app, USER_A)
      .patch(`/api/website-builder/websites/${site.id}`)
      .send({ locales: ['it', 'en', 'fr', 'de'] });
    assert.equal(tooMany.status, 403);

    const dash = await request(app).get('/dashboard').set('Host', 'localhost');
    assert.equal(dash.status, 200);
    assert.equal(dash.text, 'GS-DASHBOARD');
  });
});
