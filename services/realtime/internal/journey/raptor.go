package journey

import (
	"math"
	"sort"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/ref"
)

// Times fournit les horaires (estimés ou théoriques) d'une course.
type Times func(t *ref.Trip) (arr, dep []int64, theoretical bool)

// Point est un arrêt de départ ou d'arrivée avec un temps de marche (secondes).
type Point struct {
	Stop    string
	WalkSec int64
}

// Request décrit une recherche.
type Request struct {
	From         []Point
	To           []Point
	Depart       time.Time
	MaxTransfers int // 4 par défaut
}

// Leg est un tronçon : à bord d'une course, ou à pied entre deux arrêts.
type Leg struct {
	Walk        bool   `json:"walk"`
	TripKey     string `json:"trip_id,omitempty"`
	RouteID     string `json:"route_id,omitempty"`
	Headsign    string `json:"headsign,omitempty"`
	From        string `json:"from_stop_id"`
	To          string `json:"to_stop_id"`
	Dep         int64  `json:"dep"`
	Arr         int64  `json:"arr"`
	Stops       int    `json:"stops,omitempty"` // arrêts parcourus
	Theoretical bool   `json:"theoretical,omitempty"`
}

// Journey est un itinéraire : marche initiale, tronçons, marche finale.
type Journey struct {
	Depart    int64 `json:"depart"` // départ à pied du point de départ
	Arrive    int64 `json:"arrive"` // arrivée au point d'arrivée
	WalkStart int64 `json:"walk_start"`
	WalkEnd   int64 `json:"walk_end"`
	Transfers int   `json:"transfers"`
	Legs      []Leg `json:"legs"`
}

// Temps minimal pour changer de train sur le même quai.
const sameStopChange = 60

const inf = math.MaxInt64

type labelKind uint8

const (
	kindStart labelKind = iota
	kindRide
	kindWalk
)

type label struct {
	kind      labelKind
	trip      *ref.Trip
	board     int // indice de montée dans la course
	alight    int
	boardStop string
	boardDep  int64  // départ estimé de la course à la montée
	arrive    int64  // arrivée estimée à la descente
	from      string // marche : arrêt de départ
	walk      int64
}

// Plan cherche jusqu'à 3 itinéraires non dominés (arrivée la plus tôt, moins de correspondances).
func (n *Network) Plan(req Request, times Times) []Journey {
	maxT := req.MaxTransfers
	if maxT <= 0 {
		maxT = 4
	}
	rounds := maxT + 1
	t0 := req.Depart.Unix()
	destWalk := map[string]int64{}
	for _, p := range req.To {
		if w, ok := destWalk[p.Stop]; !ok || p.WalkSec < w {
			destWalk[p.Stop] = p.WalkSec
		}
	}

	tau := make([]map[string]int64, rounds+1)
	parent := make([]map[string]label, rounds+1)
	for k := range tau {
		tau[k] = map[string]int64{}
		parent[k] = map[string]label{}
	}
	best := map[string]int64{}
	get := func(m map[string]int64, s string) int64 {
		if v, ok := m[s]; ok {
			return v
		}
		return inf
	}

	marked := map[string]bool{}
	for _, o := range req.From {
		at := t0 + o.WalkSec
		if at < get(tau[0], o.Stop) {
			tau[0][o.Stop] = at
			best[o.Stop] = at
			parent[0][o.Stop] = label{kind: kindStart, walk: o.WalkSec}
			marked[o.Stop] = true
		}
	}
	bestDest := int64(inf)
	n.footpaths(0, marked, tau, parent, best, &bestDest, destWalk)
	bestDest = n.destination(tau[0], destWalk)

	cache := map[*ref.Trip][2][]int64{}
	theo := map[*ref.Trip]bool{}
	tt := func(t *ref.Trip) ([]int64, []int64) {
		if c, ok := cache[t]; ok {
			return c[0], c[1]
		}
		a, d, th := times(t)
		cache[t] = [2][]int64{a, d}
		theo[t] = th
		return a, d
	}

	var journeys []Journey
	lastArrival := bestDest
	if bestDest != inf {
		// Destination atteinte à pied, sans train
		if j, ok := n.rebuild(0, tau, parent, destWalk, theo); ok {
			journeys = append(journeys, j)
		}
	}

	for k := 1; k <= rounds && len(marked) > 0; k++ {
		// Parcours à examiner, depuis le premier arrêt marqué de chacun
		queue := map[int]int{}
		for s := range marked {
			for _, sr := range n.byStop[s] {
				if i, ok := queue[sr.pattern]; !ok || sr.index < i {
					queue[sr.pattern] = sr.index
				}
			}
		}
		next := map[string]bool{}
		for pi, start := range queue {
			p := &n.patterns[pi]
			var trip *ref.Trip
			var board int
			var boardStop string
			for i := start; i < len(p.stops); i++ {
				s := p.stops[i]
				if trip != nil {
					arr, dep := tt(trip)
					if a := arr[i]; a < get(best, s) && a < bestDest {
						tau[k][s] = a
						best[s] = a
						parent[k][s] = label{kind: kindRide, trip: trip, board: board, alight: i, boardStop: boardStop, boardDep: dep[board], arrive: a}
						next[s] = true
					}
				}
				prev := get(tau[k-1], s)
				if prev == inf {
					continue
				}
				if l, ok := parent[k-1][s]; ok && l.kind == kindRide {
					prev += sameStopChange
				}
				if trip != nil {
					_, dep := tt(trip)
					if prev > dep[i] {
						continue
					}
				}
				if et := n.earliest(p, i, prev, tt); et != nil && et != trip {
					if trip == nil {
						trip, board, boardStop = et, i, s
					} else {
						_, d1 := tt(et)
						_, d2 := tt(trip)
						if d1[i] < d2[i] {
							trip, board, boardStop = et, i, s
						}
					}
				}
			}
		}
		n.footpaths(k, next, tau, parent, best, &bestDest, destWalk)
		marked = next
		if d := n.destination(tau[k], destWalk); d < lastArrival {
			bestDest = d
			lastArrival = d
			if j, ok := n.rebuild(k, tau, parent, destWalk, theo); ok {
				journeys = append(journeys, j)
			}
		}
	}
	// Plus rapide d'abord ; trois au plus
	sort.SliceStable(journeys, func(a, b int) bool { return journeys[a].Arrive < journeys[b].Arrive })
	if len(journeys) > 3 {
		journeys = journeys[:3]
	}
	return journeys
}

// earliest renvoie la course du parcours qui part le plus tôt de l'arrêt i à partir de t.
func (n *Network) earliest(p *pattern, i int, t int64, tt func(*ref.Trip) ([]int64, []int64)) *ref.Trip {
	// Les retards restent de l'ordre de quelques minutes : on part 30 min avant en théorique
	lo := sort.Search(len(p.trips), func(j int) bool { return p.trips[j].Calls[i].Dep >= t-1800 })
	var best *ref.Trip
	bestDep := int64(inf)
	for j := lo; j < len(p.trips); j++ {
		c := p.trips[j].Calls[i]
		// Au-delà de 30 min après le meilleur départ trouvé, aucune course ne fera mieux
		if bestDep != inf && c.Dep > bestDep+1800 {
			break
		}
		_, dep := tt(p.trips[j])
		if dep[i] >= t && dep[i] < bestDep && i < len(p.stops)-1 {
			best, bestDep = p.trips[j], dep[i]
		}
	}
	return best
}

// footpaths propage les arrivées du tour k par les correspondances à pied.
func (n *Network) footpaths(k int, marked map[string]bool, tau []map[string]int64, parent []map[string]label, best map[string]int64, bestDest *int64, destWalk map[string]int64) {
	from := make([]string, 0, len(marked))
	for s := range marked {
		from = append(from, s)
	}
	for _, s := range from {
		at := tau[k][s]
		for _, h := range n.transfers[s] {
			t := at + h.Sec
			if b, ok := best[h.To]; ok && t >= b {
				continue
			}
			if t >= *bestDest {
				continue
			}
			tau[k][h.To] = t
			best[h.To] = t
			parent[k][h.To] = label{kind: kindWalk, from: s, walk: h.Sec}
			marked[h.To] = true
		}
	}
}

func (n *Network) destination(arr map[string]int64, destWalk map[string]int64) int64 {
	b := int64(inf)
	for s, w := range destWalk {
		if a, ok := arr[s]; ok && a+w < b {
			b = a + w
		}
	}
	return b
}

// rebuild reconstitue l'itinéraire qui arrive au mieux à destination au tour k.
func (n *Network) rebuild(k int, tau []map[string]int64, parent []map[string]label, destWalk map[string]int64, theo map[*ref.Trip]bool) (Journey, bool) {
	end, endWalk := "", int64(0)
	b := int64(inf)
	for s, w := range destWalk {
		if a, ok := tau[k][s]; ok && a+w < b {
			b, end, endWalk = a+w, s, w
		}
	}
	if end == "" {
		return Journey{}, false
	}
	j := Journey{Arrive: b, WalkEnd: endWalk}
	s, round := end, k
	for guard := 0; guard < 64; guard++ {
		l, ok := parent[round][s]
		if !ok {
			return Journey{}, false
		}
		switch l.kind {
		case kindStart:
			j.WalkStart = l.walk
			j.Depart = tau[round][s] - l.walk
			// Les tronçons ont été ajoutés à l'envers
			for a, z := 0, len(j.Legs)-1; a < z; a, z = a+1, z-1 {
				j.Legs[a], j.Legs[z] = j.Legs[z], j.Legs[a]
			}
			if len(j.Legs) > 0 {
				j.Depart = j.Legs[0].Dep - l.walk
			}
			// Heure à laquelle partir à pied pour attraper le premier train (pas plus tôt)
			walkBefore := l.walk
			rides := 0
			for _, leg := range j.Legs {
				if leg.Walk {
					if rides == 0 {
						walkBefore += leg.Arr - leg.Dep
					}
					continue
				}
				if rides == 0 {
					j.Depart = leg.Dep - walkBefore
				}
				rides++
			}
			if rides > 0 {
				j.Transfers = rides - 1
			}
			return j, true
		case kindWalk:
			at := tau[round][s]
			j.Legs = append(j.Legs, Leg{Walk: true, From: l.from, To: s, Dep: at - l.walk, Arr: at})
			s = l.from
		case kindRide:
			t := l.trip
			j.Legs = append(j.Legs, Leg{
				TripKey: t.Key, RouteID: t.RouteID, Headsign: t.Headsign,
				From: l.boardStop, To: s, Dep: l.boardDep, Arr: l.arrive, Stops: l.alight - l.board,
				Theoretical: theo[t],
			})
			s, round = l.boardStop, round-1
		}
	}
	return Journey{}, false
}
