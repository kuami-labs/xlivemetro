# 0001. Développer dans un dev container VS Code, décrit dans le dépôt

- Statut : acceptée
- Date : 2026-11-26
- Décideurs : Kuami (mainteneur)

## Contexte

XLiveMetro est open source : les contributeurs arrivent sans prévenir, sur des machines différentes (macOS Intel ou Apple Silicon, Windows, Linux), avec leur propre version de Node et de PostgreSQL, ou aucune. La stack compte plusieurs services : PostgreSQL avec PostGIS, Redis, et un service Go en plus des applications Node.

Objectif fixé : un nouveau contributeur clone le dépôt et lance la stack en 15 minutes, sans aide. Le mainteneur ne peut pas dépanner chaque installation.

La production tournera sous Debian, avec Node 26 (LTS), Go 1.27, PostgreSQL 19 (PostGIS 3.7) et Redis 8.

## Options

1. **Dev container VS Code et `compose.yaml`, versionnés dans le dépôt.**
   Avantages : seuls Docker et VS Code à installer ; mêmes versions pour tous ; même système que la production ; ESLint et Prettier branchés dans l'éditeur ; toute modification de l'environnement passe par une PR.
   Inconvénients : Docker Desktop consomme de la mémoire ; WSL 2 obligatoire sous Windows ; premier build de plusieurs minutes ; dépendance à VS Code pour toute la configuration.

2. **Installation locale guidée par le README.**
   Avantages : aucun Docker ; outils natifs, plus rapides.
   Inconvénients : une procédure par système ; versions qui divergent ; bugs « ça marche sur ma machine » ; beaucoup de questions dans les issues.

3. **Docker Compose seul, code et Node sur la machine.**
   Avantages : services identiques pour tous ; libre choix de l'éditeur.
   Inconvénients : Node, pnpm et les extensions divergent ; le hook `pre-commit` tourne avec le Node de chaque machine.

## Décision

Nous choisissons l'option 1, avec l'image `mcr.microsoft.com/devcontainers/typescript-node:26-trixie` et `compose.yaml` (PostgreSQL 19 + PostGIS, Redis 8) et la feature Go. C'est la seule qui garantit le même environnement sur tous les systèmes sans assistance, au plus près de la production.

Le `compose.yaml` reste utilisable sans VS Code (`docker compose up -d db redis`) pour les contributeurs qui préfèrent un autre éditeur, sans support officiel.

## Conséquences

- Positives : un contributeur n'installe que Docker et VS Code ; mêmes Node, Go, pnpm, `psql` et extensions pour tous ; la CI utilise la même image Node ; l'environnement est relu en PR (CODEOWNERS : `xlivemetro-maintainers`).
- Négatives, à accepter : Docker Desktop requis ; WSL 2 sous Windows ; commits à faire depuis le dev container ; données PostgreSQL locales à chaque machine.
- À revoir si : plusieurs contributeurs signalent qu'ils ne peuvent pas faire tourner Docker, ou si un éditeur autre que VS Code devient majoritaire.
