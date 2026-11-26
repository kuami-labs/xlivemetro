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

Option 1, avec `MapboxOverlay` de deck.gl en mode entrelacé dans MapLibre ; fond de carte en tuiles vectorielles OSM gratuites.

## Conséquences

- Positives : performances, gratuité, écosystème riche.
- Négatives : deux bibliothèques à maîtriser ; WebGL2 requis.
- À revoir si : WebGPU devient stable dans deck.gl (gain possible).
