package gtfs

import (
	"fmt"
	"strings"
)

// Mode d'une ligne, aligné sur l'enum Mode du schéma Prisma.
type Mode string

// Modes couverts par la v1.
const (
	Metro Mode = "metro"
	RER   Mode = "rer"
	Tram  Mode = "tram"
)

// Navettes automatiques classées « tram » par IDFM, hors périmètre (ADR 0010).
var excludedShortNames = map[string]bool{"ORLYVAL": true, "CDG VAL": true}

// ModeOf renvoie le mode d'une ligne GTFS, ou false si elle est hors périmètre.
func ModeOf(routeType, shortName string) (Mode, bool) {
	switch routeType {
	case "1":
		return Metro, true
	case "0":
		if excludedShortNames[shortName] {
			return "", false
		}
		return Tram, true
	case "2":
		if len(shortName) == 1 && strings.Contains("ABCDE", shortName) {
			return RER, true
		}
	}
	return "", false
}

// Agency est un opérateur.
type Agency struct{ ID, Name, URL string }

// Route est une ligne retenue.
type Route struct {
	ID, AgencyID, ShortName, LongName string
	Mode                              Mode
	Color, TextColor                  string
	SortOrder                         int
}

// Stop est un arrêt (quai) ou une gare (location_type 1).
type Stop struct {
	ID, Name     string
	Lat, Lon     float64
	LocationType int
	ParentID     string
	Wheelchair   int
}

// Trip est une course.
type Trip struct {
	ID, RouteID, ServiceID, ShapeID, Headsign string
	DirectionID                               int
}

// StopTime est un passage théorique, avec la distance le long du tracé.
type StopTime struct {
	StopSequence       int
	StopID             string
	Arrival, Departure int
	DistM              float64
}

// Calendar et CalendarDate décrivent les jours de circulation.
type Calendar struct {
	ServiceID          string
	Days               [7]bool // lundi … dimanche
	StartDate, EndDate string  // AAAAMMJJ
}

// CalendarDate est une exception au calendrier.
type CalendarDate struct {
	ServiceID, Date string
	ExceptionType   int
}

// Feed est le GTFS filtré sur le périmètre v1, prêt à importer.
type Feed struct {
	Agencies      []Agency
	Routes        []Route
	Stops         []Stop
	Shapes        map[string]Polyline
	Trips         []Trip
	StopTimes     map[string][]StopTime // par course, triés par séquence
	Calendars     []Calendar
	CalendarDates []CalendarDate
}

// Options restreint le chargement (jeu réduit des fixtures).
type Options struct {
	// RouteShortNames : si non vide, seules ces lignes sont gardées (ex. « 1 », « A », « T3a »).
	RouteShortNames []string
	// ServiceIDs : si non nil, seules les courses de ces services sont gardées.
	ServiceIDs map[string]bool
}

// Load lit et filtre un GTFS.
func Load(src Source, opt Options) (*Feed, error) {
	f := &Feed{Shapes: map[string]Polyline{}, StopTimes: map[string][]StopTime{}}
	keepName := map[string]bool{}
	for _, n := range opt.RouteShortNames {
		keepName[n] = true
	}

	routeIDs := map[string]bool{}
	agencyIDs := map[string]bool{}
	err := eachRow(src, "routes.txt", func(c func(string) string) error {
		mode, ok := ModeOf(c("route_type"), c("route_short_name"))
		if !ok || (len(keepName) > 0 && !keepName[c("route_short_name")]) {
			return nil
		}
		r := Route{
			ID: c("route_id"), AgencyID: c("agency_id"), ShortName: c("route_short_name"),
			LongName: c("route_long_name"), Mode: mode, Color: strings.ToUpper(c("route_color")),
			TextColor: strings.ToUpper(c("route_text_color")), SortOrder: atoi(c("route_sort_order")),
		}
		if r.Color == "" {
			r.Color = "888888"
		}
		if r.TextColor == "" {
			r.TextColor = "FFFFFF"
		}
		f.Routes = append(f.Routes, r)
		routeIDs[r.ID] = true
		agencyIDs[r.AgencyID] = true
		return nil
	})
	if err != nil {
		return nil, err
	}
	if len(f.Routes) == 0 {
		return nil, fmt.Errorf("aucune ligne du périmètre trouvée")
	}

	err = eachRow(src, "agency.txt", func(c func(string) string) error {
		if agencyIDs[c("agency_id")] {
			f.Agencies = append(f.Agencies, Agency{ID: c("agency_id"), Name: c("agency_name"), URL: c("agency_url")})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	shapeIDs := map[string]bool{}
	serviceIDs := map[string]bool{}
	tripIDs := map[string]bool{}
	err = eachRow(src, "trips.txt", func(c func(string) string) error {
		if !routeIDs[c("route_id")] || c("shape_id") == "" {
			return nil
		}
		if opt.ServiceIDs != nil && !opt.ServiceIDs[c("service_id")] {
			return nil
		}
		t := Trip{
			ID: c("trip_id"), RouteID: c("route_id"), ServiceID: c("service_id"),
			ShapeID: c("shape_id"), Headsign: c("trip_headsign"), DirectionID: atoi(c("direction_id")),
		}
		f.Trips = append(f.Trips, t)
		tripIDs[t.ID] = true
		shapeIDs[t.ShapeID] = true
		serviceIDs[t.ServiceID] = true
		return nil
	})
	if err != nil {
		return nil, err
	}

	stopIDs := map[string]bool{}
	err = eachRow(src, "stop_times.txt", func(c func(string) string) error {
		id := c("trip_id")
		if !tripIDs[id] {
			return nil
		}
		arr, err := ParseTime(c("arrival_time"))
		if err != nil {
			return err
		}
		dep, err := ParseTime(c("departure_time"))
		if err != nil {
			return err
		}
		st := StopTime{StopSequence: atoi(c("stop_sequence")), StopID: c("stop_id"), Arrival: arr, Departure: dep}
		f.StopTimes[id] = append(f.StopTimes[id], st)
		stopIDs[st.StopID] = true
		return nil
	})
	if err != nil {
		return nil, err
	}

	if err := f.loadStops(src, stopIDs); err != nil {
		return nil, err
	}
	if err := f.loadShapes(src, shapeIDs); err != nil {
		return nil, err
	}
	if err := f.loadCalendars(src, serviceIDs); err != nil {
		return nil, err
	}
	f.computeDistances()
	f.fixHeadsigns()
	return f, nil
}

// missionCode reconnaît les codes de mission du RER (« BMON », « QGAN ») qu'IDFM publie
// comme destination.
func missionCode(s string) bool {
	if len(s) != 4 {
		return false
	}
	for _, r := range s {
		if r < 'A' || r > 'Z' {
			return false
		}
	}
	return true
}

// fixHeadsigns remplace une destination vide ou en code de mission par le nom du terminus.
func (f *Feed) fixHeadsigns() {
	names := make(map[string]string, len(f.Stops))
	parents := make(map[string]string, len(f.Stops))
	for _, s := range f.Stops {
		names[s.ID] = s.Name
		parents[s.ID] = s.ParentID
	}
	for i, t := range f.Trips {
		if t.Headsign != "" && !missionCode(t.Headsign) {
			continue
		}
		sts := f.StopTimes[t.ID]
		if len(sts) == 0 {
			continue
		}
		last := sts[len(sts)-1].StopID
		if p := parents[last]; p != "" && names[p] != "" {
			last = p
		}
		if n := names[last]; n != "" {
			f.Trips[i].Headsign = n
		}
	}
}

func (f *Feed) loadStops(src Source, used map[string]bool) error {
	all := map[string]Stop{}
	err := eachRow(src, "stops.txt", func(c func(string) string) error {
		lat, err1 := atof(c("stop_lat"))
		lon, err2 := atof(c("stop_lon"))
		if err1 != nil || err2 != nil {
			return nil // nœuds sans coordonnées (accès génériques) : ignorés
		}
		s := Stop{
			ID: c("stop_id"), Name: c("stop_name"), Lat: lat, Lon: lon,
			LocationType: atoi(c("location_type")), ParentID: c("parent_station"), Wheelchair: atoi(c("wheelchair_boarding")),
		}
		all[s.ID] = s
		return nil
	})
	if err != nil {
		return err
	}
	keep := map[string]bool{}
	for id := range used {
		s, ok := all[id]
		if !ok {
			return fmt.Errorf("arrêt %s absent de stops.txt", id)
		}
		keep[id] = true
		if s.ParentID != "" {
			if _, ok := all[s.ParentID]; ok {
				keep[s.ParentID] = true
			}
		}
	}
	// Les gares d'abord : la clé étrangère parent_id doit exister à l'import
	for _, pass := range []bool{true, false} {
		for id := range keep {
			s := all[id]
			if (s.LocationType == 1) != pass {
				continue
			}
			if !keep[s.ParentID] {
				s.ParentID = ""
			}
			f.Stops = append(f.Stops, s)
		}
	}
	return nil
}

func (f *Feed) loadShapes(src Source, used map[string]bool) error {
	type pt struct {
		seq int
		p   Point
	}
	raw := map[string][]pt{}
	err := eachRow(src, "shapes.txt", func(c func(string) string) error {
		id := c("shape_id")
		if !used[id] {
			return nil
		}
		lat, err := atof(c("shape_pt_lat"))
		if err != nil {
			return err
		}
		lon, err := atof(c("shape_pt_lon"))
		if err != nil {
			return err
		}
		raw[id] = append(raw[id], pt{atoi(c("shape_pt_sequence")), Point{lat, lon}})
		return nil
	})
	if err != nil {
		return err
	}
	for id, pts := range raw {
		sortBy(pts, func(a, b pt) bool { return a.seq < b.seq })
		line := make([]Point, len(pts))
		for i, p := range pts {
			line[i] = p.p
		}
		f.Shapes[id] = NewPolyline(line)
	}
	for id := range used {
		if _, ok := f.Shapes[id]; !ok {
			return fmt.Errorf("tracé %s absent de shapes.txt", id)
		}
	}
	return nil
}

func (f *Feed) loadCalendars(src Source, used map[string]bool) error {
	err := eachRow(src, "calendar.txt", func(c func(string) string) error {
		if !used[c("service_id")] {
			return nil
		}
		cal := Calendar{ServiceID: c("service_id"), StartDate: c("start_date"), EndDate: c("end_date")}
		for i, d := range []string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"} {
			cal.Days[i] = c(d) == "1"
		}
		f.Calendars = append(f.Calendars, cal)
		return nil
	})
	if err != nil {
		return err
	}
	return eachRow(src, "calendar_dates.txt", func(c func(string) string) error {
		if used[c("service_id")] {
			f.CalendarDates = append(f.CalendarDates, CalendarDate{
				ServiceID: c("service_id"), Date: c("date"), ExceptionType: atoi(c("exception_type")),
			})
		}
		return nil
	})
}

// computeDistances trie les passages et projette chaque arrêt sur le tracé de sa course.
// Les courses d'une même mission (même tracé, mêmes arrêts) partagent le calcul.
func (f *Feed) computeDistances() {
	stops := make(map[string]Point, len(f.Stops))
	for _, s := range f.Stops {
		stops[s.ID] = Point{s.Lat, s.Lon}
	}
	memo := map[string][]float64{}
	for _, t := range f.Trips {
		sts := f.StopTimes[t.ID]
		sortBy(sts, func(a, b StopTime) bool { return a.StopSequence < b.StopSequence })
		var key strings.Builder
		key.WriteString(t.ShapeID)
		for _, st := range sts {
			key.WriteByte('|')
			key.WriteString(st.StopID)
		}
		dists, ok := memo[key.String()]
		if !ok {
			line := f.Shapes[t.ShapeID]
			dists = make([]float64, len(sts))
			prev := 0.0
			for i, st := range sts {
				prev = line.Project(stops[st.StopID], prev)
				dists[i] = prev
			}
			memo[key.String()] = dists
		}
		for i := range sts {
			sts[i].DistM = dists[i]
		}
	}
}
