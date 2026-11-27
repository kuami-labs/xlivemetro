package gtfs

import (
	"encoding/csv"
	"os"
	"path/filepath"
	"sort"
	"strconv"
)

// WriteDir écrit le feed au format GTFS dans un dossier (jeu réduit des fixtures).
// Le calendrier est remplacé par un service unique valable tous les jours : le jeu réduit
// représente une journée type, rejouée quelle que soit la date (ADR 0011).
func (f *Feed) WriteDir(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	ff := strconv.FormatFloat
	files := map[string][][]string{}
	add := func(name string, row ...string) { files[name] = append(files[name], row) }

	add("agency.txt", "agency_id", "agency_name", "agency_url", "agency_timezone")
	for _, a := range f.Agencies {
		add("agency.txt", a.ID, a.Name, a.URL, "Europe/Paris")
	}
	add("routes.txt", "route_id", "agency_id", "route_short_name", "route_long_name", "route_type", "route_color", "route_text_color", "route_sort_order")
	types := map[Mode]string{Metro: "1", Tram: "0", RER: "2"}
	for _, r := range f.Routes {
		add("routes.txt", r.ID, r.AgencyID, r.ShortName, r.LongName, types[r.Mode], r.Color, r.TextColor, strconv.Itoa(r.SortOrder))
	}
	add("stops.txt", "stop_id", "stop_name", "stop_lat", "stop_lon", "location_type", "parent_station", "wheelchair_boarding")
	for _, s := range f.Stops {
		add("stops.txt", s.ID, s.Name, ff(s.Lat, 'f', -1, 64), ff(s.Lon, 'f', -1, 64), strconv.Itoa(s.LocationType), s.ParentID, strconv.Itoa(s.Wheelchair))
	}
	add("trips.txt", "route_id", "service_id", "trip_id", "trip_headsign", "direction_id", "shape_id")
	add("stop_times.txt", "trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence")
	for _, t := range f.Trips {
		add("trips.txt", t.RouteID, "JOUR_TYPE", t.ID, t.Headsign, strconv.Itoa(t.DirectionID), t.ShapeID)
		for _, s := range f.StopTimes[t.ID] {
			add("stop_times.txt", t.ID, FormatTime(s.Arrival), FormatTime(s.Departure), s.StopID, strconv.Itoa(s.StopSequence))
		}
	}
	add("shapes.txt", "shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence")
	// Ordre stable (une map Go n'en a pas) : fichiers identiques d'une génération à l'autre
	ids := make([]string, 0, len(f.Shapes))
	for id := range f.Shapes {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		line := f.Shapes[id]
		for i, p := range line.Points {
			add("shapes.txt", id, ff(p.Lat, 'f', -1, 64), ff(p.Lon, 'f', -1, 64), strconv.Itoa(i+1))
		}
	}
	add("calendar.txt", "service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date")
	add("calendar.txt", "JOUR_TYPE", "1", "1", "1", "1", "1", "1", "1", "20200101", "20991231")
	add("calendar_dates.txt", "service_id", "date", "exception_type")
	add("transfers.txt", "from_stop_id", "to_stop_id", "transfer_type", "min_transfer_time")
	for _, t := range f.Transfers {
		add("transfers.txt", t.From, t.To, "2", strconv.Itoa(t.MinSec))
	}

	for name, rows := range files {
		out, err := os.Create(filepath.Join(dir, name))
		if err != nil {
			return err
		}
		w := csv.NewWriter(out)
		if err := w.WriteAll(rows); err != nil {
			out.Close()
			return err
		}
		if err := out.Close(); err != nil {
			return err
		}
	}
	return nil
}
