# 0016. Rendu 3D de la carte et système de design

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)
- Complète : [ADR 0003](0003-carte-maplibre-deckgl.md)

## Contexte

Le système de design a été choisi par QCM puis validé sur maquette (ambiance « salle de contrôle », accent cyan, Inter et JetBrains Mono, thèmes sombre et clair, trois représentations des trains au choix, dont des rames 3D « optimisées »). Une première maquette 3D dessinée à la main a été jugée peu réaliste ; la maquette validée part d'une capture réelle de l'application.

Contraintes techniques constatées :

- deck.gl est en surcouche de MapLibre 6 (ADR 0003) : ce qu'il dessine passe toujours au-dessus des bâtiments.
- Les tracés tracés par deck.gl flottaient au-dessus de la ville sans lien avec elle.
- `getOrientation` de `SimpleMeshLayer` ne donnait pas une orientation fiable des rames selon le cap (essais contradictoires selon l'ordre des angles).

## Décision

1. **Jetons CSS** (variables, `data-theme` sur `<html>`) exposés à Tailwind 4 ; thème sombre par défaut, choix en `localStorage`, appliqué avant le premier rendu.
2. **Lignes dessinées par MapLibre** (couches `line` : halo flouté + trait fin) au lieu de deck.gl, **au-dessus** des bâtiments : sous les bâtiments, les lignes de métro souterraines disparaissaient. Ciel (`setSky`), lumière (`setLight`) et couleurs des bâtiments selon le thème ; tout est rejoué à chaque changement de style.
3. **Trains** : trois représentations deck.gl, une couche par représentation avec un identifiant distinct (deck.gl réutilise l'état des couches de même identifiant) :
   - pastilles (`ScatterplotLayer`, anneau d'épaisseur variable) + sillage (`LineLayer`) ;
   - flèches (`IconLayer`, icône masque teintée) ;
   - rames 3D (`SimpleMeshLayer`) à partir du zoom 15 : **une** géométrie de cube instanciée, une **matrice de transformation calculée par rame** (`rameMatrix`, testée) au lieu de `getOrientation`, et un halo au sol (`ScatterplotLayer` en mètres) pour le retard.
4. Variantes de tracé : l'API écarte une variante entièrement recouverte (à 40 m) par une variante plus longue de la même ligne (RER A : 35 → 13 tracés, GeoJSON 260 → 113 Ko).
5. Dépendance ajoutée : `@deck.gl/mesh-layers` 9.4.2 (et son pair `@luma.gl/gltf`), dernière version stable, même famille que deck.gl.

## Conséquences

- Positives : rendu réaliste (bâtiments OSM, horizon, lumière), deux thèmes cohérents, rames 3D légères (une géométrie, ~1 000 instances), orientation vérifiée par des tests.
- Négatives : trains et lignes toujours au-dessus des bâtiments (surcouche) ; les rames 3D sont des volumes simples, pas des modèles détaillés ; 13 variantes restent pour le RER A.
- À revoir si : deck.gl prend en charge l'entrelacement avec MapLibre 6 ; le calcul des variantes « propres » (6 pour le RER A, 16 s en SQL) est déplacé à l'import GTFS.
