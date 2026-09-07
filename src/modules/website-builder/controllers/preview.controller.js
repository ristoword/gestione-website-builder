const { wrapAsync } = require('../utils/http-error');
const { renderDocument } = require('../renderer/render-site');
const { createPagesService } = require('../services/pages.service');
const { createSectionsService } = require('../services/sections.service');

function createPreviewController(db) {
  const pagesService = createPagesService(db);
  const sectionsService = createSectionsService(db);

  return {
    pagePreview: wrapAsync(async (req, res) => {
      const page = pagesService.get(req.tenantId, req.website.id, req.params.pageId);
      const html = renderDocument({
        website: req.website,
        page,
        sections: page.sections,
        locale: req.website.locale_default || 'it',
        interactive: req.query.interactive === '1',
        selectedId: req.query.selected || null,
        viewport: req.query.viewport || 'desktop'
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.send(html);
    }),

    livePreview: wrapAsync(async (req, res) => {
      const pageId = (req.body && req.body.pageId) || req.params.pageId;
      const page = pagesService.get(req.tenantId, req.website.id, pageId);
      const sections = Array.isArray(req.body && req.body.sections)
        ? req.body.sections
        : sectionsService.list(req.tenantId, req.website.id, pageId);
      const html = renderDocument({
        website: { ...req.website, theme: (req.body && req.body.theme) || req.website.theme },
        page: { ...page, ...(req.body && req.body.page) },
        sections,
        locale: req.website.locale_default || 'it',
        interactive: true,
        selectedId: req.body && req.body.selectedId,
        viewport: (req.body && req.body.viewport) || 'desktop'
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.send(html);
    })
  };
}

module.exports = { createPreviewController };
