const KEY = 'xlivemetro:favoris';

export interface Favorite {
  id: string;
  name: string;
}

/** Favoris en localStorage : aucun compte, rien ne part au serveur (CLAUDE.md). */
export function loadFavorites(storage: Pick<Storage, 'getItem'> = localStorage): Favorite[] {
  try {
    const v: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
    return Array.isArray(v)
      ? v.filter(
          (f): f is Favorite =>
            typeof f === 'object' &&
            f !== null &&
            typeof f.id === 'string' &&
            typeof f.name === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(
  fav: Favorite,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): Favorite[] {
  const list = loadFavorites(storage);
  const next = list.some((f) => f.id === fav.id)
    ? list.filter((f) => f.id !== fav.id)
    : [...list, fav].slice(-20);
  storage.setItem(KEY, JSON.stringify(next));
  return next;
}
