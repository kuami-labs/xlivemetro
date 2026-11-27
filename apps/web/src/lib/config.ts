export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? 'ws://localhost:4100/ws';
export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/dark';
export const MAP_STYLE_URL_LIGHT =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL_LIGHT ?? 'https://tiles.openfreemap.org/styles/positron';

/** Vue initiale : Paris, inclinée pour voir les bâtiments en 3D. */
export const INITIAL_VIEW = { lng: 2.3488, lat: 48.8534, zoom: 12.5, pitch: 55, bearing: -20 };

export const ATTRIBUTION =
  'Données transport : <a href="https://data.iledefrance-mobilites.fr" target="_blank" rel="noopener">Île-de-France Mobilités</a> (Licence Mobilités) · Positions estimées';
