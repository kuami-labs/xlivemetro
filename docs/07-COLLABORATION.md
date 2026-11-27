# Collaboration – XLiveMetro (projet open source)

> Ce document s'adresse aux **mainteneurs** : organisation GitHub, branches, règles, qualité, CI et publication.
> Les contributeurs externes lisent [CONTRIBUTING.md](../CONTRIBUTING.md), qui en reprend l'essentiel.

## Deux modes : solo aujourd'hui, équipe demain

XLiveMetro n'a pour l'instant **qu'un seul mainteneur**. Certaines règles de collaboration seraient alors incohérentes, voire bloquantes : on ne peut pas approuver sa propre pull request, une équipe d'une personne n'a pas de sens, un délai de revue ne veut rien dire.

Ce document décrit donc deux modes. Le **mode solo** est actif. Le **mode équipe** s'active à l'arrivée d'un deuxième contributeur régulier, en suivant [Passer en mode équipe](#passer-en-mode-équipe) : tout est prévu pour basculer en quelques commandes.

| Sujet                                                          | Mode solo (actuel)                                | Mode équipe                                       |
| -------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| Équipes                                                        | `xlivemetro-maintainers` seule                    | + `xlivemetro-core`, `xlivemetro-triage`          |
| Pull request obligatoire                                       | **oui**                                           | oui                                               |
| Approbation obligatoire                                        | non                                               | 1 approbation                                     |
| Revue des Code Owners                                          | non (fichier `CODEOWNERS` présent mais non exigé) | oui                                               |
| Annulation des approbations au nouveau commit                  | non                                               | oui                                               |
| Résolution des commentaires                                    | non                                               | oui                                               |
| CI verte obligatoire (`qualite`, `tests`, `fichiers-proteges`) | **oui**, dès son premier passage                  | oui                                               |
| Suppression de branche, force push                             | **interdits**                                     | interdits                                         |
| Revue                                                          | auto-revue avec la checklist de la PR             | revue par une autre personne, sous 5 jours ouvrés |
| Tri des issues                                                 | quand c'est utile                                 | chaque semaine                                    |
| Contributions externes                                         | acceptées : vous relisez et fusionnez             | idem, revue partagée                              |

En mode solo, la **CI** et la **pull request** restent obligatoires : elles gardent un historique propre et empêchent de casser `develop` ou `main` par erreur.

## Organisation GitHub

Le projet vit dans une **organisation** GitHub, pas sur un compte personnel : elle permet des équipes et des rôles différents, et le projet survit au départ d'un mainteneur.

### Dépôt public : le choix du budget

| Option                                  | Coût                   | Contrepartie                                      |
| --------------------------------------- | ---------------------- | ------------------------------------------------- |
| Dépôt **public**, organisation gratuite | 0 €                    | code visible de tous : aucun secret dans le dépôt |
| Dépôt privé, plan GitHub Team           | payant par utilisateur | incompatible avec l'open source                   |

XLiveMetro est open source : **dépôt public, organisation gratuite**. Les règles de protection des branches et les minutes GitHub Actions sont alors gratuites.

### Une organisation pour plusieurs projets

L'organisation **`kuami-labs`** est neutre : elle héberge XLiveMetro et les projets à venir. Les équipes suivent cette logique :

- **Chaque projet a ses propres équipes**, préfixées par son nom, y compris ses mainteneurs : `xlivemetro-maintainers`, `xlivemetro-core`, `xlivemetro-triage`. Un futur projet `autre` aura `autre-maintainers`, `autre-core`, `autre-triage`.
- Un mainteneur d'XLiveMetro n'a donc **aucun droit d'administration** sur les autres dépôts, et inversement.
- Au-dessus, seuls les **propriétaires de l'organisation** (vous, et éventuellement une personne de confiance) gèrent l'organisation elle-même : facturation, sécurité, création des dépôts et des équipes.

### Les équipes et les rôles

Principe : **le moins de droits possible**, on élargit à la demande et après contributions régulières.

| Équipe                   | Rôle sur le dépôt | Peut                                       | Pour qui                                  |
| ------------------------ | ----------------- | ------------------------------------------ | ----------------------------------------- |
| `xlivemetro-maintainers` | Admin             | tout, dont les règles et les releases      | 1 à 2 personnes                           |
| `xlivemetro-core`        | Write             | pousser des branches, fusionner des PR     | contributeurs réguliers et de confiance   |
| `xlivemetro-triage`      | Triage            | trier les issues, poser des labels, relire | contributeurs qui aident à l'organisation |
| Tout le monde            | Read (public)     | forker, ouvrir des issues et des PR        | contributeurs externes                    |

> **Mode solo** : seule `xlivemetro-maintainers` est créée, avec vous comme unique membre. `xlivemetro-core` et `xlivemetro-triage` sont créées au passage en mode équipe.

### Mise en place

1. Sur github.com : **+** → **New organization** (plan Free) : `kuami-labs`. À faire une seule fois, pour tous les projets.
2. **Settings** → **Authentication security** : exigez la **2FA** pour tous les membres. Un projet public est une cible.
3. **Settings** → **Member privileges** → **Base permissions** : **Read**.
4. **Settings** → **Member privileges** → **Repository deletion and transfer** : réservé aux propriétaires.
5. **Settings** → _Planning_ → **Issue types** : ajoutez `Spike` à `Task`, `Bug` et `Feature`.
6. **Teams** : pour chaque projet, créez son équipe de mainteneurs, ici `xlivemetro-maintainers`. En mode équipe, ajoutez `xlivemetro-core` et `xlivemetro-triage`.
7. Pour chaque nouveau projet : créez le dépôt **vide** (ici `xlivemetro`), puis **Settings** → **Collaborators and teams** : ajoutez chaque équipe existante avec son rôle.

> Un **spike** est une étude courte et limitée dans le temps, qui répond à une question avant de planifier le travail. Exemple : « PRIM publie-t-il des positions GPS pour certaines lignes de tram ? ».

## Le modèle de branches : GitFlow allégé

| Branche     | Rôle                                             | Alimentée par                                   |
| ----------- | ------------------------------------------------ | ----------------------------------------------- |
| `main`      | la dernière version publiée, toujours déployable | une PR depuis `develop` (release) ou `hotfix/*` |
| `develop`   | l'intégration, **branche par défaut**            | une PR depuis `feature/*` ou `fix/*`            |
| `feature/*` | une fonctionnalité, quelques jours au plus       | son auteur                                      |
| `fix/*`     | une correction non urgente                       | son auteur                                      |
| `hotfix/*`  | une correction urgente de `main`                 | un mainteneur                                   |
| `docs/*`    | documentation seule                              | son auteur                                      |

- Les contributeurs externes travaillent sur une branche **de leur fork** et ouvrent la PR vers `develop`.
- Pas de branche `release/*` : `develop` est fusionnée dans `main` au moment d'une release, puis taguée.
- Un hotfix fusionné dans `main` est aussi reporté dans `develop`.

### Les réglages du dépôt

**Settings** → **General** :

- **Default branch** : `develop`.
- **Pull Requests** : autorisez le **squash** (une PR = un commit sur `develop`) et les **merge commits** (`develop` → `main`). Désactivez le rebase merge.
- Cochez **Automatically delete head branches**.
- **Features** : activez **Issues** et **Discussions** (questions et idées hors bugs).

### Les règles de protection

**Settings** → **Rules** → **Rulesets** → **New branch ruleset**, nommé `protection`, ciblant `main` et `develop` :

| Règle                                                                   | Effet                                                                                                                   | Solo                                 | Équipe |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------ |
| Restrict deletions                                                      | personne ne supprime la branche                                                                                         | ✅                                   | ✅     |
| Block force pushes                                                      | personne ne réécrit l'historique                                                                                        | ✅                                   | ✅     |
| Require a pull request before merging                                   | aucun push direct                                                                                                       | ✅                                   | ✅     |
| ↳ Required approvals                                                    | une autre personne relit                                                                                                | 0                                    | 1      |
| ↳ Dismiss stale approvals when new commits are pushed                   | un nouveau commit annule l'approbation                                                                                  | ❌                                   | ✅     |
| ↳ Require review from Code Owners                                       | les fichiers sensibles exigent un mainteneur                                                                            | ❌                                   | ✅     |
| ↳ Require conversation resolution                                       | tous les commentaires de revue sont traités                                                                             | ❌                                   | ✅     |
| Require status checks to pass : `qualite`, `tests`, `fichiers-proteges` | la CI doit être verte ; les fichiers protégés restent intouchables ([08-SECURITE.md](08-SECURITE.md#fichiers-protégés)) | ✅ après le premier passage de la CI | ✅     |

Laissez la **bypass list** vide : vous passez aussi par une PR. Une PR solo se fusionne dès que la CI est verte.

> Pourquoi pas d'approbation en solo ? GitHub interdit d'approuver sa propre pull request : avec 1 approbation obligatoire, aucune de vos PR ne pourrait être fusionnée.

### CODEOWNERS

> Le fichier est créé dès maintenant, mais la revue des Code Owners n'est **exigée qu'en mode équipe**. En solo, il sert déjà à vous désigner automatiquement comme relecteur des PR externes qui touchent ces fichiers.

Ce qui définit l'environnement, la CI ou les dépendances demande l'accord d'un mainteneur. Ajouter une dépendance est une décision.

`.github/CODEOWNERS`

```text
/.devcontainer/            @kuami-labs/xlivemetro-maintainers
/.github/                  @kuami-labs/xlivemetro-maintainers
/compose.yaml              @kuami-labs/xlivemetro-maintainers
/packages/db/prisma/       @kuami-labs/xlivemetro-maintainers
/packages/proto/          @kuami-labs/xlivemetro-maintainers
/services/realtime/go.mod @kuami-labs/xlivemetro-maintainers
/services/realtime/go.sum @kuami-labs/xlivemetro-maintainers
/eslint.config.mjs         @kuami-labs/xlivemetro-maintainers
package.json               @kuami-labs/xlivemetro-maintainers
pnpm-lock.yaml             @kuami-labs/xlivemetro-maintainers
/SECURITY.md               @kuami-labs/xlivemetro-maintainers
/CLAUDE.md                 @kuami-labs/xlivemetro-maintainers
/.claude/                  @kuami-labs/xlivemetro-maintainers
/docs/08-SECURITE.md       @kuami-labs/xlivemetro-maintainers
```

`CLAUDE.md` et `.claude/` donnent des instructions aux assistants IA de tous les contributeurs : les modifier est sensible (voir [08-SECURITE.md](08-SECURITE.md)).

## Les issues

### Types et labels

| Label                                                                        | Sens                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `good first issue`                                                           | petite tâche, bien décrite, idéale pour un premier contributeur    |
| `help wanted`                                                                | les mainteneurs cherchent quelqu'un pour la prendre                |
| `area:realtime`, `area:api`, `area:web`, `area:mcp`, `area:db`, `area:infra` | partie du code concernée                                           |
| `priority:high`, `priority:low`                                              | urgence                                                            |
| `needs-triage`                                                               | pas encore examinée (posé automatiquement)                         |
| `blocked`                                                                    | attend une décision ou une autre tâche                             |
| `fichier-protege`                                                            | demande de changement d'un fichier protégé : un mainteneur le fera |

### Règle de travail

**Demande de changement d'un fichier protégé** (modèle d'issue dédié) : le mainteneur évalue ; s'il accepte, il fait le changement sur une branche `chore/<n°>-…`, avec `Co-authored-by: <contributeur>` dans le message de commit (ou en récupérant le commit relu du fork par `git cherry-pick`), ouvre sa PR et la fusionne. Le contributeur rebase ensuite sa PR sur `develop`.

- **Une PR = une issue.** Pour un changement plus gros qu'une coquille, ouvrez ou commentez d'abord une issue, et attendez qu'un mainteneur valide l'approche.
- Pour prendre une issue, commentez « Je la prends ». Un mainteneur vous l'assigne. Sans nouvelle sous 14 jours, elle redevient libre.
- Les nouvelles issues sont triées (type, labels, priorité) : **quand c'est utile** en mode solo, **chaque semaine** en mode équipe.

## Les commits

Messages au format [Conventional Commits](https://www.conventionalcommits.org/fr/) : ils produisent le changelog automatiquement.

| Préfixe     | Usage                           | Exemple                                                |
| ----------- | ------------------------------- | ------------------------------------------------------ |
| `feat:`     | nouvelle fonctionnalité         | `feat(web): filtre par période sur le tableau de bord` |
| `fix:`      | correction de bug               | `fix(realtime): ignorer les courses annulées`          |
| `docs:`     | documentation                   | `docs: étape WSL dans l'environnement`                 |
| `refactor:` | sans changement de comportement | `refactor(api): extraire le guard d'organisation`      |
| `test:`     | tests seuls                     | `test(position): course au terminus`                   |
| `chore:`    | outillage, dépendances          | `chore: mise à jour de Prisma`                         |

Avec le squash, c'est le **titre de la PR** qui devient le message du commit : il doit donc respecter ce format.

## La qualité avant le commit

| Outil                                                                                                  | Rôle                                                                       |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [ESLint](https://typescript-eslint.io/getting-started)                                                 | erreurs probables : variable inutilisée, promesse oubliée, `any` explicite |
| [Prettier](https://prettier.io)                                                                        | la forme : plus de débat de style en revue                                 |
| [husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) | hook `pre-commit` sur les seuls fichiers du commit                         |
| [commitlint](https://commitlint.js.org)                                                                | hook `commit-msg` : vérifie le format Conventional Commits                 |

Installation, à la racine, dans le dev container :

```bash
pnpm add -D -w eslint @eslint/js typescript-eslint prettier eslint-config-prettier
pnpm add -D -w husky lint-staged @commitlint/cli @commitlint/config-conventional
pnpm exec husky init
# puis remplacer le contenu de .husky/pre-commit et .husky/commit-msg (voir plus bas)
```

`eslint.config.mjs`

```js
// @ts-check
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // db/data : fichiers de PostgreSQL ; .next, dist : fichiers générés
  globalIgnores(['**/dist/', '**/.next/', 'db/data/', 'coverage/']),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
```

`package.json` (racine)

```json
"scripts": {
  "prepare": "husky",
  "lint": "eslint --flag v10_config_lookup_from_file .",
  "format": "prettier --write . '!db/data'",
  "format:check": "prettier --check . '!db/data'"
},
"lint-staged": {
  "*.{ts,tsx,js,mjs}": ["eslint --flag v10_config_lookup_from_file --fix", "prettier --write"],
  "*.{json,md,yml,yaml,css}": "prettier --write"
}
```

- `--flag v10_config_lookup_from_file` : chaque fichier utilise le `eslint.config.mjs` le plus proche. `apps/web` garde ainsi la configuration officielle de Next.js (`eslint-config-next`), qui impose ESLint 9.
- Le script `prepare` installe les hooks à chaque `pnpm install` : rien à faire pour les contributeurs.
- **Le hook tourne dans le conteneur**, même quand on commite depuis WSL (Claude Desktop) : les hooks appellent `docker compose exec -T dev …` si `node` est absent de la machine.

`.husky/pre-commit`

```sh
if command -v node >/dev/null 2>&1; then
  pnpm exec lint-staged
else
  docker compose exec -T dev pnpm exec lint-staged
fi
```

`.husky/commit-msg`

```sh
if command -v node >/dev/null 2>&1; then
  pnpm exec commitlint --edit "$1"
else
  docker compose exec -T dev pnpm exec commitlint --edit "$1"
fi
```

### Assistance IA

Les contributeurs peuvent utiliser Claude Code ou tout autre outil d'IA, **et le mentionner librement** : une ligne `Co-Authored-By: Claude …` ou « Generated with Claude Code » est acceptée dans les commits et les PR.

Une seule règle : **la personne qui soumet la contribution en est responsable**. Elle comprend le code, l'a testé et sait l'expliquer en revue (case du modèle de PR).

- Lors d'un squash, **conservez** les lignes `Co-authored-by` proposées par GitHub : elles reconnaissent le travail de chacun.
- Préférence personnelle d'un contributeur (par exemple ne pas mentionner l'outil) : elle se règle **sur sa machine**, dans des fichiers non versionnés :
  - `.claude/settings.local.json` : `{ "attribution": { "commit": "", "pr": "" } }`
  - `CLAUDE.local.md` : consignes personnelles pour ses propres sessions.

## L'intégration continue

Un hook se contourne (`git commit --no-verify`) : la CI **revérifie** chaque PR, y compris celles des forks.

`.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main, develop]

# Les PR venant de forks n'ont accès à aucun secret
permissions:
  contents: read

jobs:
  qualite:
    runs-on: ubuntu-latest
    container: node:26-trixie
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-go@v7
        with: { go-version-file: services/realtime/go.mod }
      - run: npm install -g corepack && corepack enable && pnpm install --frozen-lockfile
      - run: pnpm lint # ESLint + go vet + gofmt
      - run: pnpm format:check
      - run: pnpm build

  tests:
    # Pas de « container » : la base est construite depuis db/Dockerfile (PostGIS), comme en dev
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: postgres://xlivemetro:xlivemetro@localhost:5432/xlivemetro
      REDIS_URL: redis://localhost:6379
      FEED_SOURCE: replay
    steps:
      - uses: actions/checkout@v7
      - run: docker compose -f compose.yaml -f compose.ci.yaml up -d --build --wait db redis
      - uses: actions/setup-node@v6
        with: { node-version-file: .nvmrc }
      - uses: actions/setup-go@v7
        with: { go-version-file: services/realtime/go.mod }
      - run: npm install -g corepack && corepack enable && pnpm install --frozen-lockfile
      - run: pnpm db:migrate
      - run: pnpm test # Vitest + go test -race
```

- **`container: node:26-trixie`** (qualité) : même système et même Node que le dev container.
- **Job `tests` sans conteneur** : la base PostGIS est construite depuis `db/Dockerfile` avec `docker compose`, exactement comme en dev ; Node vient de `.nvmrc`.
- **Deux jobs, deux checks** : `qualite` et `tests`, à exiger dans le ruleset une fois qu'ils ont tourné une fois.
- **`permissions: contents: read`** et aucun secret : une PR venant d'un fork ne peut rien exfiltrer.
- **`FEED_SOURCE: replay`** : la CI n'appelle jamais PRIM, n'a besoin d'aucune clé et reste déterministe.
- **`setup-go`** : la version de Go vient de `services/realtime/go.mod` ; `pnpm lint` et `pnpm test` incluent `go vet`, `gofmt -l` et `go test -race`.

### Dependabot

`.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm # couvre aussi pnpm (pnpm-lock.yaml)
    directory: /
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: monthly }
```

Activez aussi **Settings** → **Code security** : Dependabot alerts, Secret scanning et Push protection (gratuits sur un dépôt public).

## La revue de code

**Mode solo** : relisez votre propre diff dans l'onglet **Files changed** avant de fusionner, en suivant la checklist du modèle de PR ; la CI fait le reste. Les PR de contributeurs externes, vous les relisez avec le tableau ci-dessous.

**Mode équipe** :

| Qui relit                                                  | Quoi vérifier                                          |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| Un membre de `xlivemetro-core` ou `xlivemetro-maintainers` | la PR répond à l'issue, rien de plus                   |
|                                                            | les tests couvrent le nouveau comportement             |
|                                                            | aucun secret, aucune donnée personnelle ajoutée        |
|                                                            | le code produit avec une IA est compris par son auteur |
|                                                            | la doc est à jour si le comportement change            |

- Délai cible : **première réponse sous 5 jours ouvrés** (contributions externes, dans les deux modes : dès que possible).
- Un commentaire préfixé `nit:` est une suggestion mineure, non bloquante.
- On relit le code, pas la personne : remarques précises, ton bienveillant ([Code de conduite](../CODE_OF_CONDUCT.md)).

## Les décisions d'architecture (ADR)

Toute décision qui engage le projet (nouvelle dépendance majeure, changement de stack, règle d'équipe) est écrite dans `docs/adr/NNNN-titre.md`, au format :

```md
# NNNN. Titre de la décision

- Statut : proposée | acceptée | remplacée par NNNN
- Date : AAAA-MM-JJ
- Décideurs : …

## Contexte

## Options

## Décision

## Conséquences

- Positives :
- Négatives, à accepter :
- À revoir si :
```

L'ADR passe par une PR comme le code : la discussion se fait en revue.

## Publier une version

1. Vérifiez que `develop` est verte et que le changelog est cohérent.
2. Ouvrez une PR `develop` → `main` intitulée `release: vX.Y.Z`, fusionnée en **merge commit**.
3. Taguez `main` : `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. Créez la **Release** GitHub à partir du tag, avec les notes générées.

Numérotation [SemVer](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`. Avant la `v1.0.0`, tout peut encore changer.

## Passer en mode équipe

À faire quand un deuxième contributeur régulier rejoint le projet. Comme partout : **vérifier l'état actuel d'abord**, n'appliquer que l'écart.

1. **Écrire la décision** : un ADR `docs/adr/NNNN-mode-equipe.md` (qui rejoint, pourquoi maintenant).
2. **Créer les équipes manquantes** et leurs droits :
   ```bash
   gh api orgs/kuami-labs/teams --jq '.[].slug'          # vérifier l'existant
   gh api -X POST orgs/kuami-labs/teams -f name=xlivemetro-core -f privacy=closed
   gh api -X POST orgs/kuami-labs/teams -f name=xlivemetro-triage -f privacy=closed
   gh api -X PUT orgs/kuami-labs/teams/xlivemetro-core/repos/kuami-labs/xlivemetro -f permission=push
   gh api -X PUT orgs/kuami-labs/teams/xlivemetro-triage/repos/kuami-labs/xlivemetro -f permission=triage
   ```
3. **Ajouter la personne** à l'équipe voulue (`xlivemetro-core` d'abord ; `xlivemetro-maintainers` seulement après plusieurs mois de confiance) :
   ```bash
   gh api -X PUT orgs/kuami-labs/teams/xlivemetro-core/memberships/PSEUDO -f role=member
   ```
4. **Durcir le ruleset** `protection` :
   ```bash
   gh api repos/kuami-labs/xlivemetro/rulesets --jq '.[] | {id, name}'   # trouver l'id
   gh api repos/kuami-labs/xlivemetro/rulesets/ID > ruleset.json           # lire l'état actuel
   ```
   Dans la règle `pull_request` de `ruleset.json`, passez :
   ```json
   "required_approving_review_count": 1,
   "dismiss_stale_reviews_on_push": true,
   "require_code_owner_review": true,
   "required_review_thread_resolution": true
   ```
   puis renvoyez le ruleset modifié :
   ```bash
   gh api -X PUT repos/kuami-labs/xlivemetro/rulesets/ID --input ruleset.json
   ```
   (ou dans l'interface : **Settings** → **Rules** → **Rulesets** → `protection`, cocher les trois sous-règles et passer les approbations à 1).
   Si la personne devient **mainteneur**, ajoutez aussi son identifiant à la liste `MAINTENEURS` de `.github/workflows/fichiers-proteges.yml`.
5. **Vérifier** : ouvrir une PR de test et constater que la fusion est bloquée sans approbation.
6. **Mettre à jour ce document** : déplacer la mention « actuel » vers le mode équipe dans le tableau en haut.

> Vous pouvez demander à Claude Code : « Lis la section Passer en mode équipe de docs/07-COLLABORATION.md et applique-la pour PSEUDO, en vérifiant l'état actuel et en me montrant chaque commande avant de l'exécuter. »

Pour **revenir en mode solo** (départ du seul autre contributeur), faites l'inverse à l'étape 4 : approbations à 0 et les trois sous-règles décochées.

## Fichiers communautaires

| Fichier                            | Rôle                                              |
| ---------------------------------- | ------------------------------------------------- |
| `README.md`                        | ce que fait XLiveMetro, capture, démarrage rapide |
| `LICENSE`                          | licence open source AGPL-3.0                      |
| `CONTRIBUTING.md`                  | comment contribuer, pas à pas                     |
| `CODE_OF_CONDUCT.md`               | règles de comportement                            |
| `SECURITY.md`                      | signaler une faille en privé                      |
| `docs/08-SECURITE.md`              | règles de sécurité du projet                      |
| `.github/ISSUE_TEMPLATE/`          | modèles de bug et de demande de fonctionnalité    |
| `.github/pull_request_template.md` | modèle de PR                                      |
