const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { mediaId } = require('../ids');
const { HttpError } = require('../utils/http-error');
const { createMediaRepository } = require('../repositories/media.repository');

const ALLOWED = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  'image/gif': [Buffer.from([0x47, 0x49, 0x46])],
  'image/webp': [Buffer.from('RIFF')]
};

function mediaRoot() {
  const override = (process.env.WB_MEDIA_ROOT || '').trim();
  if (override) return override;
  return path.join(__dirname, '..', '..', '..', '..', 'storage', 'website-media');
}

function resolveTenantPath(tenantId, websiteId, filename) {
  const root = path.resolve(mediaRoot());
  const safeName = String(filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const dest = path.resolve(root, tenantId, websiteId || '_shared', safeName);
  if (!dest.startsWith(root + path.sep) && dest !== root) {
    throw new HttpError(400, 'Percorso media non valido');
  }
  return dest;
}

function detectMime(buf, declared) {
  for (const [mime, magics] of Object.entries(ALLOWED)) {
    if (magics.some((m) => buf.slice(0, m.length).equals(m))) return mime;
  }
  if (declared === 'image/webp' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

function createMediaService(db) {
  const repo = createMediaRepository(db);

  return {
    repo,
    list(tenantId, { websiteId, q } = {}) {
      if (q) return repo.search(tenantId, q);
      if (websiteId) return repo.listByWebsite(tenantId, websiteId);
      return repo.listByTenant(tenantId);
    },
    upload(tenantId, websiteId, file, entitlements) {
      if (!file || !file.buffer) throw new HttpError(400, 'File obbligatorio');
      const mime = detectMime(file.buffer, file.mimetype);
      if (!mime) throw new HttpError(400, 'Formato file non consentito');
      const limitMb = entitlements && entitlements.limits && entitlements.limits.storageMb;
      if (typeof limitMb === 'number') {
        const used = repo.sumBytes(tenantId);
        if (used + file.buffer.length > limitMb * 1024 * 1024) {
          throw new HttpError(403, 'Limite piano raggiunto', { feature: 'storageMb', limit: limitMb });
        }
      }
      const id = mediaId();
      const ext = mime === 'image/png' ? '.png' : mime === 'image/gif' ? '.gif' : mime === 'image/webp' ? '.webp' : '.jpg';
      const filename = `${id}${ext}`;
      const dest = resolveTenantPath(tenantId, websiteId, filename);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, file.buffer);
      const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
      return repo.insert({
        id,
        tenant_id: tenantId,
        website_id: websiteId || null,
        filename: file.originalname || filename,
        storage_key: path.relative(mediaRoot(), dest),
        mime,
        size_bytes: file.buffer.length,
        checksum
      });
    },
    filePath(tenantId, id) {
      const row = repo.findByIdForTenant(tenantId, id);
      if (!row) throw new HttpError(404, 'Media non trovato');
      const dest = path.resolve(mediaRoot(), row.storage_key);
      const root = path.resolve(mediaRoot(), tenantId);
      if (!dest.startsWith(root + path.sep)) {
        throw new HttpError(403, 'Accesso negato');
      }
      if (!fs.existsSync(dest)) throw new HttpError(404, 'File media assente');
      return { row, dest };
    },
    remove(tenantId, id) {
      const { dest } = this.filePath(tenantId, id);
      try { fs.unlinkSync(dest); } catch (_) { /* ignore missing file */ }
      repo.remove(tenantId, id);
      return { deleted: true, id };
    }
  };
}

module.exports = { createMediaService, resolveTenantPath, mediaRoot };
