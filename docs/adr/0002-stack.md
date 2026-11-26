# 0002. Stack : monorepo TypeScript + service Go pour le temps réel

- Statut : acceptée
- Date : 2026-11-26
- Décideurs : Kuami (mainteneur)

## Contexte

XLiveMetro ingère les flux PRIM d'IDFM toutes les 30 s et diffuse les positions de ~1 000 trains à un nombre inconnu de navigateurs, en continu. Le reste (référentiel, recherche, prochains passages, MCP) est une API REST classique. Le mainteneur maîtrise la stack TypeScript d'XCadence.

## Options

1. **Tout en TypeScript** (NestJS api + worker BullMQ + WebSocket NestJS) : réutilisation maximale, mais Node tient moins bien des milliers de WebSocket longues et la mémoire par connexion est plus élevée.
2. **Hybride Go** : un service Go pour ingestion, calcul des positions et diffusion WebSocket ; NestJS pour l'API REST ; Next.js pour la carte.
3. **Hybride Rust** : performances maximales, risque trop élevé sur un mois.
4. **Tout en Go** : un seul langage côté serveur, mais on perd la réutilisation d'XCadence et les types partagés avec le front.

## Décision

Option 2. Le chemin chaud (ingestion, positions, diffusion) est en Go ; tout le reste réutilise la stack d'XCadence. Un schéma Protocol Buffers commun (`packages/proto`) génère les types Go et TypeScript. BullMQ n'est pas repris : la boucle d'ingestion est une goroutine, pas un job.

## Conséquences

- Positives : goroutines adaptées à beaucoup de connexions, binaire unique léger, nouvelle compétence visible ; types partagés via protobuf.
- Négatives : deux chaînes d'outils (lint, tests, Dependabot `gomod`) ; dev container plus lourd.
- À revoir si : la diffusion reste faible en charge réelle et que la double chaîne coûte plus qu'elle n'apporte.
