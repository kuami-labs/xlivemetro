# 0015. État du front sans bibliothèque dédiée

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)

## Contexte

`docs/02-STACK.md` prévoyait Zustand (état de la carte) et TanStack Query (appels REST). En réalisant la carte et les panneaux, l'état se révèle de deux natures très différentes :

- l'état **temps réel** (~1 000 trains, 60 images/s) : il doit rester hors de React, dans des typed arrays mis à jour par le Web Worker et lus directement par deck.gl ;
- l'état **d'interface** : la sélection (gare ou train), les modes affichés, les favoris, et trois appels REST (fiche gare, départs, fiche train) rafraîchis à intervalle fixe.

## Options

1. **Zustand + TanStack Query** comme prévu : cache, déduplication, états de chargement standard ; deux dépendances, et Zustand n'apporte rien à l'état temps réel qui reste hors de React.
2. **Rien de plus** : refs et typed arrays pour la carte, `useState` et `fetch` (avec `setInterval`) dans chaque panneau ; l'API renvoie déjà des en-têtes `Cache-Control`.

## Décision

Option 2. Les composants de panneau sont remontés à chaque sélection (`key`) et ignorent les réponses arrivées après leur fermeture (drapeau `active`, sans `AbortController`, que l'outil de développement de Next.js signale à tort).

## Conséquences

- Positives : aucune dépendance, état temps réel sans coût de rendu React, code court.
- Négatives : pas de cache partagé entre panneaux ni de nouvelle tentative automatique.
- À revoir si : les écrans se multiplient (`/lignes`, comparaisons) ou si plusieurs composants lisent les mêmes données REST.
