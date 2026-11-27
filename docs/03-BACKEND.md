# Backend – XLiveMetro

> Trois composants serveur : le service Go `realtime` (chemin chaud), l'API NestJS (référentiel) et le serveur MCP (bonus).

## Vue d'ensemble

```
PRIM (IDFM) ──► realtime (Go) ──► Redis (dernier état, pub/sub) ──► api (NestJS) ──► mcp
                    │                                                    ▲
                    └── WebSocket binaire ──► navigateur ◄── REST ───────┘
PostgreSQL + PostGIS : référentiel GTFS (lu par realtime et api)
```

## Service `realtime` (Go)

| Package             | Rôle                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `internal/feed`     | Interface `Source` : `prim` (appels réels) ou `replay` (fichiers de `fixtures/replay`). Choix par `FEED_SOURCE`              |
| `internal/ingest`   | Interroge la source toutes les `FEED_INTERVAL` (30 s par défaut), décode GTFS-RT / SIRI, normalise                           |
| `internal/position` | Calcule la position estimée de chaque course : horaires + retard → segment entre deux arrêts → point sur le tracé (`shapes`) |
| `internal/hub`      | Connexions WebSocket, abonnement par zone (bbox) et par mode, envoi de diffs binaires                                        |
| `internal/recorder` | Enregistre les réponses PRIM brutes (outil `cmd/record`) pour créer des jeux de rejeu                                        |
| `internal/store`    | Lecture du référentiel (pgx), écriture du dernier état et pub/sub dans Redis                                                 |

**Messages WebSocket** (définis dans `packages/proto/realtime.proto`) :

- `Snapshot` à la connexion : tous les véhicules de la zone (id, ligne, position, cap, retard, horodatage, `estimated: bool`).
- `Delta` à chaque cycle : véhicules ajoutés, déplacés (position + vitesse pour l'interpolation), supprimés.
- `Subscribe` (client → serveur) : bbox, modes, lignes.

**Règles**

- Une seule boucle d'ingestion par instance ; si plusieurs instances, verrou Redis (une seule appelle PRIM).
- Respect strict des quotas : intervalle minimal, `Retry-After`, back-off exponentiel.
- Panne de la source : l'état précédent continue d'être servi, avec son âge (`stale_since`).
- Le client WebSocket lent est déconnecté (file d'envoi bornée) : il ne ralentit jamais les autres.
- Endpoints HTTP : `GET /health`, `GET /ws` (upgrade), `GET /metrics` (format Prometheus, réseau interne).

## API (NestJS, `apps/api`)

| Méthode | Route                   | Rôle                                                           |
| ------- | ----------------------- | -------------------------------------------------------------- |
| GET     | `/health`               | état : base, Redis, âge du dernier cycle temps réel            |
| GET     | `/lines?mode=`          | lignes, couleurs officielles, tracés simplifiés (GeoJSON)      |
| GET     | `/lines/:id`            | détail, arrêts ordonnés, perturbations en cours                |
| GET     | `/stops/search?q=`      | recherche floue de gares (`pg_trgm`)                           |
| GET     | `/stops/:id`            | détail d'une gare, lignes desservies                           |
| GET     | `/stops/:id/departures` | prochains passages (SIRI Stop Monitoring, cache Redis 30 s)    |
| GET     | `/disruptions?line=`    | perturbations en cours                                         |
| GET     | `/vehicles/:id`         | état d'un train : ligne, destination, retard, prochains arrêts |

- Tout est **public, en lecture seule**, sans authentification. Limitation de débit par IP (`@nestjs/throttler`).
- Les textes de perturbation IDFM sont renvoyés comme **texte brut** ; jamais de HTML interprété.
- Documentation OpenAPI générée (`/docs`), utilisée par le MCP.

## Import GTFS (`packages/db`)

- `pnpm gtfs:import` télécharge le GTFS IDFM, filtre métro/RER/tram, charge lignes, arrêts, tracés et horaires dans PostGIS.
- Idempotent : import dans des tables temporaires, puis bascule en une transaction.
- Planifié une fois par jour (job dans `realtime` ou cron de l'hébergeur, à décider).

## Serveur MCP (`apps/mcp`, bonus)

Package npm `@kuami-labs/xlivemetro-mcp`, transport **stdio**, qui appelle l'API publique (`XLIVEMETRO_API_URL`, instance publique par défaut). Aucune clé n'est nécessaire.

| Outil              | Entrée                                  | Sortie                                                                        |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------- |
| `search_stop`      | nom approximatif                        | gares correspondantes (id, nom, lignes)                                       |
| `next_departures`  | gare, ligne ou direction (optionnelles) | prochains passages avec retards                                               |
| `line_status`      | ligne                                   | état (normal / perturbé), messages, nombre de trains en circulation           |
| `list_disruptions` | mode (optionnel)                        | perturbations en cours                                                        |
| `map_link`         | gare, ligne ou train                    | **lien profond vers la carte** centrée (`/?stop=…`, `/?line=…`, `/?follow=…`) |

Chaque réponse d'outil ajoute un lien `map_link` quand il est pertinent. Les messages IDFM renvoyés sont marqués comme données externes (voir `08-SECURITE.md`).

Exemple de configuration client :

```json
{
  "mcpServers": { "xlivemetro": { "command": "npx", "args": ["-y", "@kuami-labs/xlivemetro-mcp"] } }
}
```

> Côté utilisateurs finaux, `npx` est la convention des clients MCP ; dans le dépôt, on reste sur pnpm.

## Tests

| Zone             | Ce qui est testé                                                        | Données                       |
| ---------------- | ----------------------------------------------------------------------- | ----------------------------- |
| `position` (Go)  | interpolation, changement de segment, course en avance/retard, terminus | courses fixes                 |
| `ingest` (Go)    | décodage GTFS-RT et SIRI, flux vide, flux corrompu                      | fichiers de `fixtures/replay` |
| `hub` (Go)       | diff, abonnement par bbox, client lent déconnecté                       | tests avec `httptest`         |
| api              | routes, recherche, cache, throttler                                     | base de test + seed           |
| mcp              | chaque outil, avec une API simulée                                      | réponses fixes                |
| e2e (Playwright) | carte chargée avec véhicules ; clic sur une gare → prochains passages   | rejeu                         |
