import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service.js';
import type { Mode } from '../common/validation.js';

export interface Line {
  id: string;
  shortName: string;
  longName: string;
  mode: Mode;
  color: string;
  textColor: string;
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Quais (arrêts GTFS) de la gare. */
  quayIds: string[];
  lineIds: string[];
}

export interface LineShape {
  id: string;
  geometry: unknown;
}

/** Requêtes SQL du référentiel (PostGIS : SQL brut, docs/05-DATABASE.md). */
@Injectable()
export class ReferentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  lines(): Promise<Line[]> {
    return this.prisma.client.$queryRaw<Line[]>`
      SELECT id, short_name AS "shortName", long_name AS "longName", mode::text AS mode,
             color, text_color AS "textColor"
      FROM routes ORDER BY mode, sort_order, short_name`;
  }

  /** Tracés simplifiés (~5 m) de chaque ligne : toutes ses variantes en une MultiLineString. */
  async lineShapes(): Promise<LineShape[]> {
    const rows = await this.prisma.client.$queryRaw<{ id: string; geojson: string }[]>`
      SELECT u.route_id AS id,
             ST_AsGeoJSON(ST_Simplify(ST_Collect(s.geom::geometry), 0.00005), 5) AS geojson
      FROM (SELECT DISTINCT route_id, shape_id FROM trips) u
      JOIN shapes s ON s.id = u.shape_id
      GROUP BY u.route_id`;
    return rows.map((r) => ({ id: r.id, geometry: JSON.parse(r.geojson) as unknown }));
  }

  /** Gares desservies (gare parente, ou le quai lui-même s'il n'en a pas). */
  stations(): Promise<Station[]> {
    return this.prisma.client.$queryRaw<Station[]>`
      WITH served AS (
        SELECT DISTINCT st.stop_id, t.route_id
        FROM stop_times st JOIN trips t ON t.id = st.trip_id
      )
      SELECT coalesce(p.id, q.id) AS id, coalesce(p.name, q.name) AS name,
             coalesce(p.lat, q.lat) AS lat, coalesce(p.lon, q.lon) AS lon,
             array_agg(DISTINCT q.id) AS "quayIds", array_agg(DISTINCT served.route_id) AS "lineIds"
      FROM served
      JOIN stops q ON q.id = served.stop_id
      LEFT JOIN stops p ON p.id = q.parent_id
      GROUP BY 1, 2, 3, 4`;
  }

  /** Recherche floue (pg_trgm), insensible à la casse et aux accents. */
  searchStationIds(q: string, limit: number): Promise<{ id: string }[]> {
    return this.prisma.client.$queryRaw<{ id: string }[]>`
      WITH n AS (SELECT lower(immutable_unaccent(${q})) AS q)
      SELECT id FROM (
        SELECT DISTINCT ON (coalesce(s.parent_id, s.id)) coalesce(s.parent_id, s.id) AS id,
               greatest(similarity(lower(immutable_unaccent(s.name)), n.q),
                        word_similarity(n.q, lower(immutable_unaccent(s.name)))) AS score
        FROM stops s, n
        WHERE lower(immutable_unaccent(s.name)) % n.q
           OR n.q <% lower(immutable_unaccent(s.name))
           OR lower(immutable_unaccent(s.name)) LIKE '%' || n.q || '%'
        ORDER BY coalesce(s.parent_id, s.id), score DESC
      ) r ORDER BY score DESC LIMIT ${limit}`;
  }

  /** Gares d'une ligne dans l'ordre, d'après sa course la plus longue (sens 0). */
  lineStationIds(lineId: string): Promise<{ id: string }[]> {
    return this.prisma.client.$queryRaw<{ id: string }[]>`
      WITH longest AS (
        SELECT t.id FROM trips t JOIN stop_times st ON st.trip_id = t.id
        WHERE t.route_id = ${lineId} AND t.direction_id = 0
        GROUP BY t.id ORDER BY count(*) DESC, t.id LIMIT 1
      )
      SELECT coalesce(q.parent_id, q.id) AS id
      FROM stop_times st JOIN longest l ON l.id = st.trip_id JOIN stops q ON q.id = st.stop_id
      ORDER BY st.stop_sequence`;
  }

  async ping(): Promise<void> {
    await this.prisma.client.$queryRaw`SELECT 1`;
  }
}
