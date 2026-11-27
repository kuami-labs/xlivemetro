# Base de données – XLiveMetro

> PostgreSQL 19 + **PostGIS 3.7** + `pg_trgm`, schéma géré par Prisma (`packages/db`). Le temps réel ne passe **pas** par PostgreSQL : il vit dans la mémoire du service Go (ADR 0013).

## Tables (référentiel GTFS filtré : métro, RER, tram)

| Table                         | Contenu                                                                                     | Index                           |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| `feed_versions`               | version du GTFS importé, date, empreinte                                                    | —                               |
| `agencies`                    | opérateurs (RATP, SNCF…)                                                                    | —                               |
| `routes`                      | lignes : id GTFS, nom court, mode, couleur, couleur du texte                                | `mode`                          |
| `stops`                       | gares et quais : nom, `geom geography(Point)`, gare parente                                 | GiST `geom`, GIN trigram `name` |
| `shapes`                      | tracés : `geom geography(LineString)`                                                       | GiST `geom`                     |
| `trips`                       | courses : ligne, direction, tracé, service                                                  | `route_id`, `service_id`        |
| `stop_times`                  | horaires théoriques : course, arrêt, ordre, heures, **distance le long du tracé**           | `(trip_id, stop_sequence)`      |
| `calendars`, `calendar_dates` | jours de circulation                                                                        | —                               |
| `transfers`                   | correspondances à pied entre arrêts desservis (`transfers.txt`), durée minimale en secondes | clé (départ, arrivée)           |
| `disruptions`                 | dernières perturbations (historique 7 jours)                                                | `(route_id, active)`            |

- Prisma ne connaît pas les types PostGIS : colonnes déclarées `Unsupported("geography(...)")`, requêtes spatiales en SQL brut (`$queryRaw`) ou en Go (pgx).
- La distance le long du tracé (`shape_dist_traveled`, calculée à l'import si absente) permet au service Go d'interpoler sans calcul géométrique à chaque cycle.
- `stop_times` est la plus grosse table (~2 millions de lignes) : import par `COPY` (pgx), jamais par Prisma.

## Cache

Pas de Redis en v1 ([ADR 0014](adr/0014-sans-redis-v1.md)) : l'état temps réel vit dans la mémoire du service Go, et l'API garde en mémoire le référentiel (1 h) et les prochains départs (15 s).

## Migrations et données

- `pnpm db:migrate` : migrations Prisma (dont `CREATE EXTENSION postgis, pg_trgm` et les index GiST et trigrammes).
- `pnpm gtfs:import` : référentiel réel (téléchargement du GTFS IDFM, ~100 s), par l'outil Go `services/realtime/cmd/gtfsimport` ([ADR 0012](adr/0012-import-gtfs-go.md)). Tout est remplacé dans une transaction.
- `pnpm db:seed` : même import depuis `fixtures/gtfs-mini` (métro 1 et 14, RER A, T3a ; ~3 s), aucun téléchargement.
- `pnpm --filter @xlivemetro/realtime gtfs:mini` : régénère le jeu réduit ([fixtures/README.md](../fixtures/README.md)).
