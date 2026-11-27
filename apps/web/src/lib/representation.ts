export type Representation = 'dots' | 'arrows' | '3d';
export type Theme = 'dark' | 'light';

const REP_KEY = 'xlivemetro:representation';
const THEME_KEY = 'xlivemetro:theme';

/** Préférences d'affichage en localStorage (aucun compte, CLAUDE.md). */
export function loadRepresentation(
  storage: Pick<Storage, 'getItem'> = localStorage,
): Representation {
  const v = storage.getItem(REP_KEY);
  return v === 'arrows' || v === '3d' ? v : 'dots';
}

export function saveRepresentation(
  r: Representation,
  storage: Pick<Storage, 'setItem'> = localStorage,
) {
  storage.setItem(REP_KEY, r);
}

export function loadTheme(storage: Pick<Storage, 'getItem'> = localStorage): Theme {
  return storage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

export function saveTheme(t: Theme, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(THEME_KEY, t);
}
