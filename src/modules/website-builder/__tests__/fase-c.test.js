const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

const { openDatabase } = require('../db/sqlite');
const { migrate } = require('../db/migrate');
const { createRouter } = require('../website-builder.routes');
const { renderDocument } = require('../renderer/render-site');

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

describe('website-builder Fase C renderer + preview', () => {
  let app;
  let site;

  before(async () => {
    const db = openDatabase(':memory:');
    migrate(db);
    app = createBuilderApp(db);
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Renderer Test' });
    site = created.body.website;
  });

  it('escapes user HTML in the shared renderer', () => {
    const html = renderDocument({
      website: { name: 'X', theme: {}, locale_default: 'it' },
      page: { title: '<script>alert(1)</script>', seo: { title: '<img>' } },
      sections: [
        {
          id: 'sec_xss',
          type: 'hero',
          content: { heading: { it: '<script>alert(1)</script>' }, subheading: { it: '' }, cta: { label: { it: 'Ok' }, href: 'javascript:alert(1)' } },
          design: {},
          layout: {},
          settings: {}
        }
      ]
    });
    assert.equal(html.includes('<script>alert(1)</script>'), false);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('href="#"'));
  });

  it('preview HTML is tenant-scoped (403 cross-tenant)', async () => {
    const pageId = site.pages[0].id;
    const own = await jsonAgent(app, USER_A)
      .get(`/api/website-builder/websites/${site.id}/pages/${pageId}/preview`)
      .set('Accept', 'text/html');
    assert.equal(own.status, 200);
    assert.ok(String(own.text).includes('wb-section'));

    const cross = await jsonAgent(app, USER_B)
      .get(`/api/website-builder/websites/${site.id}/pages/${pageId}/preview`);
    assert.equal(cross.status, 403);

    const live = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${site.id}/preview`)
      .send({ pageId, sections: [], viewport: 'mobile' });
    assert.equal(live.status, 200);
    assert.ok(String(live.text).includes('data-vp="mobile"'));
  });

  it('GET /status reports fase J', async () => {
    const res = await request(app).get('/api/website-builder/status');
    assert.equal(res.status, 200);
    assert.equal(res.body.fase, 'J');
    assert.ok(res.body.fasiCompletate.includes('C'));
  });
});
