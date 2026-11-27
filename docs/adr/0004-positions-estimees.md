# 0004. Positions des véhicules estimées par interpolation

- Statut : acceptée
- Date : 2026-11-26
- Décideurs : Kuami (mainteneur)

## Contexte

IDFM ne publie pas la position GPS de la plupart des métros, RER et trams. Il publie les horaires théoriques (GTFS) et les horaires temps réel par course (SIRI Lite Estimated Timetable, ADR 0010).

## Options

1. **Attendre des positions GPS** : impossible en v1.
2. **Interpolation** : pour chaque course, horaires temps réel → les deux arrêts encadrant l'instant présent → fraction parcourue → point sur le tracé, via la distance le long du tracé.
3. **Afficher seulement les gares** avec les retards : peu spectaculaire, hors promesse.

## Décision

Option 2, calculée par le service Go à chaque cycle, puis prolongée côté client entre deux cycles (vitesse transmise). Chaque véhicule porte `estimated: true`, et `theoretical: true` s'il n'a pas de données temps réel.

## Conséquences

- Positives : carte vivante avec les seules données ouvertes.
- Négatives : position approximative, surtout en cas d'arrêt imprévu entre deux gares ; l'interface doit le dire.
- À revoir si : IDFM publie des positions GPS (GTFS-RT VehiclePositions) pour certaines lignes ; on les préférera alors ligne par ligne.
