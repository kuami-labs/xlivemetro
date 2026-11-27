# Fixtures

Données de test et de démonstration, utilisables sans aucune clé (ADR 0005 et 0011).

| Dossier      | Contenu                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `gtfs-mini/` | référentiel réduit : métro 1 et 14, RER A, tram T3a, courses du mardi 1er décembre 2026 rejouées chaque jour |

Régénérer `gtfs-mini/` à partir du GTFS complet :

```bash
pnpm --filter @xlivemetro/realtime gtfs:mini --source IDFM-gtfs.zip --date 2026-12-01 --lines 1,14,A,T3a
```

## Source et licence

Extrait du GTFS « Horaires prévus sur les lignes de transport en commun d'Île-de-France » publié par
**Île-de-France Mobilités** sous **Licence Mobilités**. Ces fichiers ne sont pas couverts par la licence
AGPL du code : ils restent soumis à la licence de leur producteur.
