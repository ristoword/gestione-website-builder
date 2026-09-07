# Gestione Semplificata — Website Builder

Prodotto **standalone**: hub, editor visuale e API vivono su questo repository.  
Railway fa il deploy automatico da `main`.

- Repo: https://github.com/ristoword/gestione-website-builder.git  
- Runtime: https://gestione-website-builder-production.up.railway.app  
- Hub: https://gestione-website-builder-production.up.railway.app/website  
- Editor: https://gestione-website-builder-production.up.railway.app/builder  
- Health: https://gestione-website-builder-production.up.railway.app/api/website-builder/health  

**Non dipende da Gestione Semplificata per funzionare.**  
Puoi registrare un account locale e creare i siti. L’integrazione GS è opzionale (SSO).

## Come si apre

| Dove | URL |
|------|-----|
| Hub (entra qui) | `/website` |
| Editor | `/builder` |
| Accedi / Registrati | `/login` · `/register` |

Locale: `http://localhost:3000/website`  
Produzione: `https://gestione-website-builder-production.up.railway.app/website`

Dal menu di Gestione Semplificata la voce **Siti web** apre questo runtime (`WEBSITE_BUILDER_APP_URL`).

## Avvio senza Gestione Semplificata

```bat
copy .env.example .env
npm install
npm run build:ui
npm start
```

Apri `http://localhost:PORT/website` (Railway imposta `PORT`).  
Crea un account su `/register` e usa l’editor.

In produzione **non** impostare `WEBSITE_BUILDER_DEV_TENANT_ID`.

## Railway — deploy automatico

1. Su [Railway](https://railway.app) il servizio è collegato a questo repo GitHub (`ristoword/gestione-website-builder`), branch **`main`**.
2. Ogni `git push origin main` avvia un nuovo deploy (Nixpacks, `npm start`).
3. Health check: `GET /api/website-builder/health`.
4. Variabili minime:

| Variabile | Valore |
|-----------|--------|
| `PORT` | impostata da Railway |
| `NODE_ENV` | `production` |
| `WEBSITE_BUILDER_ENABLED` | `true` |
| `WEBSITE_BUILDER_APP_URL` | `https://gestione-website-builder-production.up.railway.app` |
| `SESSION_SECRET` | stringa lunga casuale |
| `WEBSITE_BUILDER_STANDALONE` | `true` (default) |

Opzionale SSO verso Gestione Semplificata (stesso segreto su GS e su Railway):

| Variabile | Valore |
|-----------|--------|
| `GESTIONE_SEMPLIFICATA_BASE_URL` | `https://gestionesemplificata.com` |
| `WEBSITE_BUILDER_SSO_SECRET` | stesso valore sul backend GS |

Senza queste due variabili l’app resta **completamente autonoma**.

## SSO opzionale da Gestione Semplificata

Se l’utente è già loggato su GS, il menu **Siti web** chiama `/api/wb/launch` e apre  
`{WEBSITE_BUILDER_APP_URL}/auth/gs?...` con un ticket firmato.  
Altrimenti si usa login/registrazione locale su questo runtime.

## Struttura

```
server.js                 Avvio Node (PORT da env)
public/                   Hub /website, login, register
src/auth/                 Account locale + SSO
src/modules/website-builder/   API, SQLite, renderer
website-builder-ui/       Editor React (/builder)
templates/                Template a cartelle
```

## Template

1. Copia una cartella in `templates/`
2. Modifica `template.json`
3. Riavvia: l’editor li legge da disco
