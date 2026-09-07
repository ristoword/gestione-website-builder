function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function t(i18n, locale) {
  const loc = locale || 'it';
  if (i18n == null) return '';
  if (typeof i18n === 'string') return i18n;
  return i18n[loc] || i18n.it || i18n.en || Object.values(i18n)[0] || '';
}

function safeHref(href) {
  const s = String(href || '').trim();
  if (!s) return '#';
  if (
    s.startsWith('#') ||
    s.startsWith('/') ||
    s.startsWith('https://') ||
    s.startsWith('mailto:') ||
    s.startsWith('tel:')
  ) {
    return s;
  }
  return '#';
}

function visibilityClass(settings) {
  const s = settings || {};
  const parts = [];
  if (s.visibleDesktop === false) parts.push('wb-hide-desktop');
  if (s.visibleTablet === false) parts.push('wb-hide-tablet');
  if (s.visibleMobile === false) parts.push('wb-hide-mobile');
  return parts.join(' ');
}

module.exports = { escapeHtml, t, safeHref, visibilityClass };
