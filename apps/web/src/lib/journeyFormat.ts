import type { Journey } from './api';

/** « 14:05 → 14:32 · 27 min · 1 correspondance » */
export function journeySummary(j: Journey): string {
  const t = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const transfers =
    j.transfers === 0 ? 'direct' : `${j.transfers} correspondance${j.transfers > 1 ? 's' : ''}`;
  return `${t(j.depart)} → ${t(j.arrive)} · ${j.durationMin} min · ${transfers}`;
}

/** Premier tronçon à bord d'un train (pour « Je prends ce train »). */
export function firstRide(j: Journey) {
  return j.legs.find((l) => !l.walk && l.tripId) ?? null;
}

/** Emprise de l'itinéraire [ouest, sud, est, nord], pour cadrer la carte. */
export function journeyBounds(j: Journey): [number, number, number, number] | null {
  const pts = j.legs.flatMap((l) => l.path);
  if (pts.length === 0) return null;
  let [w, s, e, n] = [pts[0][0], pts[0][1], pts[0][0], pts[0][1]];
  for (const [lon, lat] of pts) {
    w = Math.min(w, lon);
    e = Math.max(e, lon);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [w, s, e, n];
}
