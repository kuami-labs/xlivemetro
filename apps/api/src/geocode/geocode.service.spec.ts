import { GeocodeService, toPlaces } from './geocode.service.js';
import type { GeocodeClient } from './geocode.client.js';

const feature = (label: string, citycode: string, lon = 2.3, lat = 48.85) => ({
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { label, citycode, type: 'housenumber' },
});

describe('géocodage', () => {
  it('garde les adresses d’Île-de-France, 5 au plus', () => {
    const places = toPlaces([
      feature('20 Avenue de Ségur 75007 Paris', '75107'),
      feature('Avenue de Ségur 69000 Lyon', '69123'),
      feature('Place de la Défense 92400 Courbevoie', '92026'),
      { geometry: { coordinates: ['x', 1] }, properties: { label: 'cassé', citycode: '75101' } },
      { properties: { label: 'sans géométrie', citycode: '75101' } },
      ...Array.from({ length: 6 }, (_, i) => feature(`Rue ${i} 93200 Saint-Denis`, '93066')),
    ]);
    expect(places).toHaveLength(5);
    expect(places[0]).toEqual({ label: '20 Avenue de Ségur 75007 Paris', lon: 2.3, lat: 48.85 });
    expect(places.map((p) => p.label)).not.toContain('Avenue de Ségur 69000 Lyon');
  });

  it('met en cache les recherches identiques', async () => {
    let calls = 0;
    const client = {
      search: () => {
        calls++;
        return Promise.resolve([feature('Rue de Rivoli 75001 Paris', '75101')]);
      },
    } as unknown as GeocodeClient;
    const service = new GeocodeService(client);
    await service.search('rue de Rivoli');
    await service.search('Rue  de Rivoli');
    expect(calls).toBe(1);
  });
});
