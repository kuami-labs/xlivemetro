# PRD – XLiveMetro, la carte 3D en temps réel des transports d'Île-de-France

> Document produit : vision, utilisateurs, fonctionnalités, données et plan.
> Fichiers liés : `02-STACK.md`, `03-BACKEND.md`, `04-FRONTEND.md`, `05-DATABASE.md`.

## Vision et problème

**XLiveMetro** — le « X » est la variable de la famille kuami-labs : n'importe quelle ligne, n'importe quel moment. XLiveMetro montre le réseau ferré francilien **vivant**, en 3D, en temps réel.

**Le problème.** Les applications de transport donnent des listes : prochains passages, alertes. Personne ne *voit* l'état du réseau : où sont les trains, où ça ralentit, quelle ligne est perturbée. Les données ouvertes d'IDFM (portail PRIM) le permettent, mais elles sont dispersées (GTFS statique, SIRI, GTFS-RT, messages info trafic) et difficiles à exploiter.

**La promesse.** Ouvrir une page et voir, en 3 secondes, tous les métros, RER et trams d'Île-de-France se déplacer sur une carte 3D, avec les retards et les perturbations. Et, avec le serveur MCP, poser la question à son assistant IA : « Mon RER B est-il à l'heure ? ».

**Contrainte de données à assumer.** IDFM ne publie pas la position GPS de la plupart des trains. Les positions sont **estimées** : horaires théoriques + retards temps réel, interpolés le long du tracé de la ligne. L'interface le dit clairement.

## Utilisateurs, objectifs et périmètre

| Utilisateur | Besoin principal | Priorité v1 |
| --- | --- | --- |
| Voyageur francilien | Voir si sa ligne roule, où est son train, ce qui est perturbé | Principal |
| Utilisateur d'assistant IA (MCP) | Interroger le réseau en langage naturel, recevoir un lien vers la carte | Principal (bonus) |
| Recruteur, curieux | Une démo spectaculaire, comprise immédiatement | Secondaire |

**Objectifs de la v1**

- Afficher tous les métros, RER et trams en mouvement, rafraîchis toutes les 30 s et animés à 60 images/s.
- Première carte affichée en moins de 3 s (4G correcte), 60 images/s sur un portable récent.
- Serveur MCP publié sur npm, utilisable depuis Claude Desktop ou tout client MCP.
- Fonctionner sans clé PRIM pour les contributeurs (rejeu d'un flux enregistré).

**Dans le périmètre :** métro (16 lignes), RER (A à E), tram (T1 à T14) ; carte 3D ; prochains passages ; perturbations ; serveur MCP.

**Hors périmètre v1 :** bus, Transilien (hors RER), calcul d'itinéraire complet, comptes utilisateurs, notifications, application mobile native, IA dans l'application.

## Fonctionnalités et user stories

| # | Fonctionnalité | User story | Critère d'acceptation | Priorité |
| --- | --- | --- | --- | --- |
| F1 | Carte 3D du réseau | En tant que voyageur, je vois les lignes aux couleurs officielles, les gares et les bâtiments en 3D | Tracés GTFS, couleurs officielles, inclinaison et rotation | Must |
| F2 | Véhicules en temps réel | Je vois chaque train se déplacer, avec un indicateur de retard | Positions mises à jour ≤ 30 s ; animation fluide ; retard en couleur | Must |
| F3 | Fiche d'un arrêt | Je clique sur une gare et je vois les prochains passages | Prochains passages temps réel par direction | Must |
| F4 | Perturbations | Je vois les lignes perturbées et le message officiel | Badge sur la ligne, texte IDFM affiché comme texte brut | Must |
| F5 | Filtre et recherche | Je filtre par mode ou par ligne, je cherche une gare | Recherche floue, résultat en < 200 ms | Must |
| F6 | Serveur MCP | En tant qu'utilisateur d'assistant IA, j'interroge le réseau et je reçois un lien vers la carte | 5 outils (voir `03-BACKEND.md`), lien profond vers la carte centrée | Must (bonus) |
| F7 | Suivi d'un train | Je clique sur un train et la caméra le suit | Caméra animée, fiche du train (destination, retard, prochains arrêts) | Should |
| F8 | Favoris | Je garde mes lignes et gares favorites | `localStorage`, aucun compte | Should |
| F9 | Mode « rembobiner » | Je revois l'heure écoulée en accéléré | Rejeu des snapshots de la dernière heure | Could |
| F10 | Carte de chaleur des retards | Je vois où le réseau ralentit | Agrégat des retards par segment sur 1 h | Could |

## Données

| Source (portail PRIM d'IDFM) | Contenu | Usage | Fréquence |
| --- | --- | --- | --- |
| GTFS statique IDFM | lignes, arrêts, tracés (`shapes`), horaires théoriques | référentiel en base (PostGIS) | import quotidien |
| GTFS-RT TripUpdates / SIRI Estimated Timetable | retards et horaires temps réel par course | calcul des positions | toutes les 30 s |
| SIRI Stop Monitoring | prochains passages par arrêt | fiche d'arrêt, MCP | à la demande, avec cache |
| Info trafic (messages de perturbation) | perturbations par ligne | badges, MCP | toutes les 2 min |
| Bâtiments 3D | OpenStreetMap via tuiles vectorielles | décor 3D | statique |

Les noms exacts des endpoints, les quotas et les formats sont vérifiés sur le portail PRIM au moment de l'implémentation et notés dans `03-BACKEND.md`.

## Indicateurs de succès

| Indicateur | Cible v1 |
| --- | --- |
| Temps d'affichage de la première carte | < 3 s |
| Images par seconde (portable récent, ~1 000 véhicules) | ≥ 55 |
| Fraîcheur des positions | ≤ 30 s |
| Débit WebSocket par client | < 5 Ko/s en régime établi |
| Disponibilité de la démo publique | ≥ 99 % sur un mois |
| Installation du MCP | < 2 min avec la doc |

## Plan sur un mois

| Semaine | Objectif | Livrables |
| --- | --- | --- |
| 0 | Phase 0 | dev container, dépôt, ruleset, CI (TS + Go), squelette monorepo |
| 1 | Données | import GTFS dans PostGIS, service Go : ingestion PRIM, enregistreur et rejeu |
| 2 | Temps réel | calcul des positions, diffusion WebSocket binaire, carte MapLibre + deck.gl |
| 3 | Produit | fiches arrêt et train, perturbations, recherche, filtres, design |
| 4 | Bonus et publication | serveur MCP sur npm, performances, README avec GIF, démo publique |

## Risques

| Risque | Parade |
| --- | --- |
| Quotas PRIM dépassés | une seule ingestion côté serveur, cache Redis, intervalle configurable |
| Données temps réel incomplètes pour une ligne | repli sur l'horaire théorique, signalé « théorique » |
| Performances du navigateur | données binaires, deck.gl, interpolation côté client, niveau de détail |
| Panne de PRIM | dernier état servi avec son âge affiché ; bascule possible sur le rejeu |
| Licence des données | mentions IDFM et OSM affichées, conformité vérifiée avant publication |
