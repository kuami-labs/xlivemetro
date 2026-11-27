# Environnement de développement – XLiveMetro

> Objectif : n'importe quel contributeur clone le dépôt, l'ouvre dans VS Code et lance toute la stack **en 15 minutes**, sur macOS, Windows ou Linux.
> Décision correspondante : [ADR 0001 – Dev container](adr/0001-dev-container.md).

## Le principe

L'environnement est **du code**, versionné avec le projet. Un contributeur n'installe que **Docker** et **VS Code** ; tout le reste vient du dépôt.

| Fichier                           | Décrit                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| `.devcontainer/Dockerfile`        | le système et les outils du poste de travail                  |
| `.devcontainer/devcontainer.json` | comment VS Code s'y attache : extensions, réglages, commandes |
| `compose.yaml`                    | les services : PostgreSQL + PostGIS, Redis                    |
| `.env.example`                    | les variables d'environnement, sans secret                    |

## Parité dev / prod

|                      | Dev                                                          | Prod                                   |
| -------------------- | ------------------------------------------------------------ | -------------------------------------- |
| Système              | Debian trixie                                                | Debian trixie                          |
| Node (LTS)           | 26                                                           | 26                                     |
| Go                   | 1.27                                                         | 1.27                                   |
| PostgreSQL + PostGIS | 19 / 3.7                                                     | 19 / 3.7                               |
| Redis                | 8                                                            | 8                                      |
| Configuration        | fichier `.env` local                                         | variables d'environnement (Coolify)    |
| Flux temps réel      | flux synthétique (`FEED_SOURCE=synthetic`) ou votre clé PRIM | PRIM, clé de l'instance                |
| Données              | référentiel réduit (`pnpm db:seed`)                          | GTFS IDFM complet (`pnpm gtfs:import`) |
| Rechargement à chaud | oui                                                          | non                                    |

Les six premières lignes sont **identiques**. Les autres diffèrent **exprès**.

## Prérequis

Sur votre machine, et rien d'autre :

| Outil                                                    | Version | Remarque                                                    |
| -------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| Docker Desktop (macOS, Windows) ou Docker Engine (Linux) | récente | au moins 6 Go de mémoire alloués à Docker                   |
| VS Code + extension **Dev Containers**                   | récente |                                                             |
| git, configuré **sur la machine**                        |         | nom, e-mail, clé SSH : VS Code les relaie dans le conteneur |

> **Sous Windows** : activez le moteur **WSL 2** de Docker Desktop et clonez le projet **dans WSL** (par exemple `~/projets`, depuis un terminal Ubuntu), jamais dans `C:\`. PostgreSQL refuse souvent de démarrer sur `C:\`, et l'accès aux fichiers y est beaucoup plus lent.

## Démarrer en 5 étapes

1. Forkez le dépôt sur GitHub (contributeurs externes), ou clonez-le directement (mainteneurs) :
   ```bash
   git clone git@github.com:VOTRE-COMPTE/xlivemetro.git
   ```
2. Ouvrez le dossier dans VS Code, puis **F1** → **Dev Containers: Reopen in Container**. Le premier build prend quelques minutes.
3. À la création, le conteneur installe les dépendances et copie `.env.example` en `.env`. Rien d'autre à renseigner : le flux temps réel est généré à partir du référentiel de test (ADR 0011). Pour les données réelles, ajoutez votre clé PRIM ([voir plus bas](#la-clé-prim-optionnelle)).
4. Dans le terminal de VS Code :
   ```bash
   pnpm db:migrate      # crée les tables
   pnpm db:seed         # référentiel réduit, cohérent avec le rejeu
   pnpm dev             # lance realtime, api et web
   ```
5. Ouvrez http://localhost:3000 : la carte, avec les trains du rejeu en mouvement. L'API répond sur http://localhost:4000/health, le service temps réel sur http://localhost:4100/health.

## Les fichiers

```text
xlivemetro/
├── .devcontainer/
│   ├── Dockerfile
│   └── devcontainer.json
├── apps/            # api, web, mcp
├── services/        # realtime (Go)
├── packages/        # db (Prisma), proto, shared
├── fixtures/        # rejeu PRIM, référentiel réduit
├── db/
│   ├── Dockerfile   # PostgreSQL + PostGIS multi-architecture
│   └── data/        # données PostgreSQL locales, ignorées par git
├── compose.yaml
├── compose.ci.yaml
├── .nvmrc
├── .env.example
├── .gitattributes
└── .gitignore
```

### .devcontainer/Dockerfile

```dockerfile
# Même base que l'image de production : Node 26 (LTS) sur Debian trixie
FROM mcr.microsoft.com/devcontainers/typescript-node:26-trixie

# Client PostgreSQL 19 (dépôt officiel PGDG, comme le serveur) et compilateur protobuf
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-common protobuf-compiler \
    && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
    && apt-get install -y --no-install-recommends postgresql-client-19 \
    && rm -rf /var/lib/apt/lists/*

# Go officiel, copié depuis l'image golang : présent aussi pour « docker compose exec dev »
# (les features du devcontainer ne sont appliquées que par VS Code)
COPY --from=golang:1.27-trixie /usr/local/go /usr/local/go
ENV PATH=/usr/local/go/bin:/home/node/go/bin:$PATH

# pnpm, à la version fixée dans package.json (champ packageManager).
# Corepack n'est plus livré avec Node depuis la version 25 : on l'installe.
# --force : l'image fournit déjà un pnpm global, remplacé par le relais de Corepack.
RUN npm install -g --force corepack && corepack enable
```

### .devcontainer/devcontainer.json

```json
{
  "name": "XLiveMetro",
  "dockerComposeFile": ["../compose.yaml"],
  "service": "dev",
  "workspaceFolder": "/workspace",
  "shutdownAction": "stopCompose",
  "remoteUser": "node",

  "features": {
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },

  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "prisma.prisma",
        "golang.go",
        "bradlc.vscode-tailwindcss",
        "github.vscode-pull-request-github"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" }
      }
    }
  },

  // web, api, realtime, et PostgreSQL pour un client graphique
  "forwardPorts": [3000, 4000, 4100, "db:5432"],

  // Une fois, à la création : dépendances et .env local (jamais écrasé)
  "postCreateCommand": "git config --global --add safe.directory /workspace && (test -f pnpm-lock.yaml && pnpm install --frozen-lockfile || true) && (test -f services/realtime/go.mod && (cd services/realtime && go mod download) || true) && (test -f .env || cp .env.example .env)"
}
```

| Clé                            | Rôle                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| `dockerComposeFile`, `service` | la stack à démarrer, et le service auquel VS Code s'attache  |
| `features`                     | la CLI GitHub (`gh`), sans toucher au Dockerfile             |
| `customizations`               | les mêmes extensions et réglages pour tous les contributeurs |
| `forwardPorts`                 | les ports accessibles depuis votre navigateur                |
| `postCreateCommand`            | installe les dépendances et crée le `.env`, une seule fois   |

### compose.yaml

```yaml
# Stack de développement. Versions figées : les mêmes qu'en production.
name: xlivemetro

services:
  # Le poste de travail : VS Code s'y attache, on y lance realtime, api et web
  dev:
    build:
      context: .
      dockerfile: .devcontainer/Dockerfile
    command: sleep infinity
    # Les commandes « docker compose exec dev … » tournent comme dans VS Code
    user: node
    working_dir: /workspace
    # web et API joignables depuis la machine hôte (navigateur), même sans VS Code
    ports:
      - 127.0.0.1:3000:3000
      - 127.0.0.1:4000:4000
      - 127.0.0.1:4100:4100
    volumes:
      - .:/workspace:cached
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  db:
    # PostgreSQL 19 + PostGIS, construit sur l'image officielle (multi-architecture) : db/Dockerfile
    build: ./db
    environment:
      POSTGRES_USER: xlivemetro
      POSTGRES_PASSWORD: xlivemetro
      POSTGRES_DB: xlivemetro
    volumes:
      # Données dans un dossier du projet, ignoré par git : elles survivent aux Rebuild
      # PostgreSQL 18+ : un sous-dossier par version majeure, on monte donc /var/lib/postgresql
      - ./db/data:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U xlivemetro -d xlivemetro']
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:8
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 10
```

- **Le nom du service est le nom d'hôte** : depuis `dev`, la base est `db:5432`, Redis `redis:6379`.
- **Identifiants de dev** (`xlivemetro` / `xlivemetro`) : ce ne sont pas des secrets.
- **`healthcheck` + `depends_on`** : le poste de travail attend que la base et Redis soient prêts.
- Avant la première release, figez chaque image sur une version précise (`redis:8.x.y`, `postgres:19.x` dans `db/Dockerfile`).

### db/Dockerfile

L'image officielle `postgis/postgis` n'existe que pour amd64 : elle tournerait en émulation sur les Mac Apple Silicon. On part donc de l'image officielle `postgres` (multi-architecture) et on ajoute PostGIS depuis le dépôt PGDG déjà configuré dans cette image.

```dockerfile
# PostgreSQL 19 officiel (amd64 et arm64) + PostGIS 3 du dépôt PGDG
FROM postgres:19-trixie

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-19-postgis-3 \
    && rm -rf /var/lib/apt/lists/*
```

Les extensions (`postgis`, `pg_trgm`) sont créées par la première migration Prisma, pas par l'image.

### compose.ci.yaml

En CI, la base et Redis sont publiés sur `localhost` pour les tests lancés sur le runner :

```yaml
services:
  db:
    ports: ['5432:5432']
  redis:
    ports: ['6379:6379']
```

### .nvmrc

```text
26
```

Lu par `actions/setup-node` en CI ; le dev container fixe la même version.

### .env.example

```bash
# Copié en .env à la création du conteneur. Le .env n'est JAMAIS commité.

# Base et cache (services du compose.yaml)
DATABASE_URL=postgres://xlivemetro:xlivemetro@db:5432/xlivemetro
REDIS_URL=redis://redis:6379

# Ports
API_PORT=4000
REALTIME_PORT=4100
WEB_URL=http://localhost:3000
# Adresses vues par le navigateur
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_REALTIME_URL=ws://localhost:4100/ws

# Flux temps réel : synthetic | replay | prim (ADR 0005, 0011)
# synthetic : généré depuis les horaires du référentiel, sans clé
FEED_SOURCE=synthetic
FEED_INTERVAL=30s
REPLAY_DIR=./fixtures/replay
# prim : clé personnelle du portail PRIM d'IDFM (https://prim.iledefrance-mobilites.fr)
PRIM_API_KEY=

# Fond de carte (style vectoriel OSM, sans clé)
NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/dark

# Serveur MCP : instance interrogée
XLIVEMETRO_API_URL=http://localhost:4000

# Logs : lisibles en dev, JSON en production ou avec LOG_FORMAT=json
# LOG_LEVEL=info
# LOG_FORMAT=json
# Sentry (optionnel) : vide = rien n'est envoyé
SENTRY_DSN=
```

- `FEED_SOURCE=synthetic` génère le temps réel à partir des horaires du référentiel : **aucune clé ni aucun compte n'est nécessaire pour contribuer**. `replay` rejoue des réponses PRIM enregistrées dans `REPLAY_DIR`.
- Le dossier `.secrets/` et le fichier `.env` sont dans `.gitignore`.

### .gitattributes et .gitignore

```text
# .gitattributes : fins de ligne LF pour tous, même sous Windows
* text=auto eol=lf
```

```text
# .gitignore
node_modules/
dist/
.next/
.turbo/
.env
.secrets/
db/data/
coverage/
next-env.d.ts
*.tsbuildinfo

# Consignes pour assistants IA générées par les frameworks (next dev les recrée)
apps/*/AGENTS.md
apps/*/CLAUDE.md

# Réglages personnels de Claude Code
.claude/settings.local.json
CLAUDE.local.md
```

## La clé PRIM (optionnelle)

Seulement pour travailler sur l'ingestion avec des données réelles, ou enregistrer un nouveau jeu de rejeu.

1. Créez un compte sur le portail PRIM d'IDFM, puis une clé d'API.
2. Abonnez-la aux API utilisées (liste dans `docs/03-BACKEND.md`).
3. Dans `.env` : `PRIM_API_KEY=…` et `FEED_SOURCE=prim`. Ne la collez jamais ailleurs (issue, PR, log, conversation).
4. Respectez les quotas : ne baissez pas `FEED_INTERVAL` sous 30 s.

Enregistrer un jeu de rejeu : `pnpm --filter realtime record -- --duration 1h` (écrit dans `fixtures/replay`, à relire avant de commiter).

## Accéder aux services

| Service    | Depuis le conteneur     | Depuis votre machine                                               |
| ---------- | ----------------------- | ------------------------------------------------------------------ |
| Web        | `http://localhost:3000` | `http://localhost:3000`                                            |
| API        | `http://localhost:4000` | `http://localhost:4000`                                            |
| PostgreSQL | `psql $DATABASE_URL`    | TablePlus, DBeaver : `127.0.0.1:5432`, `xlivemetro` / `xlivemetro` |
| Realtime   | `http://localhost:4100` | `http://localhost:4100` (WebSocket : `/ws`)                        |

Web, API et realtime sont publiés sur `127.0.0.1` par `compose.yaml` : ils sont joignables depuis le navigateur même sans VS Code (Claude Desktop en session WSL). Si un port est déjà pris sur votre machine, changez le port de gauche dans `compose.yaml`.

## pnpm

Le projet utilise **pnpm** exclusivement, jamais npm ni yarn.

- La version est figée dans le `package.json` racine, champ `packageManager` (par exemple `"packageManager": "pnpm@10.x.x"`). **Corepack**, activé dans le Dockerfile, installe automatiquement cette version : tout le monde a la même.
- Les workspaces sont déclarés dans `pnpm-workspace.yaml` :
  ```yaml
  packages:
    - 'apps/*'
    - 'services/*'
    - 'packages/*'
  ```
- `pnpm-lock.yaml` est commité ; à la création du conteneur, `pnpm install --frozen-lockfile` installe exactement ces versions.

| Au lieu de…                       | Utilisez…                                           |
| --------------------------------- | --------------------------------------------------- |
| `npm install`                     | `pnpm install`                                      |
| `npm install -D paquet` (racine)  | `pnpm add -D -w paquet`                             |
| `npm install paquet` dans une app | `pnpm --filter @xlivemetro/api add paquet`          |
| `npm run script`                  | `pnpm script`                                       |
| `npx outil`                       | `pnpm dlx outil` (ou `pnpm exec` s'il est installé) |
| `npm ci`                          | `pnpm install --frozen-lockfile`                    |

## Lancer les commandes depuis l'extérieur du conteneur

Claude Code (application desktop, session WSL) et tout terminal Ubuntu lancent les commandes du projet **dans le conteneur** avec `docker compose exec` :

```bash
docker compose ps                       # le service dev tourne-t-il ?
docker compose up -d                    # sinon, démarrer la stack
docker compose exec dev pnpm test       # toute commande projet passe par « exec dev »
```

Ainsi, le Node, pnpm et `psql` utilisés sont toujours ceux du conteneur.

## Commandes utiles

| Commande                                          | Effet                                                |
| ------------------------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                                        | lance realtime, api et web avec rechargement à chaud |
| `pnpm gtfs:import`                                | importe le référentiel GTFS IDFM complet             |
| `pnpm build`                                      | compile tout, comme la CI                            |
| `pnpm test`                                       | tests unitaires et d'intégration                     |
| `pnpm lint` / `pnpm format`                       | ESLint / Prettier                                    |
| `pnpm db:migrate`                                 | applique les migrations Prisma                       |
| `pnpm db:seed`                                    | charge le référentiel réduit des fixtures            |
| `pnpm db:reset`                                   | vide la base, rejoue migrations et seed              |
| `pnpm --filter @xlivemetro/db exec prisma studio` | interface Prisma Studio                              |

## Vérifier l'environnement

```bash
node -v          # v26…
go version       # go1.27…
pnpm -v          # version de packageManager
psql --version   # 19…
psql $DATABASE_URL -c "SELECT 1"
redis-cli -u $REDIS_URL ping     # PONG (si redis-tools est installé)
curl http://localhost:4000/health   # {"status":"ok","db":"ok","redis":"ok"}
curl http://localhost:4100/health   # {"status":"ok","source":"replay","last_cycle_age_s":…}
```

## Repartir de zéro

| Besoin                             | Action                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Base cassée ou schéma modifié      | `pnpm db:reset`                                                                                                 |
| Supprimer complètement les données | **Reopen Folder Locally**, supprimez `db/data` (`sudo rm -rf db/data` sous Linux), puis **Reopen in Container** |
| Dev container modifié              | **F1** → **Dev Containers: Rebuild Container**                                                                  |

## Les pièges multi-OS

| Piège                                           | Parade                                                          |
| ----------------------------------------------- | --------------------------------------------------------------- |
| Windows écrit des fins de ligne CRLF            | `.gitattributes` : `* text=auto eol=lf`, dès le premier commit  |
| Projet cloné dans `C:\` sous Windows            | le cloner dans WSL                                              |
| Mac Apple Silicon (arm64) et PC (amd64)         | des images multi-architectures ; jamais `platform: linux/amd64` |
| Modules natifs compilés pour le mauvais système | `pnpm install` **toujours dans le conteneur**                   |
| Versions de dépendances qui divergent           | `pnpm-lock.yaml` commité, `pnpm install --frozen-lockfile`      |
| Hook `pre-commit` qui échoue depuis WSL         | le conteneur `dev` doit tourner : `docker compose up -d`        |

## Dépannage

| Symptôme                        | Parade                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Le conteneur ne démarre pas     | **F1** → **Dev Containers: Show Container Log**                                                             |
| Conteneurs en conflit           | supprimez-les dans Docker Desktop, puis **Rebuild Container**                                               |
| `Author identity unknown`       | configurez git sur votre machine, puis **Rebuild Container**                                                |
| `Permission denied (publickey)` | sur votre machine, `ssh-add -l` doit lister votre clé ; sinon `ssh-add`                                     |
| Carte sans véhicules            | `curl localhost:4100/health` : source, âge du dernier cycle ; en `prim`, vérifiez la clé et les quotas      |
| Tout est cassé                  | `docker system prune -a --volumes` (supprime **toutes** les données Docker locales), puis redémarrez Docker |
