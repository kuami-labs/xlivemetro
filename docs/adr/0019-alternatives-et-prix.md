# 0019. Itinéraires alternatifs, labels et prix estimé

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)
- Suite de : [ADR 0018](0018-moteur-itineraire.md)

## Contexte

En testant F12 sur le réseau complet, une seule proposition revenait souvent (Nation → La Défense : RER A seul). RAPTOR ne garde que les itinéraires non dominés (arrivée, correspondances) : un trajet un peu plus lent par une autre ligne disparaît, alors que le voyageur veut des **alternatives** (ligne perturbée, préférence pour moins de marche, etc.), avec des **labels** pour les comparer (le plus rapide, moins de correspondances, moins de marche, le plus long, le moins cher), et ne voir sur la carte **que l'itinéraire choisi**.

Pour le prix : le guide tarifaire d'Île-de-France Mobilités (« Tarifs applicables au 1er janvier 2026 », constaté le 2026-11-27) donne un ticket Métro-Train-RER à 2,55 €, un ticket Bus-Tram à 2,05 € (un second titre pour passer du métro/RER au tram), et un ticket Paris Région <> Aéroports à 14 € (Orly par le métro 14, Roissy-CDG par le RER B).

## Options

1. **rRAPTOR / plage horaire** : plusieurs heures de départ ; donne surtout le même parcours plus tard, pas d'autre ligne.
2. **Critères supplémentaires dans RAPTOR** (marche, prix) : plus d'itinéraires non dominés, mais algorithme plus lourd, et toujours pas de « même temps, autre ligne ».
3. **Exclusion de lignes** : refaire la recherche en interdisant tour à tour les lignes des itinéraires trouvés ; garder les parcours nouveaux qui n'arrivent pas trop tard.

## Décision

Option 3, dans `internal/journey` (`Alternatives`).

- Recherche initiale (non dominés), puis 8 recherches au plus en excluant les lignes des itinéraires déjà trouvés (une à une, puis cumulées).
- Gardé si la suite de lignes et de gares de montée/descente est nouvelle (un train plus tard sur le même parcours n'est pas une alternative), et si l'arrivée dépasse celle du plus rapide d'au plus 20 min ou la moitié de sa durée.
- 5 itinéraires au plus, triés par arrivée.
- **Labels** calculés dans le navigateur, relatifs aux options affichées, seulement si le critère varie ; en cas d'égalité, la première option de la liste.
- **Prix estimé** calculé par l'API (`fare.ts`) en tickets à l'unité plein tarif : Métro-Train-RER si métro ou RER, Bus-Tram en plus si tram, ticket aéroports à la place du Métro-Train-RER si une gare d'Orly (métro 14) ou de Roissy-CDG (RER B) est desservie. Toujours affiché comme **estimé** ; les forfaits Navigo et Liberté+ ne sont pas pris en compte.
- **Carte** : seul l'itinéraire choisi est affiché (tracé, gares traversées, trains de ses lignes) ; le reste du réseau (lignes, gares, autres trains) est masqué jusqu'à la fermeture du panneau ou la fin du trajet. Une première version estompait le réseau ; masqué a été préféré à l'usage (2026-11-28) pour une carte plus lisible.

## Conséquences

- Positives : vraies alternatives par d'autres lignes ; quelques dizaines de millisecondes de plus (40 à 170 ms constatées sur le réseau complet) ; prix lisible.
- Négatives : tarifs à mettre à jour à la main à chaque changement (constantes datées dans `fare.ts`) ; règles simplifiées (pas de tarif réduit, cas des tram-trains non distingués) ; le seuil de 20 min peut écarter une alternative utile sur un long trajet.
- À revoir si : IDFM publie une API ou des données tarifaires exploitables, ou si les visiteurs demandent des préférences (éviter une ligne, moins de marche).
