# Politique de sécurité

## Versions maintenues

Seule la dernière version publiée (`main`) reçoit des correctifs de sécurité.

## Signaler une faille

**N'ouvrez pas d'issue publique.**

Utilisez le signalement privé de GitHub : onglet **Security** → **Report a vulnerability**.

Indiquez :

- la partie concernée (realtime, API, web, MCP, déploiement) ;
- les étapes pour reproduire ;
- l'impact possible ;
- une piste de correction, si vous en avez une.

## Notre engagement

| Étape                              | Délai cible    |
| ---------------------------------- | -------------- |
| Accusé de réception                | 3 jours ouvrés |
| Première évaluation                | 7 jours ouvrés |
| Correctif publié (faille critique) | 30 jours       |

Nous vous tenons informé, et nous vous créditons dans la release si vous le souhaitez.

## Périmètre sensible

XLiveMetro accède en lecture aux métadonnées GitHub d'organisations. Sont particulièrement importants :

- la protection de la clé PRIM et des quotas ;
- l'isolation des données entre organisations ;
- la diffusion WebSocket (limites, origine) et le serveur MCP.
