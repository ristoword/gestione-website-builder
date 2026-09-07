/**
 * Adapter sessione Gestione Semplificata.
 * Non è un secondo login: richiede req.session.user già valorizzato (cookie GS o DEV_TENANT).
 */

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(401).json({ error: 'Autenticazione richiesta' });
    }
    const gs = (process.env.GESTIONE_SEMPLIFICATA_BASE_URL || 'https://gestionesemplificata.com').replace(/\/$/, '');
    return res.redirect(`${gs}/login?redirect=` + encodeURIComponent(req.originalUrl || '/builder'));
  }
  next();
}

function requireCustomerAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return requireAuth(req, res, next);
  }
  const u = req.session.user;
  if (!u.email && !u.type) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(403).json({ error: 'Area clienti: effettua l\'accesso con email e password' });
    }
    const gs = (process.env.GESTIONE_SEMPLIFICATA_BASE_URL || 'https://gestionesemplificata.com').replace(/\/$/, '');
    return res.redirect(`${gs}/login?redirect=` + encodeURIComponent(req.originalUrl || '/builder'));
  }
  next();
}

function requireLicense(productId) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Autenticazione richiesta' });
    }
    const products = req.session.user.products || [];
    if (!products.includes(productId)) {
      return res.status(403).json({ error: 'Licenza non valida per questa applicazione' });
    }
    next();
  };
}

module.exports = { requireAuth, requireCustomerAuth, requireLicense };
