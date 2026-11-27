# 0010. Sources de données : GTFS IDFM et SIRI Lite de PRIM (pas de GTFS-RT)

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)

## Contexte

Le spike du 2026-11-27 a vérifié les sources réellement publiées par Île-de-France Mobilités (catalogue transport.data.gouv.fr, jeu « Réseaux urbains et interurbains d'IDFM », licence `mobility-licence`) :

| Source                                          | Accès                                                                                                                  | Constaté                                                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GTFS « Horaires au format GTFS »                | public, sans clé : `https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip` (~140 Mo zippé, `stop_times.txt` ~900 Mo) | 38 lignes de métro, RER A–E et tram ; **toutes** les courses ont un `shape_id` ; **pas** de `shape_dist_traveled` |
| SIRI Lite Estimated Timetable (requête globale) | clé PRIM (`https://prim.iledefrance-mobilites.fr/marketplace/estimated-timetable` répond 401 sans clé)                 | horaires temps réel de toutes les courses                                                                         |
| SIRI Lite Stop Monitoring (requête unitaire)    | clé PRIM                                                                                                               | prochains passages d'un arrêt                                                                                     |
| SIRI Lite General Message                       | clé PRIM (`/marketplace/general-message`, 401 sans clé)                                                                | messages de perturbation                                                                                          |
| GTFS-RT, positions GPS                          | **aucune** source publiée pour ce périmètre                                                                            | —                                                                                                                 |

La documentation détaillée de PRIM (quotas, paramètres) n'est lisible qu'une fois connecté : elle sera relevée avec la clé du mainteneur.

## Décision

- Référentiel : le GTFS IDFM, filtré sur `route_type` 1 (métro), 0 (tram, hors navettes ORLYVAL et CDG VAL) et 2 limité aux RER A à E (lignes `IDFM:C01742`, `C01743`, `C01727`, `C01728`, `C01729`).
- La distance le long du tracé est **calculée à l'import** (projection de chaque arrêt sur son `shape`).
- Temps réel : SIRI Lite Estimated Timetable (une requête globale par cycle), Stop Monitoring à la demande avec cache, General Message toutes les 2 min. **Pas de GTFS-RT** : le service Go décode du JSON SIRI Lite (`encoding/json`), sans `gtfs-realtime-bindings`.
- Identifiants : ceux du GTFS (`IDFM:C01742`) ; correspondance avec les références SIRI (`STIF:Line::C01742:`) dans le code de décodage, testée.
- Licence : mentions « Île-de-France Mobilités – Licence Mobilités » affichées sur la carte et dans `/a-propos`.

## Conséquences

- Positives : référentiel sans clé ; une seule requête temps réel globale par cycle, compatible avec des quotas serrés.
- Négatives : quotas et format exact du SIRI Lite à confirmer avec une clé ; calcul géométrique à l'import.
- À revoir si : IDFM publie un flux GTFS-RT ou des positions GPS (ADR 0004).
