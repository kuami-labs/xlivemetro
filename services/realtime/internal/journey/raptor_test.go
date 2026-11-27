package journey

import (
	"testing"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/ref"
)

// Réseau fictif (heures en minutes après 8 h) :
//
//	ligne L1 : A → B → C (lente, directe)
//	ligne L2 : A → X (rapide)   correspondance à pied X → Y (3 min)
//	ligne L3 : Y → C (rapide)
var base = time.Date(2026, 12, 1, 8, 0, 0, 0, time.UTC).Unix()

func at(min int) int64 { return base + int64(min)*60 }

func trip(key, route string, stops []string, mins []int) *ref.Trip {
	t := &ref.Trip{Key: key, RouteID: route, Headsign: stops[len(stops)-1]}
	for i, s := range stops {
		t.Calls = append(t.Calls, ref.Call{StopID: s, Arr: at(mins[i]), Dep: at(mins[i])})
	}
	return t
}

func network() *Network {
	r := &ref.Ref{
		Trips: []*ref.Trip{
			trip("L1-a", "L1", []string{"A", "B", "C"}, []int{5, 20, 40}),
			trip("L1-b", "L1", []string{"A", "B", "C"}, []int{15, 30, 50}),
			trip("L2-a", "L2", []string{"A", "X"}, []int{6, 12}),
			trip("L3-a", "L3", []string{"Y", "C"}, []int{17, 25}),
			trip("L3-b", "L3", []string{"Y", "C"}, []int{14, 22}), // partie avant l'arrivée possible
		},
		Transfers: map[string][]ref.Hop{"X": {{To: "Y", Sec: 180}}},
	}
	return NewNetwork(r)
}

func theoretical(t *ref.Trip) ([]int64, []int64, bool) {
	arr := make([]int64, len(t.Calls))
	dep := make([]int64, len(t.Calls))
	for i, c := range t.Calls {
		arr[i], dep[i] = c.Arr, c.Dep
	}
	return arr, dep, true
}

func plan(n *Network, times Times, depart int) []Journey {
	return n.Plan(Request{
		From:   []Point{{Stop: "A"}},
		To:     []Point{{Stop: "C"}},
		Depart: time.Unix(at(depart), 0),
	}, times)
}

func TestFastestWithTransferAndDirect(t *testing.T) {
	js := plan(network(), theoretical, 0)
	if len(js) != 2 {
		t.Fatalf("itinéraires = %d, attendu 2 (rapide avec correspondance, direct)", len(js))
	}
	fast, direct := js[0], js[1]
	// L2 part à 8:06, X à 8:12, marche jusqu'à Y à 8:15, L3-a (8:17) jusqu'à C à 8:25
	if fast.Arrive != at(25) || fast.Transfers != 1 || len(fast.Legs) != 3 {
		t.Fatalf("rapide : %+v", fast)
	}
	if !fast.Legs[1].Walk || fast.Legs[1].From != "X" || fast.Legs[1].To != "Y" {
		t.Errorf("marche de correspondance : %+v", fast.Legs[1])
	}
	if fast.Legs[0].Dep != at(6) || fast.Legs[2].TripKey != "L3-a" || fast.Depart != at(6) {
		t.Errorf("tronçons : %+v", fast.Legs)
	}
	if direct.Arrive != at(40) || direct.Transfers != 0 || direct.Legs[0].TripKey != "L1-a" || direct.Legs[0].Stops != 2 {
		t.Errorf("direct : %+v", direct)
	}
}

func TestMissedConnection(t *testing.T) {
	// Départ à 8:07 : L2-a est parti ; seule L1-b (8:15) reste, arrivée 8:50
	js := plan(network(), theoretical, 7)
	if len(js) != 1 || js[0].Arrive != at(50) || js[0].Legs[0].TripKey != "L1-b" {
		t.Fatalf("après le départ de L2 : %+v", js)
	}
}

func TestDelayChangesResult(t *testing.T) {
	// L2-a annoncée avec 10 min de retard : X à 8:22, Y à 8:25, plus de L3 → direct L1-a gagne
	delayed := func(tr *ref.Trip) ([]int64, []int64, bool) {
		arr, dep, _ := theoretical(tr)
		if tr.Key == "L2-a" {
			for i := range arr {
				arr[i] += 600
				dep[i] += 600
			}
		}
		return arr, dep, false
	}
	js := plan(network(), delayed, 0)
	if len(js) != 1 || js[0].Legs[0].TripKey != "L1-a" || js[0].Legs[0].Theoretical {
		t.Fatalf("avec retard : %+v", js)
	}
}

func TestWalkingOriginsAndNoRoute(t *testing.T) {
	n := network()
	// Deux départs possibles : A à 10 min à pied, Y à 2 min à pied → L3-b à 8:14
	js := n.Plan(Request{
		From:   []Point{{Stop: "A", WalkSec: 600}, {Stop: "Y", WalkSec: 120}},
		To:     []Point{{Stop: "C", WalkSec: 60}},
		Depart: time.Unix(at(0), 0),
	}, theoretical)
	if len(js) == 0 || js[0].Legs[0].TripKey != "L3-b" || js[0].WalkStart != 120 || js[0].Arrive != at(22)+60 {
		t.Fatalf("départs à pied : %+v", js)
	}
	if js[0].Depart != at(14)-120 {
		t.Errorf("heure de départ à pied : %d", (js[0].Depart-base)/60)
	}
	// Aucun trajet après le dernier train
	if js := plan(n, theoretical, 60); len(js) != 0 {
		t.Errorf("aucun trajet attendu : %+v", js)
	}
	// Départ et arrivée identiques : arrivée à pied, sans train
	same := n.Plan(Request{From: []Point{{Stop: "C"}}, To: []Point{{Stop: "C"}}, Depart: time.Unix(at(0), 0)}, theoretical)
	if len(same) != 1 || len(same[0].Legs) != 0 {
		t.Errorf("même gare : %+v", same)
	}
}
