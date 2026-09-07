const { parseJson } = require('../utils/json');

function mapMedia(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    website_id: row.website_id,
    filename: row.filename,
    storage_key: row.storage_key,
    mime: row.mime,
    size_bytes: row.size_bytes,
    width: row.width,
    height: row.height,
    alt: parseJson(row.alt_json, {}),
    category: row.category,
    checksum: row.checksum,
    created_at: row.created_at
  };
}

function createMediaRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO media_assets (
      id, tenant_id, website_id, filename, storage_key, mime, size_bytes,
      width, height, alt_json, category, checksum, variants_json, created_at
    ) VALUES (
      @id, @tenant_id, @website_id, @filename, @storage_key, @mime, @size_bytes,
      @width, @height, @alt_json, @category, @checksum, @variants_json, @created_at
    )
  `);
  const findStmt = db.prepare('SELECT * FROM media_assets WHERE id = ?');
  const listStmt = db.prepare(
    'SELECT * FROM media_assets WHERE tenant_id = ? ORDER BY created_at DESC'
  );
  const listByWebsiteStmt = db.prepare(
    `SELECT * FROM media_assets WHERE tenant_id = ? AND (website_id = ? OR website_id IS NULL) ORDER BY created_at DESC`
  );
  const searchStmt = db.prepare(
    `SELECT * FROM media_assets WHERE tenant_id = ? AND filename LIKE ? ORDER BY created_at DESC`
  );
  const deleteStmt = db.prepare('DELETE FROM media_assets WHERE id = ? AND tenant_id = ?');
  const sumStmt = db.prepare(
    'SELECT COALESCE(SUM(size_bytes), 0) AS n FROM media_assets WHERE tenant_id = ?'
  );

  return {
    insert(data) {
      insertStmt.run({
        id: data.id,
        tenant_id: data.tenant_id,
        website_id: data.website_id || null,
        filename: data.filename,
        storage_key: data.storage_key,
        mime: data.mime,
        size_bytes: data.size_bytes || 0,
        width: data.width || null,
        height: data.height || null,
        alt_json: JSON.stringify(data.alt || {}),
        category: data.category || null,
        checksum: data.checksum || null,
        variants_json: JSON.stringify(data.variants || []),
        created_at: data.created_at || new Date().toISOString()
      });
      return this.findByIdForTenant(data.tenant_id, data.id);
    },
    findById(id) {
      return findStmt.get(id) || null;
    },
    findByIdForTenant(tenantId, id) {
      const row = findStmt.get(id);
      if (!row || row.tenant_id !== tenantId) return null;
      return mapMedia(row);
    },
    listByTenant(tenantId) {
      return listStmt.all(tenantId).map(mapMedia);
    },
    listByWebsite(tenantId, websiteId) {
      return listByWebsiteStmt.all(tenantId, websiteId).map(mapMedia);
    },
    search(tenantId, q) {
      const like = `%${String(q || '').replace(/%/g, '')}%`;
      return searchStmt.all(tenantId, like).map(mapMedia);
    },
    remove(tenantId, id) {
      const info = deleteStmt.run(id, tenantId);
      return info.changes > 0;
    },
    sumBytes(tenantId) {
      return sumStmt.get(tenantId).n;
    }
  };
}

module.exports = { createMediaRepository, mapMedia };
