/** « dans 3 min », « à quai », « 14:05 » au-delà d'une heure. */
export function waitLabel(iso: string, now: number): string {
  const s = Math.round((Date.parse(iso) - now) / 1000);
  if (s < 30) return 'à quai';
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** « à l'heure », « +2 min », « +45 s ». */
export function delayLabel(seconds: number, theoretical: boolean): string {
  if (theoretical) return 'horaire théorique';
  if (seconds < 30) return "à l'heure";
  if (seconds < 120) return `+${seconds} s`;
  return `+${Math.round(seconds / 60)} min`;
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
