// Package position estime la position des trains (ADR 0004) : horaires (théoriques, ou
// estimés par le flux temps réel) → segment entre deux arrêts → point sur le tracé.
package position

import (
	"sync"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/ref"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/siri"
)

// Vehicle est l'état estimé d'un train à un instant.
type Vehicle struct {
	ID          string // clé de la course datée
	RouteID     string
	Headsign    string
	Lat, Lon    float64
	Bearing     float64 // degrés, 0 = nord
	SpeedMps    float64 // vitesse le long du tracé, pour l'interpolation côté client
	DelayS      int32   // retard au prochain arrêt, en secondes
	NextStopID  string
	AtStop      bool // à quai
	Theoretical bool // aucune donnée temps réel : horaires théoriques
}

// times sont les horaires estimés d'une course, alignés sur ref.Trip.Calls.
type times struct {
	arr, dep []int64
	seen     time.Time
}

// Engine garde les horaires temps réel reçus et calcule les positions.
type Engine struct {
	mu  sync.RWMutex
	ref *ref.Ref
	rt  map[string]*times
	// Au-delà de cette durée sans mise à jour, une course repasse en horaires théoriques.
	TTL time.Duration
}

// New crée un moteur sur un référentiel.
func New(r *ref.Ref) *Engine {
	return &Engine{ref: r, rt: map[string]*times{}, TTL: 10 * time.Minute}
}

// SetRef change de référentiel (nouveau jour) en gardant les horaires temps réel connus.
func (e *Engine) SetRef(r *ref.Ref) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.ref = r
}

// ApplyStats résume l'intégration d'un flux.
type ApplyStats struct{ Journeys, Matched int }

// Apply intègre les courses d'une réponse SIRI Lite.
func (e *Engine) Apply(journeys []siri.EstimatedVehicleJourney, now time.Time) ApplyStats {
	e.mu.Lock()
	defer e.mu.Unlock()
	st := ApplyStats{Journeys: len(journeys)}
	for _, j := range journeys {
		trip := e.match(j)
		if trip == nil {
			continue
		}
		st.Matched++
		e.rt[trip.Key] = estimate(trip, j.EstimatedCalls.EstimatedCall, now)
	}
	return st
}

func (e *Engine) match(j siri.EstimatedVehicleJourney) *ref.Trip {
	route, ok := siri.LineToGTFS(j.LineRef.Value)
	if !ok {
		return nil
	}
	for _, c := range j.EstimatedCalls.EstimatedCall {
		stop, ok := siri.StopToGTFS(c.StopPointRef.Value)
		if !ok {
			continue
		}
		aimed, ok := c.Aimed()
		if !ok {
			continue
		}
		if t, ok := e.ref.Match(route, stop, aimed); ok {
			return t
		}
	}
	return nil
}

// estimate aligne les passages SIRI sur ceux de la course ; un passage sans estimation
// prend le retard du dernier passage connu (ou du suivant, avant le premier).
func estimate(t *ref.Trip, calls []siri.EstimatedCall, now time.Time) *times {
	n := len(t.Calls)
	delay := make([]int64, n)
	known := make([]bool, n)
	idx := 0
	for _, c := range calls {
		stop, ok := siri.StopToGTFS(c.StopPointRef.Value)
		if !ok {
			continue
		}
		for i := idx; i < n; i++ {
			if t.Calls[i].StopID != stop {
				continue
			}
			aimed, ok1 := c.Aimed()
			exp, ok2 := c.Expected()
			if ok1 && ok2 {
				delay[i] = int64(exp.Sub(aimed).Seconds())
				known[i] = true
			}
			idx = i + 1
			break
		}
	}
	// Propagation : avant le premier connu, on prend le premier ; ensuite, le dernier connu
	firstKnown := -1
	for i := range known {
		if known[i] {
			firstKnown = i
			break
		}
	}
	if firstKnown >= 0 {
		last := delay[firstKnown]
		for i := range delay {
			if known[i] {
				last = delay[i]
			} else {
				delay[i] = last
			}
		}
	}
	tm := &times{arr: make([]int64, n), dep: make([]int64, n), seen: now}
	for i, c := range t.Calls {
		tm.arr[i] = c.Arr + delay[i]
		tm.dep[i] = max(c.Dep+delay[i], tm.arr[i])
	}
	return tm
}

// Compute renvoie la position de tous les trains en circulation à l'instant now.
func (e *Engine) Compute(now time.Time) []Vehicle {
	e.mu.RLock()
	defer e.mu.RUnlock()
	ts := now.Unix()
	var out []Vehicle
	// Marge de 15 min : une course en retard peut encore rouler après son terminus théorique
	for _, t := range e.ref.Between(now.Add(-15*time.Minute), now) {
		tm, ok := e.rt[t.Key]
		theoretical := !ok || now.Sub(tm.seen) > e.TTL
		if theoretical {
			tm = theoreticalTimes(t)
		}
		v, ok := locate(e.ref, t, tm, ts)
		if !ok {
			continue
		}
		v.Theoretical = theoretical
		out = append(out, v)
	}
	return out
}

func theoreticalTimes(t *ref.Trip) *times {
	tm := &times{arr: make([]int64, len(t.Calls)), dep: make([]int64, len(t.Calls))}
	for i, c := range t.Calls {
		tm.arr[i], tm.dep[i] = c.Arr, c.Dep
	}
	return tm
}

// locate place la course à l'instant ts ; false si elle n'a pas commencé ou est terminée.
func locate(r *ref.Ref, t *ref.Trip, tm *times, ts int64) (Vehicle, bool) {
	n := len(t.Calls)
	if ts < tm.dep[0] || ts >= tm.arr[n-1] {
		return Vehicle{}, false
	}
	v := Vehicle{ID: t.Key, RouteID: t.RouteID, Headsign: t.Headsign}
	var dist float64
	for i := 0; i < n-1; i++ {
		if ts < tm.dep[i] { // à quai à l'arrêt i (arrivé, pas encore reparti)
			dist = t.Calls[i].DistM
			v.AtStop, v.NextStopID = true, t.Calls[i].StopID
			v.DelayS = int32(tm.dep[i] - t.Calls[i].Dep)
			break
		}
		if ts < tm.arr[i+1] { // entre l'arrêt i et l'arrêt i+1
			d0, d1 := t.Calls[i].DistM, t.Calls[i+1].DistM
			span := tm.arr[i+1] - tm.dep[i]
			frac := 0.0
			if span > 0 {
				frac = float64(ts-tm.dep[i]) / float64(span)
				v.SpeedMps = (d1 - d0) / float64(span)
			}
			dist = d0 + frac*(d1-d0)
			v.NextStopID = t.Calls[i+1].StopID
			v.DelayS = int32(tm.arr[i+1] - t.Calls[i+1].Arr)
			break
		}
	}
	line, ok := r.Shapes[t.ShapeID]
	if !ok {
		return Vehicle{}, false
	}
	p, bearing := line.At(dist)
	v.Lat, v.Lon, v.Bearing = p.Lat, p.Lon, bearing
	return v, true
}
