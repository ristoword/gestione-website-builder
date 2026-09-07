/**
 * Idempotent sitoweb website provisioning from Stripe webhook.
 * tenantId is always the GS user.id. If the buyer has no GS account yet, skip.
 */

const { isEnabled } = require('../config/env');
const { resolveEntitlements } = require('./entitlements.service');
const { createWebsitesService } = require('./websites.service');
const { createWebsitesRepository } = require('../repositories/websites.repository');

function provisionFromStripePayment({ email, productId, stripeSessionId, userId, companyName }) {
  if (!isEnabled()) {
    return { skipped: true, reason: 'flag_off' };
  }
  if (!productId || !String(productId).startsWith('sitoweb_')) {
    return { skipped: true, reason: 'not_sitoweb' };
  }

  let tenantId = userId || null;
  if (!tenantId && email) {
    try {
      const authRepository = require('../../auth/auth.repository');
      const user = authRepository.findByEmail(email);
      if (user && user.id) tenantId = user.id;
    } catch (_) {
      tenantId = null;
    }
  }
  if (!tenantId) {
    return { skipped: true, reason: 'no_gs_account' };
  }

  const { getDb } = require('../db/sqlite');
  const { migrate } = require('../db/migrate');
  const db = getDb();
  migrate(db);
  const repo = createWebsitesRepository(db);

  if (stripeSessionId) {
    const existing = repo.findByStripeSessionId(stripeSessionId);
    if (existing) {
      return { skipped: false, idempotent: true, website: existing };
    }
  }

  const fakeUser = { id: tenantId, email, products: [productId] };
  const entitlements = resolveEntitlements(fakeUser);
  const service = createWebsitesService(db);
  const name = companyName || 'Il mio sito';
  const website = service.createForTenant(
    tenantId,
    { name, stripe_session_id: stripeSessionId || null },
    entitlements.productId ? entitlements : { ...entitlements, productId, limits: entitlements.limits || { websites: 1, pages: 6 } }
  );
  return { skipped: false, idempotent: false, website };
}

module.exports = { provisionFromStripePayment };
