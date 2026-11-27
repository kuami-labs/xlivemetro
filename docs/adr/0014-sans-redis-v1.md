# 0014. Pas de Redis en v1 : caches en mémoire

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)

## Contexte

La stack initiale (`docs/02-STACK.md`) reprenait Redis d'XCadence pour le cache de l'API, le dernier état temps réel, le pub/sub et un verrou d'ingestion. Depuis l'ADR 0013, l'état temps réel vit dans la mémoire du service Go, et l'API l'interroge par HTTP. Il ne reste à Redis que le cache des réponses de l'API.

## Options

1. **Garder Redis** pour le cache de l'API : un service de plus à faire tourner, surveiller et mettre à jour, en dev, en CI et en production.
2. **Cache en mémoire** dans l'API (`TtlCache`, taille bornée) : référentiel 1 h, départs 15 s, plus les en-têtes `Cache-Control` pour les navigateurs et un éventuel CDN.

## Décision

Option 2. Redis est retiré de `compose.yaml`, de la CI, de `.env.example` et de la documentation. Ajouter Redis plus tard ne demandera qu'une implémentation partagée de `TtlCache`.

## Conséquences

- Positives : une dépendance d'infrastructure en moins, environnement plus léger, aucun réseau entre l'API et son cache.
- Négatives : chaque instance d'API a son propre cache ; un redémarrage le vide (rechargé en quelques secondes).
- À revoir si : plusieurs instances d'API ou de `realtime` deviennent nécessaires (cache partagé, verrou d'ingestion, état commun).
