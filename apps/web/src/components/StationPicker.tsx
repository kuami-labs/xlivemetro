'use client';

import { useEffect, useId, useState } from 'react';
import { api, type Station } from '@/lib/api';
import LineBadge from './LineBadge';

/** Champ de choix d'une gare (recherche floue), pour l'itinéraire. */
export default function StationPicker({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: Station | null;
  onChange: (s: Station | null) => void;
  placeholder: string;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Station[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let active = true;
    const t = setTimeout(() => {
      api.search(q.trim()).then(
        (r) => active && setResults(r),
        () => active && setResults([]),
      );
    }, 150);
    return () => {
      clearTimeout(t);
      active = false;
    };
  }, [q]);

  const shown = q.trim().length < 2 ? [] : results;

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      {value ? (
        <div className="flex h-11 items-center justify-between gap-2 rounded-[10px] border border-border bg-surface-2 px-3">
          <span className="truncate text-[15px] font-semibold">{value.name}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ('');
            }}
            className="text-xs text-muted hover:text-accent"
            aria-label={`Changer : ${value.name}`}
          >
            Changer
          </button>
        </div>
      ) : (
        <input
          id={id}
          type="search"
          value={q}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && shown[0]) onChange(shown[0]);
          }}
          className="h-11 rounded-[10px] border border-border bg-surface-2 px-3 text-[15px] text-text outline-none placeholder:text-muted focus:border-accent"
        />
      )}
      {!value && open && shown.length > 0 && (
        <ul className="absolute inset-x-0 top-[68px] z-30 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
          {shown.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={() => onChange(s)}
                className="flex h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left hover:bg-surface-2"
              >
                <span className="flex-1 truncate text-sm">{s.name}</span>
                <span className="flex gap-1">
                  {s.lines.map((l) => (
                    <LineBadge key={l.id} line={l} size={20} />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
