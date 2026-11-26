# 0006. Serveur MCP : package npm stdio qui s'appuie sur l'API publique

- Statut : acceptée
- Date : 2026-11-26
- Décideurs : Kuami (mainteneur)

## Contexte

Bonus du projet : permettre à un assistant IA d'interroger le réseau et de renvoyer vers la carte.

## Options

1. **Package npm stdio** dans le monorepo (`apps/mcp`), qui appelle l'API REST publique.
2. **Serveur MCP distant (HTTP)** hébergé avec l'application.
3. **Les deux.**

## Décision

Option 1. Le MCP n'a aucun accès direct à PRIM, à la base ni à Redis : il n'utilise que l'API publique, avec les mêmes limites que tout client. Chaque réponse peut inclure un lien profond vers la carte (`map_link`). Publication sur npm via GitHub Actions avec provenance (`npm publish --provenance`).

## Conséquences

- Positives : surface d'attaque minimale ; aucune clé ; fonctionne avec toute instance (`XLIVEMETRO_API_URL`).
- Négatives : dépend de la disponibilité de l'instance publique ; installation locale nécessaire.
- À revoir si : la demande d'un MCP distant (sans installation) apparaît.
