import { describe, expect, it } from 'vitest';
import { behind, haloColor, rameMatrix, ringWidth, trailMeters } from './trains';

describe('trains', () => {
  it('épaissit l’anneau avec le retard', () => {
    expect(ringWidth(0, false)).toBe(2);
    expect(ringWidth(150, false)).toBe(3.5);
    expect(ringWidth(400, false)).toBe(5);
    expect(ringWidth(400, true)).toBe(2);
  });

  it('colore le halo selon le retard', () => {
    const theme = {
      warn: [1, 0, 0, 0] as [number, number, number, number],
      alert: [2, 0, 0, 0] as [number, number, number, number],
      neutral: [3, 0, 0, 0] as [number, number, number, number],
      muted: [4, 0, 0, 0] as [number, number, number, number],
    };
    expect(haloColor(0, false, theme)[0]).toBe(3);
    expect(haloColor(130, false, theme)[0]).toBe(1);
    expect(haloColor(330, false, theme)[0]).toBe(2);
    expect(haloColor(330, true, theme)[0]).toBe(4);
  });

  it('oriente la rame selon le cap', () => {
    // L'axe long du cube (1re colonne) suit le cap, sa longueur vaut la demi-longueur
    const north = rameMatrix(0, [100, 4, 8]);
    expect(north[0]).toBeCloseTo(0);
    expect(north[1]).toBeCloseTo(50);
    const east = rameMatrix(90, [100, 4, 8]);
    expect(east[0]).toBeCloseTo(50);
    expect(east[1]).toBeCloseTo(0);
    const southEast = rameMatrix(135, [100, 4, 8]);
    expect(southEast[0]).toBeCloseTo(50 * Math.SQRT1_2);
    expect(southEast[1]).toBeCloseTo(-50 * Math.SQRT1_2);
    // Largeur perpendiculaire, hauteur verticale, posée au sol
    expect(east[5]).toBeCloseTo(2);
    expect(east[10]).toBe(4);
    expect(east[14]).toBe(4);
  });

  it('calcule la fin du sillage derrière le train', () => {
    const [lon, lat] = behind(2.35, 48.86, 90, 100); // cap est : sillage à l'ouest
    expect(lat).toBeCloseTo(48.86, 6);
    expect((2.35 - lon) * 111_320 * Math.cos((48.86 * Math.PI) / 180)).toBeCloseTo(100, 0);
    expect(trailMeters(20)).toBe(300);
    expect(trailMeters(5)).toBe(150);
    expect(trailMeters(-1)).toBe(0);
  });
});
