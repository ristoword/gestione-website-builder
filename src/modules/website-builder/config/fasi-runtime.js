const RAILWAY = 'https://gestione-website-builder-production.up.railway.app';

module.exports = {
  railway: RAILWAY,
  hubPath: '/website',
  healthPath: '/api/website-builder/health',
  /** Fasi confermate su questo runtime (HUB + A–J). */
  completed: ['HUB', 'A']
};
