# 0020. Destination par adresse : géocodage de l'État, via notre API

- Statut : acceptée
- Date : 2026-11-28
- Décideurs : Kuami (mainteneur)
- Suite de : [ADR 0017](0017-assistant-de-trajet.md)

## Contexte

F17 (PRD) : le visiteur tape une adresse comme destination. Il faut la convertir en coordonnées (géocodage), puis trouver les gares proches et la marche finale.

Constaté le 2026-11-28 :

- l'API Adresse de la Base Adresse Nationale est opérée par l'IGN sur la Géoplateforme : `https://data.geopf.fr/geocodage/search` (l'ancien `api-adresse.data.gouv.fr` redirige vers elle) ; gratuite, sans clé ;
- elle annonce une limite de 50 requêtes par seconde (en-tête `ratelimit-limit`) ;
- elle couvre toute la France : un « avenue de Ségur » renvoie aussi des communes hors Île-de-France.

Une adresse de destination n'est pas la position du visiteur, mais elle peut être sensible (domicile, lieu de soin) : elle ne doit être ni conservée ni journalisée.

## Options

1. **Navigateur → IGN directement** : rien ne passe par nos serveurs, mais l'adresse IP du visiteur et le texte partent à un tiers à chaque frappe ; la limite de débit de l'IGN s'applique par visiteur ; pas de filtrage ni de cache communs ; le MCP (F18) devrait refaire la même chose.
2. **Navigateur → notre API → IGN** : l'IGN ne voit que notre serveur ; validation, filtrage Île-de-France et cache au même endroit ; réutilisable par le MCP.
3. **Géocodeur auto-hébergé** (import de la BAN, recherche locale) : aucune donnée ne sort, mais un import et un index de plus (millions d'adresses) pour une fonctionnalité secondaire.

## Décision

Option 2 : route `GET /geocode?q=` de l'API.

- Texte validé (3 à 120 caractères, sans caractère de contrôle) ; limitation de débit de l'API (120 requêtes par minute et par IP) ; délai de 4 s.
- Résultats limités à l'Île-de-France (code commune des départements 75, 77, 78, 91, 92, 93, 94, 95), 5 au plus, priorité autour de Paris.
- Cache mémoire de 24 h par texte normalisé (même adresse tapée par plusieurs visiteurs) ; réponse `Cache-Control: private, no-store` ; **jamais journalisé**.
- Le navigateur n'interroge qu'après une pause de frappe (350 ms, 3 caractères au moins) et **informe le visiteur** que le texte part au service d'adresses de l'État.
- Les gares proches de l'adresse (1,5 km, marche estimée) sont calculées dans le navigateur, comme pour « autour de moi » : seuls des identifiants de gares et des durées partent à `/journeys`.
- `GEOCODER_URL` permet de pointer vers un autre service compatible (tests, auto-hébergement plus tard).

## Conséquences

- Positives : l'adresse IP du visiteur reste chez nous ; un seul point de validation et de cache ; réutilisable par `plan_trip` (F18).
- Négatives : dépendance à un service externe (message clair s'il est indisponible) ; notre serveur voit les adresses tapées (en mémoire seulement, pour le cache).
- À revoir si : le trafic approche la limite de l'IGN, ou si la confidentialité demande un géocodeur auto-hébergé (option 3).
