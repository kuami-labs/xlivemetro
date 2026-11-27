'use client';

import { useState } from 'react';
import { api, type Journey, type Station, type StationWalk } from '@/lib/api';
import { timeLabel } from '@/lib/format';
import { firstRide, journeySummary } from '@/lib/journeyFormat';
import { geolocationMessage, nearbyStations, type StationPoint } from '@/lib/nearby';
import LineBadge from './LineBadge';
import Panel from './Panel';
import StationPicker from './StationPicker';

type From = { kind: 'position' } | { kind: 'station'; station: Station | null };

/**
 * Itinéraire métro/RER/tram (F12, F13). Depuis « ma position », les gares proches sont
 * calculées ici : seuls des identifiants de gares et des durées de marche sont envoyés.
 */
export default function JourneyPanel({
  stationPoints,
  onPreview,
  onBoard,
  onPosition,
  onClose,
}: {
  stationPoints: () => StationPoint[];
  onPreview: (j: Journey | null) => void;
  onBoard: (tripId: string, destinationId: string | null) => void;
  /** Position obtenue (affichée sur la carte, jamais envoyée) */
  onPosition: (p: { lat: number; lon: number; accuracy: number } | null) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState<From>({ kind: 'position' });
  const [to, setTo] = useState<Station | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selected, setSelected] = useState(0);

  const show = (js: Journey[]) => {
    setJourneys(js);
    setSelected(0);
    onPreview(js[0] ?? null);
    setStatus('done');
    setMessage(
      js.length === 0
        ? 'Aucun trajet en métro, RER ou tram pour le moment (bus et Transilien non couverts).'
        : '',
    );
  };

  const search = async (origins: StationWalk[]) => {
    if (!to) return;
    try {
      show(await api.journeys(origins, [{ id: to.id, walkSec: 0 }]));
    } catch {
      setStatus('error');
      setMessage('Calcul impossible pour le moment. Réessayez.');
    }
  };

  const run = () => {
    if (!to) return;
    setStatus('loading');
    setMessage('');
    if (from.kind === 'station') {
      if (from.station) void search([{ id: from.station.id, walkSec: 0 }]);
      return;
    }
    if (!('geolocation' in navigator)) {
      setStatus('error');
      setMessage(geolocationMessage(0));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        onPosition({ lat, lon, accuracy });
        const near = nearbyStations(stationPoints(), lat, lon);
        if (near.length === 0) {
          setStatus('error');
          setMessage('Aucune gare à moins de 1,5 km : choisissez une gare de départ.');
          return;
        }
        void search(near.map((s) => ({ id: s.id, walkSec: s.walkMin * 60 })));
      },
      (err) => {
        onPosition(null);
        setStatus('error');
        setMessage(geolocationMessage(err.code));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  const choose = (i: number) => {
    setSelected(i);
    onPreview(journeys[i] ?? null);
  };

  const canSearch = to !== null && (from.kind === 'position' || from.station !== null);
  const current = journeys[selected];
  const ride = current ? firstRide(current) : null;

  return (
    <Panel
      onClose={onClose}
      title={<h2 className="text-[22px] leading-tight font-bold tracking-tight">Itinéraire</h2>}
    >
      <div className="flex flex-col gap-3.5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs text-muted">Départ</legend>
          <div className="flex gap-1.5">
            {(
              [
                ['position', 'Ma position'],
                ['station', 'Une gare'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={from.kind === k}
                onClick={() =>
                  setFrom(
                    k === 'position' ? { kind: 'position' } : { kind: 'station', station: null },
                  )
                }
                className={`h-9 flex-1 rounded-lg text-sm font-semibold ${from.kind === k ? 'bg-accent text-on-accent' : 'border border-border text-muted hover:text-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {from.kind === 'position' ? (
            <p className="text-xs text-muted">
              Votre position reste sur cet appareil : seules les gares proches et les temps de
              marche sont envoyés.
            </p>
          ) : (
            <StationPicker
              label="Gare de départ"
              placeholder="Rechercher une gare"
              value={from.station}
              onChange={(s) => setFrom({ kind: 'station', station: s })}
            />
          )}
        </fieldset>

        <StationPicker
          label="Arrivée"
          placeholder="Rechercher une gare"
          value={to}
          onChange={setTo}
        />

        <button
          type="button"
          disabled={!canSearch || status === 'loading'}
          onClick={run}
          className="h-11 rounded-[10px] bg-accent text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          {status === 'loading' ? 'Calcul…' : 'Rechercher'}
        </button>

        {message && (
          <p className={`text-sm ${status === 'error' ? 'text-alert' : 'text-muted'}`}>{message}</p>
        )}

        {journeys.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Itinéraires proposés">
            {journeys.map((j, i) => (
              <li key={j.depart + j.arrive + i}>
                <button
                  type="button"
                  aria-pressed={i === selected}
                  onClick={() => choose(i)}
                  className={`flex w-full flex-col gap-1.5 rounded-[10px] border px-3 py-2.5 text-left ${i === selected ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-2'}`}
                >
                  <span className="font-mono text-[13px] text-text">{journeySummary(j)}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    {j.legs
                      .filter((l) => !l.walk && l.line)
                      .map((l, k) => (
                        <LineBadge key={k} line={l.line!} size={22} />
                      ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {current && (
          <ol className="flex flex-col" aria-label="Détail de l’itinéraire">
            {current.walkStartMin > 0 && (
              <li className="border-b border-divider py-2 text-sm text-text-2">
                {current.walkStartMin} min à pied jusqu’à {current.legs[0]?.from.name}
              </li>
            )}
            {current.legs.map((l, k) =>
              l.walk ? (
                <li key={k} className="border-b border-divider py-2 text-sm text-text-2">
                  Correspondance à pied jusqu’à {l.to.name} (
                  {Math.max(
                    1,
                    Math.round((Date.parse(l.arrival) - Date.parse(l.departure)) / 60_000),
                  )}{' '}
                  min)
                </li>
              ) : (
                <li key={k} className="flex flex-col gap-1 border-b border-divider py-2.5">
                  <span className="flex items-center gap-2">
                    {l.line && <LineBadge line={l.line} size={22} />}
                    <span className="truncate text-sm font-semibold">vers {l.headsign}</span>
                  </span>
                  <span className="font-mono text-xs text-text-2">
                    {timeLabel(l.departure)} {l.from.name} → {timeLabel(l.arrival)} {l.to.name} ·{' '}
                    {l.stops} arrêt{l.stops > 1 ? 's' : ''}
                    {l.theoretical ? ' · horaire théorique' : ''}
                  </span>
                </li>
              ),
            )}
            <li className="py-2 text-sm font-semibold">
              Arrivée {timeLabel(current.arrive)} à {to?.name}
            </li>
          </ol>
        )}

        {ride?.tripId && (
          <button
            type="button"
            onClick={() => onBoard(ride.tripId!, ride.to.id)}
            className="h-11 rounded-[10px] border border-accent text-sm font-semibold text-accent hover:bg-accent-soft"
          >
            Je prends ce train ({ride.line?.shortName} vers {ride.headsign})
          </button>
        )}
        <p className="text-xs text-muted">
          Métro, RER et tram uniquement. Horaires et positions estimés.
        </p>
      </div>
    </Panel>
  );
}
