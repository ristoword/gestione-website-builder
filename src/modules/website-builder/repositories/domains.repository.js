function createDomainsRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO domains (
      id, website_id, tenant_id, host, type, verification_token, status,
      dns_instructions_json, ssl_status, verified_at
    ) VALUES (
      @id, @website_id, @tenant_id, @host, @type, @verification_token, @status,
      @dns_instructions_json, @ssl_status, @verified_at
    )
  `);
  const findStmt = db.prepare('SELECT * FROM domains WHERE id = ?');
  const findByHostStmt = db.prepare('SELECT * FROM domains WHERE host = ?');
  const listStmt = db.prepare(
    'SELECT * FROM domains WHERE tenant_id = ? AND website_id = ?'
  );

  return {
    insert(data) {
      insertStmt.run({
        id: data.id,
        website_id: data.website_id,
        tenant_id: data.tenant_id,
        host: data.host,
        type: data.type,
        verification_token: data.verification_token || null,
        status: data.status || 'pending_dns',
        dns_instructions_json: JSON.stringify(data.dns_instructions || {}),
        ssl_status: data.ssl_status || null,
        verified_at: data.verified_at || null
      });
      return findStmt.get(data.id);
    },
    findById(id) {
      return findStmt.get(id) || null;
    },
    findByHost(host) {
      return findByHostStmt.get(host) || null;
    },
    listByWebsite(tenantId, websiteId) {
      return listStmt.all(tenantId, websiteId);
    }
  };
}

module.exports = { createDomainsRepository };
