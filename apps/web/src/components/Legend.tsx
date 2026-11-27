'use client';

import { useState } from 'react';

/** Légende du retard, repliable ; rames 3D visibles : halo au sol au lieu de l'anneau. */
export default function Legend({ halo }: { halo: boolean }) {
  const [open, setOpen] = useState(true);
  const items = [
    { label: 'À l’heure', color: 'var(--text)', width: 2, dash: false },
    { label: 'Retard 2 à 5 min', color: 'var(--warn)', width: 3.5, dash: false },
    { label: 'Retard 5 min et plus', color: 'var(--alert)', width: 5, dash: false },
    { label: 'Horaire théorique', color: 'var(--muted)', width: 2, dash: true },
  ];
  return (
    <div className="absolute right-5 bottom-10 z-10 hidden w-[250px] rounded-xl border border-border bg-overlay p-3.5 text-[13px] backdrop-blur sm:block">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="label-caps flex w-full items-center justify-between"
      >
        Légende {halo ? '– vue 3D' : ''}
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul className="mt-2.5 flex flex-col gap-2.5">
          {items.map((i) => (
            <li key={i.label} className="flex items-center gap-2.5">
              <svg width="34" height="22" viewBox="0 0 34 22" aria-hidden="true">
                {halo ? (
                  <ellipse
                    cx="17"
                    cy="11"
                    rx="15"
                    ry="5"
                    fill={i.color}
                    opacity={i.dash ? 0.45 : 0.55}
                  />
                ) : (
                  <circle
                    cx="17"
                    cy="11"
                    r="7"
                    fill="var(--muted)"
                    stroke={i.color}
                    strokeWidth={i.width}
                    strokeDasharray={i.dash ? '4 3' : undefined}
                  />
                )}
              </svg>
              {i.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
