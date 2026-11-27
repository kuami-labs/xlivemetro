// Package refdb relit le référentiel GTFS importé dans PostgreSQL (docs/05-DATABASE.md).
package refdb

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
)

// Load relit tout le référentiel sous la forme d'un gtfs.Feed.
func Load(ctx context.Context, db *pgxpool.Pool) (*gtfs.Feed, error) {
	f := &gtfs.Feed{Shapes: map[string]gtfs.Polyline{}, StopTimes: map[string][]gtfs.StopTime{}}

	err := each(ctx, db, `SELECT id, short_name, long_name, mode::text, color, text_color, sort_order, agency_id FROM routes`, func(r pgx.Rows) error {
		var x gtfs.Route
		var mode string
		if err := r.Scan(&x.ID, &x.ShortName, &x.LongName, &mode, &x.Color, &x.TextColor, &x.SortOrder, &x.AgencyID); err != nil {
			return err
		}
		x.Mode = gtfs.Mode(mode)
		f.Routes = append(f.Routes, x)
		return nil
	})
	if err != nil {
		return nil, err
	}
	err = each(ctx, db, `SELECT id, name, lat, lon, location_type, coalesce(parent_id, ''), wheelchair FROM stops`, func(r pgx.Rows) error {
		var s gtfs.Stop
		if err := r.Scan(&s.ID, &s.Name, &s.Lat, &s.Lon, &s.LocationType, &s.ParentID, &s.Wheelchair); err != nil {
			return err
		}
		f.Stops = append(f.Stops, s)
		return nil
	})
	if err != nil {
		return nil, err
	}
	err = each(ctx, db, `SELECT id, ST_AsGeoJSON(geom) FROM shapes`, func(r pgx.Rows) error {
		var id, js string
		if err := r.Scan(&id, &js); err != nil {
			return err
		}
		var g struct{ Coordinates [][2]float64 }
		if err := json.Unmarshal([]byte(js), &g); err != nil {
			return fmt.Errorf("tracé %s : %w", id, err)
		}
		pts := make([]gtfs.Point, len(g.Coordinates))
		for i, c := range g.Coordinates {
			pts[i] = gtfs.Point{Lat: c[1], Lon: c[0]}
		}
		f.Shapes[id] = gtfs.NewPolyline(pts)
		return nil
	})
	if err != nil {
		return nil, err
	}
	err = each(ctx, db, `SELECT id, route_id, service_id, shape_id, headsign, direction_id FROM trips`, func(r pgx.Rows) error {
		var t gtfs.Trip
		if err := r.Scan(&t.ID, &t.RouteID, &t.ServiceID, &t.ShapeID, &t.Headsign, &t.DirectionID); err != nil {
			return err
		}
		f.Trips = append(f.Trips, t)
		return nil
	})
	if err != nil {
		return nil, err
	}
	err = each(ctx, db, `SELECT trip_id, stop_sequence, stop_id, arrival, departure, dist_m FROM stop_times ORDER BY trip_id, stop_sequence`, func(r pgx.Rows) error {
		var id string
		var s gtfs.StopTime
		if err := r.Scan(&id, &s.StopSequence, &s.StopID, &s.Arrival, &s.Departure, &s.DistM); err != nil {
			return err
		}
		f.StopTimes[id] = append(f.StopTimes[id], s)
		return nil
	})
	if err != nil {
		return nil, err
	}
	err = each(ctx, db, `SELECT service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
		to_char(start_date, 'YYYYMMDD'), to_char(end_date, 'YYYYMMDD') FROM calendars`, func(r pgx.Rows) error {
		var c gtfs.Calendar
		d := &c.Days
		if err := r.Scan(&c.ServiceID, &d[0], &d[1], &d[2], &d[3], &d[4], &d[5], &d[6], &c.StartDate, &c.EndDate); err != nil {
			return err
		}
		f.Calendars = append(f.Calendars, c)
		return nil
	})
	if err != nil {
		return nil, err
	}
	err = each(ctx, db, `SELECT service_id, to_char(date, 'YYYYMMDD'), exception_type FROM calendar_dates`, func(r pgx.Rows) error {
		var c gtfs.CalendarDate
		if err := r.Scan(&c.ServiceID, &c.Date, &c.ExceptionType); err != nil {
			return err
		}
		f.CalendarDates = append(f.CalendarDates, c)
		return nil
	})
	if err != nil {
		return nil, err
	}
	if len(f.Routes) == 0 {
		return nil, fmt.Errorf("référentiel vide : lancez pnpm db:seed ou pnpm gtfs:import")
	}
	return f, nil
}

func each(ctx context.Context, db *pgxpool.Pool, sql string, fn func(pgx.Rows) error) error {
	rows, err := db.Query(ctx, sql)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		if err := fn(rows); err != nil {
			return err
		}
	}
	return rows.Err()
}
