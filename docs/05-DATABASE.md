# Base de données – XLiveMetro

> PostgreSQL 19 + **PostGIS 3.7** + `pg_trgm`, schéma géré par Prisma (`packages/db`). Le temps réel ne passe **pas** par PostgreSQL : il vit dans la mémoire du service Go et dans Redis.

## Tables (référentiel GTFS filtré : métro, RER, tram)

| Table                         | Contenu                                                                           | Index                           |
| ----------------------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| `feed_versions`               | version du GTFS importé, date, empreinte                                          | —                               |
| `agencies`                    | opérateurs (RATP, SNCF…)                                                          | —                               |
| `routes`                      | lignes : id GTFS, nom court, mode, couleur, couleur du texte                      | `mode`                          |
| `stops`                       | gares et quais : nom, `geom geography(Point)`, gare parente                       | GiST `geom`, GIN trigram `name` |
| `shapes`                      | tracés : `geom geography(LineString)`                                             | GiST `geom`                     |
| `trips`                       | courses : ligne, direction, tracé, service                                        | `route_id`, `service_id`        |
| `stop_times`                  | horaires théoriques : course, arrêt, ordre, heures, **distance le long du tracé** | `(trip_id, stop_sequence)`      |
| `calendars`, `calendar_dates` | jours de circulation                                                              | —                               |
| `disruptions`                 | dernières perturbations (historique 7 jours)                                      | `(route_id, active)`            |

- Prisma ne connaît pas les types PostGIS : colonnes déclarées `Unsupported("geography(...)")`, requêtes spatiales en SQL brut (`$queryRaw`) ou en Go (pgx).
- La distance le long du tracé (`shape_dist_traveled`, calculée à l'import si absente) permet au service Go d'interpoler sans calcul géométrique à chaque cycle.
- `stop_times` est la plus grosse table (~2 millions de lignes) : import par `COPY` (pgx), jamais par Prisma.

## Redis

| Clé                       | Contenu                         | Durée                  |
| ------------------------- | ------------------------------- | ---------------------- |
| `rt:state`                | dernier état complet (protobuf) | jusqu'au cycle suivant |
| `rt:updates` (pub/sub)    | notification de nouveau cycle   | —                      |
| `rt:lock:ingest`          | verrou de l'ingestion           | 60 s                   |
| `cache:departures:<stop>` | prochains passages              | 30 s                   |
| `cache:disruptions`       | perturbations                   | 120 s                  |

## Migrations et données

- `pnpm db:migrate` : migrations Prisma (dont `CREATE EXTENSION postgis, pg_trgm` et les index GiST et trigrammes).
- `pnpm gtfs:import` : référentiel réel (téléchargement du GTFS IDFM, ~100 s), par l'outil Go `services/realtime/cmd/gtfsimport` ([ADR 0012](adr/0012-import-gtfs-go.md)). Tout est remplacé dans une transaction.
- `pnpm db:seed` : même import depuis `fixtures/gtfs-mini` (métro 1 et 14, RER A, T3a ; ~3 s), aucun téléchargement.
- `pnpm --filter @xlivemetro/realtime gtfs:mini` : régénère le jeu réduit ([fixtures/README.md](../fixtures/README.md)).
