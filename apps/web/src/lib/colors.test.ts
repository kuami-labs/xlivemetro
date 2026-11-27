import { describe, expect, it } from 'vitest';
import { delayOutline, hexToRgba } from './colors';

describe('couleurs', () => {
  it('convertit les couleurs IDFM', () => {
    expect(hexToRgba('FFBE00')).toEqual([255, 190, 0, 255]);
    expect(hexToRgba('#0055c8', 128)).toEqual([0, 85, 200, 128]);
    expect(hexToRgba('invalide')).toEqual([136, 136, 136, 255]);
  });

  it('colore le contour selon le retard', () => {
    expect(delayOutline(0, false)).toEqual([255, 255, 255, 255]);
    expect(delayOutline(150, false)[0]).toBe(244);
    expect(delayOutline(400, false)[0]).toBe(230);
    expect(delayOutline(400, true)).toEqual([140, 140, 140, 255]);
  });
});
