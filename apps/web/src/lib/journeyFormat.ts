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

export type JourneyTag = 'fastest' | 'fewestTransfers' | 'leastWalk' | 'cheapest' | 'longest';

export const TAG_LABELS: Record<JourneyTag, string> = {
  fastest: 'Le plus rapide',
  fewestTransfers: 'Moins de correspondances',
  leastWalk: 'Moins de marche',
  cheapest: 'Le moins cher',
  longest: 'Le plus long',
};

/**
 * Labels de chaque option, relatifs aux autres. Un label n'apparaît que si le critère varie
 * entre les options ; en cas d'égalité, il va à la première option de la liste (la plus tôt).
 */
export function journeyTags(js: Journey[]): JourneyTag[][] {
  const tags: JourneyTag[][] = js.map(() => []);
  if (js.length === 0) return tags;
  const pick = (values: number[], tag: JourneyTag, best: 'min' | 'max') => {
    if (new Set(values).size < 2) return;
    const target = best === 'min' ? Math.min(...values) : Math.max(...values);
    tags[values.indexOf(target)].push(tag);
  };
  const arrive = js.map((j) => Date.parse(j.arrive));
  tags[arrive.indexOf(Math.min(...arrive))].push('fastest');
  if (js.length < 2) return tags;
  pick(
    js.map((j) => j.transfers),
    'fewestTransfers',
    'min',
  );
  pick(
    js.map((j) => j.walkMin),
    'leastWalk',
    'min',
  );
  pick(
    js.map((j) => j.fare.amount),
    'cheapest',
    'min',
  );
  pick(
    js.map((j) => j.durationMin),
    'longest',
    'max',
  );
  return tags;
}

/** « +12 min » par rapport au plus rapide (rien pour le plus rapide). */
export function extraMinutes(j: Journey, js: Journey[]): string {
  const best = Math.min(...js.map((x) => Date.parse(x.arrive)));
  const extra = Math.round((Date.parse(j.arrive) - best) / 60_000);
  return extra > 0 ? `+${extra} min` : '';
}

/** « 2,55 € » */
export function fareLabel(amount: number): string {
  return amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}
