# 0009. ESLint 9 plutôt que 10

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)

## Contexte

La dernière version stable d'ESLint est la 10. `apps/web` utilise la configuration officielle de Next.js (`eslint-config-next`), qui embarque `eslint-plugin-react` 7.37.5 (dernière version stable) ; celui-ci déclare `eslint: ^9.7` au plus. Un seul ESLint est installé à la racine du monorepo.

## Options

1. **ESLint 10** partout : `eslint-plugin-react` non supporté, risque d'erreurs dans le lint de `apps/web`.
2. **ESLint 10** à la racine et **9** dans `apps/web` : deux versions, configuration et hooks plus fragiles.
3. **ESLint 9** (dernière 9.x) partout.

## Décision

Option 3, avec `@eslint/js` de la même branche. C'est aussi le choix fait pour XCadence (mise à jour vers ESLint 10 refusée par Dependabot).

## Conséquences

- Positives : configuration officielle de Next.js utilisée telle quelle, un seul ESLint.
- Négatives : ESLint 10 attendra.
- À revoir si : `eslint-plugin-react` (ou `eslint-config-next`) publie une version stable compatible avec ESLint 10.
