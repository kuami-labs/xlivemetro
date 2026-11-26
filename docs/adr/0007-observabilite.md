# 0007. Observabilité : logs JSON partout

- Statut : acceptée
- Date : 2026-11-26
- Décideurs : Kuami (mainteneur)

## Contexte

Un cycle d'ingestion qui échoue, un quota PRIM dépassé ou une file WebSocket saturée doivent se comprendre sans accès à la machine, avec deux langages côté serveur.

## Décision

- Node (api, mcp) : `nestjs-pino`, comme XCadence. Go : `log/slog` en JSON. Mêmes champs (`level`, `msg`, `service`, `time`).
- Jamais de clé PRIM, d'en-tête `Authorization` ni d'adresse IP complète dans les logs.
- `realtime` expose `/metrics` (Prometheus) : durée et résultat des cycles, véhicules, connexions, octets envoyés. Non exposé publiquement.
- Sentry optionnel (`SENTRY_DSN`), comme XCadence.

## Conséquences

- Positives : diagnostic homogène ; métriques prêtes pour un tableau de bord.
- Négatives : pas de traces distribuées.
- À revoir si : plusieurs instances `realtime` tournent en parallèle.
