'use client';

import { useEffect, useState } from 'react';
import { api, type Departure, type Disruption, type Station } from '@/lib/api';
import { loadFavorites, toggleFavorite } from '@/lib/favorites';
import { delayLabel, waitLabel } from '@/lib/format';
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

  return (
    <Panel
      onClose={onClose}
      title={
        <div>
          <h2 className="truncate text-base font-semibold">{station?.name ?? 'Gare'}</h2>
          <div className="mt-1 flex flex-wrap gap-1">
            {station?.lines.map((l) => (
              <LineBadge key={l.id} line={l} />
            ))}
          </div>
        </div>
      }
    >
      {station && (
        <button
          type="button"
          className="mb-3 text-sm text-neutral-300 underline-offset-2 hover:underline"
          aria-pressed={favorite}
          onClick={() => {
            const list = toggleFavorite({ id: station.id, name: station.name });
            setFavorite(list.some((f) => f.id === station.id));
            onFavoritesChange();
          }}
        >
          {favorite ? '★ Retirer des favoris' : '☆ Ajouter aux favoris'}
        </button>
      )}
      {disruptions
        .filter((d) => d.lines.some((l) => station?.lines.some((sl) => sl.id === l.id)))
        .map((d) => (
          <div
            key={d.id}
            role="alert"
            className="mb-3 rounded border border-orange-400/60 p-2 text-sm"
          >
            <div className="mb-1 flex gap-1">
              {d.lines.map((l) => (
                <LineBadge key={l.id} line={l} />
              ))}
              <span className="font-medium">{d.channel || 'Information'}</span>
            </div>
            {/* Texte IDFM affiché comme texte brut (React l'échappe), jamais comme HTML */}
            <p>{d.text}</p>
          </div>
        ))}
      <h3 className="mb-2 text-sm font-medium text-neutral-400">Prochains départs</h3>
      {error && <p className="text-sm text-red-300">Départs indisponibles pour le moment.</p>}
      {!error && departures === null && <p className="text-sm text-neutral-400">Chargement…</p>}
      {departures?.length === 0 && (
        <p className="text-sm text-neutral-400">Aucun départ dans les 90 prochaines minutes.</p>
      )}
      <ul className="space-y-2">
        {departures?.map((d) => (
          <li key={d.tripId + d.aimed} className="flex items-center gap-2 text-sm">
            <LineBadge line={d.line} />
            <span className="min-w-0 flex-1 truncate">{d.headsign}</span>
            <span className="text-right tabular-nums">
              <span className="font-semibold">{waitLabel(d.expected, now)}</span>
              <span
                className={`block text-xs ${d.delaySeconds >= 120 && !d.theoretical ? 'text-orange-300' : 'text-neutral-400'}`}
              >
                {delayLabel(d.delaySeconds, d.theoretical)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
