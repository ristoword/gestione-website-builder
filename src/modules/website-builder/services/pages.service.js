const { createPagesRepository } = require('../repositories/pages.repository');
const { createSectionsRepository } = require('../repositories/sections.repository');
const { pageId } = require('../ids');
const { HttpError } = require('../utils/http-error');
const { slugify } = require('../utils/slug');

const PAGE_TYPES = new Set(['home', 'page', 'blog_index', 'blog_post']);

function createPagesService(db) {
  const repo = createPagesRepository(db);
  const sectionsRepo = createSectionsRepository(db);

  return {
    repo,

    list(tenantId, websiteId) {
      return repo.listByWebsite(tenantId, websiteId);
    },

    get(tenantId, websiteId, pageIdValue) {
      const page = repo.findByIdForTenant(tenantId, pageIdValue);
      if (!page || page.website_id !== websiteId) {
        throw new HttpError(404, 'Pagina non trovata');
      }
      const sections = sectionsRepo.listByPage(tenantId, page.id);
      return { ...page, sections };
    },

    create(tenantId, website, input, entitlements) {
      const usage = repo.countByWebsite(tenantId, website.id);
      const limit = entitlements && entitlements.limits && entitlements.limits.pages;
      if (typeof limit === 'number' && usage >= limit) {
        throw new HttpError(403, 'Limite piano raggiunto', {
          feature: 'pages',
          limit,
          usage,
          planKey: entitlements.planKey
        });
      }

      const title = String((input && input.title) || '').trim() || 'Nuova pagina';
      const slug = slugify((input && input.slug) || title, 'pagina');
      if (repo.findBySlug(website.id, slug)) {
        throw new HttpError(409, 'Percorso pagina già in uso');
      }
      const type = (input && input.type) || 'page';
      if (!PAGE_TYPES.has(type)) {
        throw new HttpError(400, 'Tipo di pagina non valido');
      }

      return repo.insert({
        id: pageId(),
        website_id: website.id,
        tenant_id: tenantId,
        slug,
        type,
        is_home: Boolean(input && input.is_home),
        sort_order: input && input.sort_order != null ? input.sort_order : usage,
        title,
        seo: (input && input.seo) || {},
        visibility: (input && input.visibility) || {}
      });
    },

    update(tenantId, websiteId, pageIdValue, patch) {
      const current = repo.findByIdForTenant(tenantId, pageIdValue);
      if (!current || current.website_id !== websiteId) {
        throw new HttpError(404, 'Pagina non trovata');
      }
      if (patch && patch.slug && patch.slug !== current.slug) {
        const next = slugify(patch.slug, 'pagina');
        const clash = repo.findBySlug(websiteId, next);
        if (clash && clash.id !== pageIdValue) {
          throw new HttpError(409, 'Percorso pagina già in uso');
        }
        patch.slug = next;
      }
      const updated = repo.update(tenantId, pageIdValue, patch || {});
      if (!updated) throw new HttpError(404, 'Pagina non trovata');
      return updated;
    },

    remove(tenantId, websiteId, pageIdValue) {
      const current = repo.findByIdForTenant(tenantId, pageIdValue);
      if (!current || current.website_id !== websiteId) {
        throw new HttpError(404, 'Pagina non trovata');
      }
      if (current.is_home) {
        throw new HttpError(400, 'La pagina Home non può essere eliminata');
      }
      repo.remove(tenantId, pageIdValue);
      return { deleted: true, id: pageIdValue };
    }
  };
}

module.exports = { createPagesService };
