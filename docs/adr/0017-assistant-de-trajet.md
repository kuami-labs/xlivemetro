# 0017. Élargir la v1 à un assistant de trajet (métro, RER, tram)

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)

## Contexte

La v1 prévoyait une carte en direct (positions, départs, perturbations) et excluait explicitement le calcul d'itinéraire et les notifications (PRD, version initiale). En testant l'application sur le réseau complet, le besoin d'aller plus loin est apparu : partir de sa position, trouver comment aller quelque part, puis suivre le train dans lequel on est monté.

Contraintes connues :

- les données couvrent le métro, le RER et le tram, sans bus ni Transilien : beaucoup de trajets de banlieue passent par un bus ;
- la position d'un visiteur est une donnée personnelle, et le projet s'est engagé à n'en collecter aucune ;
- il n'y a pas de GPS fiable dans le métro souterrain pour deviner le train à bord ;
- une application web ne peut pas notifier un téléphone verrouillé sans service de notifications push.

## Options

1. Garder la v1 telle quelle (carte en direct uniquement), l'assistant en v2.
2. Élargir la v1 à un assistant de trajet **limité au métro, RER et tram**, itinéraires incomplets assumés.
3. Élargir aux bus et au Transilien en même temps : réseau ~20 fois plus grand (courses, arrêts), import, mémoire et quotas à revoir, calendrier intenable.

## Décision

Option 2. Nouvelles fonctionnalités F11 à F18 du PRD : autour de moi, itinéraire gare à gare et depuis sa position, itinéraire sur la carte, « je suis dans ce train », rappel de descente, et plus tard destination par adresse et itinéraire via le MCP.

Règles qui l'accompagnent :

- **La position ne quitte jamais le navigateur** : gares proches calculées sur l'appareil, seuls des identifiants de gares et des durées de marche sont envoyés.
- **Itinéraires incomplets assumés** : marche bornée (1,5 km au départ et à l'arrivée, 400 m en correspondance), message explicite quand aucun trajet n'existe, jamais de trajet inventé.
- **Le train à bord est choisi par l'utilisateur** (avec une suggestion), pas détecté.
- **Rappels dans l'application seulement** (et notification du navigateur si autorisée), onglet ouvert ; pas de push serveur.

Le choix du **moteur d'itinéraire** (algorithme écrit en Go sur nos données, ou calculateur d'IDFM via PRIM) fera l'objet d'un ADR séparé avant l'implémentation de F12.

## Conséquences

- Positives : application utile au quotidien, et plus seulement une démonstration ; réutilise la carte, les fiches et le temps réel existants.
- Négatives : charge de travail nettement plus grande (étape 5 du plan) ; itinéraires de banlieue souvent absents ; risque d'itinéraire faux en cas de perturbation non annoncée.
- À revoir si : les bus et le Transilien deviennent nécessaires (nouvel ADR de périmètre et de dimensionnement).
