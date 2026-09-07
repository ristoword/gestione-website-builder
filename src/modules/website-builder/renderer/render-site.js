/**
 * Canonical JSON → HTML renderer used by the public site and the editor preview.
 * Props are always escaped. No innerHTML of user strings.
 */

const { escapeHtml, t, safeHref, visibilityClass } = require('./html-escape');

function pick(obj, locale) {
  return escapeHtml(t(obj, locale));
}

function sectionCss(section) {
  const d = section.design || {};
  const l = section.layout || {};
  const css = [];
  if (d.backgroundColor) css.push(`background-color:${escapeHtml(d.backgroundColor)}`);
  if (d.textColor) css.push(`color:${escapeHtml(d.textColor)}`);
  if (d.fontFamily) css.push(`font-family:${escapeHtml(d.fontFamily)}`);
  if (d.fontSize) css.push(`font-size:${escapeHtml(d.fontSize)}`);
  if (d.borderRadius) css.push(`border-radius:${escapeHtml(d.borderRadius)}`);
  if (d.borderColor) css.push(`border-color:${escapeHtml(d.borderColor)}`);
  if (d.borderWidth) css.push(`border-width:${escapeHtml(d.borderWidth)};border-style:solid`);
  if (l.padding) css.push(`padding:${escapeHtml(l.padding)}`);
  if (l.margin) css.push(`margin:${escapeHtml(l.margin)}`);
  if (l.maxWidth) css.push(`max-width:${escapeHtml(l.maxWidth)}`);
  if (l.gap) css.push(`gap:${escapeHtml(l.gap)}`);
  if (l.alignment === 'left' || l.alignment === 'center' || l.alignment === 'right') {
    css.push(`text-align:${l.alignment}`);
  }
  css.push('margin-left:auto');
  css.push('margin-right:auto');
  return css.join(';');
}

function ctaHtml(cta, locale, accent) {
  if (!cta) return '';
  const label = pick(cta.label, locale);
  if (!label) return '';
  const href = escapeHtml(safeHref(cta.href));
  const bg = accent ? `background:${escapeHtml(accent)};` : '';
  return `<a class="wb-btn" href="${href}" style="${bg}">${label}</a>`;
}

function itemsList(items, locale) {
  if (!Array.isArray(items) || !items.length) return '';
  return `<ul class="wb-list">${items
    .map((item) => {
      const title = pick(item.title || item.name || item.heading, locale);
      const body = pick(item.body || item.text || item.role, locale);
      return `<li><strong>${title}</strong>${body ? `<p>${body}</p>` : ''}</li>`;
    })
    .join('')}</ul>`;
}

function renderSectionBody(section, locale) {
  const c = section.content || {};
  const accent = (section.design && section.design.accentColor) || '';
  switch (section.type) {
    case 'hero':
      return `<div class="wb-hero"><h1>${pick(c.heading, locale)}</h1><p>${pick(c.subheading, locale)}</p>${ctaHtml(c.cta, locale, accent)}</div>`;
    case 'header':
      return `<div class="wb-header"><strong>${pick(c.siteName, locale)}</strong>${ctaHtml(c.cta, locale, accent)}</div>`;
    case 'footer':
      return `<div class="wb-footer"><p>${pick(c.copyright, locale)}</p></div>`;
    case 'about':
      return `<div><h2>${pick(c.heading, locale)}</h2><p>${pick(c.body, locale)}</p></div>`;
    case 'services':
    case 'features':
    case 'team':
      return `<div><h2>${pick(c.heading, locale)}</h2>${itemsList(c.items || c.members, locale)}</div>`;
    case 'gallery':
      return `<div><h2>${pick(c.heading, locale)}</h2><p class="wb-muted">${(c.mediaIds || []).length} immagini</p></div>`;
    case 'testimonials':
      return `<div><h2>${pick(c.heading, locale)}</h2>${itemsList(c.items, locale)}</div>`;
    case 'pricing':
      return `<div><h2>${pick(c.heading, locale)}</h2>${itemsList(c.items, locale)}</div>`;
    case 'contact':
      return `<div><h2>${pick(c.heading, locale)}</h2><p>${escapeHtml(c.email || '')}</p><p>${escapeHtml(c.phone || '')}</p><p>${pick(c.address, locale)}</p></div>`;
    case 'faq':
      return `<div><h2>${pick(c.heading, locale)}</h2>${itemsList(c.items, locale)}</div>`;
    case 'cta':
      return `<div class="wb-cta"><h2>${pick(c.heading, locale)}</h2><p>${pick(c.body, locale)}</p>${ctaHtml(c.cta, locale, accent)}</div>`;
    case 'map':
      return `<div><h2>${pick(c.heading, locale)}</h2><p class="wb-muted">${escapeHtml(c.embedUrl || '')}</p></div>`;
    case 'events':
    case 'blog':
    case 'menu':
      return `<div><h2>${pick(c.heading, locale)}</h2>${itemsList(c.items || c.groups, locale)}</div>`;
    case 'booking':
      return `<div><h2>${pick(c.heading, locale)}</h2>${ctaHtml(c.cta, locale, accent)}</div>`;
    default:
      return `<div><h2>${escapeHtml(section.type)}</h2></div>`;
  }
}

function renderSection(section, locale, selectedId) {
  const settings = section.settings || {};
  const anchor = settings.anchorId ? ` id="${escapeHtml(settings.anchorId)}"` : '';
  const selected = selectedId && selectedId === section.id ? ' wb-selected' : '';
  const vis = visibilityClass(settings);
  return `<section class="wb-section ${vis}${selected}" data-section-id="${escapeHtml(section.id)}" data-section-type="${escapeHtml(section.type)}"${anchor} style="${sectionCss(section)}">${renderSectionBody(section, locale)}</section>`;
}

function themeCss(theme) {
  const colors = (theme && theme.colors) || {};
  const fonts = (theme && theme.fonts) || {};
  return `
    :root {
      --wb-bg: ${escapeHtml(colors.background || '#ffffff')};
      --wb-text: ${escapeHtml(colors.text || '#1a1a1a')};
      --wb-accent: ${escapeHtml(colors.accent || '#c9a227')};
      --wb-primary: ${escapeHtml(colors.primary || '#1a1a1a')};
      --wb-font-body: ${escapeHtml(fonts.body || 'DM Sans, system-ui, sans-serif')};
      --wb-font-heading: ${escapeHtml(fonts.heading || 'Playfair Display, Georgia, serif')};
    }
  `;
}

function renderDocument({ website, page, sections, locale, interactive, selectedId, viewport }) {
  const loc = locale || (website && website.locale_default) || 'it';
  const theme = (website && website.theme) || {};
  const title = escapeHtml((page && page.seo && page.seo.title) || (page && page.title) || (website && website.name) || 'Sito');
  const body = (sections || []).map((s) => renderSection(s, loc, selectedId)).join('\n');
  const interactScript = interactive
    ? `<script>
        document.querySelectorAll('[data-section-id]').forEach(function (el) {
          el.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            parent.postMessage({ type: 'wb:select', id: el.getAttribute('data-section-id') }, '*');
          });
        });
      </script>`
    : '';
  const vp = viewport || 'desktop';
  return `<!DOCTYPE html>
<html lang="${escapeHtml(loc)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    ${themeCss(theme)}
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--wb-bg); color: var(--wb-text); font-family: var(--wb-font-body); }
    h1,h2,h3 { font-family: var(--wb-font-heading); margin: 0 0 0.75rem; }
    p { margin: 0 0 0.75rem; line-height: 1.6; }
    .wb-section { padding: 4rem 1.5rem; }
    .wb-selected { outline: 2px solid var(--wb-accent); outline-offset: -2px; }
    .wb-btn { display: inline-block; padding: 0.75rem 1.25rem; background: var(--wb-accent); color: #111; text-decoration: none; border-radius: 999px; font-weight: 600; }
    .wb-header, .wb-footer { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .wb-muted { opacity: 0.7; }
    .wb-list { list-style: none; padding: 0; display: grid; gap: 1rem; }
    @media (min-width: 901px) { .wb-hide-desktop { display: none !important; } }
    @media (min-width: 601px) and (max-width: 900px) { .wb-hide-tablet { display: none !important; } }
    @media (max-width: 600px) { .wb-hide-mobile { display: none !important; } }
    body[data-vp="tablet"] { max-width: 768px; margin: 0 auto; }
    body[data-vp="mobile"] { max-width: 390px; margin: 0 auto; }
  </style>
</head>
<body data-vp="${escapeHtml(vp)}">
${body}
${interactScript}
</body>
</html>`;
}

module.exports = { renderDocument, renderSection };
