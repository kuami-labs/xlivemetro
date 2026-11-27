import { describe, expect, it } from 'vitest';
import { loadFavorites, toggleFavorite } from './favorites';

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe('favoris', () => {
  it('ajoute puis retire une gare', () => {
    const s = memory();
    expect(toggleFavorite({ id: 'IDFM:1', name: 'Auber' }, s)).toHaveLength(1);
    expect(toggleFavorite({ id: 'IDFM:1', name: 'Auber' }, s)).toHaveLength(0);
  });
  it('ignore un contenu corrompu', () => {
    const s = memory();
    s.setItem('xlivemetro:favoris', '{pas du json');
    expect(loadFavorites(s)).toEqual([]);
    s.setItem('xlivemetro:favoris', JSON.stringify([{ id: 1 }, { id: 'a', name: 'A' }]));
    expect(loadFavorites(s)).toEqual([{ id: 'a', name: 'A' }]);
  });
});
