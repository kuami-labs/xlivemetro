'use client';

import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** Groupe de boutons à bascule (filtres, représentation). */
export default function Segmented<T extends string>({
  legend,
  options,
  selected,
  onToggle,
  variant = 'solid',
}: {
  legend: string;
  options: SegmentOption<T>[];
  selected: (value: T) => boolean;
  onToggle: (value: T) => void;
  variant?: 'solid' | 'soft';
}) {
  return (
    <div
      role="group"
      aria-label={legend}
      className="flex gap-1 rounded-xl border border-border bg-overlay p-1 backdrop-blur"
    >
      {options.map((o) => {
        const on = selected(o.value);
        const style = on
          ? variant === 'solid'
            ? 'bg-accent text-on-accent'
            : 'bg-surface-2 text-accent'
          : 'text-muted hover:text-text';
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            className={`inline-flex h-[38px] items-center gap-2 rounded-lg px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-accent ${style}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
