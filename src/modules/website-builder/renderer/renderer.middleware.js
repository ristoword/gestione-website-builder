/**
 * Host-based public renderer. GS hosts always fall through (next).
 * Reads published snapshots only.
 */

const { createWebsitesRepository } = require('../repositories/websites.repository');
const { createDomainsRepository } = require('../repositories/domains.repository');
const { createPublishingService } = require('../services/publishing.service');

const GS_HOSTS = new Set([
  'gestionesemplificata.com',
  'www.gestionesemplificata.com',
  'localhost',
  '127.0.0.1'
]);

function createPublicRenderer(db) {
  const websites = createWebsitesRepository(db);
  const domains = createDomainsRepository(db);
  const publishing = createPublishingService(db, websites);
  const root = (process.env.SITES_ROOT_DOMAIN || 'sites.gestionesemplificata.com').toLowerCase();

  return function websitePublicRenderer(req, res, next) {
    const host = String(req.hostname || req.headers.host || '')
      .split(':')[0]
      .toLowerCase();
    if (!host || GS_HOSTS.has(host) || host.endsWith('.railway.app')) return next();
    if (host.startsWith('www.gestionesemplificata.') || host.includes('gestionesemplificata.com')) {
      return next();
    }

    let website = null;
    const domain = domains.findByHost(host);
    if (domain && (domain.status === 'verified' || domain.type === 'subdomain')) {
      website = websites.findById(domain.website_id);
    }
    if (!website && host.endsWith('.' + root)) {
      const slug = host.slice(0, -(root.length + 1));
      website = websites.findBySlug(slug);
    }
    if (!website || website.deleted_at) return next();
    if (website.status !== 'published') {
      res.set('X-Robots-Tag', 'noindex');
      return res.status(404).send('Pagina non trovata');
    }
    if (req.path === '/sitemap.xml') {
      const snap = publishing.list(website.tenant_id, website.id)[0];
      res.type('application/xml');
      return res.send(require('../services/domains.service').sitemapXml(website, (snap && snap.snapshot && snap.snapshot.pages) || []));
    }
    if (req.path === '/robots.txt') {
      res.type('text/plain');
      return res.send(require('../services/domains.service').robotsTxt(website));
    }
    const html = publishing.renderPublished(website, req.path || '/');
    if (!html) return res.status(404).send('Pagina non trovata');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  };
}

module.exports = { createPublicRenderer };
