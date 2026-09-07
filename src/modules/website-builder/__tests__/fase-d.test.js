const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
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
  app.use(express.json({ limit: '2mb' }));
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

describe('website-builder Fase D template a cartelle', () => {
  let app;
  let site;

  before(async () => {
    const db = openDatabase(':memory:');
    migrate(db);
    app = createBuilderApp(db);
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Sito D' });
    site = created.body.website;
  });

  it('lists at least 10 distinct templates loaded from folders and applies one with confirm', async () => {
    const list = await jsonAgent(app, USER_A).get('/api/website-builder/templates');
    assert.equal(list.status, 200);
    assert.ok(list.body.templates.length >= 10);
    const slugs = new Set(list.body.templates.map((t) => t.slug));
    assert.equal(slugs.size, list.body.templates.length);
    const root = path.join(__dirname, '..', 'templates');
    assert.ok(fs.existsSync(path.join(root, 'ristoranti', 'pizzeria', 'template.json')));
    assert.ok(fs.existsSync(path.join(root, 'hotel', 'hotel-boutique', 'template.json')));

    const denied = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${site.id}/apply-template`)
      .send({ templateId: 'tpl_pizzeria' });
    assert.equal(denied.status, 409);

    const applied = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${site.id}/apply-template`)
      .send({ templateId: 'tpl_pizzeria', confirm: true });
    assert.equal(applied.status, 200, JSON.stringify(applied.body));
    assert.ok(applied.body.website.pages.length >= 1);
    const names = applied.body.website.pages.map((p) => p.slug);
    assert.ok(names.includes('home'));
  });

  it('GET /status reports Fase D completed on satellite', async () => {
    const res = await request(app).get('/api/website-builder/status');
    assert.equal(res.status, 200);
    assert.ok(res.body.fasiCompletate.includes('D'));
  });
});
