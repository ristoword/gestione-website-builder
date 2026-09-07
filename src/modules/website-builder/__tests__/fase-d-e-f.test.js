const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

const { openDatabase } = require('../db/sqlite');
const { migrate } = require('../db/migrate');
const { createRouter } = require('../website-builder.routes');

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
    delete: (url) => withUser(agent.delete(url))
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

describe('website-builder Fasi E–F media, publish', () => {
  let app;
  let site;

  before(async () => {
    process.env.WB_MEDIA_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-media-'));
    const db = openDatabase(':memory:');
    migrate(db);
    app = createBuilderApp(db);
    const created = await jsonAgent(app, USER_A)
      .post('/api/website-builder/websites')
      .send({ name: 'Sito DEF' });
    site = created.body.website;
  });

  it('uploads, searches, previews and deletes media under tenant isolation', async () => {
    const up = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${site.id}/media`)
      .send({ filename: 'hero.png', mime: 'image/png', contentBase64: PNG });
    assert.equal(up.status, 201, JSON.stringify(up.body));
    const mediaId = up.body.media.id;
    assert.equal(up.body.media.tenant_id, USER_A.id);

    const search = await jsonAgent(app, USER_A).get(
      `/api/website-builder/websites/${site.id}/media?q=hero`
    );
    assert.equal(search.status, 200);
    assert.ok(search.body.media.some((m) => m.id === mediaId));

    const file = await jsonAgent(app, USER_A).get(
      `/api/website-builder/websites/${site.id}/media/${mediaId}/file`
    );
    assert.equal(file.status, 200);

    const cross = await jsonAgent(app, USER_B).get(
      `/api/website-builder/websites/${site.id}/media/${mediaId}/file`
    );
    assert.equal(cross.status, 403);

    const delCross = await jsonAgent(app, USER_B).delete(
      `/api/website-builder/websites/${site.id}/media/${mediaId}`
    );
    assert.equal(delCross.status, 403);

    const del = await jsonAgent(app, USER_A).delete(
      `/api/website-builder/websites/${site.id}/media/${mediaId}`
    );
    assert.equal(del.status, 200);
  });

  it('publishes a snapshot, lists versions and rollbacks', async () => {
    const pub = await jsonAgent(app, USER_A)
      .post(`/api/website-builder/websites/${site.id}/publish`)
      .send({ note: 'Prima pubblicazione' });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(pub.body.website.status, 'published');
    const versionId = pub.body.version.id;

    const versions = await jsonAgent(app, USER_A).get(
      `/api/website-builder/websites/${site.id}/versions`
    );
    assert.equal(versions.status, 200);
    assert.ok(versions.body.versions.length >= 1);

    const un = await jsonAgent(app, USER_A).post(
      `/api/website-builder/websites/${site.id}/unpublish`
    );
    assert.equal(un.status, 200);
    assert.equal(un.body.website.status, 'unpublished');

    const rb = await jsonAgent(app, USER_A).post(
      `/api/website-builder/websites/${site.id}/versions/${versionId}/rollback`
    );
    assert.equal(rb.status, 200, JSON.stringify(rb.body));
    assert.equal(rb.body.website.status, 'published');

    const cross = await jsonAgent(app, USER_B).post(
      `/api/website-builder/websites/${site.id}/publish`
    );
    assert.equal(cross.status, 403);
  });
});
