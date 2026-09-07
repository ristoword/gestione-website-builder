/**
 * Website Builder HTTP router.
 * Auth = GS session. tenantId is assigned from session, never from the client.
 */

const express = require('express');
const { requireCustomerAuth } = require('../../middlewares/auth.middleware');
const { assignTenant, loadWebsiteTenant } = require('./middlewares/tenant.middleware');
const { attachEntitlements } = require('./middlewares/plan.middleware');
const { createWebsitesService } = require('./services/websites.service');
const { createPagesService } = require('./services/pages.service');
const { createSectionsService } = require('./services/sections.service');
const { createWebsitesController } = require('./controllers/websites.controller');
const { createPagesController } = require('./controllers/pages.controller');
const { createSectionsController } = require('./controllers/sections.controller');
const { createHealthController } = require('./controllers/health.controller');
const { resolveEntitlements } = require('./services/entitlements.service');
const { createPreviewController } = require('./controllers/preview.controller');
const { createNavigationRepository } = require('./repositories/navigation.repository');
const { createTemplatesService } = require('./services/templates.service');
const { createMediaService } = require('./services/media.service');
const { createPublishingService } = require('./services/publishing.service');
const { createDomainsService, sitemapXml, robotsTxt } = require('./services/domains.service');
const { createAiService } = require('./services/ai.service');
const { fetchConnectedData } = require('./integrations/ristosimply.client');
const { wrapAsync, sendError } = require('./utils/http-error');
const { listSectionTypes, getSectionMeta } = require('./config/section-registry');

function memoryUpload() {
  try {
    const multer = require('multer');
    return multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }).single('file');
  } catch (_) {
    return (_req, _res, next) => next();
  }
}

function createRouter({ db }) {
  const router = express.Router();
  const websitesService = createWebsitesService(db);
  const pagesService = createPagesService(db);
  const sectionsService = createSectionsService(db);
  const websitesController = createWebsitesController(websitesService);
  const pagesController = createPagesController(pagesService);
  const sectionsController = createSectionsController(sectionsService);
  const healthController = createHealthController(db);
  const previewController = createPreviewController(db);
  const navRepo = createNavigationRepository(db);
  const templatesService = createTemplatesService(db);
  const mediaService = createMediaService(db);
  const publishingService = createPublishingService(db, websitesService.repo);
  const domainsService = createDomainsService(db);
  const aiService = createAiService(db);
  const upload = memoryUpload();

  router.get('/health', healthController.health);
  router.get('/status', healthController.status);

  const authTenant = [requireCustomerAuth, assignTenant, attachEntitlements];
  const ownedSite = [...authTenant, loadWebsiteTenant(websitesService.repo)];

  router.get('/templates', ...authTenant, (_req, res) => {
    res.json({ templates: templatesService.list() });
  });

  router.post('/websites/:id/apply-template', ...ownedSite, wrapAsync(async (req, res) => {
    const website = templatesService.apply(req.tenantId, req.website, req.body && req.body.templateId, {
      confirm: Boolean(req.body && req.body.confirm),
      entitlements: req.entitlements,
      websitesService
    });
    res.json({ website });
  }));

  router.get('/entitlements', ...authTenant, (req, res) => {
    res.json(req.entitlements || resolveEntitlements(req.session && req.session.user));
  });

  router.get('/sections', ...authTenant, (_req, res) => {
    res.json({ sections: listSectionTypes().map(getSectionMeta) });
  });

  router.get('/websites', ...authTenant, websitesController.list);
  router.post('/websites', ...authTenant, websitesController.create);
  router.get('/websites/:id', ...ownedSite, websitesController.getById);
  router.patch('/websites/:id', ...ownedSite, websitesController.update);
  router.delete('/websites/:id', ...ownedSite, websitesController.remove);

  router.get('/websites/:id/pages', ...ownedSite, pagesController.list);
  router.post('/websites/:id/pages', ...ownedSite, pagesController.create);
  router.get('/websites/:id/pages/:pageId', ...ownedSite, pagesController.getById);
  router.patch('/websites/:id/pages/:pageId', ...ownedSite, pagesController.update);
  router.delete('/websites/:id/pages/:pageId', ...ownedSite, pagesController.remove);

  router.get('/websites/:id/pages/:pageId/sections', ...ownedSite, sectionsController.list);
  router.post('/websites/:id/pages/:pageId/sections', ...ownedSite, sectionsController.create);
  router.put('/websites/:id/pages/:pageId/sections', ...ownedSite, sectionsController.reorder);
  router.patch(
    '/websites/:id/pages/:pageId/sections/:sectionId',
    ...ownedSite,
    sectionsController.update
  );
  router.delete(
    '/websites/:id/pages/:pageId/sections/:sectionId',
    ...ownedSite,
    sectionsController.remove
  );

  router.get('/websites/:id/pages/:pageId/preview', ...ownedSite, previewController.pagePreview);
  router.post('/websites/:id/preview', ...ownedSite, previewController.livePreview);

  router.get('/websites/:id/navigation', ...ownedSite, (req, res) => {
    res.json({ navigation: navRepo.list(req.tenantId, req.website.id) });
  });
  router.put('/websites/:id/navigation', ...ownedSite, (req, res) => {
    const location = (req.body && req.body.location) || 'header';
    if (!['header', 'footer', 'legal'].includes(location)) {
      return res.status(400).json({ error: 'Posizione menu non valida' });
    }
    const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
    const safeItems = items.slice(0, 30).map((item) => ({
      label: String((item && item.label) || '').slice(0, 80),
      href: String((item && item.href) || '').slice(0, 300),
      pageId: item && item.pageId ? String(item.pageId) : null
    }));
    const row = navRepo.upsert({
      tenant_id: req.tenantId,
      website_id: req.website.id,
      location,
      items: safeItems,
      locale: (req.body && req.body.locale) || 'it'
    });
    res.json({ navigation: row });
  });

  router.get('/websites/:id/media', ...ownedSite, (req, res) => {
    const items = mediaService.list(req.tenantId, { websiteId: req.website.id, q: req.query.q });
    res.json({ media: items });
  });
  router.post('/websites/:id/media', ...ownedSite, upload, wrapAsync(async (req, res) => {
    let file = req.file;
    if (!file && req.body && req.body.contentBase64) {
      file = {
        buffer: Buffer.from(req.body.contentBase64, 'base64'),
        originalname: req.body.filename || 'upload.bin',
        mimetype: req.body.mime || 'application/octet-stream'
      };
    }
    const item = mediaService.upload(req.tenantId, req.website.id, file, req.entitlements);
    res.status(201).json({ media: item });
  }));
  router.get('/websites/:id/media/:mediaId/file', ...ownedSite, wrapAsync(async (req, res) => {
    const { row, dest } = mediaService.filePath(req.tenantId, req.params.mediaId);
    res.setHeader('Content-Type', row.mime);
    res.setHeader('X-Robots-Tag', 'noindex');
    res.sendFile(dest);
  }));
  router.delete('/websites/:id/media/:mediaId', ...ownedSite, wrapAsync(async (req, res) => {
    res.json(mediaService.remove(req.tenantId, req.params.mediaId));
  }));

  router.post('/websites/:id/publish', ...ownedSite, wrapAsync(async (req, res) => {
    const result = publishingService.publish(
      req.tenantId,
      req.website,
      req.tenantId,
      req.body && req.body.note
    );
    res.json(result);
  }));
  router.post('/websites/:id/unpublish', ...ownedSite, wrapAsync(async (req, res) => {
    res.json(publishingService.unpublish(req.tenantId, req.website));
  }));
  router.get('/websites/:id/versions', ...ownedSite, (req, res) => {
    res.json({ versions: publishingService.list(req.tenantId, req.website.id) });
  });
  router.post('/websites/:id/versions/:versionId/rollback', ...ownedSite, wrapAsync(async (req, res) => {
    res.json(publishingService.rollback(req.tenantId, req.website, req.params.versionId));
  }));

  router.get('/websites/:id/domains', ...ownedSite, (req, res) => {
    res.json({ domains: domainsService.list(req.tenantId, req.website.id) });
  });
  router.post('/websites/:id/domains', ...ownedSite, wrapAsync(async (req, res) => {
    const row = domainsService.add(req.tenantId, req.website, req.body || {}, req.entitlements);
    res.status(201).json({ domain: row });
  }));
  router.post('/websites/:id/domains/:domainId/verify', ...ownedSite, wrapAsync(async (req, res) => {
    const row = await domainsService.verify(
      req.tenantId,
      req.website.id,
      req.params.domainId,
      req.body && req.body.token
    );
    res.json({ domain: row });
  }));

  router.get('/websites/:id/seo/sitemap.xml', ...ownedSite, (req, res) => {
    const pages = pagesService.list(req.tenantId, req.website.id);
    res.type('application/xml').send(sitemapXml(req.website, pages));
  });
  router.get('/websites/:id/seo/robots.txt', ...ownedSite, (req, res) => {
    res.type('text/plain').send(robotsTxt(req.website));
  });

  router.post('/websites/:id/ai/generate', ...ownedSite, wrapAsync(async (req, res) => {
    const job = aiService.generate(
      req.tenantId,
      req.website.id,
      req.body && req.body.prompt,
      req.entitlements,
      req.website.locale_default
    );
    res.status(201).json({ job });
  }));
  router.post('/websites/:id/ai/jobs/:jobId/apply', ...ownedSite, wrapAsync(async (req, res) => {
    const pageId = (req.body && req.body.pageId) || (req.website.pages && req.website.pages[0] && req.website.pages[0].id);
    const home = pagesService.list(req.tenantId, req.website.id).find((p) => p.is_home);
    const job = aiService.apply(
      req.tenantId,
      req.params.jobId,
      sectionsService,
      req.website,
      pageId || (home && home.id)
    );
    res.json({ job });
  }));

  router.get('/websites/:id/ristosimply', ...ownedSite, wrapAsync(async (req, res) => {
    const data = await fetchConnectedData({
      tenantId: req.tenantId,
      email: req.session.user && req.session.user.email
    });
    res.json({ ristosimply: data });
  }));

  router.use((err, req, res, _next) => sendError(res, err));

  return router;
}

module.exports = { createRouter };
