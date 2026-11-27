'use client';

import type { Layer, PickingInfo } from '@deck.gl/core';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { IconLayer, LineLayer, ScatterplotLayer } from '@deck.gl/layers';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { CubeGeometry } from '@luma.gl/engine';
import { Map as MapLibre, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Line, type Mode } from '@/lib/api';
import { hexToRgba, type RGBA } from '@/lib/colors';
import { ATTRIBUTION, API_URL, INITIAL_VIEW, REALTIME_URL } from '@/lib/config';
import { loadFavorites, type Favorite } from '@/lib/favorites';
import { MAP_THEMES } from '@/lib/mapTheme';
import type { WorkerIn, WorkerOut } from '@/lib/realtime.worker';
import {
  loadRepresentation,
  loadTheme,
  saveRepresentation,
  saveTheme,
  type Representation,
  type Theme,
} from '@/lib/representation';
import {
  MESH_MIN_ZOOM,
  RAME,
  behind,
  haloColor,
  arrowSize,
  ringWidth,
  rameMatrix,
  trailMeters,
} from '@/lib/trains';
import { AT_STOP, THEORETICAL, interpolate, type VehicleFrame } from '@/lib/vehicles';
import IconButton from './IconButton';
import Legend from './Legend';
import ModeFilter from './ModeFilter';
import RepresentationPicker from './RepresentationPicker';
import SearchBox from './SearchBox';
import StationPanel from './StationPanel';
import StatusBar from './StatusBar';
import VehiclePanel from './VehiclePanel';
import ViewControls from './ViewControls';

// MapLibre 6 charge son worker à part : on laisse le bundler fournir son adresse
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());

type Selection = { kind: 'station' | 'vehicle'; id: string } | null;

interface Status {
  connected: boolean;
  vehicles: number;
  dataAgeS: number | null;
  source: string;
}

interface StationFeature {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: { id: string; name: string };
}

interface LineFeature {
  properties: { id: string; color: string; mode: Mode };
}

const ALL_MODES: Mode[] = ['metro', 'rer', 'tram'];

// Un identifiant par représentation : deck.gl ne doit pas réutiliser l'état d'un autre type
const TRAIN_LAYERS = new Set(['trains-pastilles', 'trains-fleches', 'trains-3d']);

// Flèche (masque) pour la représentation « flèches » : teintée à la couleur de la ligne
const ARROW_ICON = {
  url:
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 4 L56 58 L32 46 L8 58 Z" fill="white" stroke="black" stroke-width="5" stroke-linejoin="round"/></svg>',
    ),
  width: 64,
  height: 64,
  mask: true,
};

// Une seule géométrie (cube unité) instanciée pour toutes les rames (DESIGN.md)
const RAME_MESH = new CubeGeometry();

function urlModes(params: URLSearchParams): Mode[] {
  return (params.get('mode') ?? '')
    .split(',')
    .filter((m): m is Mode => (ALL_MODES as string[]).includes(m));
}

function initialSelection(params: URLSearchParams): Selection {
  const stop = params.get('stop');
  const follow = params.get('follow');
  if (follow) return { kind: 'vehicle', id: follow };
  if (stop) return { kind: 'station', id: stop };
  return null;
}

/**
 * Carte 3D : fond MapLibre (bâtiments, ciel, lignes) + trains deck.gl en surcouche.
 * Les positions sont interpolées à chaque image hors de React (docs/04-FRONTEND.md) ;
 * React ne gère que les panneaux, la recherche, les filtres et les préférences.
 */
export default function LiveMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const linesRef = useRef<Line[]>([]);
  const modesRef = useRef<Set<Mode>>(new Set(ALL_MODES));
  const selectionRef = useRef<Selection>(null);
  const representationRef = useRef<Representation>('dots');
  const themeRef = useRef<Theme>('dark');
  const subscribeRef = useRef<() => void>(() => {});
  const rebuildRef = useRef<() => void>(() => {});
  const restyleRef = useRef<() => void>(() => {});

  // Composant rendu seulement dans le navigateur (ssr: false) : URL et localStorage lisibles
  const [status, setStatus] = useState<Status>({
    connected: false,
    vehicles: 0,
    dataAgeS: null,
    source: '',
  });
  const [selection, setSelection] = useState<Selection>(() =>
    initialSelection(new URLSearchParams(window.location.search)),
  );
  const [modes, setModes] = useState<Set<Mode>>(() => {
    const m = urlModes(new URLSearchParams(window.location.search));
    return new Set(m.length ? m : ALL_MODES);
  });
  const [favorites, setFavorites] = useState<Favorite[]>(() => loadFavorites());
  const [representation, setRepresentation] = useState<Representation>(() => loadRepresentation());
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [pitch, setPitch] = useState(INITIAL_VIEW.pitch);
  const [zoom, setZoom] = useState(INITIAL_VIEW.zoom);

  const select = useCallback((s: Selection) => {
    selectionRef.current = s;
    setSelection(s);
  }, []);

  // URL partageable : vue, gare ou train suivi (F7, docs/04-FRONTEND.md)
  const syncUrl = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const p = new URLSearchParams({
      lat: c.lat.toFixed(5),
      lng: c.lng.toFixed(5),
      zoom: map.getZoom().toFixed(2),
      pitch: map.getPitch().toFixed(0),
      bearing: map.getBearing().toFixed(0),
    });
    const s = selectionRef.current;
    if (s) p.set(s.kind === 'station' ? 'stop' : 'follow', s.id);
    if (modesRef.current.size < ALL_MODES.length) p.set('mode', [...modesRef.current].join(','));
    window.history.replaceState(null, '', `?${p}`);
  }, []);

  useEffect(() => {
    if (!container.current) return;
    const params = new URLSearchParams(window.location.search);
    const num = (k: string, d: number) => {
      const v = Number(params.get(k));
      return params.has(k) && Number.isFinite(v) ? v : d;
    };
    const m = urlModes(params);
    modesRef.current = new Set(m.length ? m : ALL_MODES);
    selectionRef.current = initialSelection(params);
    representationRef.current = loadRepresentation();
    themeRef.current = loadTheme();

    const map = new MapLibre({
      container: container.current,
      style: MAP_THEMES[themeRef.current].style,
      center: [num('lng', INITIAL_VIEW.lng), num('lat', INITIAL_VIEW.lat)],
      zoom: num('zoom', INITIAL_VIEW.zoom),
      pitch: num('pitch', INITIAL_VIEW.pitch),
      bearing: num('bearing', INITIAL_VIEW.bearing),
      maxPitch: 70,
      attributionControl: { customAttribution: ATTRIBUTION },
    });
    mapRef.current = map;
    setPitch(map.getPitch());
    map.on('pitch', () => setPitch(map.getPitch()));
    setZoom(map.getZoom());
    map.on('zoomend', () => setZoom(map.getZoom()));

    // Surcouche (canvas deck.gl au-dessus de la carte) : le mode entrelacé de deck.gl 9.4
    // est incompatible avec MapLibre 6 (ADR 0003)
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay);

    let lineColors = new Map<string, RGBA>();
    let lineModes = new Map<string, Mode>();
    let linesGeo: { features: LineFeature[] } | null = null;
    let stations: StationFeature[] = [];
    let staticLayers: Layer[] = [];
    let frame: VehicleFrame | null = null;
    let positions = new Float32Array(0);
    let fill = new Uint8Array(0);
    let outline = new Uint8Array(0);
    let widths = new Float32Array(0);
    let raf = 0;
    let lastFollow = 0;
    // isStyleLoaded() reste faux juste après nos propres ajouts : drapeau posé à « style.load »
    let styleReady = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Ciel, lumière, bâtiments et lignes : à refaire après chaque changement de style (thème)
    map.on('style.load', () => {
      const t = MAP_THEMES[themeRef.current];
      map.setSky(t.sky as never);
      map.setLight({
        anchor: 'viewport',
        color: t.light.color,
        intensity: t.light.intensity,
        position: [1.3, 200, 40],
      });
      if (!map.getLayer('building-3d') && map.getSource('openmaptiles')) {
        map.addLayer({
          id: 'building-3d',
          type: 'fill-extrusion',
          source: 'openmaptiles',
          'source-layer': 'building',
          minzoom: 13,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'render_height'],
              0,
              t.buildings[0],
              20,
              t.buildings[1],
              60,
              t.buildings[2],
            ],
            'fill-extrusion-height': ['get', 'render_height'],
            'fill-extrusion-base': ['get', 'render_min_height'],
            'fill-extrusion-vertical-gradient': true,
            'fill-extrusion-opacity': 0.92,
          },
        });
      }
      styleReady = true;
      addLines();
    });

    // Tracés dessinés par MapLibre, au-dessus des bâtiments (le métro est souterrain : sous
    // les bâtiments, il disparaîtrait) : un halo diffus et un trait fin, comme un réseau lumineux
    function addLines() {
      if (!linesGeo || !styleReady || map.getSource('lignes')) return;
      map.addSource('lignes', { type: 'geojson', data: linesGeo as never });
      map.addLayer({
        id: 'lignes-halo',
        type: 'line',
        source: 'lignes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 5, 14, 9, 17, 18],
          'line-blur': ['interpolate', ['linear'], ['zoom'], 10, 4, 17, 14],
          'line-opacity': MAP_THEMES[themeRef.current].lineHaloOpacity,
        },
      });
      map.addLayer({
        id: 'lignes',
        type: 'line',
        source: 'lignes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 1.2, 14, 2.2, 17, 4],
        },
      });
      filterLines();
    }

    function filterLines() {
      const filter = ['in', ['get', 'mode'], ['literal', [...modesRef.current]]];
      for (const id of ['lignes-halo', 'lignes']) {
        if (map.getLayer(id)) map.setFilter(id, filter as never);
      }
    }

    function rebuild() {
      if (!linesGeo) return;
      filterLines();
      const t = MAP_THEMES[themeRef.current];
      staticLayers = [
        new ScatterplotLayer<StationFeature>({
          id: 'gares',
          data: stations,
          getPosition: (f) => f.geometry.coordinates,
          getRadius: 5,
          radiusUnits: 'pixels',
          getFillColor: t.station.fill,
          getLineColor: t.station.line,
          lineWidthMinPixels: 1.5,
          stroked: true,
          pickable: true,
          updateTriggers: { getFillColor: themeRef.current, getLineColor: themeRef.current },
        }),
      ];
    }
    rebuildRef.current = rebuild;

    restyleRef.current = () => {
      styleReady = false;
      map.setStyle(MAP_THEMES[themeRef.current].style);
      rebuild();
      recolor();
    };

    void Promise.all([
      api.lines(),
      fetch(`${API_URL}/lines.geojson`).then(
        (r) => r.json() as Promise<{ features: LineFeature[] }>,
      ),
      fetch(`${API_URL}/stations.geojson`).then(
        (r) => r.json() as Promise<{ features: StationFeature[] }>,
      ),
    ]).then(([lines, lg, sg]) => {
      linesRef.current = lines;
      lineColors = new Map(lines.map((l) => [l.id, hexToRgba(l.color)]));
      lineModes = new Map(lines.map((l) => [l.id, l.mode]));
      linesGeo = lg;
      stations = sg.features;
      addLines();
      rebuild();
      recolor();
      subscribe();
    });

    // Couleurs et épaisseurs par train : recalculées seulement quand un message arrive
    function recolor() {
      if (!frame) return;
      const ring = MAP_THEMES[themeRef.current].ring;
      const n = frame.ids.length;
      fill = new Uint8Array(n * 4);
      outline = new Uint8Array(n * 4);
      widths = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const theoretical = (frame.flags[i] & THEORETICAL) !== 0;
        const d = frame.delays[i];
        fill.set(lineColors.get(frame.routeIds[i]) ?? [136, 136, 136, 255], i * 4);
        outline.set(
          theoretical
            ? ring.theoretical
            : d >= 300
              ? ring.alert
              : d >= 120
                ? ring.warn
                : ring.onTime,
          i * 4,
        );
        widths[i] = ringWidth(d, theoretical);
      }
    }

    // Couches des trains selon la représentation choisie
    function trainLayers(f: VehicleFrame, t: number): Layer[] {
      const n = f.ids.length;
      const rep = representationRef.current;
      const color = (i: number): RGBA => [fill[i * 4], fill[i * 4 + 1], fill[i * 4 + 2], 255];
      const pos = (i: number): [number, number] => [positions[i * 2], positions[i * 2 + 1]];
      const idx = { length: n };
      const trigger = { getPosition: t, getSourcePosition: t, getTargetPosition: t };

      if (rep === '3d' && map.getZoom() >= MESH_MIN_ZOOM) {
        const halo = MAP_THEMES[themeRef.current].halo;
        const mode = (i: number) => lineModes.get(f.routeIds[i]) ?? 'metro';
        // Données = index des trains : getTransformMatrix ne reçoit que l'objet, pas son index
        const rows = Array.from({ length: n }, (_, i) => i);
        return [
          new ScatterplotLayer({
            id: 'trains-halo',
            data: rows,
            getPosition: (index: number) => pos(index),
            getRadius: (index: number) => RAME[mode(index)][0] * 0.32,
            getFillColor: (index: number) =>
              haloColor(f.delays[index], (f.flags[index] & THEORETICAL) !== 0, halo),
            radiusUnits: 'meters',
            updateTriggers: trigger,
          }),
          new SimpleMeshLayer({
            id: 'trains-3d',
            data: rows,
            mesh: RAME_MESH,
            getPosition: (index: number) => pos(index),
            getColor: (index: number) => color(index),
            // Matrice calculée par rame (échelle, cap, pose au sol) : voir rameMatrix
            getTransformMatrix: (index: number) => rameMatrix(f.bearings[index], RAME[mode(index)]),
            pickable: true,
            updateTriggers: { ...trigger, getTransformMatrix: t, getColor: fill },
          }),
        ];
      }

      if (rep === 'arrows') {
        return [
          new IconLayer({
            id: 'trains-fleches',
            data: idx,
            getIcon: () => ARROW_ICON,
            getPosition: (_: unknown, { index }: { index: number }) => pos(index),
            getColor: (_: unknown, { index }: { index: number }) => color(index),
            // deck.gl tourne dans le sens trigonométrique ; le cap est dans le sens horaire
            getAngle: (_: unknown, { index }: { index: number }) => -f.bearings[index],
            // Petites flèches en vue d'ensemble (près de 1 000 trains), plus grandes de près
            getSize: arrowSize(map.getZoom()),
            sizeUnits: 'pixels',
            billboard: false,
            pickable: true,
            updateTriggers: { ...trigger, getAngle: t, getColor: fill },
          }),
        ];
      }

      // Pastilles + sillage (30 s de parcours), anneau de retard d'épaisseur variable
      return [
        new LineLayer({
          id: 'trains-sillage',
          data: idx,
          getSourcePosition: (_: unknown, { index }: { index: number }) => pos(index),
          getTargetPosition: (_: unknown, { index }: { index: number }) =>
            behind(
              positions[index * 2],
              positions[index * 2 + 1],
              f.bearings[index],
              (f.flags[index] & AT_STOP) !== 0 ? 0 : trailMeters(f.speeds[index]),
            ),
          getColor: (_: unknown, { index }: { index: number }) => [
            fill[index * 4],
            fill[index * 4 + 1],
            fill[index * 4 + 2],
            90,
          ],
          getWidth: 5,
          widthUnits: 'pixels',
          updateTriggers: { ...trigger, getColor: fill },
        }),
        new ScatterplotLayer({
          id: 'trains-pastilles',
          data: {
            length: n,
            attributes: {
              getPosition: { value: positions, size: 2 },
              getFillColor: { value: fill, size: 4, normalized: true },
              getLineColor: { value: outline, size: 4, normalized: true },
              getLineWidth: { value: widths, size: 1 },
            },
          },
          getRadius: 6,
          radiusUnits: 'pixels',
          radiusMinPixels: 3,
          stroked: true,
          lineWidthUnits: 'pixels',
          pickable: true,
          updateTriggers: { getPosition: t },
        }),
      ];
    }

    function render(t: number) {
      if (frame) {
        interpolate(frame, reduceMotion ? frame.receivedAt : performance.now(), positions);
        // Caméra qui suit le train sélectionné (deux fois par seconde)
        const sel = selectionRef.current;
        if (sel?.kind === 'vehicle' && t - lastFollow > 500 && !map.isMoving()) {
          const i = frame.ids.indexOf(sel.id);
          if (i >= 0) {
            lastFollow = t;
            map.easeTo({
              center: [positions[i * 2], positions[i * 2 + 1]],
              duration: reduceMotion ? 0 : 500,
              easing: (x) => x,
            });
          }
        }
        overlay.setProps({ layers: [...staticLayers, ...trainLayers(frame, t)] });
      }
      raf = requestAnimationFrame(render);
    }
    map.once('load', () => {
      raf = requestAnimationFrame(render);
    });

    overlay.setProps({
      onClick: (info: PickingInfo) => {
        if (info.layer?.id === 'gares' && info.object) {
          select({ kind: 'station', id: (info.object as StationFeature).properties.id });
        } else if (TRAIN_LAYERS.has(info.layer?.id ?? '') && frame && info.index >= 0) {
          select({ kind: 'vehicle', id: frame.ids[info.index] });
        }
        syncUrl();
      },
      getCursor: ({ isHovering }) => (isHovering ? 'pointer' : 'grab'),
    });

    const worker = new Worker(new URL('../lib/realtime.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const data = e.data;
      if (data.type === 'status') {
        setStatus((s) => ({ ...s, connected: data.connected }));
        return;
      }
      // Le worker horodate avec son propre performance.now() : on se recale sur le nôtre
      frame = { ...data.frame, receivedAt: performance.now() };
      positions = new Float32Array(frame.positions.length);
      recolor();
      const f = frame;
      setStatus((s) => ({
        ...s,
        vehicles: f.ids.length,
        source: f.source,
        dataAgeS: f.dataTime ? Math.max(0, Math.round((f.serverTime - f.dataTime) / 1000)) : null,
      }));
    };
    worker.postMessage({ type: 'connect', url: REALTIME_URL } satisfies WorkerIn);

    // Abonnement à la zone visible (marge de 20 %) et aux lignes des modes affichés
    function subscribe() {
      const b = map.getBounds();
      const dx = (b.getEast() - b.getWest()) * 0.2;
      const dy = (b.getNorth() - b.getSouth()) * 0.2;
      const all = modesRef.current.size === ALL_MODES.length;
      worker.postMessage({
        type: 'subscribe',
        bbox: [b.getWest() - dx, b.getSouth() - dy, b.getEast() + dx, b.getNorth() + dy],
        routeIds: all
          ? []
          : linesRef.current.filter((l) => modesRef.current.has(l.mode)).map((l) => l.id),
      } satisfies WorkerIn);
    }
    subscribeRef.current = subscribe;
    map.on('moveend', () => {
      subscribe();
      syncUrl();
    });
    map.once('load', subscribe);

    return () => {
      cancelAnimationFrame(raf);
      worker.terminate();
      map.remove();
      mapRef.current = null;
    };
  }, [select, syncUrl]);

  // Gare choisie dans la recherche ou une fiche : on y va
  const goToStation = useCallback(
    (id: string) => {
      select({ kind: 'station', id });
      syncUrl();
      api.station(id).then(
        (s) => {
          mapRef.current?.flyTo({
            center: [s.lon, s.lat],
            zoom: Math.max(mapRef.current.getZoom(), 14),
          });
        },
        () => {}, // gare introuvable : la fiche affiche déjà l'erreur
      );
    },
    [select, syncUrl],
  );

  const changeModes = (next: Set<Mode>) => {
    modesRef.current = next;
    setModes(next);
    rebuildRef.current();
    subscribeRef.current();
    syncUrl();
  };

  const changeRepresentation = (r: Representation) => {
    representationRef.current = r;
    setRepresentation(r);
    saveRepresentation(r);
    // Les rames 3D se voient de près : on s'approche et on incline si besoin
    const map = mapRef.current;
    if (r === '3d' && map && (map.getZoom() < MESH_MIN_ZOOM || map.getPitch() < 40)) {
      map.easeTo({
        zoom: Math.max(map.getZoom(), MESH_MIN_ZOOM + 0.5),
        pitch: Math.max(map.getPitch(), 60),
      });
    }
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    themeRef.current = next;
    setTheme(next);
    saveTheme(next);
    document.documentElement.dataset.theme = next;
    restyleRef.current();
  };

  const close = () => {
    select(null);
    syncUrl();
  };

  const statusText = status.connected
    ? `${status.vehicles} trains${status.dataAgeS !== null ? ` · données il y a ${status.dataAgeS} s` : ''} · positions estimées`
    : 'Connexion au temps réel…';

  return (
    <div className="relative h-dvh w-full bg-bg">
      {/* h-full plutôt que absolute : le CSS de MapLibre impose position: relative */}
      <div ref={container} className="h-full w-full" aria-label="Carte du réseau" />

      <div className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-start gap-2 sm:inset-x-5 sm:top-5 sm:gap-3">
        <SearchBox favorites={favorites} onSelect={goToStation} />
        <div className="hidden sm:block">
          <ModeFilter modes={modes} onChange={changeModes} />
        </div>
        <div className="hidden md:block">
          <RepresentationPicker value={representation} onChange={changeRepresentation} />
        </div>
        <div className="flex-1" />
        <div className="hidden rounded-xl border border-border bg-overlay backdrop-blur sm:block">
          <IconButton
            label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M10 1 V3 M10 17 V19 M1 10 H3 M17 10 H19 M3.6 3.6 L5 5 M15 15 L16.4 16.4 M3.6 16.4 L5 15 M15 5 L16.4 3.6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M15 12.5 A7 7 0 0 1 7.5 5 A6 6 0 1 0 15 12.5 Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </IconButton>
        </div>
      </div>

      <ViewControls
        pitch={pitch}
        onPitch={(p) => mapRef.current?.easeTo({ pitch: p })}
        onZoom={(d) => (d > 0 ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut())}
        onNorth={() => mapRef.current?.easeTo({ bearing: 0 })}
      />

      {selection?.kind === 'station' && (
        <StationPanel
          key={selection.id}
          id={selection.id}
          onClose={close}
          onFavoritesChange={() => setFavorites(loadFavorites())}
        />
      )}
      {selection?.kind === 'vehicle' && (
        <VehiclePanel
          key={selection.id}
          id={selection.id}
          onClose={close}
          onStation={goToStation}
        />
      )}

      <Legend halo={representation === '3d' && zoom >= MESH_MIN_ZOOM} />
      <StatusBar connected={status.connected} text={statusText} />
    </div>
  );
}
