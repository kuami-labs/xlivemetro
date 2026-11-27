# 0005. Mode rejeu : contribuer sans clé PRIM

- Statut : acceptée, complétée par [ADR 0011](0011-rejeu-synthetique.md) (valeur par défaut : `FEED_SOURCE=synthetic`)
- Date : 2026-11-26
- Décideurs : Kuami (mainteneur)

## Contexte

L'accès aux flux temps réel PRIM demande un compte et une clé. Imposer une clé à chaque contributeur, et appeler PRIM dans la CI, poserait problème : barrière d'entrée, quotas, secret en CI, tests non reproductibles.

## Options

1. **Clé obligatoire** pour tous.
2. **Rejeu** : l'outil `cmd/record` enregistre des réponses PRIM réelles ; `FEED_SOURCE=replay` les rejoue en boucle, en recalant les horaires sur l'heure courante.
3. **Données synthétiques** générées : sans clé, mais irréalistes.

## Décision

Option 2. `FEED_SOURCE=replay` est la valeur par défaut de `.env.example` et de la CI. Un jeu enregistré (une heure de pointe, quelques lignes) est versionné dans `fixtures/replay`, avec un référentiel réduit cohérent pour `pnpm db:seed`.

## Conséquences

- Positives : `pnpm dev` montre une carte vivante sans compte ; tests déterministes ; aucun secret en CI.
- Négatives : fixtures à rafraîchir quand les formats PRIM évoluent ; taille à surveiller (compression).
- À revoir si : les conditions d'utilisation PRIM interdisent la redistribution des réponses enregistrées. **À vérifier avant de versionner les fixtures.**
