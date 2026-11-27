'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type TripDetail } from '@/lib/api';
import { delayLabel, timeLabel } from '@/lib/format';
import { reminderText, saveTrip, tripPhase } from '@/lib/trip';
import LineBadge from './LineBadge';
import Panel from './Panel';

/**
 * « Je suis dans ce train » (F15) et rappel de descente (F16). Le trajet reste dans
 * l'onglet (sessionStorage) ; rien n'est envoyé au serveur à part l'identifiant de course.
 */
export default function TripPanel({
  tripId,
  initialDestination,
  onStation,
  onEnd,
  onArrived,
}: {
  tripId: string;
  initialDestination: string | null;
  onStation: (id: string) => void;
  onEnd: () => void;
  /** Arrivé à destination : la carte cesse de suivre le train */
  onArrived: () => void;
}) {
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [gone, setGone] = useState(false);
  const [destination, setDestination] = useState<string | null>(initialDestination);
  const [now, setNow] = useState(() => Date.now());
  const lastNotified = useRef<string | null>(null);

  useEffect(() => {
    // Réponses arrivées après la fermeture ignorées (sans annuler la requête)
    let active = true;
    const load = () =>
      api.trip(tripId).then(
        (t) => {
          if (!active) return;
          setTrip(t);
          setNow(Date.now());
        },
        () => active && setGone(true),
      );
    void load();
    const timer = setInterval(load, 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tripId]);

  useEffect(() => {
    saveTrip({ tripId, destinationId: destination });
  }, [tripId, destination]);

  const calls = trip?.calls ?? [];
  // La destination est choisie parmi les arrêts restants : si elle n'y figure plus (ou si la
  // course est terminée), on est arrivé. Rien n'est conclu avant le premier chargement.
  const phase =
    !trip && !gone
      ? ({ phase: 'sans-destination' } as const)
      : tripPhase(gone ? [] : calls, destination, now, destination !== null);
  const destinationName =
    calls.find((c) => c.stationId === destination)?.station ?? lastDestinationName(destination);
  const reminder = reminderText(phase, destinationName);

  // Notification du navigateur, une seule fois par étape, si autorisée
  useEffect(() => {
    if (!reminder || lastNotified.current === reminder) return;
    lastNotified.current = reminder;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('XLiveMetro', { body: reminder, tag: `trajet-${tripId}` });
    }
  }, [reminder, tripId]);

  const choose = (stationId: string, station: string) => {
    rememberName(stationId, station);
    setDestination(stationId);
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  };

  const arrived = phase.phase === 'arrive';
  useEffect(() => {
    if (arrived) onArrived();
  }, [arrived, onArrived]);

  const v = trip?.vehicle;

  return (
    <Panel
      onClose={onEnd}
      title={
        <div className="flex flex-col gap-1.5">
          <span className="label-caps">Mon trajet</span>
          <div className="flex items-center gap-2.5">
            {trip?.line && <LineBadge line={trip.line} />}
            <h2 className="truncate text-lg font-bold">
              {trip ? `Vers ${trip.headsign}` : 'Chargement…'}
            </h2>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        {reminder && (
          <p
            role="alert"
            className="rounded-[10px] border border-accent bg-accent-soft px-3.5 py-3 text-[15px] font-semibold"
          >
            {reminder}
          </p>
        )}
        {gone && phase.phase !== 'arrive' && (
          <p className="text-sm text-muted">Cette course est terminée ou n’est plus suivie.</p>
        )}
        {trip && (
          <p className="font-mono text-[13px] text-text-2">
            {v ? delayLabel(v.delaySeconds, trip.theoretical) : 'pas encore parti'}
            <span className="text-muted"> · positions et horaires estimés</span>
          </p>
        )}

        {phase.phase === 'en-route' || phase.phase === 'prochain-arret' ? (
          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-surface-2 px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-xs text-muted">Descente à</p>
              <p className="truncate text-base font-semibold">{destinationName}</p>
              <p className="font-mono text-xs text-text-2">
                arrivée {timeLabel(phase.arrival)}
                {phase.phase === 'en-route' ? ` · ${phase.stopsLeft} arrêts` : ' · prochain arrêt'}
              </p>
            </div>
            <span className="shrink-0 font-mono text-2xl font-semibold text-accent">
              {phase.minutesLeft} min
            </span>
          </div>
        ) : null}

        {trip && phase.phase !== 'arrive' && (
          <>
            <h3 className="label-caps">
              {destination ? 'Arrêts restants' : 'Où descendez-vous ?'}
            </h3>
            <ol className="flex flex-col">
              {calls.map((c, i) => {
                const isDest = c.stationId !== null && c.stationId === destination;
                // Train pas encore parti : le premier arrêt est la gare de montée
                const boarding = i === 0 && !v;
                return (
                  <li
                    key={c.aimed + c.station}
                    className={`flex items-center justify-between gap-2 border-b border-divider py-2 text-sm last:border-0 ${isDest ? 'font-semibold text-accent' : ''}`}
                  >
                    <span className="min-w-0 truncate">{c.station}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-text-2">{timeLabel(c.expected)}</span>
                      {c.stationId && !isDest && !boarding && (
                        <button
                          type="button"
                          onClick={() => choose(c.stationId!, c.station)}
                          className="h-8 rounded-lg border border-border px-2.5 text-xs font-semibold text-text hover:border-accent hover:text-accent"
                          aria-label={`Je descends à ${c.station}`}
                        >
                          Je descends ici
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          {destination && phase.phase !== 'arrive' && (
            <button
              type="button"
              onClick={() => onStation(destination)}
              className="h-11 rounded-[10px] border border-border px-4 text-sm font-semibold hover:bg-surface-2"
            >
              Voir ma gare d’arrivée
            </button>
          )}
          <button
            type="button"
            onClick={onEnd}
            className="h-11 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent"
          >
            {phase.phase === 'arrive' ? 'Terminer' : 'Arrêter le suivi'}
          </button>
        </div>
      </div>
    </Panel>
  );
}

// Nom de la gare de descente gardé pour l'écran d'arrivée (elle ne figure plus dans les arrêts)
const NAMES_KEY = 'xlivemetro:trajet-noms';
function rememberName(id: string, name: string) {
  try {
    sessionStorage.setItem(NAMES_KEY, JSON.stringify({ [id]: name }));
  } catch {
    // stockage indisponible : le nom manquera seulement à l'arrivée
  }
}
function lastDestinationName(id: string | null): string {
  if (!id) return '';
  try {
    const names = JSON.parse(sessionStorage.getItem(NAMES_KEY) ?? '{}') as Record<string, string>;
    return names[id] ?? 'votre gare';
  } catch {
    return 'votre gare';
  }
}
