import { BadRequestException } from '@nestjs/common';
import { gtfsId, optionalMode, searchQuery, tripKey } from './validation.js';

describe('validation', () => {
  it('accepte les identifiants IDFM et refuse le reste', () => {
    expect(gtfsId('IDFM:C01742')).toBe('IDFM:C01742');
    for (const bad of ['', 'C01742', 'IDFM:', "IDFM:1' OR 1=1", 'IDFM:' + 'x'.repeat(41)]) {
      expect(() => gtfsId(bad)).toThrow(BadRequestException);
    }
  });

  it('valide les courses datées', () => {
    expect(tripKey('IDFM:RATP:COU_1-1@20261201')).toBeTruthy();
    expect(() => tripKey('IDFM:x@2026')).toThrow(BadRequestException);
  });

  it('borne la recherche', () => {
    expect(searchQuery('  Auber ')).toBe('Auber');
    for (const bad of [undefined, 'a', 'x'.repeat(65), ['ab']]) {
      expect(() => searchQuery(bad)).toThrow(BadRequestException);
    }
  });

  it('valide le mode', () => {
    expect(optionalMode(undefined)).toBeUndefined();
    expect(optionalMode('rer')).toBe('rer');
    expect(() => optionalMode('bus')).toThrow(BadRequestException);
  });
});
