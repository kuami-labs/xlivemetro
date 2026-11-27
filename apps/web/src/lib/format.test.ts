import { describe, expect, it } from 'vitest';
import { delayLabel, waitLabel } from './format';

describe('format', () => {
  const now = Date.parse('2026-12-01T08:00:00Z');
  it('affiche le temps d’attente', () => {
    expect(waitLabel('2026-12-01T08:00:10Z', now)).toBe('à quai');
    expect(waitLabel('2026-12-01T08:03:00Z', now)).toBe('3 min');
    expect(waitLabel('2026-12-01T09:30:00Z', now)).toMatch(/\d{2}:\d{2}/);
  });
  it('affiche le retard', () => {
    expect(delayLabel(0, false)).toBe("à l'heure");
    expect(delayLabel(45, false)).toBe('+45 s');
    expect(delayLabel(300, false)).toBe('+5 min');
    expect(delayLabel(300, true)).toBe('horaire théorique');
  });
});
