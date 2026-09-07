const { serializeJson, parseJson } = require('../utils/json');
const { loadTemplatesFromFolders } = require('../templates/load-from-folders');
const { TEMPLATES: SEEDED } = require('../config/templates.seed');

function mapTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    name: row.name,
    min_plan_key: row.min_plan_key,
    manifest: parseJson(row.manifest_json, {}),
    created_at: row.created_at
  };
}

function createTemplatesRepository(db) {
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO templates (id, slug, category, name, min_plan_key, manifest_json, created_at)
    VALUES (@id, @slug, @category, @name, @min_plan_key, @manifest_json, @created_at)
  `);
  const listStmt = db.prepare('SELECT * FROM templates ORDER BY name ASC');
  const findStmt = db.prepare('SELECT * FROM templates WHERE id = ? OR slug = ?');

  return {
    seed() {
      const now = new Date().toISOString();
      const fromFolders = loadTemplatesFromFolders();
      const catalog = fromFolders.length ? fromFolders : SEEDED;
      for (const t of catalog) {
        insertStmt.run({
          id: t.id,
          slug: t.slug,
          category: t.category,
          name: t.name,
          min_plan_key: t.min_plan_key,
          manifest_json: serializeJson(t.manifest, {}),
          created_at: now
        });
      }
    },
    list() {
      const fromDb = listStmt.all().map(mapTemplate);
      const folders = loadTemplatesFromFolders();
      const extra = new Map(folders.map((t) => [t.id, t]));
      return fromDb.map((t) => {
        const disk = extra.get(t.id);
        if (!disk) return t;
        return { ...t, folder: disk.folder, description: disk.description };
      });
    },
    find(idOrSlug) {
      return mapTemplate(findStmt.get(idOrSlug, idOrSlug));
    }
  };
}

module.exports = { createTemplatesRepository, mapTemplate };
