// Package gtfsdb écrit le référentiel GTFS filtré dans PostgreSQL (schéma de packages/db).
package gtfsdb

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
)

// Meta décrit la version importée.
type Meta struct {
	SourceURL string
	SHA256    string
}

// Stats résume un import.
type Stats struct{ Routes, Trips, StopTimes int }

// Import remplace tout le référentiel par feed, dans une seule transaction :
// en cas d'échec, l'ancien référentiel reste intact (ADR 0012).
func Import(ctx context.Context, conn *pgx.Conn, feed *gtfs.Feed, meta Meta) (Stats, error) {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return Stats{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // sans effet après Commit

	if _, err := tx.Exec(ctx, `TRUNCATE stop_times, trips, shapes, stops, routes, agencies, calendars, calendar_dates`); err != nil {
		return Stats{}, err
	}

	st := Stats{Routes: len(feed.Routes), Trips: len(feed.Trips)}
	steps := []func() error{
		func() error {
			return copyRows(ctx, tx, "agencies", []string{"id", "name", "url"}, len(feed.Agencies), func(i int) []any {
				a := feed.Agencies[i]
				return []any{a.ID, a.Name, nullable(a.URL)}
			})
		},
		func() error {
			return copyRows(ctx, tx, "routes", []string{"id", "agency_id", "short_name", "long_name", "mode", "color", "text_color", "sort_order"}, len(feed.Routes), func(i int) []any {
				r := feed.Routes[i]
				return []any{r.ID, r.AgencyID, r.ShortName, r.LongName, string(r.Mode), r.Color, r.TextColor, r.SortOrder}
			})
		},
		func() error { return importStops(ctx, tx, feed.Stops) },
		func() error { return importShapes(ctx, tx, feed.Shapes) },
		func() error {
			return copyRows(ctx, tx, "trips", []string{"id", "route_id", "service_id", "shape_id", "headsign", "direction_id"}, len(feed.Trips), func(i int) []any {
				t := feed.Trips[i]
				return []any{t.ID, t.RouteID, t.ServiceID, t.ShapeID, t.Headsign, t.DirectionID}
			})
		},
		func() error {
			rows := make([][]any, 0, len(feed.Trips)*20)
			for _, t := range feed.Trips {
				for _, s := range feed.StopTimes[t.ID] {
					rows = append(rows, []any{t.ID, s.StopSequence, s.StopID, s.Arrival, s.Departure, s.DistM})
				}
			}
			st.StopTimes = len(rows)
			_, err := tx.CopyFrom(ctx, pgx.Identifier{"stop_times"}, []string{"trip_id", "stop_sequence", "stop_id", "arrival", "departure", "dist_m"}, pgx.CopyFromRows(rows))
			return wrap("stop_times", err)
		},
		func() error {
			return copyRows(ctx, tx, "calendars", []string{"service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"}, len(feed.Calendars), func(i int) []any {
				c := feed.Calendars[i]
				row := []any{c.ServiceID}
				for _, d := range c.Days {
					row = append(row, d)
				}
				return append(row, mustDate(c.StartDate), mustDate(c.EndDate))
			})
		},
		func() error {
			return copyRows(ctx, tx, "calendar_dates", []string{"service_id", "date", "exception_type"}, len(feed.CalendarDates), func(i int) []any {
				c := feed.CalendarDates[i]
				return []any{c.ServiceID, mustDate(c.Date), c.ExceptionType}
			})
		},
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return Stats{}, err
		}
	}
	_, err = tx.Exec(ctx, `INSERT INTO feed_versions (source_url, sha256, routes, trips, stop_times) VALUES ($1, $2, $3, $4, $5)`,
		meta.SourceURL, meta.SHA256, st.Routes, st.Trips, st.StopTimes)
	if err != nil {
		return Stats{}, err
	}
	return st, tx.Commit(ctx)
}

func copyRows(ctx context.Context, tx pgx.Tx, table string, cols []string, n int, row func(int) []any) error {
	_, err := tx.CopyFrom(ctx, pgx.Identifier{table}, cols, pgx.CopyFromSlice(n, func(i int) ([]any, error) { return row(i), nil }))
	return wrap(table, err)
}

// Les colonnes géographiques passent par une table temporaire en texte, convertie par PostGIS.
func importStops(ctx context.Context, tx pgx.Tx, stops []gtfs.Stop) error {
	if _, err := tx.Exec(ctx, `CREATE TEMP TABLE stops_in (id text, name text, lat float8, lon float8, location_type int, parent_id text, wheelchair int) ON COMMIT DROP`); err != nil {
		return err
	}
	err := copyRows(ctx, tx, "stops_in", []string{"id", "name", "lat", "lon", "location_type", "parent_id", "wheelchair"}, len(stops), func(i int) []any {
		s := stops[i]
		return []any{s.ID, s.Name, s.Lat, s.Lon, s.LocationType, nullable(s.ParentID), s.Wheelchair}
	})
	if err != nil {
		return err
	}
	// Gares (sans parent) d'abord, pour la clé étrangère parent_id
	_, err = tx.Exec(ctx, `INSERT INTO stops (id, name, lat, lon, geom, location_type, parent_id, wheelchair)
		SELECT id, name, lat, lon, ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, location_type, parent_id, wheelchair
		FROM stops_in ORDER BY parent_id NULLS FIRST`)
	return wrap("stops", err)
}

func importShapes(ctx context.Context, tx pgx.Tx, shapes map[string]gtfs.Polyline) error {
	if _, err := tx.Exec(ctx, `CREATE TEMP TABLE shapes_in (id text, wkt text, length_m float8) ON COMMIT DROP`); err != nil {
		return err
	}
	rows := make([][]any, 0, len(shapes))
	for id, line := range shapes {
		var b strings.Builder
		b.WriteString("LINESTRING(")
		for i, p := range line.Points {
			if i > 0 {
				b.WriteByte(',')
			}
			b.WriteString(strconv.FormatFloat(p.Lon, 'f', -1, 64))
			b.WriteByte(' ')
			b.WriteString(strconv.FormatFloat(p.Lat, 'f', -1, 64))
		}
		if len(line.Points) == 1 { // une LineString exige deux points
			b.WriteString("," + strconv.FormatFloat(line.Points[0].Lon, 'f', -1, 64) + " " + strconv.FormatFloat(line.Points[0].Lat, 'f', -1, 64))
		}
		b.WriteByte(')')
		rows = append(rows, []any{id, b.String(), line.Length()})
	}
	if _, err := tx.CopyFrom(ctx, pgx.Identifier{"shapes_in"}, []string{"id", "wkt", "length_m"}, pgx.CopyFromRows(rows)); err != nil {
		return wrap("shapes_in", err)
	}
	_, err := tx.Exec(ctx, `INSERT INTO shapes (id, geom, length_m) SELECT id, ST_GeogFromText('SRID=4326;' || wkt), length_m FROM shapes_in`)
	return wrap("shapes", err)
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func mustDate(s string) time.Time {
	t, err := time.Parse("20060102", s)
	if err != nil {
		return time.Time{}
	}
	return t
}

func wrap(table string, err error) error {
	if err != nil {
		return fmt.Errorf("import de %s : %w", table, err)
	}
	return nil
}
