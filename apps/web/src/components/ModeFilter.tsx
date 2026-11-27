'use client';

import type { Mode } from '@/lib/api';
import Segmented from './Segmented';

const LABELS: Record<Mode, string> = { metro: 'Métro', rer: 'RER', tram: 'Tram' };

/** Filtre par mode (F5) : au moins un mode reste affiché. */
export default function ModeFilter({
  modes,
  onChange,
}: {
  modes: Set<Mode>;
  onChange: (modes: Set<Mode>) => void;
}) {
  return (
    <Segmented
      legend="Modes affichés"
      options={(Object.keys(LABELS) as Mode[]).map((m) => ({ value: m, label: LABELS[m] }))}
      selected={(m) => modes.has(m)}
      onToggle={(m) => {
        const next = new Set(modes);
        if (next.has(m)) next.delete(m);
        else next.add(m);
        if (next.size > 0) onChange(next);
      }}
    />
  );
}
