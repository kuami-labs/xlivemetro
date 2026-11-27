'use client';

import { useEffect, useState } from 'react';
import { api, type Departure, type Disruption, type Station } from '@/lib/api';
import { loadFavorites, toggleFavorite } from '@/lib/favorites';
import { delayLabel, waitLabel } from '@/lib/format';
import IconButton from './IconButton';
import LineBadge from './LineBadge';
import Panel from './Panel';

/** Fiche d'une gare : lignes et prochains départs, rafraîchis toutes les 30 s (F3). */
export default function StationPanel({
  id,
  onClose,
  onFavoritesChange,
}: {
  id: string;
  onClose: () => void;
  onFavoritesChange: () => void;
}) {
  const [station, setStation] = useState<Station | null>(null);
  const [departures, setDepartures] = useState<Departure[] | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [favorite, setFavorite] = useState(false);
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);

  useEffect(() => {
    // Le parent remonte le composant à chaque gare (key) : pas d'état à réinitialiser
    // Réponses arrivées après la fermeture ignorées (sans annuler la requête)
    let active = true;
    api.station(id).then(
      (s) => {
        if (!active) return;
        setStation(s);
        setFavorite(loadFavorites().some((f) => f.id === s.id));
      },
      () => active && setError(true),
    );
    const load = () =>
      api.departures(id).then(
        (d) => {
          if (!active) return;
          setDepartures(d);
          setNow(Date.now());
        },
        () => active && setError(true),
      );
    void load();
    api.disruptions().then(
      (d) => active && setDisruptions(d),
      () => {}, // perturbations indisponibles : la fiche reste utilisable
    );
    const timer = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);

  const star = (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M9 1.5 L11.3 6.3 L16.5 6.9 L12.6 10.4 L13.7 15.6 L9 13 L4.3 15.6 L5.4 10.4 L1.5 6.9 L6.7 6.3 Z"
        fill={favorite ? 'var(--accent)' : 'none'}
        stroke={favorite ? 'var(--accent)' : 'currentColor'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <Panel
      onClose={onClose}
      actions={
        station && (
          <IconButton
            label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            pressed={favorite}
            onClick={() => {
              const list = toggleFavorite({ id: station.id, name: station.name });
              setFavorite(list.some((f) => f.id === station.id));
              onFavoritesChange();
            }}
          >
            {star}
          </IconButton>
        )
      }
      title={
        <div className="flex flex-col gap-2.5">
          <h2 className="text-[22px] leading-tight font-bold tracking-tight">
            {station?.name ?? 'Gare'}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {station?.lines.map((l) => (
              <LineBadge key={l.id} line={l} />
            ))}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        {disruptions
          .filter((d) => d.lines.some((l) => station?.lines.some((sl) => sl.id === l.id)))
          .map((d) => (
            <div
              key={d.id}
              role="alert"
              className="rounded-[10px] border border-warn-border bg-warn-bg px-3.5 py-3 text-[13px] leading-relaxed"
            >
              <strong className="text-warn-title">
                {d.lines.map((l) => l.shortName).join(', ')} · {d.channel || 'Information'}
              </strong>
              {/* Texte IDFM affiché comme texte brut (React l'échappe), jamais comme HTML */}
              <p>{d.text}</p>
            </div>
          ))}
        <h3 className="label-caps">Prochains départs</h3>
        {error && <p className="text-sm text-alert">Départs indisponibles pour le moment.</p>}
        {!error && departures === null && <p className="text-sm text-muted">Chargement…</p>}
        {departures?.length === 0 && (
          <p className="text-sm text-muted">Aucun départ dans les 90 prochaines minutes.</p>
        )}
        <ul className="flex flex-col">
          {departures?.map((d) => {
            const late = !d.theoretical && d.delaySeconds >= 120;
            const veryLate = !d.theoretical && d.delaySeconds >= 300;
            return (
              <li
                key={d.tripId + d.aimed}
                className="flex items-center gap-3 border-b border-divider py-2.5 last:border-0"
              >
                <LineBadge line={d.line} />
                <span className="min-w-0 flex-1 truncate text-[15px]">{d.headsign}</span>
                <span className="text-right">
                  <span className="block font-mono text-lg font-semibold text-accent">
                    {waitLabel(d.expected, now)}
                  </span>
                  <span
                    className={`font-mono text-xs ${veryLate ? 'text-alert' : late ? 'text-warn' : 'text-muted'}`}
                  >
                    {delayLabel(d.delaySeconds, d.theoretical)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
