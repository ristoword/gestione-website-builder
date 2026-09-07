/**
 * Resolve STARTER/BUSINESS/PROFESSIONAL from the GS session + existing sitoweb licenses.
 * tenantId is never taken from the client.
 */

const { pickHighestPlan, getPlan } = require('../config/plans.config');
const { getAppUrl } = require('../config/env');

const SITOWEB_PRODUCTS = ['sitoweb_base', 'sitoweb_pro', 'sitoweb_premium'];

function collectProductIds(user) {
  const ids = new Set();
  const sessionProducts = (user && user.products) || [];
  for (const p of sessionProducts) {
    if (SITOWEB_PRODUCTS.includes(p)) ids.add(p);
  }
  const email = user && user.email;
  if (email) {
    try {
      const accountRepository = require('../../account/account.repository');
      const licenses = accountRepository.getLicensesByUserEmail(email) || [];
      for (const lic of licenses) {
        const status = String(lic.status || 'active').toLowerCase();
        if (status && status !== 'active') continue;
        if (SITOWEB_PRODUCTS.includes(lic.productId)) ids.add(lic.productId);
      }
    } catch (_) {
      // licenses JSON store is optional during isolated module tests
    }
  }
  return Array.from(ids);
}

function resolveEntitlements(user) {
  const productIds = collectProductIds(user);
  let planKey = pickHighestPlan(productIds);
  const standalone = String(process.env.WEBSITE_BUILDER_STANDALONE || 'true').toLowerCase() !== 'false';
  if (!planKey && standalone) planKey = 'business';
  const plan = planKey ? getPlan(planKey) : null;
  return {
    tenantId: user && user.id ? user.id : null,
    hasSitowebLicense: Boolean(plan),
    planKey: plan ? plan.planKey : null,
    productId: plan ? plan.productId : null,
    commercialName: plan ? plan.commercialName : null,
    limits: plan
      ? {
          websites: plan.websites,
          pages: plan.pages,
          storageMb: plan.storageMb,
          customDomains: plan.customDomains,
          locales: plan.locales,
          aiCreditsPerMonth: plan.aiCreditsPerMonth,
          premiumTemplates: plan.premiumTemplates,
          forms: plan.forms,
          analytics: plan.analytics,
          ristosimply: plan.ristosimply
        }
      : null,
    appUrl: getAppUrl()
  };
}

module.exports = {
  resolveEntitlements,
  collectProductIds
};
