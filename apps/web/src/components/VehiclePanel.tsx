'use client';

import { useEffect, useState } from 'react';
import { api, type VehicleDetail } from '@/lib/api';
import { delayLabel, timeLabel } from '@/lib/format';
import LineBadge from './LineBadge';
import Panel from './Panel';

/** Fiche d'un train suivi par la caméra (F7). */
export default function VehiclePanel({
  id,
  onClose,
  onStation,
}: {
  id: string;
  onClose: () => void;
  onStation: (id: string) => void;
}) {
  const [v, setV] = useState<VehicleDetail | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // Le parent remonte le composant à chaque train (key) : pas d'état à réinitialiser
    // Réponses arrivées après la fermeture ignorées (sans annuler la requête)
    let active = true;
    const load = () =>
      api.vehicle(id).then(
        (d) => active && setV(d),
        () => active && setGone(true),
      );
    void load();
    const timer = setInterval(load, 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);

  return (
    <Panel
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          {v?.line && <LineBadge line={v.line} />}
          <h2 className="truncate text-base font-semibold">{v ? `Vers ${v.headsign}` : 'Train'}</h2>
        </div>
      }
    >
      {gone && <p className="text-sm text-neutral-400">Ce train est arrivé ou n’est plus suivi.</p>}
      {v && (
        <>
          <p className="mb-3 text-sm">
            {v.atStop ? 'À quai · ' : ''}
            {delayLabel(v.delaySeconds, v.theoretical)} · position estimée
          </p>
          <h3 className="mb-2 text-sm font-medium text-neutral-400">Prochains arrêts</h3>
          <ol className="space-y-1 text-sm">
            {v.nextStops.map((s) => (
              <li key={s.expected + s.station} className="flex justify-between gap-2">
                {s.stationId ? (
                  <button
                    type="button"
                    className="truncate text-left hover:underline"
                    onClick={() => onStation(s.stationId!)}
                  >
                    {s.station}
                  </button>
                ) : (
                  <span className="truncate">{s.station}</span>
                )}
                <span className="tabular-nums text-neutral-300">{timeLabel(s.expected)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}
