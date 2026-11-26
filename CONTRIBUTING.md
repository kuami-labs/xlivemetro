# Contribuer à XLiveMetro

Merci de votre intérêt ! XLiveMetro est un projet open source : toute aide compte, du signalement de bug à la nouvelle fonctionnalité.

En participant, vous acceptez le [Code de conduite](CODE_OF_CONDUCT.md).

## Par où commencer

| Vous voulez…                    | Faites…                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Signaler un bug                 | ouvrez une issue avec le modèle **Bug**                                        |
| Proposer une idée               | ouvrez une issue **Feature**, ou une **Discussion** si l'idée est encore floue |
| Poser une question              | ouvrez une **Discussion**, pas une issue                                       |
| Coder                           | choisissez une issue `good first issue` ou `help wanted`                       |
| Signaler une faille de sécurité | **pas d'issue publique** : suivez [SECURITY.md](SECURITY.md)                   |

## Fichiers protégés

Certains fichiers (CI, environnement, dépendances, `CLAUDE.md`, sécurité, décisions d'architecture) ne peuvent pas être modifiés ni supprimés par une PR de contributeur : le check `fichiers-proteges` la bloque. Pour proposer un changement sur l'un d'eux :

1. Ouvrez une issue avec le modèle **« Changement de fichier protégé »** (quoi, pourquoi, et la branche de votre fork si le changement est prêt).
2. Si un mainteneur accepte, il fait le changement dans sa propre PR, en vous créditant comme coauteur (`Co-authored-by`).
3. Une fois ce changement fusionné, mettez votre PR à jour (`git fetch upstream && git rebase upstream/develop && git push --force-with-lease`) : elle ne touche plus le fichier protégé, et le check passe.

Si votre PR contient déjà une modification d'un fichier protégé, retirez-la (`git restore --source=upstream/develop <fichier>` puis un commit) et suivez ces étapes. La liste complète est dans [docs/08-SECURITE.md](docs/08-SECURITE.md#fichiers-protégés).

## Avant de coder

1. **Une PR = une issue.** Pour tout changement plus gros qu'une coquille, ouvrez ou commentez d'abord une issue.
2. Commentez « Je la prends » : un mainteneur vous l'assigne. Sans nouvelle de votre part sous 14 jours, elle redevient libre.
3. Attendez qu'un mainteneur valide l'approche avant un gros développement : cela évite du travail perdu.

## Installer l'environnement

Vous n'installez que **Docker** et **VS Code** (extension Dev Containers). Tout le reste vient du dépôt.

1. Forkez le dépôt, puis clonez **votre fork** (sous Windows : dans WSL, pas dans `C:\`) :
   ```bash
   git clone git@github.com:VOTRE-COMPTE/xlivemetro.git
   cd xlivemetro
   git remote add upstream git@github.com:kuami-labs/xlivemetro.git
   ```
2. Ouvrez le dossier dans VS Code → **F1** → **Dev Containers: Reopen in Container**.
3. Dans le terminal du conteneur :
   ```bash
   pnpm db:migrate && pnpm db:seed
   pnpm dev
   ```

Le guide complet (clé PRIM optionnelle, rejeu, dépannage) est dans [docs/06-ENVIRONNEMENT.md](docs/06-ENVIRONNEMENT.md).

## Le cycle d'une contribution

```bash
# 1. Partir de develop à jour
git switch develop
git pull upstream develop

# 2. Créer une branche
git switch -c feature/42-filtre-periode     # ou fix/…, docs/…

# 3. Coder, tester, commiter (depuis le dev container)
pnpm lint && pnpm test
git add .
git commit -m "feat(web): filtre par période sur le tableau de bord"

# 4. Pousser sur votre fork
git push -u origin feature/42-filtre-periode
```

Puis ouvrez la pull request **vers `develop`** (pas `main`), en remplissant le modèle.

## Les règles

### Branches

| Préfixe                      | Usage                   |
| ---------------------------- | ----------------------- |
| `feature/<n°-issue>-<sujet>` | nouvelle fonctionnalité |
| `fix/<n°-issue>-<sujet>`     | correction de bug       |
| `docs/<sujet>`               | documentation seule     |

### Commits et titre de PR

Format [Conventional Commits](https://www.conventionalcommits.org/fr/) : `type(zone): description à l'infinitif ou au présent`.

- Types : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- Zones : `realtime`, `api`, `web`, `mcp`, `db`, `infra`.
- Le **titre de la PR** suit le même format : il devient le message du commit fusionné.

Un hook vérifie le format à chaque commit.

### Qualité

Avant d'ouvrir la PR, ces commandes doivent passer **dans le dev container** :

```bash
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

La CI les relance sur chaque PR : une PR rouge ne peut pas être fusionnée.

### Tests

- Toute correction de bug ajoute un test qui échouait avant.
- Tout calcul de position ou décodage de flux est couvert par des tests sur un jeu de données fixe.
- Les tests n'appellent jamais PRIM : utilisez les fixtures et `FEED_SOURCE=replay`.

### Code produit avec une IA

Bienvenu, à condition que **vous le compreniez et puissiez l'expliquer** en revue. Relisez-le, testez-le, et cochez la case correspondante du modèle de PR. Mentionner l'outil (par exemple `Co-Authored-By: Claude`) est libre. Le projet fournit un `CLAUDE.md` que Claude Code lit automatiquement.

### Ce qui n'est jamais accepté

- Un secret, une clé ou un `.env` dans le code.
- Du code source de dépôts tiers stocké en base (XLiveMetro ne garde que des métadonnées).
- Tout ce qui collecte des données personnelles des visiteurs (comptes, traceurs, géolocalisation envoyée au serveur).
- Une nouvelle dépendance sans justification dans la PR.
- Une modification de `CLAUDE.md` ou `.claude/` qui élargit les droits d'un assistant IA, ou tout texte destiné à manipuler l'assistant d'un autre contributeur (voir [docs/08-SECURITE.md](docs/08-SECURITE.md)).

## La revue

- Le projet a pour l'instant un seul mainteneur : il répond dès que possible, en général sous quelques jours.
- Répondez aux commentaires, poussez les corrections sur la même branche : la PR se met à jour.
- `nit:` = suggestion mineure, non bloquante.
- Une fois approuvée et verte, un mainteneur la fusionne en **squash**.

## Garder votre fork à jour

```bash
git switch develop
git pull upstream develop
git push origin develop
```

Merci pour votre contribution !
