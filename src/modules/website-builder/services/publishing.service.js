const { parseJson } = require('../utils/json');
const { versionId } = require('../ids');
const { HttpError } = require('../utils/http-error');
const { createVersionsRepository } = require('../repositories/versions.repository');
const { createPagesRepository } = require('../repositories/pages.repository');
const { createSectionsRepository } = require('../repositories/sections.repository');
const { createNavigationRepository } = require('../repositories/navigation.repository');
const { renderDocument } = require('../renderer/render-site');

function createPublishingService(db, websitesRepo) {
  const versions = createVersionsRepository(db);
  const pagesRepo = createPagesRepository(db);
  const sectionsRepo = createSectionsRepository(db);
  const navRepo = createNavigationRepository(db);

  function snapshotOf(tenantId, website) {
    const pages = pagesRepo.listByWebsite(tenantId, website.id).map((page) => ({
      ...page,
      sections: sectionsRepo.listByPage(tenantId, page.id)
    }));
    return {
      website: {
        id: website.id,
        name: website.name,
        slug: website.slug,
        theme: website.theme,
        settings: website.settings,
        locale_default: website.locale_default
      },
      pages,
      navigation: navRepo.list(tenantId, website.id),
      capturedAt: new Date().toISOString()
    };
  }

  function mapVersion(row) {
    if (!row) return null;
    return {
      id: row.id,
      website_id: row.website_id,
      tenant_id: row.tenant_id,
      kind: row.kind,
      note: row.note,
      created_by: row.created_by,
      created_at: row.created_at,
      snapshot: parseJson(row.snapshot_json, {})
    };
  }

  return {
    snapshotOf,
    list(tenantId, websiteId) {
      return versions.listByWebsite(tenantId, websiteId).map(mapVersion);
    },
    publish(tenantId, website, userId, note) {
      const payload = snapshotOf(tenantId, website);
      const row = versions.insert({
        id: versionId(),
        website_id: website.id,
        tenant_id: tenantId,
        kind: 'publish',
        snapshot: payload,
        note: note || 'Pubblicazione',
        created_by: userId || tenantId
      });
      websitesRepo.update(website.id, tenantId, {
        status: 'published',
        published_at: new Date().toISOString(),
        published_snapshot_id: row.id
      });
      return { version: mapVersion(row), website: websitesRepo.findById(website.id) };
    },
    unpublish(tenantId, website) {
      websitesRepo.update(website.id, tenantId, { status: 'unpublished' });
      return { website: websitesRepo.findById(website.id) };
    },
    rollback(tenantId, website, versionIdValue) {
      const row = versions.findById(versionIdValue);
      if (!row || row.tenant_id !== tenantId || row.website_id !== website.id) {
        throw new HttpError(404, 'Versione non trovata');
      }
      const snap = parseJson(row.snapshot_json, {});
      pagesRepo.removeByWebsite(tenantId, website.id);
      for (const page of snap.pages || []) {
        const created = pagesRepo.insert({
          ...page,
          id: page.id,
          website_id: website.id,
          tenant_id: tenantId
        });
        for (const section of page.sections || []) {
          sectionsRepo.insert({
            ...section,
            page_id: created.id,
            website_id: website.id,
            tenant_id: tenantId
          });
        }
      }
      const clone = versions.insert({
        id: versionId(),
        website_id: website.id,
        tenant_id: tenantId,
        kind: 'publish',
        snapshot: snap,
        note: `Rollback a ${versionIdValue}`,
        created_by: tenantId
      });
      websitesRepo.update(website.id, tenantId, {
        status: 'published',
        published_snapshot_id: clone.id,
        published_at: new Date().toISOString(),
        theme: (snap.website && snap.website.theme) || website.theme,
        settings: (snap.website && snap.website.settings) || website.settings
      });
      return { version: mapVersion(clone), website: websitesRepo.findById(website.id) };
    },
    renderPublished(website, pagePath) {
      if (!website.published_snapshot_id) return null;
      const row = versions.findById(website.published_snapshot_id);
      if (!row) return null;
      const snap = parseJson(row.snapshot_json, {});
      const pages = snap.pages || [];
      const page =
        pages.find((p) => p.path === pagePath || (pagePath === '/' && p.is_home)) ||
        pages.find((p) => p.is_home);
      if (!page) return null;
      return renderDocument({
        website: snap.website,
        page,
        sections: page.sections || [],
        locale: snap.website.locale_default || 'it'
      });
    }
  };
}

module.exports = { createPublishingService };
