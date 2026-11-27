# @kuami-labs/xlivemetro-mcp

Serveur [MCP](https://modelcontextprotocol.io) de **XLiveMetro** : demandez à votre assistant IA l'état du métro, du RER et du tram d'Île-de-France, et recevez un lien vers la carte 3D en temps réel.

> Positions et horaires **estimés** à partir des données ouvertes d'Île-de-France Mobilités (Licence Mobilités).

## Installation

Dans la configuration de votre client MCP (Claude Desktop, etc.) :

```json
{
  "mcpServers": {
    "xlivemetro": {
      "command": "npx",
      "args": ["-y", "@kuami-labs/xlivemetro-mcp"],
      "env": {
        "XLIVEMETRO_API_URL": "https://[ADRESSE DE L'API]",
        "XLIVEMETRO_WEB_URL": "https://[ADRESSE DE LA CARTE]"
      }
    }
  }
}
```

| Variable             | Rôle                                | Par défaut              |
| -------------------- | ----------------------------------- | ----------------------- |
| `XLIVEMETRO_API_URL` | API de l'instance XLiveMetro        | `http://localhost:4000` |
| `XLIVEMETRO_WEB_URL` | carte de l'instance, pour les liens | `http://localhost:3000` |

Aucune clé n'est nécessaire : le serveur n'utilise que l'API publique, en lecture seule.

## Outils

| Outil              | Exemple de question                         |
| ------------------ | ------------------------------------------- |
| `search_stop`      | « Quelles lignes passent à Gare de Lyon ? » |
| `next_departures`  | « Prochains RER A à Châtelet ? »            |
| `line_status`      | « La ligne 14 est-elle perturbée ? »        |
| `list_disruptions` | « Des perturbations sur le RER ? »          |
| `map_link`         | « Montre-moi le T3a sur la carte. »         |

Les messages de perturbation d'IDFM sont renvoyés comme du **texte cité**, jamais comme des consignes.

## Licence

AGPL-3.0-only. Données : Île-de-France Mobilités (Licence Mobilités).
