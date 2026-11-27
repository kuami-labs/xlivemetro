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

  const late = v && !v.theoretical && v.delaySeconds >= 120;
  const veryLate = v && !v.theoretical && v.delaySeconds >= 300;
  return (
    <Panel
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          {v?.line && <LineBadge line={v.line} />}
          <h2 className="truncate text-lg font-bold">{v ? `Vers ${v.headsign}` : 'Train'}</h2>
        </div>
      }
    >
      {gone && <p className="text-sm text-muted">Ce train est arrivé ou n’est plus suivi.</p>}
      {v && (
        <div className="flex flex-col gap-3.5">
          <p className="font-mono text-[13px]">
            <span className={veryLate ? 'text-alert' : late ? 'text-warn' : 'text-text-2'}>
              {delayLabel(v.delaySeconds, v.theoretical)}
            </span>
            <span className="text-muted">
              {v.atStop ? ' · à quai' : ''} · position estimée · suivi
            </span>
          </p>
          <h3 className="label-caps">Prochains arrêts</h3>
          <ol className="flex flex-col">
            {v.nextStops.map((s) => (
              <li
                key={s.expected + s.station}
                className="flex items-center justify-between gap-2 border-b border-divider py-2 text-sm last:border-0"
              >
                {s.stationId ? (
                  <button
                    type="button"
                    className="truncate text-left hover:text-accent hover:underline"
                    onClick={() => onStation(s.stationId!)}
                  >
                    {s.station}
                  </button>
                ) : (
                  <span className="truncate">{s.station}</span>
                )}
                <span className="font-mono text-text-2">{timeLabel(s.expected)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}
