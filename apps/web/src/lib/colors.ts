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
