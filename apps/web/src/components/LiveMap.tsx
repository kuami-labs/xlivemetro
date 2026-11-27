'use client';

import type { PickingInfo } from '@deck.gl/core';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map as MapLibre, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Line, type Mode } from '@/lib/api';
import { delayOutline, hexToRgba, type RGBA } from '@/lib/colors';
import { ATTRIBUTION, API_URL, INITIAL_VIEW, MAP_STYLE_URL, REALTIME_URL } from '@/lib/config';
import { loadFavorites, type Favorite } from '@/lib/favorites';
import type { WorkerIn, WorkerOut } from '@/lib/realtime.worker';
import { THEORETICAL, interpolate, type VehicleFrame } from '@/lib/vehicles';
import ModeFilter from './ModeFilter';
import SearchBox from './SearchBox';
import StationPanel from './StationPanel';
import VehiclePanel from './VehiclePanel';

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
 * Carte 3D : fond MapLibre (bâtiments extrudés) + couches deck.gl en surcouche.
 * Les positions sont interpolées à chaque image hors de React (docs/04-FRONTEND.md) ;
 * React ne gère que les panneaux, la recherche et les filtres.
 */
export default function LiveMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const linesRef = useRef<Line[]>([]);
  const modesRef = useRef<Set<Mode>>(new Set(ALL_MODES));
  const selectionRef = useRef<Selection>(null);
  const subscribeRef = useRef<() => void>(() => {});
  const rebuildRef = useRef<() => void>(() => {});

  const [status, setStatus] = useState<Status>({
    connected: false,
    vehicles: 0,
    dataAgeS: null,
    source: '',
  });
  // Composant rendu seulement dans le navigateur (ssr: false) : l'URL est lisible dès le rendu
  const [selection, setSelection] = useState<Selection>(() =>
    initialSelection(new URLSearchParams(window.location.search)),
  );
  const [modes, setModes] = useState<Set<Mode>>(() => {
    const m = urlModes(new URLSearchParams(window.location.search));
    return new Set(m.length ? m : ALL_MODES);
  });
  const [favorites, setFavorites] = useState<Favorite[]>(() => loadFavorites());

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

    const map = new MapLibre({
      container: container.current,
      style: MAP_STYLE_URL,
      center: [num('lng', INITIAL_VIEW.lng), num('lat', INITIAL_VIEW.lat)],
      zoom: num('zoom', INITIAL_VIEW.zoom),
      pitch: num('pitch', INITIAL_VIEW.pitch),
      bearing: num('bearing', INITIAL_VIEW.bearing),
      maxPitch: 70,
      attributionControl: { customAttribution: ATTRIBUTION },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');

    // Surcouche (canvas deck.gl au-dessus de la carte) : le mode entrelacé de deck.gl 9.4
    // est incompatible avec MapLibre 6 (ADR 0003)
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay);

    let lineColors = new Map<string, RGBA>();
    let linesGeo: { features: LineFeature[] } | null = null;
    let stations: StationFeature[] = [];
    let staticLayers: (GeoJsonLayer | ScatterplotLayer)[] = [];
    let frame: VehicleFrame | null = null;
    let positions = new Float32Array(0);
    let fill = new Uint8Array(0);
    let outline = new Uint8Array(0);
    let raf = 0;
    let lastFollow = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    map.on('load', () => {
      // Bâtiments en 3D (tuiles OpenMapTiles du style)
      if (!map.getLayer('building-3d') && map.getSource('openmaptiles')) {
        map.addLayer({
          id: 'building-3d',
          type: 'fill-extrusion',
          source: 'openmaptiles',
          'source-layer': 'building',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#2a2d34',
            'fill-extrusion-height': ['get', 'render_height'],
            'fill-extrusion-base': ['get', 'render_min_height'],
            'fill-extrusion-opacity': 0.85,
          },
        });
      }
    });

    function rebuild() {
      if (!linesGeo) return;
      const visible = modesRef.current;
      staticLayers = [
        new GeoJsonLayer({
          id: 'lignes',
          // Features GeoJSON de /lines.geojson (typage deck.gl plus large que le nôtre)
          data: linesGeo.features.filter((f) => visible.has(f.properties.mode)) as never,
          getLineColor: (f: LineFeature) => hexToRgba(f.properties.color),
          getLineWidth: 4,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 2,
        }),
        new ScatterplotLayer<StationFeature>({
          id: 'gares',
          data: stations,
          getPosition: (f) => f.geometry.coordinates,
          getRadius: 5,
          radiusUnits: 'pixels',
          getFillColor: [20, 20, 24, 255],
          getLineColor: [235, 235, 235, 255],
          lineWidthMinPixels: 1.5,
          stroked: true,
          pickable: true,
        }),
      ];
    }
    rebuildRef.current = rebuild;

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
      linesGeo = lg;
      stations = sg.features;
      rebuild();
      recolor();
      subscribe();
    });

    // Couleurs par train : recalculées seulement quand un message arrive
    function recolor() {
      if (!frame) return;
      const n = frame.ids.length;
      fill = new Uint8Array(n * 4);
      outline = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) {
        fill.set(lineColors.get(frame.routeIds[i]) ?? [136, 136, 136, 255], i * 4);
        outline.set(delayOutline(frame.delays[i], (frame.flags[i] & THEORETICAL) !== 0), i * 4);
      }
    }

    function render(t: number) {
      if (frame) {
        interpolate(frame, reduceMotion ? frame.receivedAt : performance.now(), positions);
        const n = frame.ids.length;
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
        overlay.setProps({
          layers: [
            ...staticLayers,
            new ScatterplotLayer({
              id: 'trains',
              data: {
                length: n,
                attributes: {
                  getPosition: { value: positions, size: 2 },
                  getFillColor: { value: fill, size: 4, normalized: true },
                  getLineColor: { value: outline, size: 4, normalized: true },
                },
              },
              getRadius: 6,
              radiusUnits: 'pixels',
              radiusMinPixels: 3,
              stroked: true,
              lineWidthMinPixels: 2,
              pickable: true,
              updateTriggers: { getPosition: t },
            }),
          ],
        });
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
        } else if (info.layer?.id === 'trains' && frame && info.index >= 0) {
          select({ kind: 'vehicle', id: frame.ids[info.index] });
        }
        syncUrl();
      },
      getCursor: ({ isHovering }) => (isHovering ? 'pointer' : 'grab'),
    });

    const worker = new Worker(new URL('../lib/realtime.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
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

  const close = () => {
    select(null);
    syncUrl();
  };

  return (
    <div className="relative h-dvh w-full">
      {/* h-full plutôt que absolute : le CSS de MapLibre impose position: relative */}
      <div ref={container} className="h-full w-full" aria-label="Carte du réseau" />
      <SearchBox favorites={favorites} onSelect={goToStation} />
      <ModeFilter modes={modes} onChange={changeModes} />
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
      <div
        role="status"
        className="absolute bottom-8 left-3 rounded bg-black/70 px-3 py-2 text-xs text-white"
      >
        {status.connected ? `${status.vehicles} trains` : 'Connexion au temps réel…'}
        {status.source && ` · source ${status.source}`}
        {status.dataAgeS !== null && ` · données d'il y a ${status.dataAgeS} s`}
        {' · positions estimées'}
      </div>
    </div>
  );
}
