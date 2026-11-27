'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type Station } from '@/lib/api';
import type { Favorite } from '@/lib/favorites';
import LineBadge from './LineBadge';

/** Recherche de gare (Ctrl+K), favoris quand le champ est vide (F5, F8). */
export default function SearchBox({
  favorites,
  onSelect,
}: {
  favorites: Favorite[];
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Station[]>([]);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    // Réponses arrivées après la fermeture ignorées (sans annuler la requête)
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

  const choose = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQ('');
    input.current?.blur();
  };

  const short = q.trim().length < 2;
  const shown = short ? [] : results;
  const showFavorites = short && favorites.length > 0;

  return (
    <div className="absolute top-3 left-3 z-20 w-[min(24rem,calc(100vw-5rem))]">
      <label htmlFor="recherche" className="sr-only">
        Rechercher une gare
      </label>
      <input
        id="recherche"
        ref={input}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && shown[0]) choose(shown[0].id);
          if (e.key === 'Escape') input.current?.blur();
        }}
        placeholder="Rechercher une gare (Ctrl+K)"
        autoComplete="off"
        className="w-full rounded-lg bg-neutral-900/95 px-3 py-2 text-sm text-neutral-100 shadow-xl outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-400"
      />
      {open && (shown.length > 0 || showFavorites) && (
        <ul className="mt-1 overflow-hidden rounded-lg bg-neutral-900/95 text-sm text-neutral-100 shadow-xl">
          {showFavorites &&
            favorites.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-neutral-700"
                  onMouseDown={() => choose(f.id)}
                >
                  ★ {f.name}
                </button>
              </li>
            ))}
          {shown.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-700"
                onMouseDown={() => choose(s.id)}
              >
                <span className="flex-1 truncate">{s.name}</span>
                <span className="flex gap-1">
                  {s.lines.map((l) => (
                    <LineBadge key={l.id} line={l} />
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
