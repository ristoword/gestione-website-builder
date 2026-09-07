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

describe('website-builder Fase G SEO e domini TXT', () => {
  let app;
  let site;

  before(async () => {
    const db = openDatabase(':memory:');
    migrate(db);
    app = createBuilderApp(db);
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Sito G' });
    site = created.body.website;
  });

  it('custom domain is TXT-only and isolated; sitemap is per-tenant', async () => {
    const add = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${site.id}/domains`)
      .send({ host: 'www.esempio-wb-test.it', type: 'custom' });
    assert.equal(add.status, 201, JSON.stringify(add.body));
    const instructions = JSON.parse(add.body.domain.dns_instructions_json || '{}');
    assert.equal(instructions.recordType, 'TXT');
    assert.ok(String(instructions.note).toLowerCase().includes('txt'));

    const cross = await jsonAgent(app, USER_B)
      .post(`/api/website-builder/websites/${site.id}/domains/${add.body.domain.id}/verify`)
      .send({ token: add.body.domain.verification_token });
    assert.equal(cross.status, 403);

    const verify = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${site.id}/domains/${add.body.domain.id}/verify`)
      .send({ token: add.body.domain.verification_token });
    assert.equal(verify.status, 200, JSON.stringify(verify.body));

    const sm = await jsonAgent(app, USER_A).get(
      `/api/website-builder/websites/${site.id}/seo/sitemap.xml`
    );
    assert.equal(sm.status, 200);
    assert.ok(String(sm.text).includes('urlset'));
  });

  it('GET /status reports Fase G completed on satellite', async () => {
    const res = await request(app).get('/api/website-builder/status');
    assert.equal(res.status, 200);
    assert.ok(res.body.fasiCompletate.includes('G'));
  });
});
