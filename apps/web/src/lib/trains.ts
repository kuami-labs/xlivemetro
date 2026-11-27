import type { Mode } from './api';
import type { RGBA } from './colors';

/** Épaisseur de l'anneau de retard (px) : l'information ne repose pas sur la couleur seule. */
export function ringWidth(delaySeconds: number, theoretical: boolean): number {
  if (theoretical) return 2;
  if (delaySeconds >= 300) return 5;
  if (delaySeconds >= 120) return 3.5;
  return 2;
}

/** Couleur du halo au sol en 3D, selon le retard (thème : couleurs warn/alert). */
export function haloColor(
  delaySeconds: number,
  theoretical: boolean,
  theme: { warn: RGBA; alert: RGBA; neutral: RGBA; muted: RGBA },
): RGBA {
  if (theoretical) return theme.muted;
  if (delaySeconds >= 300) return theme.alert;
  if (delaySeconds >= 120) return theme.warn;
  return theme.neutral;
}

/**
 * Dimensions affichées d'une rame en mètres [longueur, largeur, hauteur] : longueur réelle
 * approchée, largeur et hauteur doublées pour rester lisibles vues de haut.
 */
export const RAME: Record<Mode, [number, number, number]> = {
  metro: [80, 5.2, 6.8],
  rer: [110, 6, 8.6],
  tram: [40, 4.8, 6.6],
};

/**
 * Matrice 4×4 (ordre colonnes, comme deck.gl) qui place un cube unité (−1…1) en rame :
 * échelle (demi-dimensions), rotation autour de la verticale pour suivre le cap
 * (0 = nord, sens horaire), puis élévation de la demi-hauteur pour la poser au sol.
 */
export function rameMatrix(bearing: number, [l, w, h]: [number, number, number]): number[] {
  const theta = ((90 - bearing) * Math.PI) / 180; // angle depuis l'est, sens trigonométrique
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const sx = l / 2;
  const sy = w / 2;
  const sz = h / 2;
  return [c * sx, s * sx, 0, 0, -s * sy, c * sy, 0, 0, 0, 0, sz, 0, 0, 0, sz, 1];
}

const METERS_PER_DEGREE = 111_320;

/** Point situé `meters` derrière (lon, lat) selon le cap : fin du sillage. */
export function behind(
  lon: number,
  lat: number,
  bearing: number,
  meters: number,
): [number, number] {
  const b = (bearing * Math.PI) / 180;
  return [
    lon - (meters * Math.sin(b)) / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180)),
    lat - (meters * Math.cos(b)) / METERS_PER_DEGREE,
  ];
}

/** Longueur du sillage : 30 s de parcours, bornée (à quai : aucun). */
export function trailMeters(speed: number): number {
  return Math.min(Math.max(speed, 0) * 30, 300);
}

/** Les rames 3D ne s'affichent qu'à partir de ce zoom ; pastilles au-delà (DESIGN.md). */
export const MESH_MIN_ZOOM = 15;

/** Taille des flèches (px) selon le zoom : 12 px en vue d’ensemble, 28 px au zoom 15, 30 au plus. */
export function arrowSize(zoom: number): number {
  return Math.round(Math.min(30, Math.max(12, 28 * 2 ** (zoom - 15))));
}
