const { auditId } = require('../ids');
const { serializeJson } = require('../utils/json');

function createAuditRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO audit_events (id, tenant_id, website_id, action, payload_json, created_by, created_at)
    VALUES (@id, @tenant_id, @website_id, @action, @payload_json, @created_by, @created_at)
  `);

  return {
    log({ tenantId, websiteId, action, payload, createdBy }) {
      insertStmt.run({
        id: auditId(),
        tenant_id: tenantId,
        website_id: websiteId || null,
        action,
        payload_json: serializeJson(payload || {}, {}),
        created_by: createdBy || tenantId,
        created_at: new Date().toISOString()
      });
    }
  };
}

module.exports = { createAuditRepository };
