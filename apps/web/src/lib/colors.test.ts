import { describe, expect, it } from 'vitest';
import { hexToRgba } from './colors';

describe('couleurs', () => {
  it('convertit les couleurs IDFM', () => {
    expect(hexToRgba('FFBE00')).toEqual([255, 190, 0, 255]);
    expect(hexToRgba('#0055c8', 128)).toEqual([0, 85, 200, 128]);
    expect(hexToRgba('invalide')).toEqual([136, 136, 136, 255]);
  });
});
