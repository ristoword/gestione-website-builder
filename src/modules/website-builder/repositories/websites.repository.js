/**
 * Websites persistence. Every query is tenant-scoped.
 */

const { parseJson, serializeJson } = require('../utils/json');

function mapWebsite(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    template_id: row.template_id,
    theme: parseJson(row.theme_json, {}),
    settings: parseJson(row.settings_json, {}),
    locale_default: row.locale_default,
    locales: parseJson(row.locales_json, ['it']),
    plan_product_id: row.plan_product_id,
    stripe_session_id: row.stripe_session_id || null,
    published_snapshot_id: row.published_snapshot_id || null,
    deleted_at: row.deleted_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at
  };
}

function createWebsitesRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO websites (
      id, tenant_id, name, slug, status, template_id, theme_json, settings_json,
      locale_default, locales_json, plan_product_id, created_at, updated_at, published_at,
      stripe_session_id, deleted_at, published_snapshot_id
    ) VALUES (
      @id, @tenant_id, @name, @slug, @status, @template_id, @theme_json, @settings_json,
      @locale_default, @locales_json, @plan_product_id, @created_at, @updated_at, @published_at,
      @stripe_session_id, @deleted_at, @published_snapshot_id
    )
  `);
  const findByIdStmt = db.prepare('SELECT * FROM websites WHERE id = ?');
  const findBySlugStmt = db.prepare('SELECT * FROM websites WHERE slug = ?');
  const findByStripeStmt = db.prepare('SELECT * FROM websites WHERE stripe_session_id = ?');
  const listByTenantStmt = db.prepare(
    `SELECT * FROM websites WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
  );
  const countByTenantStmt = db.prepare(
    `SELECT COUNT(*) AS n FROM websites WHERE tenant_id = ? AND deleted_at IS NULL`
  );
  const updateStmt = db.prepare(`
    UPDATE websites SET
      name = @name,
      slug = @slug,
      status = @status,
      template_id = @template_id,
      theme_json = @theme_json,
      settings_json = @settings_json,
      locale_default = @locale_default,
      locales_json = @locales_json,
      plan_product_id = @plan_product_id,
      published_snapshot_id = @published_snapshot_id,
      published_at = @published_at,
      updated_at = @updated_at
    WHERE id = @id AND tenant_id = @tenant_id AND deleted_at IS NULL
  `);
  const softDeleteStmt = db.prepare(`
    UPDATE websites SET deleted_at = ?, status = 'unpublished', updated_at = ?
    WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
  `);

  return {
    insert(data) {
      const now = new Date().toISOString();
      const row = {
        id: data.id,
        tenant_id: data.tenant_id,
        name: data.name,
        slug: data.slug,
        status: data.status || 'draft',
        template_id: data.template_id || null,
        theme_json: serializeJson(data.theme || data.theme_json, {}),
        settings_json: serializeJson(data.settings || data.settings_json, {}),
        locale_default: data.locale_default || 'it',
        locales_json: serializeJson(data.locales || data.locales_json, ['it']),
        plan_product_id: data.plan_product_id || null,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
        published_at: data.published_at || null,
        stripe_session_id: data.stripe_session_id || null,
        deleted_at: data.deleted_at || null,
        published_snapshot_id: data.published_snapshot_id || null
      };
      insertStmt.run(row);
      return this.findById(row.id);
    },

    findById(id) {
      return mapWebsite(findByIdStmt.get(id));
    },

    findBySlug(slug) {
      return mapWebsite(findBySlugStmt.get(slug));
    },

    findByStripeSessionId(sessionId) {
      if (!sessionId) return null;
      return mapWebsite(findByStripeStmt.get(sessionId));
    },

    slugExists(slug) {
      return Boolean(findBySlugStmt.get(slug));
    },

    listByTenant(tenantId) {
      return listByTenantStmt.all(tenantId).map(mapWebsite);
    },

    countByTenant(tenantId) {
      return countByTenantStmt.get(tenantId).n;
    },

    update(id, tenantId, patch) {
      const current = this.findById(id);
      if (!current || current.tenant_id !== tenantId || current.deleted_at) return null;
      const next = {
        id,
        tenant_id: tenantId,
        name: patch.name != null ? patch.name : current.name,
        slug: patch.slug != null ? patch.slug : current.slug,
        status: patch.status != null ? patch.status : current.status,
        template_id: patch.template_id !== undefined ? patch.template_id : current.template_id,
        theme_json: serializeJson(patch.theme != null ? patch.theme : current.theme, {}),
        settings_json: serializeJson(patch.settings != null ? patch.settings : current.settings, {}),
        locale_default: patch.locale_default != null ? patch.locale_default : current.locale_default,
        locales_json: serializeJson(patch.locales != null ? patch.locales : current.locales, ['it']),
        plan_product_id:
          patch.plan_product_id !== undefined ? patch.plan_product_id : current.plan_product_id,
        published_snapshot_id:
          patch.published_snapshot_id !== undefined
            ? patch.published_snapshot_id
            : current.published_snapshot_id,
        published_at: patch.published_at !== undefined ? patch.published_at : current.published_at,
        updated_at: new Date().toISOString()
      };
      updateStmt.run(next);
      return this.findById(id);
    },

    softDelete(id, tenantId) {
      const now = new Date().toISOString();
      const info = softDeleteStmt.run(now, now, id, tenantId);
      return info.changes > 0;
    }
  };
}

module.exports = {
  createWebsitesRepository,
  mapWebsite
};
