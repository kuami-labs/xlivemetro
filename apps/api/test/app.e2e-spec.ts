import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { RealtimeClient } from '../src/realtime/realtime.client.js';
import { ReferentialRepository } from '../src/referential/referential.repository.js';
import { CDG, FakeRealtime, FakeRepository, M1, RERA } from './fakes.js';

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let realtime: FakeRealtime;

  beforeEach(async () => {
    realtime = new FakeRealtime();
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ReferentialRepository)
      .useValue(new FakeRepository())
      .overrideProvider(RealtimeClient)
      .useValue(realtime)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health', () =>
    request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', db: 'ok', realtime: 'ok' }));

  it('GET /lines filtre par mode', async () => {
    const all = await request(app.getHttpServer()).get('/lines').expect(200);
    expect(all.body.map((l: { shortName: string }) => l.shortName)).toEqual(['1', 'A']);
    const res = await request(app.getHttpServer()).get('/lines?mode=rer').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.headers['cache-control']).toContain('max-age=3600');
    await request(app.getHttpServer()).get('/lines?mode=bus').expect(400);
  });

  it('GET /lines/:id renvoie les gares ordonnées sans doublon', async () => {
    const res = await request(app.getHttpServer()).get(`/lines/${M1.id}`).expect(200);
    expect(res.body.stations.map((s: { id: string }) => s.id)).toEqual(['IDFM:71517', CDG.id]);
    await request(app.getHttpServer()).get('/lines/IDFM:inconnue').expect(404);
    await request(app.getHttpServer()).get("/lines/'; DROP TABLE routes").expect(400);
  });

  it('GET /lines.geojson et /stations.geojson', async () => {
    const lines = await request(app.getHttpServer()).get('/lines.geojson').expect(200);
    expect(lines.headers['content-type']).toContain('application/geo+json');
    expect(lines.body.features[0].properties.color).toBe('#FFBE00');
    const empty = await request(app.getHttpServer()).get('/lines.geojson?mode=tram').expect(200);
    expect(empty.body.features).toHaveLength(0);
    const stations = await request(app.getHttpServer()).get('/stations.geojson').expect(200);
    expect(stations.body.features[0].properties.lines).toEqual(['A', '1']);
  });

  it('GET /stations/search', async () => {
    const res = await request(app.getHttpServer()).get('/stations/search?q=etoile').expect(200);
    expect(res.body).toHaveLength(1);
    // Lignes triées : métro avant RER
    expect(res.body[0].lines.map((l: { shortName: string }) => l.shortName)).toEqual(['1', 'A']);
    await request(app.getHttpServer()).get('/stations/search?q=a').expect(400);
  });

  it('GET /stations/:id et ses départs', async () => {
    await request(app.getHttpServer()).get(`/stations/${CDG.id}`).expect(200);
    await request(app.getHttpServer()).get('/stations/IDFM:999').expect(404);
    const res = await request(app.getHttpServer())
      .get(`/stations/${CDG.id}/departures`)
      .expect(200);
    expect(res.body[0]).toMatchObject({
      delaySeconds: 90,
      theoretical: false,
      line: { id: M1.id },
    });
    expect(realtime.paths[0]).toBe('/departures?stops=IDFM%3A1%2CIDFM%3A2&limit=12');
    // Deuxième appel servi par le cache (15 s)
    await request(app.getHttpServer()).get(`/stations/${CDG.id}/departures`).expect(200);
    expect(realtime.paths.filter((p) => p.startsWith('/departures'))).toHaveLength(1);
  });

  it('GET /disruptions', async () => {
    const res = await request(app.getHttpServer()).get('/disruptions').expect(200);
    expect(res.body[0]).toMatchObject({
      text: 'Trafic <b>perturbé</b>',
      lines: [{ shortName: 'A' }],
    });
    expect(res.body[0].validUntil).toBeNull();
    await request(app.getHttpServer()).get(`/disruptions?line=${RERA.id}`).expect(200);
    expect(realtime.paths).toContain('/disruptions?line=IDFM%3AC01742');
    await request(app.getHttpServer()).get('/disruptions?line=IDFM:inconnue').expect(404);
    await request(app.getHttpServer()).get('/disruptions?line=pas-un-id').expect(400);
  });

  it('GET /trips/:id : arrêts restants, avec ou sans train en circulation', async () => {
    const res = await request(app.getHttpServer()).get('/trips/IDFM:T1@20261201').expect(200);
    expect(res.body).toMatchObject({
      line: { shortName: '1' },
      headsign: 'Château de Vincennes',
      vehicle: { delaySeconds: 90, nextStationId: CDG.id },
    });
    expect(res.body.calls[0]).toMatchObject({
      station: CDG.name,
      stationId: CDG.id,
      delaySeconds: 90,
    });
    // Course connue mais pas encore partie : pas de position, arrêts quand même
    const waiting = await request(app.getHttpServer()).get('/trips/IDFM:T3@20261201').expect(200);
    expect(waiting.body.vehicle).toBeNull();
    await request(app.getHttpServer()).get('/trips/IDFM:T9@20261201').expect(404);
    await request(app.getHttpServer()).get('/trips/pas-une-course').expect(400);
  });

  it('GET /vehicles/:id', async () => {
    const res = await request(app.getHttpServer()).get('/vehicles/IDFM:T1@20261201').expect(200);
    expect(res.body).toMatchObject({ delaySeconds: 90, line: { shortName: '1' } });
    expect(res.body.nextStops[0]).toMatchObject({ station: CDG.name, stationId: CDG.id });
    await request(app.getHttpServer()).get('/vehicles/IDFM:T9@20261201').expect(404);
    await request(app.getHttpServer()).get('/vehicles/pas-une-course').expect(400);
  });
});
