/**
 * Tenant isolation: tenantId is ALWAYS the GS session user.id.
 * Body/query/header tenantId is ignored (never trusted).
 */

function assignTenant(req, res, next) {
  const user = req.session && req.session.user;
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }
  req.tenantId = user.id;
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'tenantId')) {
    delete req.body.tenantId;
  }
  next();
}

function assertTenant(row, tenantId) {
  if (!row) return { ok: false, status: 404, error: 'Risorsa non trovata' };
  if (row.tenant_id !== tenantId) {
    return { ok: false, status: 403, error: 'Accesso negato' };
  }
  return { ok: true };
}

/**
 * Load a website by :id and refuse cross-tenant access with 403.
 */
function loadWebsiteTenant(websitesRepo) {
  return function loadWebsiteTenantMw(req, res, next) {
    const id = req.params.id || req.params.websiteId;
    if (!id) {
      return res.status(400).json({ error: 'Identificativo del sito obbligatorio' });
    }
    const row = websitesRepo.findById(id);
    const check = assertTenant(row, req.tenantId);
    if (!check.ok) {
      return res.status(check.status).json({ error: check.error });
    }
    if (row.deleted_at) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    req.website = row;
    next();
  };
}

module.exports = {
  assignTenant,
  assertTenant,
  loadWebsiteTenant
};
