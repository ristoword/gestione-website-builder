const { parseJson, serializeJson } = require('../utils/json');

function mapPage(row, i18n) {
  if (!row) return null;
  const loc = i18n || null;
  return {
    id: row.id,
    website_id: row.website_id,
    tenant_id: row.tenant_id,
    slug: row.slug,
    path: row.is_home ? '/' : `/${row.slug}`,
    type: row.type,
    sort_order: row.sort_order,
    is_home: Boolean(row.is_home),
    visibility: parseJson(row.visibility_json, {}),
    title: loc ? loc.title || '' : '',
    seo: {
      title: loc ? loc.seo_title || '' : '',
      description: loc ? loc.seo_description || '' : '',
      canonical: loc ? loc.canonical || '' : '',
      og: loc ? parseJson(loc.og_json, {}) : {},
      jsonLd: loc ? parseJson(loc.schema_json, {}) : {}
    },
    locale: loc ? loc.locale : 'it',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function createPagesRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO pages (
      id, website_id, tenant_id, slug, type, sort_order, is_home, visibility_json, created_at, updated_at
    ) VALUES (
      @id, @website_id, @tenant_id, @slug, @type, @sort_order, @is_home, @visibility_json, @created_at, @updated_at
    )
  `);
  const listStmt = db.prepare(
    'SELECT * FROM pages WHERE tenant_id = ? AND website_id = ? ORDER BY sort_order ASC'
  );
  const findStmt = db.prepare('SELECT * FROM pages WHERE id = ?');
  const findBySlugStmt = db.prepare(
    'SELECT * FROM pages WHERE website_id = ? AND slug = ?'
  );
  const countStmt = db.prepare(
    'SELECT COUNT(*) AS n FROM pages WHERE tenant_id = ? AND website_id = ?'
  );
  const updateStmt = db.prepare(`
    UPDATE pages SET
      slug = @slug,
      type = @type,
      sort_order = @sort_order,
      is_home = @is_home,
      visibility_json = @visibility_json,
      updated_at = @updated_at
    WHERE id = @id AND tenant_id = @tenant_id
  `);
  const deleteByWebsiteStmt = db.prepare('DELETE FROM pages WHERE website_id = ? AND tenant_id = ?');
  const upsertI18nStmt = db.prepare(`
    INSERT INTO page_i18n (
      page_id, locale, title, seo_title, seo_description, canonical, og_json, schema_json
    ) VALUES (
      @page_id, @locale, @title, @seo_title, @seo_description, @canonical, @og_json, @schema_json
    )
    ON CONFLICT(page_id, locale) DO UPDATE SET
      title = excluded.title,
      seo_title = excluded.seo_title,
      seo_description = excluded.seo_description,
      canonical = excluded.canonical,
      og_json = excluded.og_json,
      schema_json = excluded.schema_json
  `);
  const findI18nStmt = db.prepare(
    'SELECT * FROM page_i18n WHERE page_id = ? AND locale = ?'
  );
  const listI18nStmt = db.prepare('SELECT * FROM page_i18n WHERE page_id = ?');

  function withI18n(row, locale) {
    if (!row) return null;
    const loc = locale || 'it';
    const i18n = findI18nStmt.get(row.id, loc) || listI18nStmt.all(row.id)[0] || null;
    return mapPage(row, i18n);
  }

  return {
    insert(data) {
      const now = new Date().toISOString();
      insertStmt.run({
        id: data.id,
        website_id: data.website_id,
        tenant_id: data.tenant_id,
        slug: data.slug,
        type: data.type || 'page',
        sort_order: data.sort_order || 0,
        is_home: data.is_home ? 1 : 0,
        visibility_json: serializeJson(data.visibility || {}, {}),
        created_at: data.created_at || now,
        updated_at: data.updated_at || now
      });
      if (data.title != null || data.seo) {
        this.upsertI18n(data.id, data.locale || 'it', {
          title: data.title,
          seo: data.seo
        });
      }
      return this.findByIdForTenant(data.tenant_id, data.id, data.locale || 'it');
    },

    upsertI18n(pageId, locale, data) {
      const seo = data.seo || {};
      upsertI18nStmt.run({
        page_id: pageId,
        locale: locale || 'it',
        title: data.title || '',
        seo_title: seo.title || '',
        seo_description: seo.description || '',
        canonical: seo.canonical || '',
        og_json: serializeJson(seo.og || {}, {}),
        schema_json: serializeJson(seo.jsonLd || seo.schema || {}, {})
      });
    },

    findById(id) {
      return findStmt.get(id) || null;
    },

    findByIdForTenant(tenantId, id, locale) {
      const row = findStmt.get(id);
      if (!row || row.tenant_id !== tenantId) return null;
      return withI18n(row, locale);
    },

    findRawById(id) {
      return findStmt.get(id) || null;
    },

    findBySlug(websiteId, slug) {
      return findBySlugStmt.get(websiteId, slug) || null;
    },

    listByWebsite(tenantId, websiteId, locale) {
      return listStmt.all(tenantId, websiteId).map((row) => withI18n(row, locale));
    },

    countByWebsite(tenantId, websiteId) {
      return countStmt.get(tenantId, websiteId).n;
    },

    update(tenantId, id, patch) {
      const current = findStmt.get(id);
      if (!current || current.tenant_id !== tenantId) return null;
      updateStmt.run({
        id,
        tenant_id: tenantId,
        slug: patch.slug != null ? patch.slug : current.slug,
        type: patch.type != null ? patch.type : current.type,
        sort_order: patch.sort_order != null ? patch.sort_order : current.sort_order,
        is_home: patch.is_home != null ? (patch.is_home ? 1 : 0) : current.is_home,
        visibility_json: serializeJson(
          patch.visibility != null ? patch.visibility : parseJson(current.visibility_json, {}),
          {}
        ),
        updated_at: new Date().toISOString()
      });
      if (patch.title != null || patch.seo) {
        const loc = patch.locale || 'it';
        const existing = findI18nStmt.get(id, loc) || {};
        const existingSeo = {
          title: existing.seo_title || '',
          description: existing.seo_description || '',
          canonical: existing.canonical || '',
          og: parseJson(existing.og_json, {}),
          jsonLd: parseJson(existing.schema_json, {})
        };
        this.upsertI18n(id, loc, {
          title: patch.title != null ? patch.title : existing.title,
          seo: patch.seo ? { ...existingSeo, ...patch.seo } : existingSeo
        });
      }
      return this.findByIdForTenant(tenantId, id, patch.locale || 'it');
    },

    remove(tenantId, id) {
      const info = deleteStmt.run(id, tenantId);
      return info.changes > 0;
    },
    removeByWebsite(tenantId, websiteId) {
      const info = deleteByWebsiteStmt.run(websiteId, tenantId);
      return info.changes;
    }
  };
}

module.exports = { createPagesRepository, mapPage };
