const { createSectionsRepository } = require('../repositories/sections.repository');
const { createPagesRepository } = require('../repositories/pages.repository');
const { sectionId } = require('../ids');
const { HttpError } = require('../utils/http-error');
const { defaultSection, validateSection, SECTION_TYPES } = require('../config/section-registry');

function mergeDeep(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch != null ? patch : base;
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] && !Array.isArray(out[k])) {
      out[k] = mergeDeep(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function toValidatable(section) {
  return {
    id: section.id,
    type: section.type,
    version: 1,
    content: section.content || {},
    design: section.design || {},
    layout: section.layout || {},
    settings: section.settings || {}
  };
}

function createSectionsService(db) {
  const repo = createSectionsRepository(db);
  const pagesRepo = createPagesRepository(db);

  function requirePage(tenantId, websiteId, pageIdValue) {
    const page = pagesRepo.findByIdForTenant(tenantId, pageIdValue);
    if (!page || page.website_id !== websiteId) {
      throw new HttpError(404, 'Pagina non trovata');
    }
    return page;
  }

  return {
    repo,

    list(tenantId, websiteId, pageIdValue) {
      requirePage(tenantId, websiteId, pageIdValue);
      return repo.listByPage(tenantId, pageIdValue);
    },

    create(tenantId, website, pageIdValue, input) {
      requirePage(tenantId, website.id, pageIdValue);
      const type = input && input.type;
      if (!type || !SECTION_TYPES.includes(type)) {
        throw new HttpError(400, 'Tipo di sezione non valido');
      }
      const seed = defaultSection(type, sectionId());
      const section = {
        ...seed,
        content: mergeDeep(seed.content, input.content),
        design: mergeDeep(seed.design, input.design),
        layout: mergeDeep(seed.layout, input.layout),
        settings: mergeDeep(seed.settings, input.settings)
      };
      const check = validateSection(toValidatable(section));
      if (!check.valid) {
        throw new HttpError(400, 'Sezione non valida', { errors: check.errors });
      }
      return repo.insert({
        id: section.id,
        page_id: pageIdValue,
        website_id: website.id,
        tenant_id: tenantId,
        type: section.type,
        sort_order:
          input && input.sort_order != null
            ? input.sort_order
            : repo.nextSortOrder(tenantId, pageIdValue),
        content: section.content,
        design: section.design,
        layout: section.layout,
        settings: section.settings
      });
    },

    update(tenantId, websiteId, pageIdValue, sectionIdValue, patch) {
      requirePage(tenantId, websiteId, pageIdValue);
      const current = repo.findByIdForTenant(tenantId, sectionIdValue);
      if (!current || current.page_id !== pageIdValue || current.website_id !== websiteId) {
        throw new HttpError(404, 'Sezione non trovata');
      }
      const next = {
        ...current,
        content: patch.content != null ? mergeDeep(current.content, patch.content) : current.content,
        design: patch.design != null ? mergeDeep(current.design, patch.design) : current.design,
        layout: patch.layout != null ? mergeDeep(current.layout, patch.layout) : current.layout,
        settings: patch.settings != null ? mergeDeep(current.settings, patch.settings) : current.settings,
        sort_order: patch.sort_order != null ? patch.sort_order : current.sort_order
      };
      const check = validateSection(toValidatable(next));
      if (!check.valid) {
        throw new HttpError(400, 'Sezione non valida', { errors: check.errors });
      }
      return repo.update(tenantId, sectionIdValue, next);
    },

    remove(tenantId, websiteId, pageIdValue, sectionIdValue) {
      requirePage(tenantId, websiteId, pageIdValue);
      const current = repo.findByIdForTenant(tenantId, sectionIdValue);
      if (!current || current.page_id !== pageIdValue) {
        throw new HttpError(404, 'Sezione non trovata');
      }
      repo.remove(tenantId, sectionIdValue);
      return { deleted: true, id: sectionIdValue };
    },

    reorder(tenantId, websiteId, pageIdValue, orderedIds) {
      requirePage(tenantId, websiteId, pageIdValue);
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        throw new HttpError(400, 'Elenco sezioni obbligatorio');
      }
      const existing = repo.listByPage(tenantId, pageIdValue);
      const existingIds = new Set(existing.map((s) => s.id));
      for (const id of orderedIds) {
        if (!existingIds.has(id)) {
          throw new HttpError(400, 'Sezione non appartenente alla pagina');
        }
      }
      return repo.reorder(tenantId, pageIdValue, orderedIds);
    }
  };
}

module.exports = { createSectionsService, mergeDeep };
