/**
 * Folder-based template catalog.
 * Adding a template = create templates/<categoria>/<slug>/template.json
 * Categories on disk: ristoranti, hotel, servizi, generico.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.join(__dirname);

function categoryFromFolder(folderName) {
  const map = {
    ristoranti: 'ristorazione',
    hotel: 'ospitalita',
    servizi: 'servizi',
    generico: 'generico'
  };
  return map[folderName] || folderName;
}

function resolveTemplatesRoot(explicit) {
  const fromEnv = (process.env.WEBSITE_BUILDER_TEMPLATES_DIR || '').trim();
  if (explicit) return explicit;
  if (fromEnv) return fromEnv;
  const cwdAlt = path.join(process.cwd(), 'templates');
  if (fs.existsSync(path.join(DEFAULT_ROOT, 'ristoranti')) || fs.existsSync(path.join(DEFAULT_ROOT, 'hotel'))) {
    return DEFAULT_ROOT;
  }
  if (fs.existsSync(path.join(cwdAlt, 'ristoranti')) || fs.existsSync(path.join(cwdAlt, 'hotel'))) {
    return cwdAlt;
  }
  return DEFAULT_ROOT;
}

function loadTemplatesFromFolders(rootDir) {
  const root = resolveTemplatesRoot(rootDir);
  const templates = [];
  if (!fs.existsSync(root)) return templates;

  const categories = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const cat of categories) {
    const catDir = path.join(root, cat.name);
    let entries;
    try {
      entries = fs.readdirSync(catDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch (_) {
      continue;
    }
    for (const folder of entries) {
      const manifestPath = path.join(catDir, folder.name, 'template.json');
      if (!fs.existsSync(manifestPath)) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (err) {
        throw new Error(`Template non valido: ${cat.name}/${folder.name} (${err.message})`);
      }
      const slug = data.slug || folder.name;
      const manifest = data.manifest || {
        theme: data.theme || {},
        pages: data.pages || []
      };
      templates.push({
        id: data.id || `tpl_${slug.replace(/-/g, '_')}`,
        slug,
        name: data.name || folder.name,
        category: data.category || categoryFromFolder(cat.name),
        min_plan_key: data.min_plan_key || 'starter',
        folder: `${cat.name}/${folder.name}`,
        preview: data.preview || null,
        description: data.description || '',
        manifest
      });
    }
  }

  templates.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  return templates;
}

module.exports = {
  loadTemplatesFromFolders,
  resolveTemplatesRoot,
  DEFAULT_ROOT
};
