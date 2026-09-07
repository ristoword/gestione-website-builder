const crypto = require('crypto');
const { domainId } = require('../ids');
const { HttpError } = require('../utils/http-error');
const { createDomainsRepository } = require('../repositories/domains.repository');

const ROOT = () => process.env.SITES_ROOT_DOMAIN || 'sites.gestionesemplificata.com';

function createDomainsService(db) {
  const repo = createDomainsRepository(db);

  return {
    list(tenantId, websiteId) {
      return repo.listByWebsite(tenantId, websiteId);
    },
    add(tenantId, website, { host, type }, entitlements) {
      const kind = type === 'custom' ? 'custom' : 'subdomain';
      if (kind === 'custom') {
        const limit = entitlements && entitlements.limits && entitlements.limits.customDomains;
        if (!limit) {
          throw new HttpError(403, 'Dominio personalizzato non incluso nel piano', { feature: 'customDomains' });
        }
        const existing = repo.listByWebsite(tenantId, website.id).filter((d) => d.type === 'custom').length;
        if (existing >= limit) {
          throw new HttpError(403, 'Limite piano raggiunto', { feature: 'customDomains', limit, usage: existing });
        }
      }
      let hostname = String(host || '').trim().toLowerCase();
      if (kind === 'subdomain') {
        hostname = `${website.slug}.${ROOT()}`;
      }
      if (!/^[a-z0-9.-]+$/.test(hostname) || hostname.length > 253) {
        throw new HttpError(400, 'Hostname non valido');
      }
      if (repo.findByHost(hostname)) {
        throw new HttpError(409, 'Hostname già registrato');
      }
      const token = `wb_${crypto.randomBytes(12).toString('hex')}`;
      const instructions =
        kind === 'custom'
          ? {
              recordType: 'TXT',
              host: hostname,
              name: `_gestione-wb.${hostname}`,
              value: `gestione-wb-verify=${token}`,
              note: 'Aggiungi solo un record TXT. Non sono richieste modifiche NS, A o CNAME da questa applicazione.'
            }
          : {
              recordType: 'CNAME',
              host: hostname,
              note: 'Sottodominio Gestione Semplificata. Il DNS del dominio radice è gestito dall’operatore, non dal cliente.'
            };
      return repo.insert({
        id: domainId(),
        website_id: website.id,
        tenant_id: tenantId,
        host: hostname,
        type: kind,
        verification_token: token,
        status: kind === 'subdomain' ? 'pending_dns' : 'pending_dns',
        dns_instructions: instructions
      });
    },
    async verify(tenantId, websiteId, domainIdValue, presentedToken) {
      const rows = repo.listByWebsite(tenantId, websiteId);
      const row = rows.find((d) => d.id === domainIdValue);
      if (!row) throw new HttpError(404, 'Dominio non trovato');
      if (row.type !== 'custom') {
        throw new HttpError(400, 'La verifica TXT vale solo per i domini personalizzati');
      }
      let txtOk = presentedToken && presentedToken === row.verification_token;
      if (!txtOk && process.env.WEBSITE_BUILDER_DNS_STUB !== 'true') {
        try {
          const dns = require('node:dns').promises;
          const name = `_gestione-wb.${row.host}`;
          const records = await dns.resolveTxt(name);
          const flat = records.flat().join(' ');
          txtOk = flat.includes(`gestione-wb-verify=${row.verification_token}`);
        } catch (_) {
          txtOk = false;
        }
      }
      if (!txtOk) {
        throw new HttpError(400, 'Record TXT non trovato. Aggiungi il TXT indicato e riprova.');
      }
      db.prepare(
        `UPDATE domains SET status = 'verified', verified_at = ?, ssl_status = 'pending' WHERE id = ? AND tenant_id = ?`
      ).run(new Date().toISOString(), row.id, tenantId);
      return repo.listByWebsite(tenantId, websiteId).find((d) => d.id === domainIdValue);
    }
  };
}

function sitemapXml(website, pages) {
  const host = `${website.slug}.${ROOT()}`;
  const urls = (pages || [])
    .map((p) => `  <url><loc>https://${host}${p.path || '/'}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robotsTxt(website) {
  const host = `${website.slug}.${ROOT()}`;
  if (website.status !== 'published') {
    return 'User-agent: *\nDisallow: /\n';
  }
  return `User-agent: *\nAllow: /\nSitemap: https://${host}/sitemap.xml\n`;
}

module.exports = { createDomainsService, sitemapXml, robotsTxt };
