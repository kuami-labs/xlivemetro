/**
 * Liens profonds vers la carte (paramètres d'URL de docs/04-FRONTEND.md). Le lien pointe
 * toujours vers l'instance configurée, jamais vers une adresse issue des données.
 */
export function mapLink(
  webUrl: string,
  target:
    | { stop: string; lat?: number; lon?: number }
    | { follow: string }
    | { mode: string; lat: number; lon: number },
): string {
  const p = new URLSearchParams();
  if ('stop' in target) {
    p.set('stop', target.stop);
    if (target.lat !== undefined && target.lon !== undefined) {
      p.set('lat', target.lat.toFixed(5));
      p.set('lng', target.lon.toFixed(5));
      p.set('zoom', '15');
      p.set('pitch', '55');
    }
  } else if ('follow' in target) {
    p.set('follow', target.follow);
    p.set('zoom', '15');
  } else {
    p.set('mode', target.mode);
    p.set('lat', target.lat.toFixed(5));
    p.set('lng', target.lon.toFixed(5));
    p.set('zoom', '12');
  }
  return `${webUrl.replace(/\/$/, '')}/?${p}`;
}
