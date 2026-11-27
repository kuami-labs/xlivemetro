/**
 * Gares proches de la position du visiteur, calculées DANS le navigateur : la position
 * n'est jamais envoyée au serveur (PRD, « Confidentialité de la position »).
 */

export interface StationPoint {
  id: string;
  name: string;
  lon: number;
  lat: number;
  lines: string[]; // noms courts
}

export interface NearbyStation extends StationPoint {
  distanceM: number;
  walkMin: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
/** Détour moyen des rues par rapport au vol d'oiseau. */
export const DETOUR = 1.3;
/** Vitesse de marche : 5 km/h. */
export const WALK_M_PER_MIN = 5000 / 60;
export const MAX_DISTANCE_M = 1500;
export const MAX_RESULTS = 5;

/** Distance orthodromique en mètres (haversine). */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Temps de marche estimé (minutes, arrondi au supérieur, 1 au moins). */
export function walkMinutes(distance: number): number {
  return Math.max(1, Math.ceil((distance * DETOUR) / WALK_M_PER_MIN));
}

/** Les gares les plus proches, à moins de 1,5 km à vol d'oiseau, de la plus proche à la plus lointaine. */
export function nearbyStations(
  stations: StationPoint[],
  lat: number,
  lon: number,
  max = MAX_RESULTS,
  radius = MAX_DISTANCE_M,
): NearbyStation[] {
  return stations
    .map((s) => ({ ...s, distanceM: distanceM(lat, lon, s.lat, s.lon) }))
    .filter((s) => s.distanceM <= radius)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, max)
    .map((s) => ({ ...s, walkMin: walkMinutes(s.distanceM) }));
}

/** Message lisible pour une erreur de géolocalisation du navigateur. */
export function geolocationMessage(code: number): string {
  switch (code) {
    case 1:
      return 'Position refusée. Vous pouvez chercher une gare à la place.';
    case 2:
      return 'Position indisponible pour le moment.';
    case 3:
      return 'La position met trop de temps à arriver. Réessayez.';
    default:
      return 'Géolocalisation impossible sur cet appareil.';
  }
}
