const { parseJson, serializeJson } = require('../utils/json');

function mapSection(row) {
  if (!row) return null;
  return {
    id: row.id,
    page_id: row.page_id,
    website_id: row.website_id,
    tenant_id: row.tenant_id,
    type: row.type,
    sort_order: row.sort_order,
    content: parseJson(row.content_json, {}),
    design: parseJson(row.design_json, {}),
    layout: parseJson(row.layout_json, {}),
    settings: parseJson(row.settings_json, {}),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function createSectionsRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO sections (
      id, page_id, website_id, tenant_id, type, sort_order,
      content_json, design_json, layout_json, settings_json, created_at, updated_at
    ) VALUES (
      @id, @page_id, @website_id, @tenant_id, @type, @sort_order,
      @content_json, @design_json, @layout_json, @settings_json, @created_at, @updated_at
    )
  `);
  const findStmt = db.prepare('SELECT * FROM sections WHERE id = ?');
  const listStmt = db.prepare(
    'SELECT * FROM sections WHERE tenant_id = ? AND page_id = ? ORDER BY sort_order ASC'
  );
  const maxOrderStmt = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS n FROM sections WHERE tenant_id = ? AND page_id = ?'
  );
  const updateStmt = db.prepare(`
    UPDATE sections SET
      type = @type,
      sort_order = @sort_order,
      content_json = @content_json,
      design_json = @design_json,
      layout_json = @layout_json,
      settings_json = @settings_json,
      updated_at = @updated_at
    WHERE id = @id AND tenant_id = @tenant_id
  `);
  const deleteStmt = db.prepare('DELETE FROM sections WHERE id = ? AND tenant_id = ?');
  const reorderStmt = db.prepare(
    'UPDATE sections SET sort_order = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND page_id = ?'
  );

  return {
    insert(data) {
      const now = new Date().toISOString();
      insertStmt.run({
        id: data.id,
        page_id: data.page_id,
        website_id: data.website_id,
        tenant_id: data.tenant_id,
        type: data.type,
        sort_order: data.sort_order || 0,
        content_json: serializeJson(data.content || {}, {}),
        design_json: serializeJson(data.design || {}, {}),
        layout_json: serializeJson(data.layout || {}, {}),
        settings_json: serializeJson(data.settings || {}, {}),
        created_at: data.created_at || now,
        updated_at: data.updated_at || now
      });
      return this.findByIdForTenant(data.tenant_id, data.id);
    },
    findById(id) {
      return findStmt.get(id) || null;
    },
    findByIdForTenant(tenantId, id) {
      const row = findStmt.get(id);
      if (!row || row.tenant_id !== tenantId) return null;
      return mapSection(row);
    },
    listByPage(tenantId, pageId) {
      return listStmt.all(tenantId, pageId).map(mapSection);
    },
    nextSortOrder(tenantId, pageId) {
      return maxOrderStmt.get(tenantId, pageId).n + 1;
    },
    update(tenantId, id, patch) {
      const current = this.findByIdForTenant(tenantId, id);
      if (!current) return null;
      updateStmt.run({
        id,
        tenant_id: tenantId,
        type: patch.type != null ? patch.type : current.type,
        sort_order: patch.sort_order != null ? patch.sort_order : current.sort_order,
        content_json: serializeJson(patch.content != null ? patch.content : current.content, {}),
        design_json: serializeJson(patch.design != null ? patch.design : current.design, {}),
        layout_json: serializeJson(patch.layout != null ? patch.layout : current.layout, {}),
        settings_json: serializeJson(patch.settings != null ? patch.settings : current.settings, {}),
        updated_at: new Date().toISOString()
      });
      return this.findByIdForTenant(tenantId, id);
    },
    remove(tenantId, id) {
      const info = deleteStmt.run(id, tenantId);
      return info.changes > 0;
    },
    reorder(tenantId, pageId, orderedIds) {
      const now = new Date().toISOString();
      const run = db.transaction(() => {
        orderedIds.forEach((id, index) => {
          reorderStmt.run(index, now, id, tenantId, pageId);
        });
      });
      run();
      return this.listByPage(tenantId, pageId);
    }
  };
}

module.exports = { createSectionsRepository, mapSection };
