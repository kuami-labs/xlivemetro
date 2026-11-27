import type { RGBA } from './colors';
import { MAP_STYLE_URL, MAP_STYLE_URL_LIGHT } from './config';
import type { Theme } from './representation';

/** Réglages de la carte par thème (DESIGN.md, ambiance « salle de contrôle »). */
export interface MapTheme {
  style: string;
  sky: Record<string, string | number>;
  light: { color: string; intensity: number };
  buildings: [string, string, string]; // bas, moyen, haut
  lineHaloOpacity: number;
  station: { fill: RGBA; line: RGBA };
  ring: { onTime: RGBA; warn: RGBA; alert: RGBA; theoretical: RGBA };
  halo: { neutral: RGBA; warn: RGBA; alert: RGBA; muted: RGBA };
}

export const MAP_THEMES: Record<Theme, MapTheme> = {
  dark: {
    style: MAP_STYLE_URL,
    sky: {
      'sky-color': '#05070A',
      'horizon-color': '#12304A',
      'fog-color': '#0B0F14',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.35,
      'atmosphere-blend': 0,
    },
    light: { color: '#B8CCE8', intensity: 0.3 },
    buildings: ['#151A22', '#1D2430', '#2A3443'],
    lineHaloOpacity: 0.28,
    station: { fill: [11, 15, 20, 255], line: [230, 237, 245, 255] },
    ring: {
      onTime: [255, 255, 255, 255],
      warn: [245, 165, 36, 255],
      alert: [240, 80, 110, 255],
      theoretical: [139, 152, 169, 255],
    },
    halo: {
      neutral: [255, 255, 255, 70],
      warn: [245, 165, 36, 150],
      alert: [240, 80, 110, 160],
      muted: [139, 152, 169, 110],
    },
  },
  light: {
    style: MAP_STYLE_URL_LIGHT,
    sky: {
      'sky-color': '#DCE6F0',
      'horizon-color': '#F4F6F9',
      'fog-color': '#F4F6F9',
      'sky-horizon-blend': 0.5,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.3,
      'atmosphere-blend': 0,
    },
    light: { color: '#FFFFFF', intensity: 0.4 },
    buildings: ['#E3E8EE', '#D5DCE5', '#C4CDD8'],
    lineHaloOpacity: 0.18,
    station: { fill: [255, 255, 255, 255], line: [14, 22, 33, 255] },
    ring: {
      onTime: [14, 22, 33, 255],
      warn: [180, 83, 9, 255],
      alert: [190, 18, 60, 255],
      theoretical: [83, 97, 115, 255],
    },
    halo: {
      neutral: [14, 22, 33, 50],
      warn: [180, 83, 9, 120],
      alert: [190, 18, 60, 130],
      muted: [83, 97, 115, 90],
    },
  },
};
