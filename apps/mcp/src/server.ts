import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiError, type Line, type Station, type XLiveMetroApi } from './api.js';
import { delayText, lineName, quoteDisruption, waitText } from './format.js';
import { mapLink } from './links.js';

const VERSION = '0.1.0';

type Text = { content: { type: 'text'; text: string }[]; isError?: boolean };

function text(t: string): Text {
  return { content: [{ type: 'text', text: t }] };
}

function failure(e: unknown): Text {
  const msg = e instanceof ApiError ? e.message : 'erreur inattendue';
  return { content: [{ type: 'text', text: msg }], isError: true };
}

/** Lecture seule : aucun outil ne modifie quoi que ce soit (ADR 0006). */
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

/**
 * Serveur MCP de XLiveMetro : 5 outils en lecture seule sur l'API publique, chacun avec
 * un lien vers la carte quand il a du sens (docs/03-BACKEND.md).
 */
export function createServer(
  api: XLiveMetroApi,
  webUrl: string,
  now: () => number = Date.now,
): McpServer {
  const server = new McpServer({ name: 'xlivemetro', version: VERSION });

  // Une gare : identifiant IDFM, sinon meilleur résultat de recherche
  async function resolveStation(stop: string): Promise<Station | null> {
    if (/^IDFM:[A-Za-z0-9_-]+$/.test(stop)) return api.station(stop);
    const found = await api.search(stop);
    return found[0] ?? null;
  }

  async function resolveLine(line: string): Promise<Line | null> {
    const wanted = line
      .trim()
      .toLowerCase()
      .replace(/^(métro|metro|rer|tram|ligne)\s+/i, '');
    const lines = await api.lines();
    return lines.find((l) => l.id === line || l.shortName.toLowerCase() === wanted) ?? null;
  }

  server.registerTool(
    'search_stop',
    {
      title: 'Rechercher une gare',
      description:
        "Recherche une gare du métro, du RER ou du tram d'Île-de-France par son nom (tolère les fautes et l'absence d'accents). Renvoie l'identifiant, les lignes desservies et un lien vers la carte.",
      inputSchema: {
        query: z.string().min(2).max(64).describe('Nom approximatif, ex. « chatelet »'),
      },
      annotations: READ_ONLY,
    },
    async ({ query }) => {
      try {
        const stations = await api.search(query);
        if (stations.length === 0) return text(`Aucune gare trouvée pour « ${query} ».`);
        return text(
          stations
            .map(
              (s) =>
                `${s.name} (${s.id}) – ${s.lines.map(lineName).join(', ')}\n  Carte : ${mapLink(webUrl, { stop: s.id, lat: s.lat, lon: s.lon })}`,
            )
            .join('\n'),
        );
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    'next_departures',
    {
      title: 'Prochains départs',
      description:
        "Prochains départs d'une gare (90 prochaines minutes), avec le retard estimé. Les horaires sans données temps réel sont signalés comme théoriques. Chaque départ a un lien pour suivre le train sur la carte.",
      inputSchema: {
        stop: z.string().min(2).max(64).describe('Nom de la gare ou identifiant IDFM:…'),
        line: z.string().max(16).optional().describe('Ligne à garder, ex. « A », « 14 », « T3a »'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe('Nombre de départs (8 par défaut)'),
      },
      annotations: READ_ONLY,
    },
    async ({ stop, line, limit }) => {
      try {
        const station = await resolveStation(stop);
        if (!station) return text(`Gare « ${stop} » introuvable.`);
        let departures = await api.departures(station.id);
        if (line) {
          const l = line.trim().toLowerCase();
          departures = departures.filter((d) => d.line.shortName.toLowerCase() === l);
        }
        departures = departures.slice(0, limit ?? 8);
        const head = `${station.name} – ${mapLink(webUrl, { stop: station.id, lat: station.lat, lon: station.lon })}`;
        if (departures.length === 0) {
          return text(
            `${head}\nAucun départ${line ? ` de la ligne ${line}` : ''} dans les 90 prochaines minutes.`,
          );
        }
        const t = now();
        return text(
          [
            head,
            ...departures.map(
              (d) =>
                `- ${lineName(d.line)} vers ${d.headsign} : ${waitText(d.expected, t)} (${delayText(d)}) – suivre : ${mapLink(webUrl, { follow: d.tripId })}`,
            ),
            'Positions et horaires estimés à partir des données ouvertes d’Île-de-France Mobilités.',
          ].join('\n'),
        );
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    'line_status',
    {
      title: "État d'une ligne",
      description:
        "État d'une ligne (normal ou perturbé) avec les messages officiels en cours, ses terminus et un lien vers la carte centrée sur la ligne.",
      inputSchema: {
        line: z.string().min(1).max(16).describe('Ligne : « 1 », « 14 », « A », « T3a »…'),
      },
      annotations: READ_ONLY,
    },
    async ({ line }) => {
      try {
        const l = await resolveLine(line);
        if (!l) return text(`Ligne « ${line} » inconnue (métro, RER A à E et tram uniquement).`);
        const [detail, disruptions] = await Promise.all([api.line(l.id), api.disruptions()]);
        const mine = disruptions.filter((d) => d.lines.some((x) => x.id === l.id));
        const mid = detail.stations[Math.floor(detail.stations.length / 2)];
        const ends = detail.stations.length
          ? `${detail.stations[0].name} ↔ ${detail.stations[detail.stations.length - 1].name}`
          : '';
        return text(
          [
            `${lineName(l)}${ends ? ` (${ends})` : ''} : ${mine.length ? 'perturbée' : 'aucune perturbation signalée'}.`,
            ...mine.map(quoteDisruption),
            mid ? `Carte : ${mapLink(webUrl, { mode: l.mode, lat: mid.lat, lon: mid.lon })}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        );
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    'list_disruptions',
    {
      title: 'Perturbations en cours',
      description:
        'Liste les perturbations en cours sur le métro, le RER et le tram (messages officiels IDFM, cités tels quels).',
      inputSchema: {
        mode: z.enum(['metro', 'rer', 'tram']).optional().describe('Filtrer par mode'),
      },
      annotations: READ_ONLY,
    },
    async ({ mode }) => {
      try {
        const all = await api.disruptions();
        const list = mode ? all.filter((d) => d.lines.some((l) => l.mode === mode)) : all;
        if (list.length === 0) return text('Aucune perturbation signalée.');
        return text(list.map(quoteDisruption).join('\n'));
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    'map_link',
    {
      title: 'Lien vers la carte',
      description:
        'Lien vers la carte 3D XLiveMetro centrée sur une gare (nom ou identifiant), une ligne, ou suivant un train (identifiant de course renvoyé par next_departures).',
      inputSchema: {
        stop: z.string().min(2).max(64).optional(),
        line: z.string().min(1).max(16).optional(),
        train: z.string().max(160).optional().describe('Identifiant de course : « …@AAAAMMJJ »'),
      },
      annotations: READ_ONLY,
    },
    async ({ stop, line, train }) => {
      try {
        if (train) {
          if (!/^IDFM:[A-Za-z0-9_:.-]{1,120}@\d{8}$/.test(train))
            return text('Identifiant de course invalide.');
          return text(mapLink(webUrl, { follow: train }));
        }
        if (stop) {
          const s = await resolveStation(stop);
          return text(
            s
              ? mapLink(webUrl, { stop: s.id, lat: s.lat, lon: s.lon })
              : `Gare « ${stop} » introuvable.`,
          );
        }
        if (line) {
          const l = await resolveLine(line);
          if (!l) return text(`Ligne « ${line} » inconnue.`);
          const detail = await api.line(l.id);
          const mid = detail.stations[Math.floor(detail.stations.length / 2)];
          return text(mid ? mapLink(webUrl, { mode: l.mode, lat: mid.lat, lon: mid.lon }) : webUrl);
        }
        return text(webUrl);
      } catch (e) {
        return failure(e);
      }
    },
  );

  return server;
}
