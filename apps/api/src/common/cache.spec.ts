import { TtlCache } from './cache.js';

describe('TtlCache', () => {
  it('garde une valeur pendant sa durée de vie puis la recharge', async () => {
    let now = 0;
    const cache = new TtlCache<number>(1000, 10, () => now);
    let calls = 0;
    const load = () => Promise.resolve(++calls);
    expect(await cache.get('a', load)).toBe(1);
    now = 999;
    expect(await cache.get('a', load)).toBe(1);
    now = 1000;
    expect(await cache.get('a', load)).toBe(2);
  });

  it('évince la plus ancienne entrée au-delà de la taille maximale', async () => {
    const cache = new TtlCache<string>(60_000, 2);
    let loads = 0;
    const load = (v: string) => () => {
      loads++;
      return Promise.resolve(v);
    };
    await cache.get('a', load('a'));
    await cache.get('b', load('b'));
    await cache.get('c', load('c'));
    await cache.get('b', load('b'));
    expect(loads).toBe(3);
    await cache.get('a', load('a'));
    expect(loads).toBe(4);
  });
});
