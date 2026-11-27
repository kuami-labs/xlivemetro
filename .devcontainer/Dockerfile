# Même base que l'image de production : Node 26 (LTS) sur Debian trixie
FROM mcr.microsoft.com/devcontainers/typescript-node:26-trixie

# Client PostgreSQL 19 (dépôt officiel PGDG, comme le serveur)
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-common \
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
