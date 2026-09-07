/**
 * Read-only RistoSimply client. Never copies menu/events/bookings into the builder DB.
 */

async function fetchConnectedData({ email } = {}) {
  let hasLicense = false;
  try {
    if (email) {
      const accountRepository = require('../../account/account.repository');
      const licenses = accountRepository.getLicensesByUserEmail(email) || [];
      hasLicense = licenses.some((lic) => {
        const pid = String(lic.productId || '');
        const status = String(lic.status || 'active').toLowerCase();
        return pid.startsWith('ristoword') && (status === 'active' || status === 'trialing');
      });
    }
  } catch (_) {
    hasLicense = false;
  }
  return {
    available: hasLicense,
    duplicated: false,
    source: 'ristosimply',
    widgets: hasLicense ? ['menu', 'booking', 'hours'] : [],
    note: 'I dati restano su RistoSimply/Ristoword. Il Website Builder non li duplica.'
  };
}

module.exports = { fetchConnectedData };
