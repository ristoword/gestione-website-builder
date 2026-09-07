/**
 * Auth hub Website Builder.
 * Standalone: redirect a /login locale.
 * Se WEBSITE_BUILDER_STANDALONE=false, reindirizza a Gestione Semplificata.
 */

function gsBase() {
  return (process.env.GESTIONE_SEMPLIFICATA_BASE_URL || 'https://gestionesemplificata.com').replace(/\/$/, '');
}

function isStandalone() {
  return String(process.env.WEBSITE_BUILDER_STANDALONE || 'true').toLowerCase() !== 'false';
}

function loginRedirect(req, res) {
  const dest = req.originalUrl || '/website';
  if (isStandalone()) {
    return res.redirect('/login?redirect=' + encodeURIComponent(dest));
  }
  return res.redirect(`${gsBase()}/login?redirect=` + encodeURIComponent(dest));
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(401).json({ error: 'Autenticazione richiesta' });
    }
    return loginRedirect(req, res);
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
    return loginRedirect(req, res);
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
