const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

const { openDatabase } = require('../db/sqlite');
const { migrate } = require('../db/migrate');
const { createRouter } = require('../website-builder.routes');

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

describe('website-builder Fase H AI', () => {
  let app;
  let site;

  before(async () => {
    process.env.WEBSITE_AI_OFFLINE = 'true';
    const db = openDatabase(':memory:');
    migrate(db);
    app = createBuilderApp(db);
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Sito H' });
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

  it('GET /status reports Fase H completed on satellite', async () => {
    const res = await request(app).get('/api/website-builder/status');
    assert.equal(res.status, 200);
    assert.ok(res.body.fasiCompletate.includes('H'));
  });
});
