'use client';

import IconButton from './IconButton';

/** Zoom, nord, inclinaison et bascule 2D/3D (planche « Carte 3D »). */
export default function ViewControls({
  pitch,
  onPitch,
  onZoom,
  onNorth,
}: {
  pitch: number;
  onPitch: (p: number) => void;
  onZoom: (delta: number) => void;
  onNorth: () => void;
}) {
  return (
    <div className="absolute top-[88px] right-5 z-10 hidden flex-col items-end gap-2 sm:flex">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-overlay backdrop-blur">
        <IconButton label="Zoomer" onClick={() => onZoom(1)}>
          <span className="text-xl leading-none">+</span>
        </IconButton>
        <IconButton label="Dézoomer" onClick={() => onZoom(-1)}>
          <span className="text-xl leading-none">−</span>
        </IconButton>
        <IconButton label="Réorienter vers le nord" onClick={onNorth}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 2 L14 10 L10 8.5 L6 10 Z" fill="var(--accent)" />
            <path d="M10 18 L6 10 L10 11.5 L14 10 Z" fill="var(--muted)" />
          </svg>
        </IconButton>
      </div>
      <div className="flex w-[200px] flex-col gap-2 rounded-xl border border-border bg-overlay p-3 backdrop-blur">
        <label htmlFor="inclinaison" className="flex justify-between text-xs text-muted">
          <span>Inclinaison</span>
          <span className="font-mono text-text">{Math.round(pitch)}°</span>
        </label>
        <input
          id="inclinaison"
          type="range"
          min={0}
          max={70}
          value={Math.round(pitch)}
          onChange={(e) => onPitch(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex gap-1.5">
          {[
            { label: '2D', value: 0, on: pitch < 5 },
            { label: '3D', value: 60, on: pitch >= 5 },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              aria-pressed={b.on}
              onClick={() => onPitch(b.value)}
              className={`h-8 flex-1 rounded-lg text-xs font-semibold ${b.on ? 'bg-accent text-on-accent' : 'border border-border text-muted hover:text-text'}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
