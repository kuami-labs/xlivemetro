'use client';

import { MapboxOverlay } from '@deck.gl/mapbox';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map as MapLibre, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { delayOutline, hexToRgba, type RGBA } from '@/lib/colors';
import { API_URL, ATTRIBUTION, INITIAL_VIEW, MAP_STYLE_URL, REALTIME_URL } from '@/lib/config';
import type { WorkerIn, WorkerOut } from '@/lib/realtime.worker';
import { THEORETICAL, interpolate, type VehicleFrame } from '@/lib/vehicles';

// MapLibre 6 charge son worker à part : on laisse le bundler fournir son adresse
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());

interface Line {
  id: string;
  shortName: string;
  color: string;
}

interface Status {
  connected: boolean;
  vehicles: number;
  dataAgeS: number | null;
  source: string;
}

/**
 * Carte 3D : fond MapLibre (bâtiments extrudés) + couches deck.gl en surcouche.
 * Les positions sont interpolées à chaque image hors de React (docs/04-FRONTEND.md).
 */
export default function LiveMap() {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({
    connected: false,
    vehicles: 0,
    dataAgeS: null,
    source: '',
  });

  useEffect(() => {
    if (!container.current) return;
    const params = new URLSearchParams(window.location.search);
    const num = (k: string, d: number) => {
      const v = Number(params.get(k));
      return params.has(k) && Number.isFinite(v) ? v : d;
    };
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
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');

    // Surcouche (canvas deck.gl au-dessus de la carte) : le mode entrelacé de deck.gl 9.4
    // est incompatible avec MapLibre 6 (ADR 0003)
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay);

    let lineColors = new Map<string, RGBA>();
    let staticLayers: (GeoJsonLayer | ScatterplotLayer)[] = [];
    let frame: VehicleFrame | null = null;
    let positions = new Float32Array(0);
    let fill = new Uint8Array(0);
    let outline = new Uint8Array(0);
    let raf = 0;
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

    void Promise.all([
      fetch(`${API_URL}/lines`).then((r) => r.json() as Promise<Line[]>),
      fetch(`${API_URL}/lines.geojson`).then((r) => r.json()),
      fetch(`${API_URL}/stations.geojson`).then((r) => r.json()),
    ]).then(([lines, linesGeo, stationsGeo]) => {
      lineColors = new Map(lines.map((l) => [l.id, hexToRgba(l.color)]));
      staticLayers = [
        new GeoJsonLayer({
          id: 'lignes',
          data: linesGeo,
          getLineColor: (f: { properties: { color: string } }) => hexToRgba(f.properties.color),
          getLineWidth: 4,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 2,
        }),
        new ScatterplotLayer({
          id: 'gares',
          data: stationsGeo.features,
          getPosition: (f: { geometry: { coordinates: [number, number] } }) =>
            f.geometry.coordinates,
          getRadius: 4,
          radiusUnits: 'pixels',
          getFillColor: [20, 20, 24, 255],
          getLineColor: [235, 235, 235, 255],
          lineWidthMinPixels: 1.5,
          stroked: true,
          pickable: true,
        }),
      ];
      recolor();
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

    function render() {
      if (frame) {
        interpolate(frame, reduceMotion ? frame.receivedAt : performance.now(), positions);
        const n = frame.ids.length;
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
              updateTriggers: { getPosition: performance.now() },
            }),
          ],
        });
      }
      raf = requestAnimationFrame(render);
    }
    map.once('load', () => {
      raf = requestAnimationFrame(render);
    });

    const worker = new Worker(new URL('../lib/realtime.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      if (e.data.type === 'status') {
        setStatus((s) => ({ ...s, connected: e.data.type === 'status' && e.data.connected }));
        return;
      }
      // Le worker horodate avec son propre performance.now() : on se recale sur le nôtre
      frame = { ...e.data.frame, receivedAt: performance.now() };
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

    // Abonnement à la zone visible (marge de 20 %), après chaque déplacement
    const subscribe = () => {
      const b = map.getBounds();
      const dx = (b.getEast() - b.getWest()) * 0.2;
      const dy = (b.getNorth() - b.getSouth()) * 0.2;
      worker.postMessage({
        type: 'subscribe',
        bbox: [b.getWest() - dx, b.getSouth() - dy, b.getEast() + dx, b.getNorth() + dy],
      } satisfies WorkerIn);
    };
    map.on('moveend', subscribe);
    map.once('load', subscribe);

    return () => {
      cancelAnimationFrame(raf);
      worker.terminate();
      map.remove();
    };
  }, []);

  return (
    <div className="relative h-dvh w-full">
      {/* h-full plutôt que absolute : le CSS de MapLibre impose position: relative */}
      <div ref={container} className="h-full w-full" aria-label="Carte du réseau" />
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
