const DEFAULT_APP_URL = 'https://gestione-website-builder-production.up.railway.app';

function isEnabled() {
  return String(process.env.WEBSITE_BUILDER_ENABLED || '').toLowerCase() === 'true';
}

function getAppUrl() {
  const fromEnv = (process.env.WEBSITE_BUILDER_APP_URL || '').trim();
  return (fromEnv || DEFAULT_APP_URL).replace(/\/$/, '');
}

module.exports = {
  DEFAULT_APP_URL,
  isEnabled,
  getAppUrl
};
