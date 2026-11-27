# 0018. Moteur d'itinéraire : RAPTOR en Go, dans le service temps réel

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)
- Suite de : [ADR 0017](0017-assistant-de-trajet.md)

## Contexte

Les fonctionnalités F12 à F14 (PRD) demandent des itinéraires en métro, RER et tram, de gare à gare et depuis la position du visiteur, en moins d'une seconde, en tenant compte des retards connus.

Ce dont on dispose déjà :

- le service Go `realtime` garde en mémoire toutes les courses du jour, leurs passages théoriques **et estimés** (`internal/position`) ;
- le GTFS d'IDFM fournit `transfers.txt` : 191 651 correspondances à pied entre arrêts, avec une durée minimale (4 à 8 min le plus souvent), constaté le 2026-11-27 ;
- PRIM propose aussi un calculateur d'itinéraires multimodal, accessible avec une clé.

## Options

1. **Calculateur d'IDFM via PRIM** : complet (bus, Transilien, marche), maintenu par IDFM. Mais il dépend de la clé et de ses quotas (une requête par recherche de visiteur, à l'opposé de l'ingestion unique), ne fonctionne pas sans clé pour les contributeurs, et ses horaires peuvent différer de ceux affichés sur notre carte.
2. **OpenTripPlanner ou MOTIS** auto-hébergés : complets et éprouvés, mais lourds (JVM ou binaire dédié, plusieurs Go de mémoire, import séparé), un service de plus à faire tourner.
3. **RAPTOR écrit en Go dans `realtime`** : algorithme de référence pour les réseaux à horaires (Delling et al., 2012), par tours de correspondances, sans graphe à précalculer. Il travaille directement sur les courses en mémoire, avec les mêmes horaires estimés que la carte.

## Décision

Option 3.

- **Données** : courses du jour regroupées par parcours (même suite d'arrêts), horaires estimés quand ils existent, sinon théoriques (ADR 0004) ; correspondances de `transfers.txt` limitées à nos arrêts (import GTFS, nouvelle table `transfers`), plus un temps minimal par défaut entre quais d'une même gare quand IDFM n'en donne pas.
- **Recherche** : RAPTOR multi-critères simple (heure d'arrivée, nombre de correspondances), 4 correspondances au plus ; plusieurs points de départ avec leur temps de marche (F13 : gares proches calculées dans le navigateur) et plusieurs quais d'arrivée ; jusqu'à 3 itinéraires non dominés.
- **Interface** : `GET /journeys` du service temps réel (réseau interne), exposé par l'API publique avec validation ; l'API ne reçoit que des identifiants de gares et des durées de marche, jamais de coordonnées (PRD).
- **Limites assumées** : métro, RER et tram seulement (ADR 0017) ; pas de calcul de marche par les rues (temps estimés à vol d'oiseau côté navigateur) ; message explicite quand aucun trajet n'existe.
- **Tests** : réseau fictif minimal (correspondance ratée, course plus lente mais directe, retard qui change le résultat), puis cas réels sur le jeu réduit (Nation → La Défense, Châtelet → Olympiades).

## Conséquences

- Positives : fonctionne sans clé et sans service de plus ; mêmes horaires que la carte et les fiches ; temps de réponse visé de quelques dizaines de millisecondes ; compétence algorithmique visible.
- Négatives : à écrire et à tester soi-même ; itinéraires incomplets (ni bus ni Transilien) ; correspondances aussi bonnes que `transfers.txt`.
- À revoir si : le périmètre s'élargit aux bus et au Transilien (le calculateur de PRIM ou un OpenTripPlanner deviendrait plus pertinent), ou si la qualité des correspondances déçoit dans les grandes gares.
