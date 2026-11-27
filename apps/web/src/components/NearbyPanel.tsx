'use client';

import { useEffect, useState } from 'react';
import { api, type Departure, type Line } from '@/lib/api';
import { delayLabel, waitLabel } from '@/lib/format';
import type { NearbyStation } from '@/lib/nearby';
import LineBadge from './LineBadge';
import Panel from './Panel';

export type NearbyState =
  | { status: 'locating' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stations: NearbyStation[] };

/** « Autour de moi » (F11) : gares proches, temps de marche et prochains départs. */
export default function NearbyPanel({
  state,
  lines,
  onStation,
  onRetry,
  onClose,
}: {
  state: NearbyState;
  lines: Map<string, Line>;
  onStation: (id: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [departures, setDepartures] = useState<Record<string, Departure[]>>({});
  const [now, setNow] = useState(() => Date.now());
  const ids = state.status === 'ready' ? state.stations.map((s) => s.id).join(',') : '';

  useEffect(() => {
    if (!ids) return;
    // Réponses arrivées après la fermeture ignorées (sans annuler la requête)
    let active = true;
    const load = () =>
      Promise.all(
        ids.split(',').map((id) =>
          api.departures(id).then(
            (d) => [id, d.slice(0, 3)] as const,
            () => [id, []] as const,
          ),
        ),
      ).then((pairs) => {
        if (!active) return;
        setDepartures(Object.fromEntries(pairs));
        setNow(Date.now());
      });
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ids]);

  return (
    <Panel
      onClose={onClose}
      title={
        <div className="flex flex-col gap-1">
          <h2 className="text-[22px] leading-tight font-bold tracking-tight">Autour de moi</h2>
          <p className="text-xs text-muted">
            Votre position reste sur cet appareil : elle n’est jamais envoyée.
          </p>
        </div>
      }
    >
      {state.status === 'locating' && <p className="text-sm text-muted">Localisation en cours…</p>}
      {state.status === 'error' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-alert">{state.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="h-11 self-start rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent"
          >
            Réessayer
          </button>
        </div>
      )}
      {state.status === 'ready' && state.stations.length === 0 && (
        <p className="text-sm text-muted">
          Aucune gare de métro, RER ou tram à moins de 1,5 km. Cherchez une gare avec la barre de
          recherche.
        </p>
      )}
      {state.status === 'ready' && state.stations.length > 0 && (
        <ul className="flex flex-col">
          {state.stations.map((s) => (
            <li key={s.id} className="border-b border-divider py-3 last:border-0">
              <button
                type="button"
                onClick={() => onStation(s.id)}
                className="flex w-full items-start justify-between gap-3 text-left hover:text-accent"
              >
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="truncate text-[15px] font-semibold">{s.name}</span>
                  <span className="flex flex-wrap gap-1">
                    {s.lines.flatMap((n) => {
                      const l = lines.get(n);
                      return l ? [<LineBadge key={n} line={l} size={22} />] : [];
                    })}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono">
                  <span className="block text-base font-semibold text-accent">{s.walkMin} min</span>
                  <span className="text-xs text-muted">
                    {s.distanceM < 1000
                      ? `${Math.round(s.distanceM / 10) * 10} m`
                      : `${(s.distanceM / 1000).toFixed(1).replace('.', ',')} km`}{' '}
                    à pied
                  </span>
                </span>
              </button>
              <ul className="mt-2 flex flex-col gap-1">
                {(departures[s.id] ?? []).map((d) => (
                  <li key={d.tripId + d.aimed} className="flex items-center gap-2 text-[13px]">
                    <LineBadge line={d.line} size={20} />
                    <span className="min-w-0 flex-1 truncate text-text-2">{d.headsign}</span>
                    <span className="font-mono text-text">{waitLabel(d.expected, now)}</span>
                    <span className="sr-only">{delayLabel(d.delaySeconds, d.theoretical)}</span>
                  </li>
                ))}
                {departures[s.id]?.length === 0 && (
                  <li className="text-[13px] text-muted">Aucun départ dans les 90 minutes.</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
