/**
 * Website Builder SQLite migrations.
 * Additive only. Users are never copied here.
 */

const MIGRATIONS = [
  {
    version: 1,
    name: 'fase_a_foundation',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS websites (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'unpublished')),
        template_id TEXT,
        theme_json TEXT NOT NULL DEFAULT '{}',
        settings_json TEXT NOT NULL DEFAULT '{}',
        locale_default TEXT NOT NULL DEFAULT 'it',
        locales_json TEXT NOT NULL DEFAULT '["it"]',
        plan_product_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
      );

      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        website_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'page'
          CHECK (type IN ('home', 'page', 'blog_index', 'blog_post')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_home INTEGER NOT NULL DEFAULT 0,
        visibility_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS page_i18n (
        page_id TEXT NOT NULL,
        locale TEXT NOT NULL,
        title TEXT,
        seo_title TEXT,
        seo_description TEXT,
        canonical TEXT,
        og_json TEXT NOT NULL DEFAULT '{}',
        schema_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (page_id, locale),
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL,
        website_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        type TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        content_json TEXT NOT NULL DEFAULT '{}',
        design_json TEXT NOT NULL DEFAULT '{}',
        layout_json TEXT NOT NULL DEFAULT '{}',
        settings_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS navigation (
        id TEXT PRIMARY KEY,
        website_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        location TEXT NOT NULL
          CHECK (location IN ('header', 'footer', 'legal')),
        items_json TEXT NOT NULL DEFAULT '[]',
        locale TEXT NOT NULL DEFAULT 'it',
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        website_id TEXT,
        filename TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        mime TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        width INTEGER,
        height INTEGER,
        alt_json TEXT NOT NULL DEFAULT '{}',
        category TEXT,
        checksum TEXT,
        variants_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS forms (
        id TEXT PRIMARY KEY,
        website_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        fields_json TEXT NOT NULL DEFAULT '[]',
        settings_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS form_submissions (
        id TEXT PRIMARY KEY,
        form_id TEXT NOT NULL,
        website_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        ip_hash TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS domains (
        id TEXT PRIMARY KEY,
        website_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        host TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL
          CHECK (type IN ('subdomain', 'custom')),
        verification_token TEXT,
        status TEXT NOT NULL DEFAULT 'pending_dns'
          CHECK (status IN ('pending_dns', 'verified', 'ssl_pending', 'active')),
        dns_instructions_json TEXT NOT NULL DEFAULT '{}',
        ssl_status TEXT,
        verified_at TEXT,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY,
        website_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        kind TEXT NOT NULL
          CHECK (kind IN ('autosave', 'manual', 'publish')),
        snapshot_json TEXT NOT NULL,
        note TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS website_members (
        website_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer'
          CHECK (role IN ('owner', 'editor', 'viewer')),
        PRIMARY KEY (website_id, user_id),
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_jobs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        website_id TEXT,
        prompt TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        result_patch_json TEXT,
        applied_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        website_id TEXT,
        action TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_by TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        category TEXT,
        name TEXT NOT NULL,
        min_plan_key TEXT,
        manifest_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_websites_tenant ON websites(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_websites_tenant_id ON websites(tenant_id, id);
      CREATE INDEX IF NOT EXISTS idx_pages_tenant ON pages(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_pages_tenant_website ON pages(tenant_id, website_id);
      CREATE INDEX IF NOT EXISTS idx_sections_tenant ON sections(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_sections_tenant_website ON sections(tenant_id, website_id);
      CREATE INDEX IF NOT EXISTS idx_media_tenant ON media_assets(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_domains_tenant ON domains(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_domains_tenant_website ON domains(tenant_id, website_id);
      CREATE INDEX IF NOT EXISTS idx_versions_tenant_website ON versions(tenant_id, website_id);
      CREATE INDEX IF NOT EXISTS idx_forms_tenant ON forms(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_nav_tenant_website ON navigation(tenant_id, website_id);
    `
  },
  {
    version: 2,
    name: 'fase_b_crud',
    sql: `
      ALTER TABLE websites ADD COLUMN stripe_session_id TEXT;
      ALTER TABLE websites ADD COLUMN deleted_at TEXT;
      ALTER TABLE websites ADD COLUMN published_snapshot_id TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_websites_stripe_session
        ON websites(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_website_slug
        ON pages(website_id, slug);
      CREATE INDEX IF NOT EXISTS idx_websites_not_deleted
        ON websites(tenant_id, deleted_at);
    `
  }
];

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version)
  );
  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );

  const run = db.transaction(() => {
    for (const m of MIGRATIONS) {
      if (applied.has(m.version)) continue;
      db.exec(m.sql);
      insert.run(m.version, m.name, new Date().toISOString());
    }
  });
  run();
  return db;
}

module.exports = { migrate, MIGRATIONS };
