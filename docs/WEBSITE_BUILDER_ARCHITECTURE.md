# Gestione Semplificata — Website Builder

## Documento di architettura (Fase 1)

| Campo | Valore |
|---|---|
| Prodotto | **Gestione Semplificata — Website Builder** |
| Versione documento | 1.2 |
| Data | 2026-09-07 |
| Stato | Fase A (fondamenti) implementata: SQLite, tenant, piani, sezioni, router. Nessun editor visuale. |
| Ambito | Integrazione nel monorepo esistente, senza seconda applicazione, secondo sistema di autenticazione o secondo sistema tenant |
| Autore | Architetto software / full-stack senior |
| Runtime Railway canonico | `https://gestione-website-builder-production.up.railway.app` (`WEBSITE_BUILDER_APP_URL`) |

---

## 0. Vincoli non negoziabili

1. **Non creare** un secondo sistema di autenticazione.
2. **Non creare** un secondo database o un secondo layer di persistenza parallelo e disconnesso.
3. **Non creare** un secondo sistema multi-tenant.
4. **Non riscrivere** il progetto esistente.
5. **Non spezzare** login, checkout Stripe, licenze, account cliente, dashboard admin, RistoSimply/Ristoword, STATWIN, download protetti, SEO del sito marketing.
6. **Ogni website appartiene a un tenant.** Un tenant può possedere uno o più website. **Mai** accedere ai dati di un altro tenant.
7. RBAC **compatibile** con ruoli e sessioni già esistenti.
8. Il builder è un **modulo interno** della piattaforma Gestione Semplificata, non un’app separata.

Il visual editor (Fase C) **non** è in questo commit. La Fase A di codice è implementata dietro `WEBSITE_BUILDER_ENABLED` (default `false`).

---

## 1. Analisi completa del repository esistente

### 1.1 Identità del prodotto

Il repository è la **Gestione Semplificata Platform** (package root: `gestione-semplificata-platform`). È un’unica applicazione Node.js/Express che ospita:

- il **sito marketing** pubblico (`gestionesemplificata.com`);
- l’**area clienti** (`/account`);
- il **checkout Stripe** e i webhook licenze;
- la **dashboard Super Admin** React (`/admin`);
- la **dashboard Super Admin HTML** (`/super-admin`);
- le API di **validazione licenza** verso Ristoword / RistoSimply;
- i **piani Sito Web** già in vendita (BASE / PRO / PREMIUM).

Non esiste un Website Builder funzionante. Esiste già, invece, il **prodotto commerciale “Sito Web”**: tre SKU Stripe, pagina pricing sulla home, webhook di conferma “il team costruirà il sito a mano”, e una vista admin `/admin/sitiweb` che elenca gli abbonamenti Stripe. Il modulo da costruire **sostituisce il flusso artigianale** con un builder self-service, riusando gli stessi piani e lo stesso account cliente.

### 1.2 Stack tecnologico

| Layer | Tecnologia attuale | Note |
|---|---|---|
| Runtime | Node.js | Avvio: `npm start` → `node backend/server.js` |
| HTTP | Express 4.18 | Un solo processo, porta `PORT` (default 3000) |
| Frontend pubblico | HTML statico + JS vanilla | Template in `backend/src/templates/pages/`, asset in `backend/src/public/` |
| CSS pubblico | CSS custom (`global.css`, `pages.css`, `auth.css`, `dashboard.css`, …) | Nessun framework CSS sul sito pubblico |
| Admin UI | React 18 + Vite 5 + TypeScript + Tailwind 3 + React Router 6 | `backend/admin-dashboard/`, base path `/admin/` |
| Auth | `express-session` + cookie `httpOnly` | Store: `MemoryStore` (`sessionStore.js`) |
| Password | `bcryptjs` | `BCRYPT_ROUNDS` (default 12) |
| Pagamenti | Stripe Checkout + webhook | `stripe` ^14 |
| Email | Nodemailer / SMTP | `assistenza@gestionesemplificata.com` |
| Security HTTP | `helmet` (CSP disabilitata), `cors` selettivo, `express-rate-limit` | Trust proxy = 1 |
| Anti-bot | Honeypot + Cloudflare Turnstile (opzionale) | `antibot.middleware.js` |
| Analytics | GA4 Measurement ID + Data API | Service account JSON in env |
| i18n pubblico | JSON client-side | `it, en, es, fr, de, nl` |
| Persistenza | **File JSON su disco** + repository in-memory | Nessun PostgreSQL / MySQL / MongoDB in produzione |
| Test | Cartelle `unit` / `integration` / `e2e` **vuote** (solo `.gitkeep`) | Nessuna suite automatica oggi |
| Hosting atteso | Railway / VPS / reverse proxy | Variabili `RAILWAY_*`, `GESTIONE_SEMPLIFICATA_BASE_URL` |

Dipendenze backend rilevanti (`backend/package.json`):

- `express`, `express-session`, `express-rate-limit`
- `helmet`, `cors`, `dotenv`
- `jsonwebtoken` (presente; SSO Ristoword è HMAC custom, non JWT library)
- `bcryptjs`, `nodemailer`, `stripe`
- `@google-analytics/data`

**Non presenti** (e da valutare solo se indispensabili, senza spezzare lo stack): React sul frontend cliente, database SQL, Redis, object storage S3, queue worker, WebSocket.

### 1.3 Struttura del repository

```
/workspace
├── package.json                 # orchestratore: start/dev/postinstall
├── README.md
├── backend/
│   ├── server.js                # entrypoint unico
│   ├── .env.example
│   ├── data/                    # JSON persistenti (users.json gitignored)
│   ├── storage/                 # file privati + app protette
│   ├── admin-dashboard/         # SPA React Super Admin
│   ├── docs/                    # Stripe, SEO, flusso Ristoword
│   ├── src/
│   │   ├── config/              # products, stripe, mail, session, contacts
│   │   ├── database/schemas/    # contratti dati (DB-ready, file-backed)
│   │   ├── middlewares/         # auth, admin, superadmin, rateLimit, antibot
│   │   ├── modules/             # bounded context (auth, account, licenses, …)
│   │   ├── routes/              # aggregazione API + admin SPA + webhook
│   │   ├── public/              # css, js, i18n, assets
│   │   ├── templates/pages/     # HTML delle pagine pubbliche
│   │   ├── services/            # admin-stripe, admin-analytics
│   │   └── utils/               # hash, audit, licenseGenerator, seedSuperAdmin
│   └── tests/                   # vuote
├── integrations/ristoword-owner-activate/
└── docs/                        # QUESTO documento
```

Pattern moduli consolidato (da replicare per il builder):

```
modules/<nome>/
  <nome>.routes.js
  <nome>.controller.js
  <nome>.service.js
  <nome>.repository.js
```

Alcune cartelle modulo sono **placeholder vuoti** (`about`, `analytics`, `dashboard`, `feedback`, `products`, `public-site`, `redirects`, `registrations`, `ristoword-access`, `services-page`). Il Website Builder **non** deve occuparle: va creato un modulo nuovo `website-builder` (o `websites`) dedicato, per non confondere bounded context.

`backend/src/core/` (`app.js`, `bootstrap.js`, `router.js`, `server.js`) è vuoto: l’entrypoint reale è `backend/server.js`. Non migrare l’app su `core/` in questa iniziativa.

### 1.4 Persistenza e “database”

**Non c’è un RDBMS.** I dati vivono su file JSON sotto `backend/data/`, con override via env per volume persistente (importante su Railway, dove il filesystem si azzera al deploy).

| Entità | File | Env override | Repository |
|---|---|---|---|
| Utenti / account | `data/users.json` | `USERS_JSON_PATH` | `modules/auth/auth.repository.js` |
| Clienti (archivio acquisti) | `data/customers.json` | `CUSTOMERS_JSON_PATH` | `modules/customers/customers.repository.js` |
| Licenze (repo) | `data/licenses_repo.json` | `LICENSES_REPO_JSON_PATH` | `modules/licenses/licenses.repository.js` |
| Licenze trial/Stripe | `data/licenses.json` | `LICENSES_JSON_PATH` | `utils/licenseGenerator.js` |
| Pagamenti | `data/payments.json` | (path analogo) | `modules/payments/payments.repository.js` |
| Sessioni | memoria processo | — | `config/sessionStore.js` |
| Audit | `logs/audit.log` (gitignored) | `AUDIT_LOG_DIR` | `utils/auditLog.js` |

Schema “DB-ready” già dichiarati in `backend/src/database/schemas/`:

- `users.schema.js`
- `customers.schema.js`
- `licenses.schema.js`
- `payments.schema.js`
- `purchases.schema.js`
- `invoices.schema.js`
- `credentials.schema.js`

Cartelle `models/`, `migrations/`, `seeds/` sono vuote (`.gitkeep`). Gli schema commentano esplicitamente (in inglese nel codice esistente): *pronti per l’integrazione con un database (SQL, NoSQL o file).*

**Implicazione per il builder:** i nuovi aggregati (Website, Page, Section, …) devono seguire **lo stesso contratto**: schema in `database/schemas/`, repository file-backed, path overridable. Non si introduce Postgres “accanto” ai JSON. Se in futuro la mole di pagine/media lo richiederà, si **sostituisce l’implementazione del repository** (stessa interfaccia) con SQLite/Postgres: è evoluzione dello stesso data layer, non un secondo database.

Storage file già presente:

- `backend/storage/private/` — contratti, PDF credenziali, fatture, export
- `backend/storage/protected-apps/` — installer Ristoword, FoodCost, DrinkCost, StaffCost, SuperSuite, STATWIN, Magazine Enterprise

Il media library del builder userà un sottoalbero nuovo, es. `backend/storage/website-media/{tenantId}/{websiteId}/`, **senza** mescolare i binari delle app protette.

### 1.5 Autenticazione (da riusare, non duplicare)

Un solo meccanismo di login: `POST /api/auth/login` → `req.session.user`.

Due tipi di sessione, già distinti:

| Tipo | Identificatore | Campi sessione | Uso |
|---|---|---|---|
| **Customer account** | email + password | `id, email, firstName, lastName, companyName, phone, role, type: 'customer'` | Area `/account`, checkout, futuro builder |
| **Credentials** | username + password | `id, username, customerId, productId, products[]` | Portale download app |

Middleware esistenti (`src/middlewares/auth.middleware.js`):

- `requireAuth` — sessione presente
- `requireCustomerAuth` — sessione con email o `type` (rifiuta le sole credentials di download)
- `requireLicense(productId)` — `session.user.products` contiene il prodotto

Altri endpoint auth: register, trial register, verify-trial-email, logout, `/api/auth/me`, forgot/reset password. Rate limit dedicato (`authLimiter`). Password reset con token hashato.

**Il Website Builder userà esclusivamente `requireCustomerAuth` (cliente) e i middleware Super Admin (operatore).** Nessun JWT parallelo, nessun secondo cookie, nessun Identity Provider nuovo. Se in futuro servirà un token per preview pubblica, sarà un **token di preview firmato e monouso**, analogo all’SSO Ristoword (`ristoword-sso.service.js`), non un nuovo sistema utenti.

`jsonwebtoken` è in `package.json` ma l’SSO Ristoword è HMAC custom (header.payload.signature). Per i token di preview del sito si riusa lo stesso stile, con secret dedicato `WEBSITE_PREVIEW_SECRET`.

### 1.6 Ruoli e RBAC esistenti

Ruoli su `users.schema.js`:

| `role` | Chi | Cosa può fare oggi |
|---|---|---|
| `customer` (default) | Account registrato | Login, `/account`, acquisti, licenze proprie |
| `superadmin` | Titolare / operatori allowlist | `/admin` SPA, `/super-admin` HTML, tutte le `/api/admin/*` |

Super Admin è determinato in **due modi** (da mantenere entrambi):

1. `user.role === 'superadmin'`
2. Email in allowlist: `SUPER_ADMIN_EMAILS` oppure default `basilepaolo@me.com`

Seed all’avvio: `seedSuperAdmin.js` (richiede `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD`) perché il filesystem hosting può azzerarsi.

Secondo canale admin **token-based** (server-to-server): header `X-Admin-Token` / `Authorization: Bearer` confrontato con `ADMIN_API_TOKEN` (`requireAdmin`). Usato per gestione licenze e tool operativi. **Non** è un ruolo utente. Il builder non lo userà per l’editor; potrà usarlo solo per job interni (es. publish da worker), se mai esistessero.

**Non esiste oggi** un ruolo `staff`, `editor`, `agency`. L’estensione RBAC del builder deve **aggiungere membership sul website** (vedi §4.2), non nuovi tipi di login.

### 1.7 Multi-tenancy di fatto (non c’è una tabella Tenant)

Non esiste un modello `Tenant`. L’unità di isolamento è l’**account customer** (`users.id`, prefisso `usr_`).

Campi correlati già presenti:

- `users.companyName`, `vatNumber`, `email`, `stripeCustomerId`
- `customers.id` (`cust_*`) collegato all’acquisto / licenza
- licenze filtrate per `customerId` o per email

**Decisione architetturale (vincolante):**

> **Tenant = account customer esistente (`users.id`).**  
> `tenantId` nei record Website Builder **è sempre** `user.id` del proprietario.  
> Non si crea `tenants.json`, non si crea un Tenant Service parallelo, non si introduce un’organizzazione distinta dall’utente.  
> Se in futuro servirà un’agenzia con più locali, si evolverà **nello stesso** account (membership/collaboratori), non con un secondo albero tenant.

Isolamento obbligatorio in ogni query del builder:

```
website.tenantId === req.session.user.id
```

Eccezione unica: Super Admin (`isSuperAdmin(req) === true`) può leggere/scrivere cross-tenant **solo** dalle API `/api/admin/websites*`, mai dalle API cliente `/api/websites*`.

### 1.8 Catalogo prodotti e piani Sito Web già esistenti

Fonte unica: `backend/src/config/products.config.js`.

SKU Website già definiti:

| `productId` | Nome | Prezzo | Stripe Product ID | Env Price | `access` / `accessType` |
|---|---|---|---|---|---|
| `sitoweb_base` | Sito Web BASE | 99 €/mese | `prod_V3R3fQlqL18WWe` | `STRIPE_PRICE_SITOWEB_BASE` | `sitoweb` |
| `sitoweb_pro` | Sito Web PRO | 199 €/mese | `prod_V3R1bIrwhfEzyc` | `STRIPE_PRICE_SITOWEB_PRO` | `sitoweb` |
| `sitoweb_premium` | Sito Web PREMIUM | 349 €/mese | `prod_V3QyUb18UBHT04` | `STRIPE_PRICE_SITOWEB_PREMIUM` | `sitoweb` |

Altri prodotti da **non toccare** se non per riferimenti di integrazione: Ristoword monthly/annual/trial, RistoSaaS (risto/hotel premium/gold), FoodCost, DrinkCost, StaffCost, SuperSuite, IoChef, Magazine Enterprise, STATWIN (free/premium/pro/trial).

Checkout già funzionante:

- Pulsanti `[data-product-id="sitoweb_*"]` → `POST /api/checkout/:productId` (`checkout.js`)
- Success URL dedicato: `/payment-success?type=sitoweb&plan=...`
- Webhook Stripe: se `productId` inizia per `sitoweb_`, invia email “team inizia entro 24h” e notifica admin. **Non crea ancora un Website.**

`access.resolver.js` **non** gestisce `access === 'sitoweb'`: cade nel ramo `unknown` → redirect `/prodotti`. Va esteso (modifica chirurgica) senza cambiare i rami ristoword/download/bundle.

### 1.9 API e routing

Entrypoint: `backend/server.js`. Ordine rilevante:

1. Helmet, session, trust proxy
2. `POST /api/webhook/stripe` (raw body) **prima** di `express.json()`
3. JSON parser
4. CORS solo su `/api/licenses`
5. **`/api/admin`** → `src/routes/admin.routes.js` (SPA React, `requireSuperAdmin` da `admin.middleware.js`)
6. **`/api`** + rate limit globale → `src/routes/api.js` (include **anche** `modules/admin/admin.routes.js` su `/admin`, Super Admin HTML)
7. SPA admin statica `/admin`, `/admin/*`
8. Static files da `src/public`
9. `/` → redirect `/dashboard`
10. `sitemap.xml`, `robots.txt`
11. Pagine HTML elencate in array `pages`
12. Blog `/blog/:slug`
13. `/super-admin` (404 se non Super Admin)
14. `/account` (account.html se loggato, altrimenti account-entry.html)
15. Catch-all 404 **“Pagina non trovata”**

API già montate in `api.js`:

| Prefisso | Modulo |
|---|---|
| `/api/auth` | login, register, me, reset |
| `/api/accounts` | accounts |
| `/api/account` | dashboard cliente, profilo, password, SSO Ristoword |
| `/api/payments` | pagamenti |
| `/api/checkout` | Stripe Checkout |
| `/api/stripe` | customer portal |
| `/api/trial` | trial |
| `/api/support` | supporto |
| `/api/licenses` | validate (pubblico), CRUD (admin token) |
| `/api/credentials` | credenziali download |
| `/api/download` | file protetti |
| `/api/admin` | (secondo router) super-admin HTML |
| `/api/config/public` | GA4, Turnstile, URL validate licenza |

**Punto di innesto API builder (cliente):** `router.use('/websites', websiteBuilderRoutes)` in `api.js`, protette da `requireCustomerAuth` + guard tenant.

**Punto di innesto renderer pubblico:** middleware Express **subito prima del 404**, che risolve Host/path verso un sito pubblicato. Deve **escludere** host e path già usati da GS (`gestionesemplificata.com`, `/api/*`, `/admin`, `/account`, pagine marketing).

Attenzione al **doppio `/api/admin`**: la SPA e la dashboard HTML condividono il prefisso. Le nuove route admin del builder vanno in `src/routes/admin.routes.js` (quello montato per primo in `server.js`) con path non conflittuali (`/sitiweb` esiste già; aggiungere `/websites` e `/websites/:id`).

### 1.10 UI esistente

**Sito pubblico (vanilla):** navbar, i18n, pricing siti web nella home `dashboard.html` (card BASE/PRO/PREMIUM + extra services), pagine SEO, blog, trial, login/register.

**Area cliente (`account.html` + `account.js`):** profilo, prodotti/licenze, fatture, Stripe Customer Portal, CTA RistoSimply. **Non** ha sezione “I miei siti”. Va estesa, non sostituita.

**Super Admin React (`/admin`):** Overview, Clienti, Licenze, Analytics, Prodotti, Vendite, Supporto, Email, **Siti Web** (`SitiWebPage.tsx` → `GET /api/admin/sitiweb`), Report, Impostazioni, Log, Baccoperbacco. Auth via stesso `/api/auth/login` + check `/api/admin/session`.

**Super Admin HTML (`/super-admin`):** gestione utenti/licenze più operativa (`modules/admin`).

Il visual editor **non** va dentro la SPA Super Admin. Quella resta il pannello titolare. L’editor è uno strumento **del cliente**, allineato visivamente al design GS (DM Sans / Playfair Display, glass-card, palette già in `global.css`) oppure, se la complessità lo impone, una **SPA React dedicata** sullo stesso pattern di `admin-dashboard`, servita sotto `/builder` con `requireCustomerAuth`.

### 1.11 Integrazione RistoSimply / Ristoword

RistoSimply è il nome commerciale; in codice il prodotto è `ristoword_*`. Flusso documentato in `backend/docs/GS_RISTOWORD_FLOW.md`:

1. Trial/acquisto su GS → licenza in `licenses.json`
2. Redirect `ristoword.app/owner-activate?licenseCode=...`
3. Ristoword chiama `GET/POST /api/licenses/validate`
4. Area account: `POST /api/account/ristoword/first-login-link` genera token SSO HMAC (`RISTOWORD_SSO_SECRET`, TTL 90s)

CORS licenze: `ristoword.app`, localhost, Vercel/Netlify preview.

Il Website Builder **non deve** modificare validate/SSO. L’integrazione (Fase 11) è **embed di widget** (menu, prenotazioni, orari) nei siti dei clienti che hanno anche licenza Ristoword attiva, tramite API GS già autenticate lato server (mai esporre il secret SSO al browser del sito pubblicato).

### 1.12 SEO, i18n, sicurezza già in campo

- Sitemap e robots in `server.js`; report in `SEO_FOUNDATION_REPORT.md`, `ADVANCED_SEO_REPORT.md`, `backend/docs/SEO.md`
- i18n marketing: 6 lingue, `localStorage` key `gestionesemplificata_lang`
- Helmet senza CSP (script inline); rate limit globale 300 req/15 min (×100 in dev)
- Session cookie `sameSite: 'lax'`, `secure` in production
- Audit JSON line-based

Il renderer dei siti cliente dovrà emettere meta SEO per-pagina **senza** inquinare sitemap/robots di GS: ogni sito pubblicato ha sitemap propria sul proprio dominio.

### 1.13 Qualità e regressioni

- Nessun test automatico eseguibile
- Checkout e webhook sono critici e fragili (ordine raw body, trial vs sitoweb)
- Sessioni in memoria: restart = logout. Accettato oggi; il builder non introduce Redis in Fase 1
- `users.json` gitignored; altri JSON in `data/` risultano versionati — i nuovi file builder **non** vanno committati con dati reali (gitignore + env path)

---

## 2. Cosa si riusa (e cosa non si tocca)

### 2.1 Riuso obbligatorio

| Capacità | Dove | Come la usa il builder |
|---|---|---|
| Login / sessione | `auth.*`, `requireCustomerAuth` | Unico ingresso editor e API |
| Ruolo Super Admin | `admin.middleware`, `superadmin.middleware` | Supervisione, accesso in sola lettura per supporto, sblocco piani |
| Account cliente | `/account`, `account.service` | Entry “I miei siti”, entitlement, profilo azienda |
| Catalogo e Stripe | `products.config.js`, checkout, webhook | Piani BASE/PRO/PREMIUM, billing, portal |
| Customer record | `customers.repository` | Collegare website ↔ acquirente |
| Licenze | `licenses.repository` + `licenseGenerator` | Entitlement sitoweb + widget RistoSimply |
| Storage su disco | `backend/storage/` | Media per tenant |
| Pattern repository JSON | `auth.repository`, `licenses.repository` | Stesso I/O, stessi override env |
| Schema DB-ready | `database/schemas/` | Nuovi schema affiancati, stesso stile |
| Audit log | `auditLog.js` | Eventi `website.*`, `publish.*`, `domain.*` |
| Mail | `config/mail.js` | Conferma publish, form lead, dominio |
| Rate limit | `rateLimit.middleware.js` | Limiter dedicato upload e AI |
| Admin SPA | `admin-dashboard` | Estendere `SitiWebPage`, non sostituirla |
| i18n GS | `/i18n/*.json` | Solo stringhe marketing GS; i siti cliente hanno i18n proprio |
| Helmet / CORS | `server.js` | Estendere CORS solo se serve preview |

### 2.2 Non toccare (salvo innesti minimi documentati)

- Flusso trial Ristoword e `/api/licenses/validate`
- SSO Ristoword
- Download protetti e `protected-apps/`
- STATWIN, FoodCost, DrinkCost, StaffCost, SuperSuite, IoChef
- GA4 del sito GS (i siti cliente avranno measurement ID opzionale proprio)
- HTML delle landing SEO (`software-gestionale-ristorante`, blog, ecc.) tranne link “I miei siti” in navbar account
- `MemoryStore` sessioni (nessuna migrazione Redis in questa iniziativa)

### 2.3 Innesti minimi consentiti (elenco chiuso)

File esistenti che **dovranno** essere toccati in fasi successive, in modo chirurgico:

1. `backend/server.js` — mount renderer + pagina `/builder`
2. `backend/src/routes/api.js` — `router.use('/websites', …)`
3. `backend/src/routes/admin.routes.js` — API admin websites
4. `backend/src/config/products.config.js` — metadata limiti piano (non cambiare prezzi/SKU)
5. `backend/src/modules/payments/access.resolver.js` — ramo `sitoweb`
6. `backend/src/routes/webhook.routes.js` — dopo pagamento sitoweb, **provisioning Website** invece della sola email artigianale
7. `backend/src/modules/payments/checkout.service.js` — success URL verso `/account#siti` quando l’utente è loggato
8. `backend/src/templates/pages/account.html` + `account.js` — card “I miei siti”
9. `backend/src/templates/pages/payment-success.html` — ramo `type=sitoweb` con CTA builder
10. `backend/admin-dashboard/src/pages/SitiWebPage.tsx` + `App.tsx` / `Sidebar.tsx` — elenco siti reali oltre agli abbonamenti Stripe
11. `backend/.env.example` — path JSON, secret preview, limiti upload
12. `.gitignore` — `backend/data/websites*.json`, media uploads
13. `backend/src/modules/account/account.service.js` — includere websites nell’aggregato dashboard

---

## 3. Modello di dominio

Tutti gli aggregati includono `tenantId`. Qualsiasi read/write senza filtro tenant è un bug di sicurezza.

### 3.1 Tenant (esistente)

```
Tenant ≡ User (role=customer)
  id            = users.id          // usr_...
  email         = users.email
  companyName   = users.companyName
  stripeCustomerId
```

Nessuna nuova tabella Tenant. Il servizio builder espone `getTenantId(req) => req.session.user.id`.

### 3.2 Website

Sito appartenente a un tenant. Un tenant può averne N, nei limiti del piano.

```
Website {
  id, tenantId,
  name, slug,                // slug unico per tenant (usato nel sottodominio default)
  planId,                    // sitoweb_base | sitoweb_pro | sitoweb_premium
  status,                    // draft | published | unpublished | suspended
  themeId,
  localeDefault,             // it (default)
  locales[],                 // i18n — PRO/PREMIUM
  primaryDomainId,
  settings: WebsiteSettings,
  publishedSnapshotId,
  createdAt, updatedAt, publishedAt
}
```

Slug default: `{slug}.sites.gestionesemplificata.com` (host da configurare in DNS/proxy in Fase H; fino ad allora preview su path `/p/{websiteId}` autenticata).

### 3.3 Pages

```
Page {
  id, tenantId, websiteId,
  title, path,               // path unico nel website, es. /, /menu, /contatti
  status,                    // draft | published
  seo: { title, description, ogImage, canonical, noindex, jsonLd },
  locale,
  isHome,
  sortOrder,
  createdAt, updatedAt
}
```

### 3.4 Sections

Blocco ordinato in una pagina. Schema JSON versionato (`schemaVersion`) per evolvere i tipi senza migrare a mano.

```
Section {
  id, tenantId, websiteId, pageId,
  type,                      // vedi catalogo Fase 3
  sortOrder,
  visible,
  props,                     // oggetto JSON del tipo
  localeOverrides,           // { en: { props... } }
  schemaVersion,
  createdAt, updatedAt
}
```

Le section **non** sono HTML libero di default (XSS). L’HTML custom è un tipo `html` riservato a PREMIUM, sanitizzato server-side.

### 3.5 Templates

Starter di settore (ristorante, pizzeria, hotel, bar, professionista, generico). Compongono pagine + section + theme preset. Sono **globali** (non tenant), in sola lettura per i customer; Super Admin può aggiornare il catalogo.

```
Template {
  id, key, name, category, previewImage,
  themeId, defaultPages[], defaultSections[],
  requiredPlan,              // base può usare un subset
  createdAt, updatedAt
}
```

Applicare un template a un website **vuoto** clona le pagine nel tenant. Non sovrascrive un sito già popolato senza conferma esplicita.

### 3.6 Themes

```
Theme {
  id, key, name,
  tokens: { colors, fonts, radius, spacing },
  customCss,                 // PREMIUM, sanitizzato
  requiredPlan
}
```

Il website memorizza `themeId` + eventuali override token (`settings.themeOverrides`) per non forkare il tema globale.

### 3.7 Media Library

```
MediaAsset {
  id, tenantId, websiteId,
  filename, mime, size, width, height,
  storagePath,               // relativo a storage/website-media
  alt, folder,
  createdByUserId,
  createdAt
}
```

Limiti per piano (quota MB e numero file) applicati **prima** della scrittura su disco. Path fisico **sempre** prefissato con `tenantId` per impedire path traversal cross-tenant (`getProtectedPath` è il precedente da copiare).

### 3.8 Navigation

```
Navigation {
  id, tenantId, websiteId,
  location,                  // header | footer | legal
  items: [{ label, href, pageId, children[], locale }]
}
```

Un albero per location. I `href` interni puntano a `pageId`; gli esterni sono URL allowlistati (`https:` only).

### 3.9 Forms

```
Form {
  id, tenantId, websiteId,
  name, fields[],
  notifyEmail,               // default: email tenant
  storeSubmissions,
  successMessage,
  createdAt
}
FormSubmission {
  id, tenantId, websiteId, formId,
  payload, ipHash, userAgent,
  createdAt
}
```

Antispam: honeypot + Turnstile riusando `antibot.middleware.js`. Rate limit per IP. PII: retention configurabile; export CSV solo al proprietario del tenant.

### 3.10 SEO

Campi per Website (global) e per Page. Generazione:

- `sitemap.xml` e `robots.txt` **del dominio del cliente**
- canonical, OG, Twitter, JSON-LD `Restaurant` / `Hotel` / `LocalBusiness` da settings
- `noindex` automatico su preview e su siti `unpublished`

Non modificare la sitemap di `gestionesemplificata.com` se non per una landing “crea il tuo sito” già esistente.

### 3.11 Domains

```
Domain {
  id, tenantId, websiteId,
  hostname,                  // www.esempio.it
  type,                      // subdomain | custom
  status,                    // pending_dns | verifying | active | error
  sslStatus,
  verifiedAt,
  createdAt
}
```

Fase iniziale: solo sottodominio GS. Custom domain da PREMIUM (e PRO se il commerciale lo include: oggi il copy BASE dice “dominio incluso” — il provisioning resta manuale/operatore finché non c’è integrazione registrar). Esiste un branch remoto `cursor/scegli-dominio-openprovider-2d75`: da valutare come **provider futuro**, non bloccante per A–G.

### 3.12 Publishing

Separazione **draft** vs **live**:

- l’editor scrive sempre il grafo draft (pages/sections correnti);
- **Publish** congela uno `PublishSnapshot` immutabile (JSON serializzato di pages + sections + nav + theme + settings);
- il renderer pubblico legge **solo** lo snapshot;
- rollback = riattivare snapshot precedente.

```
PublishSnapshot {
  id, tenantId, websiteId,
  version,
  payload,                   // JSON
  publishedByUserId,
  createdAt
}
```

### 3.13 Website settings

```
WebsiteSettings {
  businessName, tagline, phone, email, whatsapp, address, mapsUrl,
  openingHours[],
  socials: { instagram, facebook, tripadvisor, google },
  faviconMediaId, logoMediaId,
  ga4MeasurementId,          // opzionale, sito cliente
  cookieBanner,
  restaurant: { cuisine, priceRange, bookingUrl, menuSource },  // per JSON-LD e widget RistoSimply
  ristoword: { enabled, licenseLinked }
}
```

Niente segreti (SSO, Stripe) in settings.

### 3.14 AI assistant

Non è un prodotto separato. È un **servizio interno** `website-builder/ai.service.js` che:

- riceve intent (testo, tipo pagina, lingua);
- restituisce **JSON di section** validato contro lo schema tipi (mai HTML arbitrario);
- viene invocato solo da API autenticate del tenant;
- quota per piano (BASE: off o N prompt/mese; PRO: limitato; PREMIUM: alto);
- chiavi LLM solo in env (`WEBSITE_AI_API_KEY`), mai nel frontend.

Se la chiave non è configurata, l’API risponde 503 con messaggio chiaro, come già fa Stripe quando manca `STRIPE_SECRET_KEY`.

---

## 4. Tenant isolation e RBAC

### 4.1 Regole di isolamento

1. Ogni record builder ha `tenantId`.
2. Le API `/api/websites*` impostano `tenantId` dal session user, **mai** dal body cliente.
3. `websiteId` in path viene caricato e verificato: se `website.tenantId !== session.user.id` → **404** (non 403, per non leakare esistenza). Super Admin sulle API `/api/admin/websites*` può vedere tutti i tenant.
4. File media: `resolve(storageRoot, tenantId, websiteId, filename)` deve rimanere sotto `storageRoot/tenantId`.
5. Renderer pubblico: risolve hostname → website. Nessun dato di altri tenant nella risposta.
6. Form submission, AI log, snapshot: stesso filtro.
7. Liste paginate: query sempre `WHERE tenantId = ?` (filtro in repository).

Middleware dedicato (nuovo, ma basato sui precedenti):

```
requireCustomerAuth
  → loadWebsiteFromParam
    → assertWebsiteOwnedByTenant   // 404 se mismatch
      → assertPlanFeature(feature) // 403 se piano insufficiente
```

Non sostituisce `requireCustomerAuth`. Lo **incatena**.

### 4.2 RBAC compatibile

Ruoli **piattaforma** (invariati): `customer` | `superadmin`.

Ruoli **per website** (nuovi, tabella membership, stesso user id):

| Ruolo website | Chi | Permessi |
|---|---|---|
| `owner` | Il tenant (user.id creatore) | Tutti, billing, delete, invite |
| `editor` | Collaboratore invitato (stesso users table, email già registrata o invite) | Pagine, section, media, publish se piano lo consente |
| `viewer` | Collaboratore | Solo preview |

Invito collaboratore: **non** crea un secondo user system. Se l’email non ha account GS, si invita a `/register` esistente e poi si collega la membership. Un Super Admin non diventa `owner`; opera da `/api/admin`.

Matrice sintetica:

| Azione | customer owner | editor | viewer | superadmin |
|---|---|---|---|---|
| Creare website (entro quota piano) | sì | no | no | sì (impersonando tenant) |
| Edit pagine/section | sì | sì | no | sì |
| Publish | sì | se granted | no | sì |
| Domini / settings billing | sì | no | no | sì |
| Vedere altri tenant | no | no | no | sì |
| Cancellare website | sì | no | no | sì |

Feature flag per piano (`assertPlanFeature`):

| Feature | BASE | PRO | PREMIUM |
|---|---|---|---|
| N. website | 1 | 2 | 5 (configurabile) |
| N. pagine | 8 | 25 | illimitato soft (es. 200) |
| Template settore | subset | tutti | tutti + custom |
| Blog / news | no | sì | sì |
| SEO avanzato (JSON-LD, sitemap) | base | sì | sì |
| i18n extra lingue | no | 2 | 6 |
| Custom domain | provisioning assistito | sì | sì |
| Form avanzati / prenotazione | contatto only | + newsletter | + prenotazione / preventivo |
| Widget RistoSimply | no | sì se licenza RW | sì |
| AI assistant | no | quota bassa | quota alta |
| CSS custom / HTML section | no | no | sì |
| Collaboratori | 0 | 2 | 10 |

I numeri devono restare in `products.config.js` (campo nuovo `features` / `limits` sugli SKU `sitoweb_*`) per non disallinearsi dal commerciale.

---

## 5. Architettura runtime proposta

### 5.1 Un solo processo Express

```
[Browser cliente] --cookie sessione--> Express
                         |
                         +-- /api/auth, /api/account, /api/checkout   (esistenti)
                         +-- /api/websites/*                         (NUOVO, requireCustomerAuth)
                         +-- /api/admin/websites*                    (NUOVO, requireSuperAdmin)
                         +-- /builder/*                              (NUOVO SPA o pagine editor)
                         +-- Host != GS  --> renderer snapshot        (NUOVO, pubblico)
                         +-- path GS esistenti                       (invariati)
```

Nessun microservizio, nessun secondo `package.json` applicativo. Eventuale SPA editor è analoga ad `admin-dashboard`: build Vite → `dist` servito da Express.

### 5.2 Scelta UI editor (decisione)

Due opzioni valutate:

| Opzione | Pro | Contro | Decisione |
|---|---|---|---|
| A. Estendere `account.html` vanilla | Zero nuove dipendenze | Editor visuale drag-and-drop ingestibile in vanilla | Scartata per il canvas |
| B. Inserire l’editor nella SPA `/admin` | React già pronto | È Super Admin: i clienti non possono accedervi senza rompere RBAC | Scartata |
| C. Nuova SPA Vite React `backend/website-builder-ui/` servita su `/builder`, auth cookie GS | Stesso pattern admin-dashboard; isolamento UI; riuso Tailwind/React | Nuova cartella UI (non nuova app: stesso server, stesso auth) | **Scelta** |

La SPA editor **non è una seconda applicazione**: non ha server proprio, non ha auth propria, non ha database. È un frontend statico compilato, come `admin-dashboard`.

Shell account vanilla resta per “I miei siti” (lista, piano, apri editor). Il canvas vive in `/builder/:websiteId`.

### 5.3 Renderer pubblico

Modulo `modules/website-renderer/`:

1. Estrae `Host`
2. Se Host è di GS (lista allow: `gestionesemplificata.com`, `www.`, localhost) → `next()`
3. Cerca `Domain` attivo o sottodominio `{slug}.sites....`
4. Se website `published` con snapshot → render HTML da snapshot (template sicuro, escape)
5. Altrimenti 404 generico, **senza** rivelare tenant

Preview autenticata: `/builder/:id/preview` (iframe) e token firmati `/preview/:token` per share (TTL breve, `noindex`).

### 5.4 Persistenza builder

File (fase implementativa, stesso pattern):

| File | Env |
|---|---|
| `data/wb_websites.json` | `WB_WEBSITES_JSON_PATH` |
| `data/wb_pages.json` | `WB_PAGES_JSON_PATH` |
| `data/wb_sections.json` | `WB_SECTIONS_JSON_PATH` |
| `data/wb_media.json` | `WB_MEDIA_JSON_PATH` |
| `data/wb_navigations.json` | `WB_NAV_JSON_PATH` |
| `data/wb_forms.json` + `wb_submissions.json` | `WB_FORMS_JSON_PATH` |
| `data/wb_domains.json` | `WB_DOMAINS_JSON_PATH` |
| `data/wb_snapshots.json` | `WB_SNAPSHOTS_JSON_PATH` |
| `data/wb_templates.json` | catalogo globale versionabile |
| `data/wb_memberships.json` | collaboratori |

Repository con lock in-process (write sincrono come `auth.repository`). Documentare il limite: non adatto a cluster PM2 multi-istanza senza disco condiviso — **stesso vincolo già scritto** per `licenses.json`.

Media: filesystem `storage/website-media/` + env `WB_MEDIA_ROOT`.

---

## 6. Le 15 fasi prodotto (contratto con il committente)

Queste 15 fasi sono il perimetro funzionale richiesto. Il mapping verso lo sprint tecnico A–J è in §7.

### Fase 1 — Architettura *(questa fase)*

Analisi repo, vincoli, modello dati, RBAC, piano file, roadmap. Deliverable: il presente documento. **Nessun editor in produzione.**

### Fase 2 — Editor visuale

Canvas WYSIWYG per pagine: selezione section, riordino, editing props, preview desktop/tablet/mobile, undo locale, salvataggio draft su API. SPA `/builder/:websiteId`. Autenticazione sessione GS. Isolamento tenant su ogni fetch.

### Fase 3 — Sections

Catalogo versionato. Tipi minimi:

- `hero`, `richText`, `image`, `gallery`, `video`
- `features`, `cta`, `separator`
- `menuList` (piatti), `openingHours`, `map`
- `testimonials`, `events`, `offers`
- `contactForm`, `team`, `faq`
- `html` (solo PREMIUM, sanitizzato)
- `ristosimplyMenu`, `ristosimplyBooking` (Fase 11, feature-flag)

Ogni tipo: schema JSON (campi, default, piano minimo), componente React editor, componente renderer.

### Fase 4 — Templates e themes

Catalogo iniziale: Ristorante, Pizzeria, Bar, Hotel, Professionista, Landing generica. Temi con token (colori, font). Applicazione template solo su sito vuoto o con overwrite confermato. Preview template senza copiare dati nel tenant finché l’utente non conferma.

### Fase 5 — Assistente AI

Prompt → proposta section/testi in italiano (e lingue piano). Output JSON validato. Quota. Disabilitato se manca API key. Nessun training su dati di altri tenant. Log prompt senza PII non necessaria.

### Fase 6 — Media library

Upload (jpeg/png/webp/gif/svg controllato), scan MIME reale, limite size, resize/orientamento in fase successiva. Alt text obbligatorio per publish SEO. Cartelle logiche. Delete con check riferimenti nelle section. Quota piano.

### Fase 7 — Publishing

Bozza contro sito live, snapshot immutabili, pubblicazione/ritiro, rollback, stato `suspended` (mancato pagamento Stripe). Job di coerenza: se l’abbonamento Stripe è `canceled`/`past_due`, Super Admin e webhook impostano `suspended` e il renderer mostra la pagina «sito temporaneamente non disponibile» senza rivelare dati del tenant.

### Fase 8 — Domains

Sottodominio `*.sites.gestionesemplificata.com`. Dominio personalizzato: istruzioni DNS (CNAME), verifica TXT, stato in interfaccia. SSL: dal reverse proxy (Caddy/Nginx/Railway) — il processo Node non termina i certificati in Fase 8. Integrazione OpenProvider: analisi separata, fuori dal percorso critico.

### Fase 9 — SEO

Meta per pagina, OG, canonical, sitemap/robots per host cliente, JSON-LD LocalBusiness, `noindex` su non-prod. Allineamento con le pratiche già usate sul sito GS (`backend/docs/SEO.md`) ma **namespace separato**.

### Fase 10 — i18n siti cliente

Lingue extra su PRO/PREMIUM. Switcher. `localeOverrides` sulle section. Non confondere con i18n marketing GS (`/i18n/it.json`). Default `it`.

### Fase 11 — Integrazione RistoSimply

Se il tenant ha licenza Ristoword **attiva** (stesso controllo di `findActiveRistowordLicense`):

- toggle in settings;
- section widget menu / prenotazione che puntano a URL Ristoword o a feed consentiti;
- nessun embedding del secret SSO nel sito pubblico;
- se la licenza scade, i widget si degradano a CTA “scopri RistoSimply” o si nascondono.

Non duplicare il gestionale nel builder.

### Fase 12 — Dashboard

Due superfici:

1. **Cliente** (`/account`): lista siti, piano, stato publish, CTA editor, dominio.
2. **Super Admin** (`/admin/sitiweb`): KPI Stripe **già esistenti** + tabella websites reali (tenant, piano, stato, dominio, ultima publish). Dettaglio per supporto. Nessun editor completo nel pannello admin (evita due editor da mantenere): link “apri come supporto” opzionale e auditato.

### Fase 13 — Piani commerciali

Riuso SKU `sitoweb_base|pro|premium`. Webhook: provisioning automatico del Website al primo pagamento (sostituisce copy “ti contatteremo”). Upgrade/downgrade: Stripe Customer Portal già esistente; il builder ricalcola `planId` da subscription e applica limits (downgrade: sito resta visibile ma feature extra in sola lettura).

### Fase 14 — Security

Vedi §9. OWASP: IDOR tenant, XSS renderer, upload, CSRF (cookie sameSite lax + same origin), SSRF nei webhook form, path traversal media, abuse AI.

### Fase 15 — Qualità

Test unitari repository isolation, test integrazione API 401/404 cross-tenant, smoke checkout sitoweb, checklist regressione §8. Introduzione progressiva di test in `backend/tests/` (oggi vuota).

---

## 7. Roadmap implementativa A–J

Ordine vincolante. Non anticipare il canvas prima di A–B.

### Fase A — Fondamenti (dati + isolamento) — **implementata**

- [x] SQLite + migrazioni: `websites`, `pages`, `page_i18n`, `sections`, `media_assets`, `domains`, `versions` (+ navigation, forms, members, ai_jobs, audit)
- [x] Utenti GS restano in `users.json` — il SQLite non è un secondo user/tenant system
- [x] Feature flag `WEBSITE_BUILDER_ENABLED` (default off) prima del mount API in `server.js`
- [x] `req.tenantId = req.session.user.id` (mai dal body)
- [x] `plans.config.js` limiti server-side; mapping `sitoweb_base=STARTER`, `sitoweb_pro=BUSINESS`, `sitoweb_premium=PROFESSIONAL`
- [x] Section registry + JSON Schema AJV (18 tipi)
- [x] Router `/api/website-builder` montato dopo `/api/admin` e prima del limiter `/api`
- [x] `GET /health` e `GET /status` (runtime URL Railway)
- [x] Test isolation: due utenti, **403** cross-tenant
- [x] Smoke `/api/auth/me` e `/api/licenses/validate`
- [x] **Nessuna UI editor** (Fase C)

### Fase B — Website CRUD + account + webhook provisioning

- `POST/GET/PATCH/DELETE /api/websites`
- Webhook sitoweb: crea website draft + membership owner (idempotente su `stripeSessionId`)
- Card “I miei siti” in `/account`
- `payment-success` CTA
- `access.resolver` ramo sitoweb → `/account#siti`
- Admin: conteggio websites accanto agli ordini Stripe

### Fase C — Pagine, sezioni ed editor visuale

- API pages/sections CRUD
- SPA `/builder` (Vite React, cookie credentials)
- Catalogo section minimo (hero, testo, immagine, cta, contatti, orari)
- Preview iframe draft
- Non rompere `/admin` build

### Fase D — Templates e themes

- Seed template JSON
- Apply template
- Theme tokens + override colori in settings

### Fase E — Media library

- Upload multipart, MIME allowlist, quota
- Picker nell’editor
- Storage path tenant-safe

### Fase F — Navigation e Forms

- Nav header/footer
- Form contatto + submissions + email `mail.js`
- Antibot + rate limit

### Fase G — SEO e i18n

- Campi SEO page/website
- Sitemap/robots per renderer
- Locales PRO/PREMIUM

### Fase H — Publishing e renderer pubblico

- Snapshot
- Middleware host-based (non interferire con path GS)
- Unpublish / suspend da webhook billing

### Fase I — Domains + AI assistant

- Custom domain verification
- AI JSON generation con quote
- Feature flags piano

### Fase J — RistoSimply widgets, polish commerciale, security review, qualità

- Widget condizionati a licenza RW
- Allineamento copy pricing home vs limits reali
- Audit IDOR, upload, XSS
- Test e2e smoke: login → crea sito → edit → publish
- Hardening headers per renderer (CSP propria dei siti cliente, distinta da GS)

---

## 8. Impatto sul sistema esistente e strategia anti-regressione

### 8.1 Superfici a rischio

| Superficie | Rischio | Mitigazione |
|---|---|---|
| `server.js` 404 catch-all | Renderer “mangia” le pagine GS | Allowlist host GS → sempre `next()`; matcher solo su Host custom/subdomain |
| `/api/admin` doppio router | Collisioni path | Path nuovi `/websites` non usati; non rinominare `/sitiweb` |
| Webhook Stripe | Rompere trial Ristoword | Ramo `isSitoWeb` già isolato; provisioning **dentro** quel ramo; trial invariato |
| Checkout success URL | Clienti app scaricabili | Cambiare URL solo se `productId.startsWith('sitoweb_')` (già vero) |
| Session / cookie | SPA builder su path diverso | Stesso cookie `path: '/'`; `credentials: 'include'` come admin-dashboard |
| `products.config.js` | Prezzi/SKU sbagliati | Aggiungere solo chiavi `limits`/`features`; non cambiare `id`/`price`/`stripeProductId` |
| Account dashboard | Layout rotto | Sezione nuova in fondo; `account.js` funzioni esistenti intatte |
| Build SPA admin | Errore TypeScript | Estendere pagine, non cambiare `vite.base` |
| Static `/` e sitemap GS | URL siti cliente in sitemap GS | Vietato; sitemap cliente solo sul loro Host |
| Rate limit globale | Upload/AI 429 | Limiter dedicato **prima** o route escluse come il webhook |

### 8.2 Checklist di regressione (da eseguire prima di ogni merge di fase A–J)

1. `POST /api/auth/login` customer e superadmin
2. `/account` carica profilo e licenze Ristoword
3. `POST /api/checkout/ristoword_monthly` (o mock) non cambia metadata
4. Webhook trial: licenza `trialing`, email, redirect owner-activate
5. `GET/POST /api/licenses/validate` CORS Ristoword
6. Download app con codice licenza
7. `/admin` overview e `/admin/sitiweb` (KPI Stripe)
8. `/super-admin` 404 per non-admin
9. Home `/dashboard` pricing tre piani sitoweb cliccabili
10. `sitemap.xml` e `robots.txt` GS invariati nei path Disallow
11. i18n selector IT/EN sul marketing
12. Checkout `sitoweb_pro` → payment-success tipo sitoweb
13. **Nuovo:** utente A non ottiene `GET /api/websites/:idDiB` (atteso 404)
14. Path marketing `/ristoword`, `/prodotti`, `/login` ancora serviti come HTML GS

### 8.3 Compatibilità commerciale

Il copy attuale promette “il team inizia entro 24 ore”. Quando il builder è live, il webhook deve:

- creare il sito in draft;
- inviare email **nuova** (“il tuo sito è pronto da personalizzare in Area Clienti”) **sostituendo** il copy artigianale, con fallback: se provisioning fallisce, restano email + notifica admin (nessun silenzio).

---

## 9. Security (Fase 14, vincoli già in Fase A)

1. **IDOR / tenant:** filtro obbligatorio in repository, non solo in controller.
2. **Preview token:** HMAC, TTL breve, `noindex`, un websiteId nel payload.
3. **Upload:** allowlist MIME + magic bytes; no SVG scriptabile se possibile (o sanitizzazione); max size; no overwrite path.
4. **XSS:** renderer escape; niente `innerHTML` con props utente; HTML custom PREMIUM con sanitizer allowlist tag.
5. **CSRF:** stesse origini; mutazioni JSON + cookie `SameSite=lax` (come oggi). Non allargare CORS a `*` per `/api/websites`.
6. **SSRF:** form notifyEmail solo email tenant o dominio allowlist; URL esterni in section `image`/`video` validati (https).
7. **Billing bypass:** `assertPlanFeature` server-side; la UI nasconde, il server rifiuta.
8. **Suspended:** renderer non serve snapshot se Stripe non active/trialing (con grace period configurabile).
9. **Secrets:** nessuna API key nel payload snapshot pubblicato.
10. **Audit:** `website.create`, `website.publish`, `website.delete`, `domain.add`, `admin.website.access`.
11. **Collaboratori:** invite per email già nel sistema utenti; nessun password share.
12. **Rate limit** AI e submit form.

---

## 10. Dipendenze nuove (da introdurre solo quando la fase lo richiede)

| Dipendenza | Fase | Perché | Vincolo |
|---|---|---|---|
| SPA React (stesse versioni di admin-dashboard: React 18, Vite 5, Tailwind 3, RR 6) | C | Editor visuale | Cartella UI, non nuovo server |
| `multer` (o equivalente) | E | Upload multipart | Limite size, disk storage sotto tenant path |
| Libreria sanitize HTML (es. `sanitize-html`) | C/J | Section html PREMIUM | Allowlist stretta |
| Client LLM (fetch nativo o SDK minimo) | I | AI | Opzionale; feature off senza env |
| `sharp` (opzionale) | E+ | Resize immagini | Native addon: valutare compatibilità Railway; Fase E può salvare originali |

**Non** aggiungere in Fase 1–B: database SQL, Redis, Elasticsearch, headless Chrome, Kubernetes.

Nuove env (`.env.example` — placeholder, nessun segreto):

```
WEBSITE_BUILDER_ENABLED=false
WEBSITE_BUILDER_APP_URL=https://gestione-website-builder-production.up.railway.app
WEBSITE_BUILDER_SQLITE_PATH=
OPENAI_API_KEY=
WB_MEDIA_ROOT=
WEBSITE_PREVIEW_SECRET=
SITES_ROOT_DOMAIN=sites.gestionesemplificata.com
```

`WEBSITE_BUILDER_APP_URL` è il **runtime Railway canonico** del satellite (stesso contratto di STATWIN: identità e fatturazione restano su Gestione Semplificata; editor e renderer pubblici potranno girare su quell’host). Finché il repository `gestione-website-builder` non è scrivibile, **tutto il codice vive in questo repository**.

---

## 11. File da creare e da modificare

### 11.1 File da creare (non in questa PR di sola documentazione)

```
backend/src/database/schemas/websites.schema.js
backend/src/database/schemas/website-pages.schema.js
backend/src/database/schemas/website-sections.schema.js
backend/src/database/schemas/website-media.schema.js
backend/src/database/schemas/website-navigation.schema.js
backend/src/database/schemas/website-forms.schema.js
backend/src/database/schemas/website-domains.schema.js
backend/src/database/schemas/website-snapshots.schema.js
backend/src/database/schemas/website-memberships.schema.js
backend/src/database/schemas/website-templates.schema.js

backend/src/modules/website-builder/
  websites.repository.js
  websites.service.js
  websites.controller.js
  websites.routes.js
  pages.repository.js
  pages.service.js
  sections.repository.js
  sections.catalog.js
  media.service.js
  publishing.service.js
  entitlement.service.js          # piano Stripe/licenza sitoweb
  tenant.guard.js
  ai.service.js                   # Fase I
  templates.seed.json

backend/src/modules/website-renderer/
  renderer.middleware.js
  snapshot.render.js
  html-escape.js

backend/src/middlewares/sitoweb-entitlement.middleware.js

backend/website-builder-ui/               # SPA Vite, Fase C
  package.json
  vite.config.ts                    # base: '/builder/'
  src/App.tsx
  src/canvas/...
  src/api/client.ts                 # fetch credentials: 'include'

backend/storage/website-media/.gitkeep
backend/tests/unit/website-tenant-isolation.test.js
backend/tests/integration/websites-api.test.js
```

Pagine HTML minime (Fase B, prima della SPA):

```
backend/src/templates/pages/builder-entry.html   # redirect a SPA o lista
```

### 11.2 File da modificare (innesti)

Vedi elenco chiuso §2.3. In più, quando la SPA esiste:

- `backend/package.json` — script `build:builder` analogo a `build:admin`
- `backend/server.js` — static `/builder/assets`, `requireCustomerAuth` su `/builder` e `/builder/*` (come `/admin` usa `requireSuperAdmin`)
- `backend/src/public/i18n/*.json` — chiavi “I miei siti” / “Website Builder” sul marketing/account se visibili in navbar

### 11.3 File di questa fase

Oltre a questo documento: modulo `backend/src/modules/website-builder/` (Fase A, dietro `WEBSITE_BUILDER_ENABLED`), innesti in `server.js`, `products.config.js`, `.env.example`, `.gitignore`. Nessun editor visuale.

---

## 12. Piano tecnico prima di qualsiasi cambiamento strutturale

Ordine di lavoro quando partirà il codice (Fase A):

1. Leggere di nuovo questo documento e lo checklist §8.2.
2. Aggiornare `.gitignore` e `.env.example` (path vuoti).
3. Aggiungere **solo** chiavi `limits`/`features` in `products.config.js` sugli SKU sitoweb esistenti.
4. Creare schema + repository websites con filtro tenant nel repository (non nel solo controller).
5. Creare `tenant.guard.js` e test di isolamento.
6. Montare `/api/websites` in `api.js` dietro `WEBSITE_BUILDER_ENABLED`, **dopo** aver verificato che `/api/auth/me` e `/api/account/dashboard` restano invariati.
7. Solo allora webhook provisioning (idempotente).
8. Solo allora UI account.
9. Solo allora SPA editor (Fase C) in cartella nuova, `base: '/builder/'`, proxy `/api` come `admin-dashboard`.
10. Il renderer host-based è **l’ultimo** innesto in `server.js` (Fase H), con test espliciti che `/dashboard` e `/ristoword` restano HTML GS.

Divieto: non “preparare” il visual editor in parallelo ad A. Non copiare `admin-dashboard` rinominandolo prima dei guard tenant.

---

## 13. Contratto API (bozza stabile, da implementare da Fase A/B)

Tutte le route cliente: cookie sessione, `requireCustomerAuth`.

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/api/websites` | Lista del tenant corrente |
| POST | `/api/websites` | Crea (quota piano) |
| GET | `/api/websites/:id` | Dettaglio se di proprietà del tenant |
| PATCH | `/api/websites/:id` | Impostazioni e tema |
| DELETE | `/api/websites/:id` | Eliminazione logica o definitiva, solo proprietario |
| GET/POST | `/api/websites/:id/pages` | Pagine |
| PATCH/DELETE | `/api/websites/:id/pages/:pageId` | Pagina |
| GET/PUT | `/api/websites/:id/pages/:pageId/sections` | Sezioni ordinate |
| POST | `/api/websites/:id/media` | Caricamento file |
| POST | `/api/websites/:id/publish` | Snapshot e stato pubblicato |
| POST | `/api/websites/:id/unpublish` | Ritiro dalla pubblicazione |
| GET | `/api/admin/websites` | Super Admin, tutti i tenant |

Errori: 401 non autenticato; 404 IDOR; 403 piano insufficiente o ruolo membership; 409 slug duplicato nel tenant; 429 rate limit.

---

## 14. Decisioni esplicite (ADR sintetici)

**ADR-1 — Tenant = `users.id`.** Evita un secondo tenant system. Revisione solo se nascerà un vero modello Agenzia multi-P.IVA.

**ADR-2 — Persistenza file JSON con repository, schema DB-ready.** Allineato al resto di GS. Evoluzione SQL = swap repository, non secondo DB.

**ADR-3 — Editor = SPA statica `/builder` sullo stesso Express.** Stesso schema di `/admin`. Non è una seconda app.

**ADR-4 — Renderer per Host, non per path sul dominio GS.** Protegge tutte le route marketing/API esistenti.

**ADR-5 — Publish = snapshot immutabile.** Il draft può essere inconsistente; il live no.

**ADR-6 — Piani = SKU Stripe già in catalogo.** Nessun nuovo prodotto Stripe in Fase 1–B.

**ADR-7 — RistoSimply è widget + entitlement licenza, non un fork del gestionale.**

**ADR-8 — 404 al posto di 403** su website non posseduto.

**ADR-9 — Feature flag `WEBSITE_BUILDER_ENABLED`.** Prima del mount di `/api/websites` e `/builder` in `server.js` / `api.js`. Default `false` finché Fase A non è verde. Non è un secondo sistema: è un interruttore sullo stesso processo, analogo a Stripe che resta inerte senza chiavi.

### 14.1 Alternative valutate e scartate

Queste opzioni **non** rispettano i vincoli del committente e non vanno riprese in implementazione.

| Alternativa | Perché è stata considerata | Perché è scartata |
|---|---|---|
| SQLite “solo per il builder”, utenti ancora su JSON | Pagine/media crescono meglio in SQL | È un **secondo database**. I vincoli vietano un secondo data layer disconnesso. Si resta sul repository JSON (stesso pattern di `users.json` / `licenses_repo.json`); eventuale SQL futuro è **swap della stessa interfaccia repository**, non un DB affiancato. |
| Repository Git separato `gestione-website-builder` + runtime Railway satellite (modello STATWIN) | Isolamento di deploy | È una **seconda applicazione**. STATWIN è un prodotto download/SaaS già esterno; il builder deve vivere **dentro** Gestione Semplificata (stesso login, stesso account, stesso Stripe). |
| Piani rinominati STARTER / BUSINESS / PROFESSIONAL | Naming “builder” più internazionalizzabile | In catalogo e in home i piani **esistono già** come BASE / PRO / PREMIUM (`sitoweb_*`). Rinominarli spezza Stripe, webhook, copy e admin `/sitiweb`. Il builder usa i nomi commerciali già venduti. |
| Inserire l’editor nella SPA `/admin` | React già pronto | `/admin` è Super Admin. I clienti non devono entrare nel pannello titolare. |
| Nuovo login JWT per l’editor | SPA “moderna” | Secondo auth. Vietato. Cookie di sessione GS, come `admin-dashboard`. |

---

## 15. Fuori ambito (esplicito)

- E-commerce completo, POS, magazzino
- Multitenancy «agenzie in marchio bianco» con sotto-tenant
- App mobile nativa del builder
- Migrazione a PostgreSQL in questa iniziativa
- Riscrivere il sito marketing GS nel nuovo renderer
- Autenticazione OAuth Google/Apple
- Editor nel pannello Super Admin come prodotto parallelo
- Hosting DNS/SSL self-contained nel processo Node (si delega al proxy)

---

## 16. Criteri di completamento per le fasi successive

Una fase A–J è completa quando:

1. I vincoli §0 restano veri.
2. La checklist §8.2 è stata eseguita (manuale finché non ci sono e2e).
3. Nessun utente può leggere/scrivere website di un altro tenant (test automatico da A in poi).
4. Non è stato introdotto un secondo login o un secondo catalogo utenti.
5. I file nuovi rispettano il pattern `routes/controller/service/repository`.
6. `.env.example` è aggiornato senza segreti reali.

---

## 17. Prossimo passo immediato

La Fase A (fondamenti) è **già nel codice**. Prossimo lavoro: **Fase B** (CRUD siti, area account, provisioning webhook). Nessun editor visuale, nessuna SPA, nessun renderer pubblico finché B non è stabile.

Riferimento operativo: sezioni **7 (A–B)**, **11.1 (schema + modulo)**, **12 (ordine)**, **18 (changelog)**.

---

## 18. Changelog documento

| Data | Nota |
|------|------|
| 2026-09-07 | v1.0 — Analisi Gestione Semplificata e piano A–J. Nessun editor. |
| 2026-09-07 | v1.1 — **Fase A, fondamenti.** Target di produzione: runtime Railway `https://gestione-website-builder-production.up.railway.app` (`WEBSITE_BUILDER_APP_URL`), satellite sullo stesso modello STATWIN. SQLite dedicato al builder (`WEBSITE_BUILDER_SQLITE_PATH`); gli account Gestione Semplificata restano su JSON. `tenantId = session.user.id`. Piani mappati sugli SKU Stripe esistenti senza rinominarli. Router `/api/website-builder` dietro `WEBSITE_BUILDER_ENABLED=false` (nessun cambio di comportamento a flag spento). Test di isolamento: 403 tra tenant. Nessun editor visuale. |
| 2026-09-07 | v1.4 — Nuovo tentativo di push su `gestione-website-builder` (token GS + `gh auth`, backoff, API Contents): ancora **403** `denied to cursor[bot]`. Repo satellite vuoto (`size: 0`). |
| 2026-09-07 | v1.5 — Ritento pomeridiano: `git push -u origin main` (5 tentativi, backoff 0/4/8/16/32 s) e `PUT /contents`. Errore esatto invariato: `Permission to ristoword/gestione-website-builder.git denied to cursor[bot].` / HTTP 403. `ls-remote` vuoto; App installata solo su `gestionesemplificata`. Runtime locale SHA `6dd6b22` non pubblicato. Railway non può deployare. |

### 18.1 Decisioni di produzione che precisano gli ADR

Queste decisioni sono **canoniche** per l’implementazione (indicazioni successive del committente). Non introducono un secondo login né un secondo catalogo utenti.

| Tema | Precisazione Fase A |
|---|---|
| Persistenza builder | SQLite (`better-sqlite3`) **solo** per websites/pages/sections/media/domains/versions. `users.json` / licenze / Stripe **invariati**. Non è un secondo sistema utenti. |
| Runtime Railway | URL pubblico dell’editor/renderer (come `appUrl` STATWIN). Il codice nasce in `gestionesemplificata` finché `gestione-website-builder` non è scrivibile. |
| Piani | Nomi commerciali STARTER / BUSINESS / PROFESSIONAL = `sitoweb_base` / `sitoweb_pro` / `sitoweb_premium`. SKU Stripe **non** rinominati. Limiti solo in `plans.config.js`. |
| Accesso tra tenant | `GET /api/website-builder/websites/:id` di un altro tenant → **403** (criterio di test Fase A). |
| Prefisso API | `/api/website-builder/*` per non collidere con honeypot `name="website"` né con `/api/admin`. |
