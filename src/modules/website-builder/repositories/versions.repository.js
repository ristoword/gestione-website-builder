function createVersionsRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO versions (
      id, website_id, tenant_id, kind, snapshot_json, note, created_by, created_at
    ) VALUES (
      @id, @website_id, @tenant_id, @kind, @snapshot_json, @note, @created_by, @created_at
    )
  `);
  const findStmt = db.prepare('SELECT * FROM versions WHERE id = ?');
  const listStmt = db.prepare(
    'SELECT * FROM versions WHERE tenant_id = ? AND website_id = ? ORDER BY created_at DESC'
  );

  return {
    insert(data) {
      insertStmt.run({
        id: data.id,
        website_id: data.website_id,
        tenant_id: data.tenant_id,
        kind: data.kind,
        snapshot_json: JSON.stringify(data.snapshot || {}),
        note: data.note || null,
        created_by: data.created_by || null,
        created_at: data.created_at || new Date().toISOString()
      });
      return findStmt.get(data.id);
    },
    findById(id) {
      return findStmt.get(id) || null;
    },
    listByWebsite(tenantId, websiteId) {
      return listStmt.all(tenantId, websiteId);
    }
  };
}

module.exports = { createVersionsRepository };
