/**
 * Server-side Website Builder plan limits.
 * Mapping onto existing Stripe product IDs (sitoweb_*).
 * Never copy these numbers into the frontend as source of truth —
 * clients read GET /api/website-builder/entitlements.
 *
 * "Unlimited" is a high configurable cap, never Number.POSITIVE_INFINITY.
 */

const UNLIMITED = 999999;

const PRODUCT_TO_PLAN = {
  sitoweb_base: 'starter',
  sitoweb_pro: 'business',
  sitoweb_premium: 'professional'
};

const PLAN_TO_PRODUCT = {
  starter: 'sitoweb_base',
  business: 'sitoweb_pro',
  professional: 'sitoweb_premium'
};

/** Highest plan wins when a tenant holds more than one sitoweb license. */
const PLAN_RANK = {
  starter: 1,
  business: 2,
  professional: 3
};

const PLANS = {
  starter: {
    planKey: 'starter',
    productId: 'sitoweb_base',
    commercialName: 'STARTER',
    websites: 1,
    pages: 6,
    storageMb: 500,
    customDomains: 0,
    locales: 1,
    aiCreditsPerMonth: 20,
    premiumTemplates: false,
    forms: 1,
    analytics: 'base',
    ristosimply: 'menu_read'
  },
  business: {
    planKey: 'business',
    productId: 'sitoweb_pro',
    commercialName: 'BUSINESS',
    websites: 3,
    pages: 20,
    storageMb: 5000,
    customDomains: 1,
    locales: 3,
    aiCreditsPerMonth: 100,
    premiumTemplates: true,
    forms: 5,
    analytics: 'standard',
    ristosimply: 'menu_events'
  },
  professional: {
    planKey: 'professional',
    productId: 'sitoweb_premium',
    commercialName: 'PROFESSIONAL',
    websites: 10,
    pages: UNLIMITED,
    storageMb: 20000,
    customDomains: 3,
    locales: 7,
    aiCreditsPerMonth: 500,
    premiumTemplates: true,
    forms: UNLIMITED,
    analytics: 'advanced',
    ristosimply: 'full'
  }
};

function planKeyFromProductId(productId) {
  return PRODUCT_TO_PLAN[productId] || null;
}

function getPlan(planKey) {
  return PLANS[planKey] || null;
}

function pickHighestPlan(productIds) {
  let best = null;
  let rank = 0;
  for (const id of productIds || []) {
    const key = planKeyFromProductId(id);
    if (!key) continue;
    const r = PLAN_RANK[key] || 0;
    if (r > rank) {
      rank = r;
      best = key;
    }
  }
  return best;
}

module.exports = {
  UNLIMITED,
  PRODUCT_TO_PLAN,
  PLAN_TO_PRODUCT,
  PLAN_RANK,
  PLANS,
  planKeyFromProductId,
  getPlan,
  pickHighestPlan
};
