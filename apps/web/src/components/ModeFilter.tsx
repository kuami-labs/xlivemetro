'use client';

import type { Mode } from '@/lib/api';

const LABELS: Record<Mode, string> = { metro: 'Métro', rer: 'RER', tram: 'Tram' };

/** Filtre par mode (F5). */
export default function ModeFilter({
  modes,
  onChange,
}: {
  modes: Set<Mode>;
  onChange: (modes: Set<Mode>) => void;
}) {
  return (
    <fieldset className="absolute top-14 left-3 z-10 flex gap-1 rounded-lg bg-neutral-900/95 p-1 text-sm text-neutral-100 shadow-xl">
      <legend className="sr-only">Modes affichés</legend>
      {(Object.keys(LABELS) as Mode[]).map((m) => (
        <label
          key={m}
          className={`cursor-pointer rounded px-2 py-1 ${modes.has(m) ? 'bg-neutral-100 text-neutral-900' : 'hover:bg-neutral-700'}`}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={modes.has(m)}
            onChange={() => {
              const next = new Set(modes);
              if (next.has(m)) next.delete(m);
              else next.add(m);
              if (next.size > 0) onChange(next);
            }}
          />
          {LABELS[m]}
        </label>
      ))}
    </fieldset>
  );
}
