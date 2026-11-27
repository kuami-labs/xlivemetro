import { describe, expect, it } from 'vitest';
import { loadRepresentation, loadTheme, saveRepresentation, saveTheme } from './representation';

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe('préférences', () => {
  it('représentation : pastilles par défaut, valeur inconnue ignorée', () => {
    const s = memory();
    expect(loadRepresentation(s)).toBe('dots');
    saveRepresentation('3d', s);
    expect(loadRepresentation(s)).toBe('3d');
    s.setItem('xlivemetro:representation', 'nimporte');
    expect(loadRepresentation(s)).toBe('dots');
  });
  it('thème : sombre par défaut', () => {
    const s = memory();
    expect(loadTheme(s)).toBe('dark');
    saveTheme('light', s);
    expect(loadTheme(s)).toBe('light');
  });
});
