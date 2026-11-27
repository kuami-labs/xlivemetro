# 0008. TypeScript 6.0 plutôt que 7.0

- Statut : acceptée
- Date : 2026-11-27
- Décideurs : Kuami (mainteneur)

## Contexte

La règle du projet est d'installer la dernière version stable de chaque outil (CLAUDE.md, règle 10). La dernière version stable de TypeScript est la 7.0.2, réécrite en Go. À l'installation, `pnpm peers check` signale une incompatibilité réelle : `typescript-eslint` 8.74.0, la dernière version stable, exige `typescript >=4.8.4 <6.1.0`.

## Options

1. **TypeScript 7.0** sans `typescript-eslint` : perte du lint typé TypeScript, indispensable à la qualité (`docs/07-COLLABORATION.md`).
2. **TypeScript 7.0** en ignorant l'avertissement : comportement non supporté, erreurs de lint imprévisibles.
3. **TypeScript 6.0.x** (dernière version stable de la branche 6, compatible avec tout l'outillage).

## Décision

Option 3 : `typescript@~6.0` (6.0.3). C'est aussi la version d'XCadence.

## Conséquences

- Positives : lint typé complet, outillage cohérent (NestJS, Next.js, Vitest).
- Négatives : on ne profite pas encore de la vitesse de compilation de TypeScript 7.
- À revoir si : `typescript-eslint` publie une version stable compatible avec TypeScript 7 ; Dependabot la proposera.
