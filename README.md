# Gestione Semplificata — Website Builder

Copia **avviabile** del Website Builder, visibile in Esplora file su questo PC.

Percorso: `C:\Users\PC\OneDrive\Documenti\Desktop\Gestione-Website-Builder`

Il login resta quello di **Gestione Semplificata**. Non c’è un secondo account.  
`tenantId` = `user.id` della sessione GS. Piani: `sitoweb_base` → STARTER, `sitoweb_pro` → BUSINESS, `sitoweb_premium` → PROFESSIONAL.

Il codice è integrato anche nel monolite:

`C:\Users\PC\OneDrive\Documenti\Desktop\gestione semplificata\backend\src\modules\website-builder`

## Struttura

```
Gestione-Website-Builder/
  server.js                 Avvio Node (Railway: npm start)
  package.json
  templates/                TEMPLATE A CARTELLE (aggiungi un sito = nuova cartella)
    ristoranti/             6 template ristorazione
    hotel/                  3 template ospitalità
    servizi/                2 template servizi
    generico/               1 landing
  src/modules/website-builder/   Motore (SQLite, API, renderer)
  src/middlewares/          Sessione GS (niente secondo login)
  website-builder-ui/       Editor visuale React (/builder)
  data/                     SQLite locale
  storage/                  Upload media per tenant
  fasi/                     Diario A–J (cosa è stato creato in ogni fase)
  docs/                     Architettura e Railway
```

## Template: come aggiungerne uno

1. Copia `templates/ristoranti/pizzeria`
2. Rinomina la cartella, es. `templates/ristoranti/pub-birreria`
3. Modifica `template.json` (`id`, `slug`, `name`, colori, pagine)
4. Riavvia. L’editor legge le cartelle da disco: **non serve toccare il codice**.

## Avvio locale

```bat
copy .env.example .env
npm install
npm run build:ui
npm start
```

Apri `http://localhost:3000/builder`  
Health: `http://localhost:3000/api/website-builder/health`

`.env.example` attiva `WEBSITE_BUILDER_DEV_TENANT_ID` solo per provare in locale. In produzione quella variabile va tolta: si usa il cookie di sessione Gestione Semplificata.

## Fasi

| Fase | Cartella | Contenuto |
|------|----------|-----------|
| A | `fasi/A-foundation` + `src/modules/website-builder/db` | SQLite, tenant, piani, schemi |
| B | `fasi/B-crud` + `controllers` / `services` | CRUD siti, pagine, sezioni |
| C | `fasi/C-editor` + `website-builder-ui` | Editor visuale reale |
| D | `fasi/D-templates` + `templates/` | ≥10 template a cartelle |
| E | `fasi/E-media` + `storage/` | Libreria media |
| F | `fasi/F-publish` | Bozza / anteprima / pubblica / versioni |
| G | `fasi/G-seo-domini` | SEO + dominio (solo TXT) |
| H | `fasi/H-ai` | AI con API validate |
| I | `fasi/I-ristosimply` | Integrazione RistoSimply (no duplicazione dati) |
| J | `fasi/J-limiti` | Limiti piano e hardening |

## GitHub / Railway

Repo satellite: https://github.com/ristoword/gestione-website-builder.git  
Runtime: https://gestione-website-builder-production.up.railway.app  

Se `cursor[bot]` riceve **403** sul push, autorizza l’app Cursor su quel repository (Write). Finché il repo è vuoto, Railway non può fare il primo deploy.
