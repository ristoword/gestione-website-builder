const { parseJson, serializeJson } = require('../utils/json');
const { navId } = require('../ids');

function mapNav(row) {
  if (!row) return null;
  return {
    id: row.id,
    website_id: row.website_id,
    tenant_id: row.tenant_id,
    location: row.location,
    locale: row.locale,
    items: parseJson(row.items_json, [])
  };
}

function createNavigationRepository(db) {
  const upsertStmt = db.prepare(`
    INSERT INTO navigation (id, website_id, tenant_id, location, items_json, locale)
    VALUES (@id, @website_id, @tenant_id, @location, @items_json, @locale)
    ON CONFLICT(id) DO UPDATE SET items_json = excluded.items_json, locale = excluded.locale
  `);
  const findStmt = db.prepare(
    'SELECT * FROM navigation WHERE tenant_id = ? AND website_id = ? AND location = ? AND locale = ?'
  );
  const listStmt = db.prepare(
    'SELECT * FROM navigation WHERE tenant_id = ? AND website_id = ?'
  );

  return {
    list(tenantId, websiteId) {
      return listStmt.all(tenantId, websiteId).map(mapNav);
    },
    upsert(data) {
      const existing = findStmt.get(data.tenant_id, data.website_id, data.location, data.locale || 'it');
      const id = (existing && existing.id) || data.id || navId();
      if (existing) {
        db.prepare('UPDATE navigation SET items_json = ? WHERE id = ? AND tenant_id = ?').run(
          serializeJson(data.items || [], []),
          existing.id,
          data.tenant_id
        );
        return mapNav(findStmt.get(data.tenant_id, data.website_id, data.location, data.locale || 'it'));
      }
      upsertStmt.run({
        id,
        website_id: data.website_id,
        tenant_id: data.tenant_id,
        location: data.location,
        items_json: serializeJson(data.items || [], []),
        locale: data.locale || 'it'
      });
      return mapNav(findStmt.get(data.tenant_id, data.website_id, data.location, data.locale || 'it'));
    }
  };
}

module.exports = { createNavigationRepository };
