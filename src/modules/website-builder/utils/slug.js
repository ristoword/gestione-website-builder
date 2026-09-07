function slugify(text, fallback = 'sito') {
  const slug = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

function uniqueSlug(base, existsFn) {
  const root = slugify(base);
  if (!existsFn(root)) return root;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${root}-${i}`.slice(0, 56);
    if (!existsFn(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

module.exports = { slugify, uniqueSlug };
