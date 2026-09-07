const { createWebsitesRepository } = require('../repositories/websites.repository');
const { createPagesRepository } = require('../repositories/pages.repository');
const { createSectionsRepository } = require('../repositories/sections.repository');
const { createMembersRepository } = require('../repositories/members.repository');
const { createAuditRepository } = require('../repositories/audit.repository');
const { createDomainsRepository } = require('../repositories/domains.repository');
const { assertTenant } = require('../middlewares/tenant.middleware');
const { websiteId, pageId, sectionId, domainId } = require('../ids');
const { HttpError } = require('../utils/http-error');
const { slugify, uniqueSlug } = require('../utils/slug');
const { DEFAULT_THEME, defaultSettings } = require('../config/defaults');
const { defaultSection } = require('../config/section-registry');
const { getAppUrl } = require('../config/env');

const DEFAULT_HOME_SECTIONS = ['hero', 'about', 'cta', 'contact'];

function createWebsitesService(db) {
  const repo = createWebsitesRepository(db);
  const pagesRepo = createPagesRepository(db);
  const sectionsRepo = createSectionsRepository(db);
  const membersRepo = createMembersRepository(db);
  const auditRepo = createAuditRepository(db);
  const domainsRepo = createDomainsRepository(db);

  function requireOwned(id, tenantId) {
    const row = repo.findById(id);
    const check = assertTenant(row, tenantId);
    if (!check.ok) {
      throw new HttpError(check.status, check.error);
    }
    if (row.deleted_at) {
      throw new HttpError(403, 'Accesso negato');
    }
    return row;
  }

  function seedHomePage(website, tenantId) {
    const home = pagesRepo.insert({
      id: pageId(),
      website_id: website.id,
      tenant_id: tenantId,
      slug: 'home',
      type: 'home',
      is_home: true,
      sort_order: 0,
      title: 'Home',
      seo: { title: website.name, description: '' }
    });
    DEFAULT_HOME_SECTIONS.forEach((type, index) => {
      const seed = defaultSection(type, sectionId());
      sectionsRepo.insert({
        id: seed.id,
        page_id: home.id,
        website_id: website.id,
        tenant_id: tenantId,
        type: seed.type,
        sort_order: index,
        content: seed.content,
        design: seed.design,
        layout: seed.layout,
        settings: seed.settings
      });
    });
    return home;
  }

  function withPublicUrl(website) {
    if (!website) return website;
    const root = process.env.SITES_ROOT_DOMAIN || 'sites.gestionesemplificata.com';
    return {
      ...website,
      defaultHost: `${website.slug}.${root}`,
      editorUrl: `${getAppUrl()}/builder/${website.id}`,
      previewPath: `/builder/${website.id}/preview`
    };
  }

  return {
    repo,
    pagesRepo,
    sectionsRepo,

    listForTenant(tenantId) {
      return repo.listByTenant(tenantId).map(withPublicUrl);
    },

    getForTenant(id, tenantId) {
      const website = withPublicUrl(requireOwned(id, tenantId));
      const pages = pagesRepo.listByWebsite(tenantId, id);
      return { ...website, pages };
    },

    createForTenant(tenantId, input, entitlements) {
      if (!entitlements || !entitlements.productId) {
        throw new HttpError(403, 'Piano Sito Web non attivo', { feature: 'websites' });
      }
      const usage = repo.countByTenant(tenantId);
      const limit = entitlements.limits && entitlements.limits.websites;
      if (typeof limit === 'number' && usage >= limit) {
        throw new HttpError(403, 'Limite piano raggiunto', {
          feature: 'websites',
          limit,
          usage,
          planKey: entitlements.planKey
        });
      }

      const name = String((input && input.name) || '').trim() || 'Il mio sito';
      const requested = (input && input.slug) || name;
      const slug = uniqueSlug(requested, (s) => repo.slugExists(s));

      const website = repo.insert({
        id: websiteId(),
        tenant_id: tenantId,
        name,
        slug,
        status: 'draft',
        theme: (input && input.theme) || DEFAULT_THEME,
        settings: { ...defaultSettings(name), ...((input && input.settings) || {}) },
        locale_default: (input && input.locale_default) || 'it',
        locales: (input && input.locales) || ['it'],
        plan_product_id: entitlements.productId,
        stripe_session_id: (input && input.stripe_session_id) || null,
        template_id: (input && input.template_id) || null
      });

      membersRepo.upsert(website.id, tenantId, 'owner');
      seedHomePage(website, tenantId);

      const root = process.env.SITES_ROOT_DOMAIN || 'sites.gestionesemplificata.com';
      try {
        domainsRepo.insert({
          id: domainId(),
          website_id: website.id,
          tenant_id: tenantId,
          host: `${website.slug}.${root}`,
          type: 'subdomain',
          status: 'pending_dns'
        });
      } catch (_) {
        // subdomain host uniqueness: ignore if already present
      }

      auditRepo.log({
        tenantId,
        websiteId: website.id,
        action: 'website.create',
        payload: { name, slug }
      });

      return this.getForTenant(website.id, tenantId);
    },

    updateForTenant(id, tenantId, patch) {
      requireOwned(id, tenantId);
      const forbidden = ['tenant_id', 'tenantId', 'id', 'stripe_session_id'];
      const clean = { ...(patch || {}) };
      forbidden.forEach((k) => delete clean[k]);
      if (clean.slug) {
        const next = slugify(clean.slug);
        const existing = repo.findBySlug(next);
        if (existing && existing.id !== id) {
          throw new HttpError(409, 'Slug già in uso');
        }
        clean.slug = next;
      }
      const updated = repo.update(id, tenantId, clean);
      if (!updated) throw new HttpError(404, 'Risorsa non trovata');
      auditRepo.log({
        tenantId,
        websiteId: id,
        action: 'website.update',
        payload: { fields: Object.keys(clean) }
      });
      return this.getForTenant(id, tenantId);
    },

    deleteForTenant(id, tenantId) {
      requireOwned(id, tenantId);
      const ok = repo.softDelete(id, tenantId);
      if (!ok) throw new HttpError(404, 'Risorsa non trovata');
      auditRepo.log({ tenantId, websiteId: id, action: 'website.delete', payload: {} });
      return { deleted: true, id };
    }
  };
}

module.exports = { createWebsitesService, DEFAULT_HOME_SECTIONS };
