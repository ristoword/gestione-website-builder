const { createTemplatesRepository } = require('../repositories/templates.repository');
const { createPagesRepository } = require('../repositories/pages.repository');
const { createSectionsRepository } = require('../repositories/sections.repository');
const { pageId, sectionId } = require('../ids');
const { HttpError } = require('../utils/http-error');
const { defaultSection } = require('../config/section-registry');
const { PLAN_RANK } = require('../config/plans.config');

function createTemplatesService(db) {
  const repo = createTemplatesRepository(db);
  const pagesRepo = createPagesRepository(db);
  const sectionsRepo = createSectionsRepository(db);
  repo.seed();

  return {
    repo,
    list() {
      return repo.list().map((t) => ({
        id: t.id,
        slug: t.slug,
        category: t.category,
        name: t.name,
        min_plan_key: t.min_plan_key,
        folder: t.folder || null,
        description: t.description || '',
        pageCount: (t.manifest.pages || []).length,
        sectionTypes: [...new Set((t.manifest.pages || []).flatMap((p) => p.sections || []))]
      }));
    },
    apply(tenantId, website, templateId, { confirm, entitlements, websitesService }) {
      const tpl = repo.find(templateId);
      if (!tpl) throw new HttpError(404, 'Template non trovato');
      const userRank = PLAN_RANK[(entitlements && entitlements.planKey) || 'starter'] || 0;
      const needRank = PLAN_RANK[tpl.min_plan_key] || 1;
      if (userRank < needRank) {
        throw new HttpError(403, 'Template riservato a un piano superiore', { feature: 'premiumTemplates' });
      }
      const existingPages = pagesRepo.listByWebsite(tenantId, website.id);
      const populated = existingPages.length > 1 || existingPages.some((p) => {
        return sectionsRepo.listByPage(tenantId, p.id).length > 0;
      });
      if (populated && !confirm) {
        throw new HttpError(409, 'Il sito non è vuoto. Conferma per sovrascrivere.', { requiresConfirm: true });
      }
      pagesRepo.removeByWebsite(tenantId, website.id);
      const pages = tpl.manifest.pages || [];
      pages.forEach((spec, index) => {
        const page = pagesRepo.insert({
          id: pageId(),
          website_id: website.id,
          tenant_id: tenantId,
          slug: spec.slug,
          type: spec.type || (spec.isHome ? 'home' : 'page'),
          is_home: Boolean(spec.isHome),
          sort_order: index,
          title: spec.title,
          seo: { title: spec.title }
        });
        (spec.sections || []).forEach((type, sIndex) => {
          const seed = defaultSection(type, sectionId());
          sectionsRepo.insert({
            id: seed.id,
            page_id: page.id,
            website_id: website.id,
            tenant_id: tenantId,
            type: seed.type,
            sort_order: sIndex,
            content: seed.content,
            design: seed.design,
            layout: seed.layout,
            settings: seed.settings
          });
        });
      });
      if (websitesService) {
        websitesService.updateForTenant(website.id, tenantId, {
          template_id: tpl.id,
          theme: tpl.manifest.theme || website.theme
        });
      }
      return websitesService.getForTenant(website.id, tenantId);
    }
  };
}

module.exports = { createTemplatesService };
