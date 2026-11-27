# 0003. Carte 3D : MapLibre GL JS + deck.gl

- Statut : acceptée
- Date : 2026-11-26
- Décideurs : Kuami (mainteneur)

## Contexte

Il faut afficher un fond de carte avec bâtiments 3D et animer ~1 000 véhicules à 60 images/s, sans coût de licence.

## Options

1. **MapLibre + deck.gl** : open source, deck.gl conçu pour de gros volumes animés (attributs binaires, `TripsLayer`).
2. **MapLibre seul** : plus simple, animation de milliers d'objets peu performante via les sources GeoJSON.
3. **CesiumJS** : globe 3D réaliste, lourd, inadapté à l'échelle d'une ville.
4. **Three.js sur mesure** : liberté totale, beaucoup plus de travail.
5. **Mapbox GL** : excellent, mais licence et facturation.

## Décision

Option 1, avec `MapboxOverlay` de deck.gl ; fond de carte en tuiles vectorielles OSM gratuites (OpenFreeMap).

Mise à jour du 2026-11-27 : le mode **entrelacé** (couches deck.gl insérées entre les couches MapLibre) échoue avec MapLibre 6.19 et deck.gl 9.4.2 (`getViewport` lit une propriété absente de la nouvelle API des couches personnalisées). deck.gl est donc utilisé en **surcouche** (`interleaved: false`) : ses couches sont dessinées au-dessus de la carte, bâtiments 3D compris. Le worker de MapLibre 6 est fourni explicitement (`setWorkerUrl`) pour Turbopack.

## Conséquences

- Positives : performances, gratuité, écosystème riche.
- Négatives : deux bibliothèques à maîtriser ; WebGL2 requis.
- À revoir si : WebGPU devient stable dans deck.gl (gain possible) ; deck.gl prend en charge l'entrelacement avec MapLibre 6 (les trains passeraient alors derrière les bâtiments).
