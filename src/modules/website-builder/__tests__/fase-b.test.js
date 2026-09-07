const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

const { openDatabase } = require('../db/sqlite');
const { migrate } = require('../db/migrate');
const { createRouter } = require('../website-builder.routes');
const { resolveAccess } = require('../../payments/access.resolver');

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
const USER_BASE = {
  id: 'usr_tenant_base',
  email: 'base@example.com',
  type: 'customer',
  role: 'customer',
  products: ['sitoweb_base']
};
const USER_NONE = {
  id: 'usr_tenant_none',
  email: 'none@example.com',
  type: 'customer',
  role: 'customer'
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
    patch: (url) => withUser(agent.patch(url)),
    put: (url) => withUser(agent.put(url)),
    delete: (url) => withUser(agent.delete(url))
  };
}

function createBuilderApp(db) {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    })
  );
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
  app.use((req, res) => res.status(404).json({ error: 'Pagina non trovata' }));
  return app;
}

describe('website-builder Fase B CRUD + isolamento', () => {
  let db;
  let app;

  before(() => {
    db = openDatabase(':memory:');
    migrate(db);
    app = createBuilderApp(db);
  });

  it('GET /status reports fase J', async () => {
    const res = await request(app).get('/api/website-builder/status');
    assert.equal(res.status, 200);
    assert.equal(res.body.fase, 'J');
    assert.ok(res.body.fasiCompletate.includes('B'));
  });

  it('POST /websites creates a draft site with home page and sections for the session tenant', async () => {
    const res = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Trattoria da Paolo', tenantId: USER_B.id });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.website.tenant_id, USER_A.id);
    assert.notEqual(res.body.website.tenant_id, USER_B.id);
    assert.equal(res.body.website.status, 'draft');
    assert.ok(res.body.website.pages.length >= 1);
    assert.equal(res.body.website.pages[0].is_home, true);

    const pages = await jsonAgent(app, USER_A).get(
      `/api/website-builder/websites/${res.body.website.id}/pages`
    );
    assert.equal(pages.status, 200);
    const homeId = pages.body.pages[0].id;
    const sections = await jsonAgent(app, USER_A).get(
      `/api/website-builder/websites/${res.body.website.id}/pages/${homeId}/sections`
    );
    assert.equal(sections.status, 200);
    assert.ok(sections.body.sections.length >= 3);
    assert.equal(typeof sections.body.sections[0].content, 'object');
  });

  it('lists only the session tenant websites', async () => {
    await jsonAgent(app, USER_B).post('/api/website-builder/websites').send({ name: 'Pizzeria B' });
    const a = await jsonAgent(app, USER_A).get('/api/website-builder/websites');
    const b = await jsonAgent(app, USER_B).get('/api/website-builder/websites');
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.ok(a.body.websites.every((w) => w.tenant_id === USER_A.id));
    assert.ok(b.body.websites.every((w) => w.tenant_id === USER_B.id));
    assert.equal(b.body.websites.length, 1);
  });

  it('returns 403 when user B requests user A website, pages or sections', async () => {
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Sito isolato A' });
    const id = created.body.website.id;
    const pageId = created.body.website.pages[0].id;

    const getSite = await jsonAgent(app, USER_B).get(`/api/website-builder/websites/${id}`);
    assert.equal(getSite.status, 403);
    assert.equal(getSite.body.error, 'Accesso negato');

    const patchSite = await jsonAgent(app, USER_B)
      .patch(`/api/website-builder/websites/${id}`)
      .send({ name: 'Hijack' });
    assert.equal(patchSite.status, 403);

    const pages = await jsonAgent(app, USER_B).get(`/api/website-builder/websites/${id}/pages`);
    assert.equal(pages.status, 403);

    const addPage = await jsonAgent(app, USER_B)
      .post(`/api/website-builder/websites/${id}/pages`)
      .send({ title: 'Intruso' });
    assert.equal(addPage.status, 403);

    const sections = await jsonAgent(app, USER_B).get(
      `/api/website-builder/websites/${id}/pages/${pageId}/sections`
    );
    assert.equal(sections.status, 403);

    const addSection = await jsonAgent(app, USER_B)
      .post(`/api/website-builder/websites/${id}/pages/${pageId}/sections`)
      .send({ type: 'hero' });
    assert.equal(addSection.status, 403);
  });

  it('PATCH website and page, POST section, reorder, then DELETE stay tenant-scoped', async () => {
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Editabile' });
    const id = created.body.website.id;
    const homeId = created.body.website.pages[0].id;

    const patched = await jsonAgent(app, USER_A)
      .patch(`/api/website-builder/websites/${id}`)
      .send({ name: 'Editabile Plus', tenantId: USER_B.id });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.website.name, 'Editabile Plus');
    assert.equal(patched.body.website.tenant_id, USER_A.id);

    const page = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${id}/pages`)
      .send({ title: 'Menu', slug: 'menu' });
    assert.equal(page.status, 201, JSON.stringify(page.body));
    assert.equal(page.body.page.slug, 'menu');
    assert.equal(page.body.page.path, '/menu');

    const patchedPage = await jsonAgent(app, USER_A)
      .patch(`/api/website-builder/websites/${id}/pages/${page.body.page.id}`)
      .send({ title: 'Il menu', seo: { description: 'Piatti del giorno' } });
    assert.equal(patchedPage.status, 200);
    assert.equal(patchedPage.body.page.title, 'Il menu');

    const section = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${id}/pages/${homeId}/sections`)
      .send({ type: 'faq', content: { heading: { it: 'Domande' } } });
    assert.equal(section.status, 201, JSON.stringify(section.body));
    assert.equal(section.body.section.type, 'faq');
    assert.equal(section.body.section.content.heading.it, 'Domande');

    const listed = await jsonAgent(app, USER_A).get(
      `/api/website-builder/websites/${id}/pages/${homeId}/sections`
    );
    const ids = listed.body.sections.map((s) => s.id).reverse();
    const reordered = await jsonAgent(app, USER_A)
      .put(`/api/website-builder/websites/${id}/pages/${homeId}/sections`)
      .send({ orderedIds: ids });
    assert.equal(reordered.status, 200);
    assert.equal(reordered.body.sections[0].id, ids[0]);

    const delSection = await jsonAgent(app, USER_B)
      .delete(`/api/website-builder/websites/${id}/pages/${homeId}/sections/${section.body.section.id}`);
    assert.equal(delSection.status, 403);

    const delOwn = await jsonAgent(app, USER_A)
      .delete(`/api/website-builder/websites/${id}/pages/${homeId}/sections/${section.body.section.id}`);
    assert.equal(delOwn.status, 200);

    const delSite = await jsonAgent(app, USER_A).delete(`/api/website-builder/websites/${id}`);
    assert.equal(delSite.status, 200);
    const gone = await jsonAgent(app, USER_A).get(`/api/website-builder/websites/${id}`);
    assert.equal(gone.status, 403);
  });

  it('rejects create without sitoweb plan and enforces website quota on BASE', async () => {
    const noPlan = await jsonAgent(app, USER_NONE)
      .post('/api/website-builder/websites')
      .send({ name: 'Senza piano' });
    assert.equal(noPlan.status, 403);

    const first = await jsonAgent(app, USER_BASE)
      .post('/api/website-builder/websites')
      .send({ name: 'Unico BASE' });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const second = await jsonAgent(app, USER_BASE)
      .post('/api/website-builder/websites')
      .send({ name: 'Secondo BASE' });
    assert.equal(second.status, 403);
    assert.equal(second.body.feature, 'websites');
  });

  it('rejects unknown section types', async () => {
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Validazione' });
    const id = created.body.website.id;
    const pageId = created.body.website.pages[0].id;
    const bad = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${id}/pages/${pageId}/sections`)
      .send({ type: 'not-a-section' });
    assert.equal(bad.status, 400);
  });

  it('maps sitoweb access to /account#siti without touching ristoword', () => {
    const sitoweb = resolveAccess('sitoweb_pro');
    assert.equal(sitoweb.type, 'sitoweb');
    assert.equal(sitoweb.redirect, '/account#siti');
    const rw = resolveAccess('ristoword_monthly');
    assert.equal(rw.type, 'ristoword');
  });
});
