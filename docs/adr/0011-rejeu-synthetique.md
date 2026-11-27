# 0011. Rejeu : flux SIRI Lite synthétique généré depuis le GTFS, en attendant un enregistrement réel

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)
- Complète : [ADR 0005](0005-mode-rejeu.md)

## Contexte

L'ADR 0005 prévoit de rejouer des réponses PRIM réellement enregistrées. Au démarrage du projet, aucune clé PRIM n'est disponible (création de compte à faire par le mainteneur), et le format exact des réponses SIRI Lite n'est visible qu'avec une clé (ADR 0010). Les conditions de redistribution de réponses enregistrées restent aussi à confirmer.

## Options

1. **Attendre la clé** avant tout développement temps réel : bloque le service Go et la carte.
2. **Flux synthétique** : un générateur produit, au format SIRI Lite Estimated Timetable, les courses du référentiel réduit à partir des horaires théoriques du GTFS, avec des retards pseudo-aléatoires **déterministes** (graine fixe).
3. **Données inventées** sans lien avec le GTFS : irréalistes, positions incohérentes.

## Décision

Option 2. La source `replay` lit des fichiers SIRI Lite ; ces fichiers sont d'abord produits par le générateur (`cmd/synth`), puis remplacés ou complétés par des enregistrements réels (`cmd/record`) quand une clé existera et que la redistribution sera confirmée. Le décodeur est le même dans les deux cas : le générateur suit la structure SIRI Lite publique (norme SIRI, profil Lite) et sera recalé sur une vraie réponse dès la première clé.

Le GTFS IDFM est publié sous Licence Mobilités : les extraits versionnés dans `fixtures/` portent la mention de la source et de la licence (`fixtures/README.md`).

## Conséquences

- Positives : tout le chemin temps réel se développe et se teste sans clé ; données cohérentes avec le référentiel ; tests déterministes.
- Négatives : écarts possibles avec le format réel, à corriger au premier enregistrement ; retards non représentatifs.
- À revoir : dès qu'une clé PRIM est disponible (relever le format, enregistrer un jeu réel).
