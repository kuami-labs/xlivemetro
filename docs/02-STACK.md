# Stack technique – XLiveMetro

La stack reprend celle d'XCadence (TypeScript, NestJS, Next.js, PostgreSQL, Redis, Docker) et ajoute **Go** pour le chemin chaud du temps réel, et **PostGIS** pour la géographie. Décision : [ADR 0002](adr/0002-stack.md).

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Dépôt | Monorepo pnpm + Turborepo, plus un module Go | Une seule CI, un seul `pnpm dev` |
| Ingestion et diffusion temps réel | **Go** (`services/realtime`) : `net/http`, `coder/websocket`, `gtfs-realtime-bindings` | Goroutines pour des milliers de connexions, faible mémoire, binaire unique |
| Format temps réel | Messages binaires (Protocol Buffers), envoi des différences uniquement | Débit minimal, décodage direct vers des typed arrays |
| API REST | NestJS (`apps/api`) | Référentiel (lignes, arrêts, recherche), prochains passages ; architecture connue |
| Base de données | PostgreSQL 19 + PostGIS 3.7 + Prisma | Référentiel GTFS, tracés, requêtes spatiales |
| Cache et bus | Redis 8 (cache, pub/sub entre Go et NestJS) | Un seul appel PRIM partagé |
| Front | Next.js (App Router) + Tailwind + shadcn/ui | Pages rapides, composants prêts |
| Carte 3D | MapLibre GL JS + deck.gl (`MapboxOverlay`) | Open source, couches 3D animées performantes (WebGL2, WebGPU à venir) |
| Fond de carte | Tuiles vectorielles OpenFreeMap / OpenMapTiles (OSM) | Gratuit, bâtiments 3D |
| État côté front | Zustand (état carte) + TanStack Query (REST) | Léger, hors cycle de rendu React pour l'animation |
| Serveur MCP | `@modelcontextprotocol/sdk` (`apps/mcp`), transport stdio, publié sur npm | Réutilise l'API publique ; installable partout |
| Tests | Vitest, Supertest, `go test`, Playwright (2 parcours) | Calculs de position couverts à 100 % |
| CI/CD | GitHub Actions ; déploiement à décider (ADR à venir) | |
| Observabilité | Logs JSON (pino côté Node, `log/slog` côté Go) | Même format partout |

## Structure du monorepo

```
xlivemetro/
├── apps/
│   ├── api/          # NestJS : référentiel, recherche, prochains passages, perturbations
│   ├── web/          # Next.js : carte 3D
│   └── mcp/          # serveur MCP (stdio), publié sur npm
├── services/
│   └── realtime/     # Go : ingestion PRIM, positions, WebSocket, enregistreur/rejeu
├── packages/
│   ├── shared/       # types et DTO partagés (TS)
│   ├── proto/        # schéma .proto des messages temps réel → code Go et TS générés
│   └── db/           # schéma Prisma, migrations, import GTFS
├── fixtures/
│   └── replay/       # flux PRIM enregistrés pour le rejeu et les tests
├── docs/
├── compose.yaml
└── turbo.json
```

`services/realtime` a un `package.json` minimal (scripts `dev`, `build`, `lint`, `test` qui appellent `go`) : Turborepo l'orchestre comme les autres.
