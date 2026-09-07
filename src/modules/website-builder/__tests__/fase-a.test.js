const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

const { openDatabase } = require('../db/sqlite');
const { migrate } = require('../db/migrate');
const { createRouter } = require('../website-builder.routes');
const { createWebsitesRepository } = require('../repositories/websites.repository');
const { createPagesRepository } = require('../repositories/pages.repository');
const { createSectionsRepository } = require('../repositories/sections.repository');
const { createMediaRepository } = require('../repositories/media.repository');
const { createDomainsRepository } = require('../repositories/domains.repository');
const { createVersionsRepository } = require('../repositories/versions.repository');
const { websiteId, pageId, sectionId, mediaId, domainId, versionId } = require('../ids');
const { defaultSection, validateSection, listSectionTypes } = require('../config/section-registry');
const { PRODUCT_TO_PLAN, PLANS, pickHighestPlan, UNLIMITED } = require('../config/plans.config');
const { isEnabled, getAppUrl, DEFAULT_APP_URL } = require('../config/env');

const USER_A = { id: 'usr_tenant_a', email: 'a@example.com', type: 'customer', role: 'customer' };
const USER_B = { id: 'usr_tenant_b', email: 'b@example.com', type: 'customer', role: 'customer' };

function jsonAgent(app, user) {
  const agent = request.agent(app);
  return {
    get(url) {
      const req = agent.get(url).set('Accept', 'application/json');
      if (user) req.set('Cookie', `test-user=${encodeURIComponent(JSON.stringify(user))}`);
      return req;
    },
    post(url) {
      const req = agent.post(url).set('Accept', 'application/json');
      if (user) req.set('Cookie', `test-user=${encodeURIComponent(JSON.stringify(user))}`);
      return req;
    }
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

describe('website-builder Fase A foundation', () => {
  let db;
  let app;
  let websitesRepo;
  let siteA;

  before(() => {
    db = openDatabase(':memory:');
    migrate(db);
    websitesRepo = createWebsitesRepository(db);
    siteA = websitesRepo.insert({
      id: websiteId(),
      tenant_id: USER_A.id,
      name: 'Trattoria A',
      slug: 'trattoria-a',
      status: 'draft',
      plan_product_id: 'sitoweb_base'
    });
    app = createBuilderApp(db);
  });

  it('creates all tenant-scoped tables', () => {
    const names = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
      .map((r) => r.name);
    for (const t of [
      'websites',
      'pages',
      'sections',
      'media_assets',
      'domains',
      'versions',
      'page_i18n',
      'navigation',
      'forms',
      'form_submissions'
    ]) {
      assert.ok(names.includes(t), `missing table ${t}`);
    }
  });

  it('persists pages, sections, media, domains and versions under tenant_id', () => {
    const pages = createPagesRepository(db);
    const sections = createSectionsRepository(db);
    const media = createMediaRepository(db);
    const domains = createDomainsRepository(db);
    const versions = createVersionsRepository(db);

    const page = pages.insert({
      id: pageId(),
      website_id: siteA.id,
      tenant_id: USER_A.id,
      slug: 'home',
      type: 'home',
      is_home: true
    });
    const section = defaultSection('hero', sectionId());
    sections.insert({
      id: section.id,
      page_id: page.id,
      website_id: siteA.id,
      tenant_id: USER_A.id,
      type: section.type,
      content: section.content,
      design: section.design,
      layout: section.layout,
      settings: section.settings
    });
    media.insert({
      id: mediaId(),
      tenant_id: USER_A.id,
      website_id: siteA.id,
      filename: 'hero.jpg',
      storage_key: `media/${USER_A.id}/hero.jpg`,
      mime: 'image/jpeg',
      size_bytes: 12
    });
    domains.insert({
      id: domainId(),
      website_id: siteA.id,
      tenant_id: USER_A.id,
      host: 'trattoria-a.gestionesemplificata.com',
      type: 'subdomain'
    });
    versions.insert({
      id: versionId(),
      website_id: siteA.id,
      tenant_id: USER_A.id,
      kind: 'manual',
      snapshot: { pages: [page.id] },
      created_by: USER_A.id
    });

    assert.equal(pages.listByWebsite(USER_B.id, siteA.id).length, 0);
    assert.equal(pages.listByWebsite(USER_A.id, siteA.id).length, 1);
    assert.equal(sections.listByPage(USER_A.id, page.id).length, 1);
    assert.equal(media.listByTenant(USER_B.id).length, 0);
    assert.equal(domains.listByWebsite(USER_A.id, siteA.id)[0].host, 'trattoria-a.gestionesemplificata.com');
    assert.equal(versions.listByWebsite(USER_A.id, siteA.id).length, 1);
  });

  it('GET /health and /status report the Railway runtime URL', async () => {
    const health = await request(app).get('/api/website-builder/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    assert.equal(health.body.sqlite, 'ok');
    assert.equal(health.body.appUrl, DEFAULT_APP_URL);
    assert.equal(health.body.sectionTypes, 18);
    assert.equal(health.body.standalone, true);
    assert.ok(Array.isArray(health.body.fasiCompletate));
    assert.ok(health.body.fasiCompletate.includes('A'));
    assert.ok(String(health.body.hub).endsWith('/website'));

    const status = await request(app).get('/api/website-builder/status');
    assert.equal(status.status, 200);
    assert.equal(status.body.fase, 'J');
    assert.equal(status.body.appUrl, getAppUrl());
  });

  it('rejects unauthenticated tenant routes with 401', async () => {
    const res = await request(app)
      .get('/api/website-builder/websites')
      .set('Accept', 'application/json');
    assert.equal(res.status, 401);
  });

  it('lists only the session tenant websites', async () => {
    const a = await jsonAgent(app, USER_A).get('/api/website-builder/websites');
    assert.equal(a.status, 200);
    assert.equal(a.body.websites.length, 1);
    assert.equal(a.body.websites[0].id, siteA.id);

    const b = await jsonAgent(app, USER_B).get('/api/website-builder/websites');
    assert.equal(b.status, 200);
    assert.equal(b.body.websites.length, 0);
  });

  it('returns 403 when user B requests user A website', async () => {
    const own = await jsonAgent(app, USER_A).get(`/api/website-builder/websites/${siteA.id}`);
    assert.equal(own.status, 200);
    assert.equal(own.body.website.tenant_id, USER_A.id);

    const cross = await jsonAgent(app, USER_B).get(`/api/website-builder/websites/${siteA.id}`);
    assert.equal(cross.status, 403);
    assert.equal(cross.body.error, 'Accesso negato');
  });

  it('ignores tenantId sent by the client', async () => {
    const res = await jsonAgent(app, USER_B)
      .post('/api/website-builder/entitlements')
      .send({ tenantId: USER_A.id });
    // entitlements is GET-only; POST should not leak tenant A data
    assert.notEqual(res.status, 200);

    const entitlements = await jsonAgent(app, USER_B).get('/api/website-builder/entitlements');
    assert.equal(entitlements.status, 200);
    assert.equal(entitlements.body.tenantId, USER_B.id);
    assert.notEqual(entitlements.body.tenantId, USER_A.id);
  });

  it('maps sitoweb products to STARTER/BUSINESS/PROFESSIONAL with finite caps', () => {
    assert.equal(PRODUCT_TO_PLAN.sitoweb_base, 'starter');
    assert.equal(PRODUCT_TO_PLAN.sitoweb_pro, 'business');
    assert.equal(PRODUCT_TO_PLAN.sitoweb_premium, 'professional');
    assert.equal(pickHighestPlan(['sitoweb_base', 'sitoweb_premium']), 'professional');
    assert.equal(PLANS.professional.pages, UNLIMITED);
    assert.notEqual(PLANS.professional.pages, Infinity);
    assert.equal(typeof PLANS.starter.websites, 'number');
  });

  it('validates default JSON for every registered section type', () => {
    const types = listSectionTypes();
    assert.equal(types.length, 18);
    for (const type of types) {
      const section = defaultSection(type, `sec_test_${type}`);
      const result = validateSection(section);
      assert.equal(result.valid, true, `${type}: ${JSON.stringify(result.errors)}`);
    }
    const bad = validateSection({ id: 'x', type: 'not-a-section', version: 1, content: {}, design: {}, layout: {}, settings: {} });
    assert.equal(bad.valid, false);
  });

  it('is enabled by default and can be turned off with WEBSITE_BUILDER_ENABLED=false', () => {
    const prev = process.env.WEBSITE_BUILDER_ENABLED;
    delete process.env.WEBSITE_BUILDER_ENABLED;
    assert.equal(isEnabled(), true);
    process.env.WEBSITE_BUILDER_ENABLED = 'false';
    assert.equal(isEnabled(), false);
    process.env.WEBSITE_BUILDER_ENABLED = 'true';
    assert.equal(isEnabled(), true);
    if (prev === undefined) delete process.env.WEBSITE_BUILDER_ENABLED;
    else process.env.WEBSITE_BUILDER_ENABLED = prev;
  });
});
