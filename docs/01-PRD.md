# PRD – XLiveMetro, la carte 3D en temps réel des transports d'Île-de-France

> Document produit : vision, utilisateurs, fonctionnalités, données et plan.
> Fichiers liés : `02-STACK.md`, `03-BACKEND.md`, `04-FRONTEND.md`, `05-DATABASE.md`.
> Mise à jour du 2026-11-27 : ajout de l'**assistant de trajet** (autour de moi, itinéraire, suivi de son train), voir [ADR 0017](adr/0017-assistant-de-trajet.md).

## Vision et problème

**XLiveMetro** — le « X » est la variable de la famille kuami-labs : n'importe quelle ligne, n'importe quel moment. XLiveMetro montre le réseau ferré francilien **vivant**, en 3D, en temps réel, et aide à s'y déplacer.

**Le problème.** Les applications de transport donnent des listes : prochains passages, alertes, itinéraires. Personne ne _voit_ l'état du réseau : où sont les trains, où ça ralentit, quelle ligne est perturbée, et donc pourquoi un trajet prend du retard. Les données ouvertes d'IDFM (portail PRIM) le permettent, mais elles sont dispersées (GTFS, SIRI Lite, messages info trafic) et difficiles à exploiter.

**La promesse.**

1. Ouvrir une page et voir, en 3 secondes, tous les métros, RER et trams d'Île-de-France se déplacer sur une carte 3D, avec les retards et les perturbations.
2. Depuis sa position, trouver les gares proches et leurs départs, demander comment aller à une gare, voir l'itinéraire **sur la carte vivante**, puis suivre le train dans lequel on est monté jusqu'à sa descente.
3. Avec le serveur MCP, poser la question à son assistant IA : « Mon RER B est-il à l'heure ? ».

**Contraintes à assumer.**

- IDFM ne publie pas la position GPS de la plupart des trains. Les positions sont **estimées** : horaires + retards temps réel, interpolés le long du tracé. L'interface le dit clairement.
- Le réseau couvert est le **métro, le RER et le tram**. Sans bus ni Transilien, certains itinéraires seront incomplets ou absents (banlieue éloignée) : l'application le dit, au lieu d'inventer un trajet.

## Utilisateurs, objectifs et périmètre

| Utilisateur                      | Besoin principal                                                                 | Priorité v1       |
| -------------------------------- | -------------------------------------------------------------------------------- | ----------------- |
| Voyageur francilien              | Voir si sa ligne roule, trouver une gare proche, savoir comment et quand y aller | Principal         |
| Voyageur en cours de trajet      | Savoir dans quel train il est, où il en est, quand descendre ou changer          | Principal         |
| Utilisateur d'assistant IA (MCP) | Interroger le réseau en langage naturel, recevoir un lien vers la carte          | Principal (bonus) |
| Recruteur, curieux               | Une démo spectaculaire, comprise immédiatement                                   | Secondaire        |

**Objectifs de la v1**

- Afficher tous les métros, RER et trams en mouvement, rafraîchis toutes les 30 s et animés à 60 images/s.
- Première carte affichée en moins de 3 s (4G correcte), 60 images/s sur un portable récent.
- Proposer des itinéraires métro/RER/tram de gare à gare, et depuis sa position, en tenant compte des retards connus, calculés en moins d'une seconde.
- Suivre son train jusqu'à sa descente, avec l'heure d'arrivée estimée.
- Serveur MCP publié sur npm, utilisable depuis Claude Desktop ou tout client MCP.
- Fonctionner sans clé PRIM pour les contributeurs (flux synthétique, ADR 0011).

**Dans le périmètre :** métro (16 lignes), RER (A à E), tram (T1 à T14) ; carte 3D ; prochains départs ; perturbations ; gares autour de moi ; itinéraires métro/RER/tram (avec marche à pied au départ, à l'arrivée et en correspondance) ; suivi de son train ; serveur MCP.

**Hors périmètre v1 :** bus, Transilien et TER, vélos et trottinettes, comptes utilisateurs, notifications push (téléphone verrouillé ou onglet fermé), application mobile native, IA dans l'application, détection automatique du train à bord (pas de GPS fiable en souterrain).

## Confidentialité de la position (règle de produit)

La position du visiteur est une **donnée personnelle**. Elle est demandée par le navigateur, avec son accord, uniquement quand il utilise « Autour de moi » ou « depuis ma position », et :

- elle **ne quitte jamais le navigateur** : les gares proches sont calculées sur l'appareil, à partir de la liste des gares déjà chargée pour la carte ;
- seuls des **identifiants de gares** (départ, arrivée) et des durées de marche sont envoyés au serveur pour calculer un itinéraire ;
- elle n'est ni enregistrée, ni journalisée, ni mise dans l'URL ;
- refus ou indisponibilité : l'utilisateur choisit sa gare de départ à la main, rien d'autre ne change.

## Fonctionnalités et user stories

### Carte en direct

| #   | Fonctionnalité                | User story                                                                                          | Critère d'acceptation                                                 | Priorité     |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------ |
| F1  | Carte 3D du réseau            | En tant que voyageur, je vois les lignes aux couleurs officielles, les gares et les bâtiments en 3D | Tracés GTFS, couleurs officielles, inclinaison et rotation            | Must         |
| F2  | Véhicules en temps réel       | Je vois chaque train se déplacer, avec un indicateur de retard                                      | Positions mises à jour ≤ 30 s ; animation fluide ; retard en couleur  | Must         |
| F3  | Fiche d'une gare              | Je clique sur une gare et je vois les prochains départs                                             | Départs temps réel, attente et retard                                 | Must         |
| F4  | Perturbations                 | Je vois les lignes perturbées et le message officiel                                                | Message IDFM affiché comme texte brut                                 | Must         |
| F5  | Filtre et recherche           | Je filtre par mode, je cherche une gare                                                             | Recherche floue sans accents, résultat en < 200 ms                    | Must         |
| F6  | Serveur MCP                   | En tant qu'utilisateur d'assistant IA, j'interroge le réseau et je reçois un lien vers la carte     | 5 outils (voir `03-BACKEND.md`), lien profond vers la carte           | Must (bonus) |
| F7  | Suivi d'un train sur la carte | Je clique sur un train et la caméra le suit                                                         | Caméra animée, fiche du train (destination, retard, prochains arrêts) | Should       |
| F8  | Favoris                       | Je garde mes gares favorites                                                                        | `localStorage`, aucun compte                                          | Should       |
| F9  | Mode « rembobiner »           | Je revois l'heure écoulée en accéléré                                                               | Rejeu des états de la dernière heure                                  | Could        |
| F10 | Carte de chaleur des retards  | Je vois où le réseau ralentit                                                                       | Agrégat des retards par segment sur 1 h                               | Could        |

### Assistant de trajet

| #   | Fonctionnalité                | User story                                                                                                    | Critère d'acceptation                                                                                                                                                                                                                                                                                                                             | Priorité |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F11 | Autour de moi                 | En tant que voyageur, j'autorise ma position et je vois les gares les plus proches et leurs prochains départs | Jusqu'à 5 gares à moins de 1,5 km, distance et temps de marche estimé (vol d'oiseau × 1,3, 5 km/h) ; position jamais envoyée au serveur ; refus géré                                                                                                                                                                                              | Must     |
| F12 | Itinéraire de gare à gare     | Je choisis une gare de départ et une gare d'arrivée, et je reçois des itinéraires en métro, RER et tram       | Jusqu'à 5 itinéraires dont des alternatives par d'autres lignes, avec labels (le plus rapide, moins de correspondances, moins de marche, le moins cher, le plus long), heures de départ et d'arrivée, lignes, gares de correspondance, durée, marche, prix estimé en tickets à l'unité (ADR 0019) ; retards connus pris en compte ; réponse < 1 s | Must     |
| F13 | Itinéraire depuis ma position | Je pars de là où je suis : l'itinéraire commence par la marche jusqu'à une gare proche                        | Plusieurs gares de départ candidates avec leur temps de marche, la meilleure option retenue ; seuls identifiants de gares et durées envoyés                                                                                                                                                                                                       | Must     |
| F14 | Itinéraire sur la carte       | Je vois mon itinéraire sur la carte vivante, et les trains que je dois prendre                                | Seul l'itinéraire choisi est affiché (tracé, gares, trains de ses lignes), le reste du réseau masqué ; gares de correspondance marquées, train du premier tronçon suivi s'il roule déjà                                                                                                                                                           | Should   |
| F15 | Je suis dans ce train         | À la gare, j'indique le train que je prends, et l'application me suit                                         | Choix dans les départs de la gare (suggestion du prochain départ de la ligne de l'itinéraire) ; prochains arrêts, heure d'arrivée estimée mise à jour ; écran d'accueil du trajet                                                                                                                                                                 | Should   |
| F16 | Rappel de descente            | Je suis prévenu quand approche ma gare de descente ou de correspondance                                       | Alerte dans l'application (et notification du navigateur si autorisée) 1 arrêt avant, tant que l'onglet est ouvert ; aucune notification push serveur                                                                                                                                                                                             | Should   |
| F17 | Destination par adresse       | Je tape une adresse comme destination                                                                         | Géocodage par l'API Adresse de l'État via notre API (ADR 0020 : le texte saisi lui est envoyé, l'utilisateur en est informé, rien n'est conservé) ; adresses d'Île-de-France seulement ; gares à moins de 1,5 km calculées dans le navigateur ; marche finale indiquée et tracée                                                                  | Could    |
| F18 | Itinéraire via le MCP         | Je demande un itinéraire à mon assistant IA                                                                   | Outil `plan_trip` (gare à gare), lien vers la carte avec l'itinéraire                                                                                                                                                                                                                                                                             | Could    |

**Itinéraires incomplets (assumés en v1).** Le calculateur ne connaît que le métro, le RER et le tram, avec de la marche à pied (1,5 km au plus au départ et à l'arrivée, 400 m en correspondance hors liaisons internes des gares). Quand aucun itinéraire n'existe dans ces limites, l'application l'indique (« aucun trajet en métro, RER ou tram ») sans proposer de trajet approximatif.

## Données

| Source                                          | Contenu                                                                                 | Usage                                      | Fréquence        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------- |
| GTFS statique IDFM                              | lignes, arrêts, tracés, horaires, **correspondances** (`transfers.txt`, `pathways.txt`) | référentiel (PostGIS), calcul d'itinéraire | import quotidien |
| SIRI Lite Estimated Timetable (requête globale) | horaires temps réel par course                                                          | positions, départs, itinéraires            | toutes les 30 s  |
| SIRI Lite General Message                       | perturbations par ligne                                                                 | encadrés, MCP, avertissement d'itinéraire  | toutes les 2 min |
| Position du visiteur                            | coordonnées (navigateur uniquement)                                                     | gares proches                              | à la demande     |
| API Adresse (IGN, Géoplateforme), ADR 0020      | géocodage d'une adresse                                                                 | destination par adresse                    | à la demande     |
| Bâtiments 3D                                    | OpenStreetMap via tuiles vectorielles                                                   | décor 3D                                   | statique         |

Sources vérifiées le 2026-11-27 : voir [ADR 0010](adr/0010-sources-idfm.md). Quotas PRIM à relever avec une clé.

## Indicateurs de succès

| Indicateur                                                                              | Cible v1                                  |
| --------------------------------------------------------------------------------------- | ----------------------------------------- |
| Temps d'affichage de la première carte                                                  | < 3 s                                     |
| Images par seconde (portable récent, ~1 000 véhicules)                                  | ≥ 55                                      |
| Fraîcheur des positions                                                                 | ≤ 30 s                                    |
| Débit WebSocket par client                                                              | < 5 Ko/s en régime établi                 |
| Calcul d'un itinéraire                                                                  | < 1 s (réseau complet, heure de pointe)   |
| Itinéraires gare à gare trouvés (paires de gares tirées au hasard, à l'heure de pointe) | ≥ 99 %                                    |
| Écart à l'arrivée annoncée (trajets suivis)                                             | < 3 min dans 80 % des cas (avec clé PRIM) |
| Disponibilité de la démo publique                                                       | ≥ 99 % sur un mois                        |
| Installation du MCP                                                                     | < 2 min avec la doc                       |

## Plan

| Étape | Objectif            | Livrables                                                                                | État    |
| ----- | ------------------- | ---------------------------------------------------------------------------------------- | ------- |
| 0     | Fondations          | dev container, dépôt, CI (TS + Go), squelette, spike des sources                         | fait    |
| 1     | Données             | import GTFS (PostGIS), flux synthétique, sources replay et PRIM                          | fait    |
| 2     | Temps réel          | positions estimées, WebSocket binaire, carte MapLibre + deck.gl                          | fait    |
| 3     | Produit             | fiches, perturbations, recherche, filtres, système de design, rames 3D                   | fait    |
| 4     | Bonus               | serveur MCP                                                                              | fait    |
| 5     | Assistant de trajet | F11 autour de moi ; moteur d'itinéraire (choix : ADR à venir) ; F12, F13, F14 ; F15, F16 | à faire |
| 6     | Publication         | clé PRIM et ingestion réelle, hébergement (ADR), MCP sur npm, README, release v0.1.0     | à faire |

Ordre proposé pour l'étape 5 : F11 (simple, utile tout de suite), puis F15 et F16 (réutilisent la fiche train), puis le moteur d'itinéraire et F12, F13, F14.

## Risques

| Risque                                                     | Parade                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Quotas PRIM dépassés                                       | une seule ingestion côté serveur, caches, intervalle configurable                                                        |
| Données temps réel incomplètes pour une ligne              | repli sur l'horaire théorique, signalé « théorique »                                                                     |
| Performances du navigateur                                 | données binaires, deck.gl, interpolation côté client, niveau de détail                                                   |
| Panne de PRIM                                              | dernier état servi avec son âge affiché                                                                                  |
| Licence des données                                        | mentions IDFM et OSM affichées, conformité vérifiée avant publication                                                    |
| Itinéraires incomplets (ni bus ni Transilien)              | limites de marche claires, message explicite quand aucun trajet n'existe, jamais de trajet inventé                       |
| Itinéraire faux à cause d'un retard ou d'une perturbation  | retards temps réel pris en compte, perturbations affichées sur l'itinéraire, mention « horaires estimés »                |
| Fuite de la position du visiteur                           | calcul des gares proches dans le navigateur, seuls des identifiants de gares envoyés, rien dans les logs ni l'URL        |
| Correspondances mal modélisées (grandes gares)             | `transfers.txt` et `pathways.txt` d'IDFM, durée minimale de correspondance, tests sur Châtelet, Gare de Lyon, La Défense |
| Rappel de descente manqué (onglet en arrière-plan, mobile) | limite annoncée (application web, pas de push), notification du navigateur si autorisée                                  |
