package journey

import (
	"testing"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/ref"
)

// Réseau du test principal + ligne L4 : A → C directe, plus lente que L1 (dominée)
// et ligne L5 : A → C, beaucoup trop lente pour être proposée.
func networkWithAlternatives() *Network {
	n := network()
	trips := append([]*ref.Trip{}, n.ref.Trips...)
	trips = append(trips,
		trip("L4-a", "L4", []string{"A", "C"}, []int{8, 45}),
		trip("L5-a", "L5", []string{"A", "C"}, []int{9, 90}),
	)
	return NewNetwork(&ref.Ref{Trips: trips, Transfers: n.ref.Transfers})
}

func TestAlternatives(t *testing.T) {
	n := networkWithAlternatives()
	req := Request{From: []Point{{Stop: "A"}}, To: []Point{{Stop: "C"}}, Depart: time.Unix(at(0), 0)}
	js := n.Alternatives(req, theoretical)
	// Plus rapide (L2+L3, 8:25), direct L1 (8:40), puis L4 (8:45) ; L5 (9:30) trop lent
	if len(js) != 3 {
		t.Fatalf("itinéraires = %d : %+v", len(js), js)
	}
	want := []string{"L2", "L1", "L4"}
	for i, w := range want {
		if js[i].Legs[0].RouteID != w {
			t.Errorf("option %d : ligne %s, attendu %s", i, js[i].Legs[0].RouteID, w)
		}
	}
	// Aucun doublon de parcours
	seen := map[string]bool{}
	for _, j := range js {
		if seen[signature(j)] {
			t.Errorf("doublon : %s", signature(j))
		}
		seen[signature(j)] = true
	}
}

func TestExcludeRoutes(t *testing.T) {
	n := network()
	js := n.Plan(Request{
		From: []Point{{Stop: "A"}}, To: []Point{{Stop: "C"}}, Depart: time.Unix(at(0), 0),
		ExcludeRoutes: map[string]bool{"L1": true},
	}, theoretical)
	for _, j := range js {
		for _, l := range j.Legs {
			if l.RouteID == "L1" {
				t.Fatalf("L1 exclue mais empruntée : %+v", j)
			}
		}
	}
	if len(js) != 1 || js[0].Arrive != at(25) {
		t.Fatalf("sans L1 : %+v", js)
	}
}

func TestAlternativesNone(t *testing.T) {
	if js := plan(network(), theoretical, 60); len(js) != 0 {
		t.Fatal("aucun trajet attendu")
	}
	n := network()
	req := Request{From: []Point{{Stop: "A"}}, To: []Point{{Stop: "C"}}, Depart: time.Unix(at(60), 0)}
	if js := n.Alternatives(req, theoretical); len(js) != 0 {
		t.Fatalf("aucun trajet attendu : %+v", js)
	}
}
