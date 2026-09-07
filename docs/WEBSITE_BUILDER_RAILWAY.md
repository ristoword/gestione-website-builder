# Website Builder — runtime Railway

**URL di produzione dichiarato:** https://gestione-website-builder-production.up.railway.app

Il Website Builder è un **modulo di Gestione Semplificata**, non una seconda applicazione di identità. Il runtime Railway è un satellite (stesso contratto di STATWIN): login, Stripe e licenze restano su Gestione Semplificata (`tenantId` = `user.id` della sessione GS).

## Dove sta il codice oggi

Tutto il codice Fase A vive in:

- repository: `ristoword/gestionesemplificata`
- ramo: `cursor/website-builder-architecture-0f85`
- PR: https://github.com/ristoword/gestionesemplificata/pull/11
- modulo: `backend/src/modules/website-builder/`

Railway è atteso sul repository dedicato `ristoword/gestione-website-builder`. Quel repository è **vuoto** (0 commit).

## Blocco: nessun permesso di push sul repo satellite

Ritentato il 2026-09-07 (pomeriggio): `git push -u origin main` su `https://github.com/ristoword/gestione-website-builder.git` con token `origin` di `gestionesemplificata` (rewrite `x-access-token`), 5 tentativi con attesa 0/4/8/16/32 s. Stesso esito con `PUT /repos/.../contents` via API.

Errore esatto (invariato):

```
remote: Permission to ristoword/gestione-website-builder.git denied to cursor[bot].
fatal: unable to access 'https://github.com/ristoword/gestione-website-builder.git/': The requested URL returned error: 403
```

Verifica dopo i tentativi:

- `git ls-remote` non elenca alcun commit
- `gh api repos/ristoword/gestione-website-builder` → `size: 0`, `permissions.push: false`
- `GET /installation/repositories` elenca **solo** `ristoword/gestionesemplificata`

Il token è un’integrazione GitHub App (`cursor[bot]`) installata sul repo GS, non sul satellite. Il permesso di scrittura su Gestione Semplificata non si estende a `gestione-website-builder`.

Sblocco: in GitHub → `ristoword/gestione-website-builder` → Settings → GitHub Apps / Collaborators, installare o autorizzare `cursor[bot]` (o un PAT con `contents: write`) su **quel** repository, poi ripetere `git push -u origin main`.

Runtime locale pronto ma **non** pubblicato: SHA `6dd6b22b0d33db7f68aba5c6ef613f1ecee6b718` (`feat: runtime satellite Website Builder per Railway`). `npm start` ascolta `process.env.PORT`; health `GET /api/website-builder/health`. Finché il 403 resta, Railway su `https://gestione-website-builder-production.up.railway.app` **non** può fare il primo deploy da GitHub.

## Variabili d’ambiente Railway (quando il repo sarà scrivibile)

Impostare sul servizio `gestione-website-builder-production`:

| Variabile | Valore / nota |
|---|---|
| `PORT` | Assegnata da Railway (non hardcodare) |
| `WEBSITE_BUILDER_ENABLED` | `true` su questo runtime |
| `WEBSITE_BUILDER_APP_URL` | `https://gestione-website-builder-production.up.railway.app` |
| `WEBSITE_BUILDER_SQLITE_PATH` | Percorso su **volume persistente** (es. `/data/website-builder.sqlite`) |
| `SESSION_SECRET` | Stringa lunga casuale (stesso segreto di GS solo se si condividono cookie; altrimenti SSO HMAC in Fase J) |
| `GESTIONE_SEMPLIFICATA_BASE_URL` | `https://gestionesemplificata.com` (login, billing, licenze) |
| `NODE_ENV` | `production` |

Non creare un secondo catalogo utenti. Non copiare `users.json` sul satellite.

## Avvio atteso (dopo il primo push su `main`)

```
npm start
```

Health check: `GET /api/website-builder/health`

Identità: `requireCustomerAuth` sulla sessione GS (o token SSO dedicato, non un secondo login).
