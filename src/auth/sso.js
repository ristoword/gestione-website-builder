const crypto = require('crypto');

function ssoSecret() {
  return process.env.WEBSITE_BUILDER_SSO_SECRET || process.env.SESSION_SECRET || 'wb-sso-dev';
}

function signLaunchUrl(user, appUrl, returnPath) {
  const exp = Date.now() + 5 * 60 * 1000;
  const body = {
    id: user.id,
    email: user.email || '',
    type: user.type || 'customer',
    role: user.role || 'customer',
    products: user.products || ['sitoweb_pro'],
    exp
  };
  const p = Buffer.from(JSON.stringify(body)).toString('base64url');
  const s = crypto.createHmac('sha256', ssoSecret()).update(p).digest('hex');
  const dest = returnPath && returnPath.startsWith('/') ? returnPath : '/website';
  const base = String(appUrl || '').replace(/\/$/, '');
  return `${base}/auth/gs?p=${encodeURIComponent(p)}&s=${encodeURIComponent(s)}&next=${encodeURIComponent(dest)}`;
}

function verifyLaunch(p, s) {
  if (!p || !s) return null;
  const expected = crypto.createHmac('sha256', ssoSecret()).update(String(p)).digest('hex');
  const a = Buffer.from(String(s));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let body;
  try {
    body = JSON.parse(Buffer.from(String(p), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!body || !body.id || Number(body.exp) < Date.now()) return null;
  return body;
}

module.exports = { signLaunchUrl, verifyLaunch, ssoSecret };
