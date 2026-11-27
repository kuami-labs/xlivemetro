# Frontend – XLiveMetro

> Next.js (App Router), MapLibre GL JS + deck.gl. Le système de design est à créer (`DESIGN.md`), avec une identité propre.

## Pages

| Route       | Contenu                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `/`         | la carte plein écran ; paramètres d'URL : `stop`, `line`, `follow`, `mode`, `lat`, `lng`, `zoom`, `pitch`, `bearing` |
| `/lignes`   | liste des lignes et leur état (rendu serveur, utile au référencement)                                                |
| `/a-propos` | sources, licences IDFM et OSM, fonctionnement des positions estimées, MCP                                            |

Toute vue de la carte est **partageable** par son URL : c'est ce que produit l'outil `map_link` du MCP.

## Couches de la carte

| Couche                    | Technologie                                                              | Contenu                                               |
| ------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| Fond + bâtiments 3D       | MapLibre (style vectoriel, `fill-extrusion`)                             | thème sombre par défaut, clair en option              |
| Tracés des lignes         | deck.gl `PathLayer`                                                      | couleurs officielles, lignes perturbées en pointillés |
| Gares                     | deck.gl `ScatterplotLayer` + `TextLayer`                                 | taille selon le zoom                                  |
| Véhicules                 | deck.gl `ScenegraphLayer` (modèle 3D léger) ou `IconLayer` selon le zoom | couleur du retard, cap                                |
| Traînées                  | deck.gl `TripsLayer`                                                     | sillage des 60 dernières secondes                     |
| Chaleur des retards (F10) | deck.gl `HeatmapLayer`                                                   |                                                       |

## Performances (le cœur du projet)

- **Hors de React** : les positions vivent dans des `Float32Array` mis à jour par le décodeur WebSocket ; React ne rend que l'interface autour de la carte.
- **Interpolation** : entre deux messages (30 s), chaque véhicule avance selon sa vitesse ; `requestAnimationFrame` met à jour les attributs deck.gl (`updateTriggers`, attributs binaires).
- **Décodage** dans un **Web Worker** (protobuf → typed arrays transférables).
- **Abonnement par zone** : le client n'envoie au serveur que la bbox visible.
- **Niveau de détail** : icônes plates loin, modèles 3D proches.
- **Budget** : JS initial < 250 Ko gzip hors carte ; carte chargée de façon différée (`next/dynamic`, `ssr: false`).
- Mesure : panneau de stats en dev (images/s, véhicules, débit), test Lighthouse en CI (optionnel).

## Composants

| Composant                 | Rôle                                                                   |
| ------------------------- | ---------------------------------------------------------------------- |
| `LiveMap`                 | instancie MapLibre + `MapboxOverlay` deck.gl, gère la caméra           |
| `RealtimeClient`          | WebSocket, reconnexion avec back-off, Web Worker de décodage           |
| `StopPanel`               | fiche d'une gare : prochains passages (TanStack Query, rafraîchi 30 s) |
| `VehiclePanel`            | fiche d'un train suivi                                                 |
| `LineFilter`, `SearchBox` | filtres et recherche (Ctrl+K)                                          |
| `DisruptionBadge`         | état d'une ligne, message en texte brut                                |
| `FreshnessIndicator`      | âge des données, « estimé » / « théorique »                            |
| `Attribution`             | mentions IDFM, OSM, tuiles                                             |

## Accessibilité

La carte 3D n'est pas accessible par nature : toute information de la carte existe aussi en **texte** (panneaux, `/lignes`). Navigation clavier complète des panneaux, contrastes AA, `prefers-reduced-motion` coupe les animations de caméra et les traînées.
