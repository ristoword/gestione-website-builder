const { wrapAsync } = require('../utils/http-error');

function createPagesController(pagesService) {
  return {
    list: wrapAsync(async (req, res) => {
      const pages = pagesService.list(req.tenantId, req.website.id);
      res.json({ pages });
    }),
    getById: wrapAsync(async (req, res) => {
      const page = pagesService.get(req.tenantId, req.website.id, req.params.pageId);
      res.json({ page });
    }),
    create: wrapAsync(async (req, res) => {
      const page = pagesService.create(req.tenantId, req.website, req.body || {}, req.entitlements);
      res.status(201).json({ page });
    }),
    update: wrapAsync(async (req, res) => {
      const page = pagesService.update(req.tenantId, req.website.id, req.params.pageId, req.body || {});
      res.json({ page });
    }),
    remove: wrapAsync(async (req, res) => {
      const result = pagesService.remove(req.tenantId, req.website.id, req.params.pageId);
      res.json(result);
    })
  };
}

module.exports = { createPagesController };
