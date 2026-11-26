# PostgreSQL 19 officiel (amd64 et arm64) + PostGIS 3 du dépôt PGDG
FROM postgres:19-trixie

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-19-postgis-3 \
    && rm -rf /var/lib/apt/lists/*
