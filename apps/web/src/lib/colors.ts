export type RGBA = [number, number, number, number];

/** « FFBE00 » ou « #FFBE00 » → [255, 190, 0, alpha]. */
export function hexToRgba(hex: string, alpha = 255): RGBA {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [136, 136, 136, alpha];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    alpha,
  ];
}

/** Contour d'un train selon son retard (secondes) ; gris si horaires théoriques. */
export function delayOutline(delay: number, theoretical: boolean): RGBA {
  if (theoretical) return [140, 140, 140, 255];
  if (delay >= 300) return [230, 57, 70, 255];
  if (delay >= 120) return [244, 162, 97, 255];
  return [255, 255, 255, 255];
}
