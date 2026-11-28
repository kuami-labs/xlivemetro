'use client';

import { useEffect, useId, useState } from 'react';
import { api, type Place } from '@/lib/api';

/**
 * Champ d'adresse de destination (F17). La recherche ne part qu'après une courte pause de
 * frappe, et le visiteur est prévenu que le texte est envoyé au service d'adresses de l'État.
 */
export default function AddressPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 3) return;
    let active = true;
    const t = setTimeout(() => {
      api.geocode(q.trim()).then(
        (r) => {
          if (!active) return;
          setResults(r);
          setError(false);
        },
        () => {
          if (!active) return;
          setResults([]);
          setError(true);
        },
      );
    }, 350);
    return () => {
      clearTimeout(t);
      active = false;
    };
  }, [q]);

  const typed = q.trim().length >= 3;
  const shown = typed ? results : [];

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      {value ? (
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-[10px] border border-border bg-surface-2 px-3 py-2">
          <span className="text-[15px] leading-snug font-semibold">{value.label}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ('');
            }}
            className="text-xs text-muted hover:text-accent"
            aria-label={`Changer : ${value.label}`}
          >
            Changer
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            type="search"
            value={q}
            autoComplete="off"
            placeholder="Ex. 20 avenue de Ségur, Paris"
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown[0]) onChange(shown[0]);
            }}
            className="h-11 rounded-[10px] border border-border bg-surface-2 px-3 text-[15px] text-text outline-none placeholder:text-muted focus:border-accent"
          />
          <p className="text-xs text-muted">
            Le texte saisi est envoyé, par notre serveur, au service d’adresses de l’État (IGN). Il
            n’est pas conservé.
          </p>
          {typed && error && (
            <p className="text-xs text-alert">Recherche d’adresse indisponible. Réessayez.</p>
          )}
        </>
      )}
      {!value && open && shown.length > 0 && (
        <ul className="absolute inset-x-0 top-[68px] z-30 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
          {shown.map((p) => (
            <li key={p.label + p.lat + p.lon}>
              <button
                type="button"
                onMouseDown={() => onChange(p)}
                className="flex min-h-11 w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-2"
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
