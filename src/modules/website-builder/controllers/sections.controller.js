const { wrapAsync } = require('../utils/http-error');

function createSectionsController(sectionsService) {
  return {
    list: wrapAsync(async (req, res) => {
      const sections = sectionsService.list(req.tenantId, req.website.id, req.params.pageId);
      res.json({ sections });
    }),
    create: wrapAsync(async (req, res) => {
      const section = sectionsService.create(
        req.tenantId,
        req.website,
        req.params.pageId,
        req.body || {}
      );
      res.status(201).json({ section });
    }),
    update: wrapAsync(async (req, res) => {
      const section = sectionsService.update(
        req.tenantId,
        req.website.id,
        req.params.pageId,
        req.params.sectionId,
        req.body || {}
      );
      res.json({ section });
    }),
    remove: wrapAsync(async (req, res) => {
      const result = sectionsService.remove(
        req.tenantId,
        req.website.id,
        req.params.pageId,
        req.params.sectionId
      );
      res.json(result);
    }),
    reorder: wrapAsync(async (req, res) => {
      const ids = (req.body && (req.body.orderedIds || req.body.sectionIds || req.body.sections)) || [];
      const orderedIds = ids.map((item) => (typeof item === 'string' ? item : item.id)).filter(Boolean);
      const sections = sectionsService.reorder(
        req.tenantId,
        req.website.id,
        req.params.pageId,
        orderedIds
      );
      res.json({ sections });
    })
  };
}

module.exports = { createSectionsController };
