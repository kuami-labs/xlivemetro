'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type Station } from '@/lib/api';
import type { Favorite } from '@/lib/favorites';
import LineBadge from './LineBadge';
import Logo from './Logo';

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
    <div className="relative w-full sm:w-[380px]">
      <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border bg-overlay pr-2 pl-2.5 backdrop-blur focus-within:outline-2 focus-within:outline-accent">
        <Logo />
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
          placeholder="Rechercher une gare"
          autoComplete="off"
          className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-muted"
        />
        <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 font-mono text-xs text-muted sm:inline">
          Ctrl K
        </kbd>
      </div>
      {open && (shown.length > 0 || showFavorites) && (
        <ul className="absolute inset-x-0 top-[52px] z-30 overflow-hidden rounded-xl border border-border bg-surface p-1.5 text-text shadow-2xl">
          {showFavorites &&
            favorites.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="flex h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-surface-2"
                  onMouseDown={() => choose(f.id)}
                >
                  <span aria-hidden="true" className="text-accent">
                    ★
                  </span>
                  {f.name}
                </button>
              </li>
            ))}
          {shown.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left hover:bg-surface-2"
                onMouseDown={() => choose(s.id)}
              >
                <span className="flex-1 truncate text-[15px]">{s.name}</span>
                <span className="flex gap-1">
                  {s.lines.map((l) => (
                    <LineBadge key={l.id} line={l} size={24} />
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
