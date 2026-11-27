import { estimateFare } from './fare.js';

describe('estimateFare', () => {
  it('métro et RER : un seul ticket Métro-Train-RER', () => {
    expect(
      estimateFare([
        { mode: 'metro', fromId: 'IDFM:1', toId: 'IDFM:2' },
        { mode: 'rer', fromId: 'IDFM:2', toId: 'IDFM:3' },
      ]),
    ).toEqual({ amount: 2.55, currency: 'EUR', tickets: ['Métro-Train-RER'] });
  });

  it('métro puis tram : deux titres', () => {
    expect(
      estimateFare([
        { mode: 'metro', fromId: 'IDFM:1', toId: 'IDFM:2' },
        { mode: 'tram', fromId: 'IDFM:2', toId: 'IDFM:3' },
        { mode: 'tram', fromId: 'IDFM:3', toId: 'IDFM:4' },
      ]),
    ).toEqual({ amount: 4.6, currency: 'EUR', tickets: ['Métro-Train-RER', 'Bus-Tram'] });
  });

  it('aéroport par le RER B ou le métro 14', () => {
    expect(estimateFare([{ mode: 'rer', fromId: 'IDFM:1', toId: 'IDFM:73699' }]).amount).toBe(14);
    expect(estimateFare([{ mode: 'metro', fromId: 'IDFM:63284', toId: 'IDFM:1' }]).amount).toBe(14);
  });

  it('sans train : gratuit (à pied)', () => {
    expect(estimateFare([]).amount).toBe(0);
  });
});
