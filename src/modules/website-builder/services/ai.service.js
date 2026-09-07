const { aiJobId } = require('../ids');
const { HttpError } = require('../utils/http-error');
const { defaultSection, validateSection, SECTION_TYPES } = require('../config/section-registry');
const { serializeJson, parseJson } = require('../utils/json');

function offlinePatch(prompt, locale) {
  const text = String(prompt || '').toLowerCase();
  const types = [];
  if (text.includes('menu') || text.includes('piatt')) types.push('menu');
  if (text.includes('prenot') || text.includes('book')) types.push('booking');
  if (text.includes('team') || text.includes('chi siamo')) types.push('about');
  if (text.includes('faq')) types.push('faq');
  if (!types.length) types.push('hero', 'about', 'contact');
  const sections = types.filter((t) => SECTION_TYPES.includes(t)).map((type) => {
    const seed = defaultSection(type, `sec_ai_${type}`);
    if (seed.content.heading) seed.content.heading[locale || 'it'] = String(prompt || 'Nuova sezione').slice(0, 80);
    const check = validateSection(seed);
    if (!check.valid) throw new HttpError(400, 'Patch AI non valida');
    return seed;
  });
  return { op: 'append-sections', sections };
}

function createAiService(db) {
  const insert = db.prepare(`
    INSERT INTO ai_jobs (id, tenant_id, website_id, prompt, status, result_patch_json, applied_at, created_at)
    VALUES (@id, @tenant_id, @website_id, @prompt, @status, @result_patch_json, @applied_at, @created_at)
  `);
  const find = db.prepare('SELECT * FROM ai_jobs WHERE id = ?');
  const countMonth = db.prepare(`
    SELECT COUNT(*) AS n FROM ai_jobs
    WHERE tenant_id = ? AND created_at >= ?
  `);

  return {
    generate(tenantId, websiteId, prompt, entitlements, locale) {
      const key = (process.env.OPENAI_API_KEY || process.env.WEBSITE_AI_API_KEY || '').trim();
      const offline = String(process.env.WEBSITE_AI_OFFLINE || '') === 'true';
      if (!key && !offline) {
        const err = new HttpError(503, 'Assistente AI non configurato (manca OPENAI_API_KEY)');
        throw err;
      }
      const limit = entitlements && entitlements.limits && entitlements.limits.aiCreditsPerMonth;
      if (typeof limit === 'number') {
        const since = new Date();
        since.setDate(1);
        since.setHours(0, 0, 0, 0);
        const used = countMonth.get(tenantId, since.toISOString()).n;
        if (used >= limit) {
          throw new HttpError(403, 'Limite piano raggiunto', { feature: 'aiCreditsPerMonth', limit, usage: used });
        }
      }
      const patch = offlinePatch(prompt, locale || 'it');
      const id = aiJobId();
      insert.run({
        id,
        tenant_id: tenantId,
        website_id: websiteId,
        prompt: String(prompt || '').slice(0, 2000),
        status: 'ready',
        result_patch_json: serializeJson(patch, {}),
        applied_at: null,
        created_at: new Date().toISOString()
      });
      return { id, status: 'ready', patch };
    },
    get(tenantId, jobId) {
      const row = find.get(jobId);
      if (!row || row.tenant_id !== tenantId) throw new HttpError(404, 'Job AI non trovato');
      return {
        id: row.id,
        status: row.status,
        patch: parseJson(row.result_patch_json, {}),
        applied_at: row.applied_at
      };
    },
    apply(tenantId, jobId, sectionsService, website, pageId) {
      const job = this.get(tenantId, jobId);
      if (job.status === 'applied') return job;
      const sections = (job.patch && job.patch.sections) || [];
      for (const spec of sections) {
        const check = validateSection(spec);
        if (!check.valid) throw new HttpError(400, 'Patch AI non valida');
        sectionsService.create(tenantId, website, pageId, { type: spec.type, content: spec.content });
      }
      db.prepare(`UPDATE ai_jobs SET status = 'applied', applied_at = ? WHERE id = ? AND tenant_id = ?`).run(
        new Date().toISOString(),
        jobId,
        tenantId
      );
      return this.get(tenantId, jobId);
    }
  };
}

module.exports = { createAiService, offlinePatch };
