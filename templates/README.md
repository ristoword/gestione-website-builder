# Template Website Builder

Ogni template è **una cartella**. Non serve toccare l’editor per aggiungerne uno nuovo.

```
templates/
  ristoranti/
    ristorante-classico/template.json
    pizzeria/template.json
    ...
  hotel/
    hotel-boutique/template.json
    bed-and-breakfast/template.json
    spa-wellness/template.json
  servizi/
  generico/
```

## Come aggiungere un template

1. Copia una cartella esistente (es. `ristoranti/pizzeria`).
2. Rinominala (es. `ristoranti/pub-birreria`).
3. Modifica `template.json`: `id`, `slug`, `name`, colori, elenco pagine/sezioni.
4. Riavvia il server. Il catalogo viene letto da disco all’avvio.

Piano minimo (`min_plan_key`): `starter` (Sito Web BASE), `business` (PRO), `professional` (PREMIUM).
