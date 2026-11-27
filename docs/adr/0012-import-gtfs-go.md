# 0012. Import GTFS écrit en Go, schéma géré par Prisma 7.10

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)

## Contexte

Le GTFS IDFM pèse ~140 Mo zippé ; `stop_times.txt` fait ~900 Mo. Après filtrage (ADR 0010) il reste 36 lignes, ~91 000 courses et ~2 millions de passages. Il faut aussi projeter chaque arrêt sur son tracé (distance le long du tracé). `docs/05-DATABASE.md` prévoyait un import dans `packages/db` (TypeScript).

Pour Prisma, le tag npm `latest` pointe sur `8.0.0-rc.36`, une **pré-version** ; la dernière version stable est la 7.10.1.

## Options

1. **Import en TypeScript** (`packages/db`) : décompression et CSV via des dépendances supplémentaires, `COPY` via `pg-copy-streams`, calcul géométrique en JS.
2. **Import en Go** (`services/realtime/cmd/gtfsimport`) : `archive/zip` et `encoding/csv` de la bibliothèque standard, `COPY` binaire via `pgx`, et le même code de géométrie que le calcul des positions temps réel.

## Décision

- Option 2. Le paquet `internal/gtfs` (lecture, filtre, géométrie) sert à l'import **et** au service temps réel : une seule implémentation de la distance le long du tracé. Dépendance ajoutée : `github.com/jackc/pgx/v5` (pilote PostgreSQL de référence en Go).
- Le **schéma** reste géré par Prisma (`packages/db`, migrations versionnées) ; Go ne crée aucune table.
- L'import remplace tout le référentiel **dans une transaction** (`TRUNCATE` puis `COPY`) : en cas d'échec, rien ne change. Pendant l'import (~100 s pour le GTFS complet), les lectures du référentiel attendent ; acceptable pour un import quotidien de nuit.
- Prisma **7.10.1**, dernière version stable (la 8.0 n'est qu'en RC), conformément à la règle 10 de `CLAUDE.md`.

## Conséquences

- Positives : import complet en ~100 s ; aucune dépendance npm de plus ; géométrie testée une seule fois.
- Négatives : `pnpm gtfs:import` et `pnpm db:seed` passent par Go ; lectures bloquées pendant l'import.
- À revoir si : l'import doit tourner en journée sans bloquer (import dans des tables de travail puis renommage) ; Prisma 8 sort en version stable.
- Mesures (2026-11-27) : écart médian de 6,9 m entre un arrêt et le point du tracé à sa distance calculée ; 99ᵉ centile 290 m, dû à des arrêts IDFM situés jusqu'à 150 m de leur tracé (ex. Auber).
