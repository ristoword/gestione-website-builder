/**
 * Plan limit enforcement — server side only.
 * Limits live in config/plans.config.js, never in the client.
 */

const { resolveEntitlements } = require('../services/entitlements.service');

function attachEntitlements(req, res, next) {
  req.entitlements = resolveEntitlements(req.session && req.session.user);
  next();
}

/**
 * @param {string} feature  key on the plan object (websites, pages, forms, …)
 * @param {(req) => number} getUsage  current usage for that feature
 */
function enforcePlanLimit(feature, getUsage) {
  return function enforcePlanLimitMw(req, res, next) {
    const entitlements = req.entitlements || resolveEntitlements(req.session && req.session.user);
    req.entitlements = entitlements;
    if (!entitlements.productId || !entitlements.limits) {
      return res.status(403).json({
        error: 'Piano Sito Web non attivo',
        feature
      });
    }
    if (typeof getUsage !== 'function') return next();
    const limit = entitlements.limits[feature];
    if (typeof limit !== 'number') return next();
    const usage = Number(getUsage(req)) || 0;
    if (usage >= limit) {
      return res.status(403).json({
        error: 'Limite piano raggiunto',
        feature,
        limit,
        usage,
        planKey: entitlements.planKey
      });
    }
    next();
  };
}

module.exports = {
  attachEntitlements,
  enforcePlanLimit
};
