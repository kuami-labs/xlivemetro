// Package ref construit le référentiel du moment : les courses qui circulent la veille et le
// jour donnés, avec des horaires absolus (les courses après minuit appartiennent à la veille).
package ref

import (
	"strconv"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
)

// Paris est le fuseau des horaires GTFS d'IDFM.
var Paris = mustLoad("Europe/Paris")

func mustLoad(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

// Route est une ligne.
type Route struct {
	ID, ShortName, Color string
	Mode                 gtfs.Mode
}

// Call est un passage théorique, en secondes Unix.
type Call struct {
	StopID   string
	Arr, Dep int64
	DistM    float64
}

// Trip est une course datée (une course GTFS un jour de service donné).
type Trip struct {
	Key       string // identifiant unique : trip_id + date de service
	TripID    string
	RouteID   string
	ShapeID   string
	Headsign  string
	Direction int
	Calls     []Call
}

// Start et End bornent la course dans le temps.
func (t *Trip) Start() int64 { return t.Calls[0].Dep }

// End renvoie l'arrivée au terminus.
func (t *Trip) End() int64 { return t.Calls[len(t.Calls)-1].Arr }

// Hop est une correspondance à pied vers un autre arrêt.
type Hop struct {
	To  string
	Sec int64
}

// Ref est le référentiel du moment.
type Ref struct {
	Routes    map[string]Route
	Stops     map[string]gtfs.Stop
	Shapes    map[string]gtfs.Polyline
	Trips     []*Trip
	Transfers map[string][]Hop // correspondances à pied, par arrêt de départ
	byCall    map[string]*Trip
}

// Build construit le référentiel des jours de service day-1 et day (heure de Paris).
func Build(f *gtfs.Feed, day time.Time) *Ref {
	r := &Ref{
		Routes: map[string]Route{}, Stops: map[string]gtfs.Stop{},
		Shapes: f.Shapes, Transfers: map[string][]Hop{}, byCall: map[string]*Trip{},
	}
	for _, t := range f.Transfers {
		r.Transfers[t.From] = append(r.Transfers[t.From], Hop{To: t.To, Sec: int64(t.MinSec)})
	}
	for _, rt := range f.Routes {
		r.Routes[rt.ID] = Route{ID: rt.ID, ShortName: rt.ShortName, Color: rt.Color, Mode: rt.Mode}
	}
	for _, s := range f.Stops {
		r.Stops[s.ID] = s
	}
	d := day.In(Paris)
	today := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, Paris)
	for _, service := range []time.Time{today.AddDate(0, 0, -1), today} {
		active := f.ActiveServices(service)
		// Midi moins 12 h : règle GTFS, robuste aux changements d'heure
		base := time.Date(service.Year(), service.Month(), service.Day(), 12, 0, 0, 0, Paris).Add(-12 * time.Hour).Unix()
		date := service.Format("20060102")
		for _, t := range f.Trips {
			sts := f.StopTimes[t.ID]
			if !active[t.ServiceID] || len(sts) < 2 {
				continue
			}
			trip := &Trip{
				Key: t.ID + "@" + date, TripID: t.ID, RouteID: t.RouteID, ShapeID: t.ShapeID,
				Headsign: t.Headsign, Direction: t.DirectionID, Calls: make([]Call, len(sts)),
			}
			for i, st := range sts {
				trip.Calls[i] = Call{StopID: st.StopID, Arr: base + int64(st.Arrival), Dep: base + int64(st.Departure), DistM: st.DistM}
				r.byCall[callKey(t.RouteID, st.StopID, base+int64(st.Departure))] = trip
			}
			r.Trips = append(r.Trips, trip)
		}
	}
	return r
}

// Match retrouve la course d'une ligne qui passe à l'arrêt à l'heure théorique donnée.
// C'est ainsi que les courses SIRI (identifiants propres aux exploitants) rejoignent le GTFS.
func (r *Ref) Match(routeID, stopID string, aimed time.Time) (*Trip, bool) {
	t, ok := r.byCall[callKey(routeID, stopID, aimed.Unix())]
	return t, ok
}

// Between renvoie les courses en circulation entre from et to.
func (r *Ref) Between(from, to time.Time) []*Trip {
	var out []*Trip
	for _, t := range r.Trips {
		if t.End() >= from.Unix() && t.Start() <= to.Unix() {
			out = append(out, t)
		}
	}
	return out
}

func callKey(route, stop string, unix int64) string {
	return route + "|" + stop + "|" + strconv.FormatInt(unix, 10)
}
