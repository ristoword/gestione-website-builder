const { sendError, wrapAsync } = require('../utils/http-error');

function createWebsitesController(websitesService) {
  return {
    list(req, res) {
      const list = websitesService.listForTenant(req.tenantId);
      res.json({ websites: list });
    },

    getById: wrapAsync(async (req, res) => {
      const website = websitesService.getForTenant(req.params.id, req.tenantId);
      res.json({ website });
    }),

    create: wrapAsync(async (req, res) => {
      const website = websitesService.createForTenant(req.tenantId, req.body || {}, req.entitlements);
      res.status(201).json({ website });
    }),

    update: wrapAsync(async (req, res) => {
      if (req.body && Array.isArray(req.body.locales) && req.entitlements && req.entitlements.limits) {
        const cap = req.entitlements.limits.locales;
        if (typeof cap === 'number' && req.body.locales.length > cap) {
          const { HttpError } = require('../utils/http-error');
          throw new HttpError(403, 'Limite piano raggiunto', { feature: 'locales', limit: cap });
        }
      }
      const website = websitesService.updateForTenant(req.params.id, req.tenantId, req.body || {});
      res.json({ website });
    }),

    remove: wrapAsync(async (req, res) => {
      const result = websitesService.deleteForTenant(req.params.id, req.tenantId);
      res.json(result);
    })
  };
}

module.exports = { createWebsitesController, sendError };
