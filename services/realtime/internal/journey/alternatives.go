package journey

import (
	"sort"
	"strings"
)

// MaxAlternatives borne le nombre d'itinéraires proposés au visiteur.
const MaxAlternatives = 5

// Nombre maximal de recherches RAPTOR pour une demande (quelques ms chacune).
const alternativeBudget = 8

// Alternatives renvoie le plus rapide et des itinéraires vraiment différents (autres lignes).
//
// Méthode : on refait la recherche en interdisant, tour à tour, les lignes des itinéraires
// déjà trouvés (méthode par exclusion). Un itinéraire n'est gardé que s'il emprunte une
// suite de lignes nouvelle et n'arrive pas trop tard : au plus 20 min ou la moitié de la
// durée du plus rapide après lui (ADR 0019).
func (n *Network) Alternatives(req Request, times Times) []Journey {
	first := n.Plan(req, times)
	if len(first) == 0 {
		return first
	}
	fastest := first[0]
	limit := fastest.Arrive + max(1200, (fastest.Arrive-fastest.Depart)/2)

	seen := map[string]bool{}
	var out []Journey
	var queue [][]string
	tried := map[string]bool{}
	push := func(base []string, j Journey) {
		for _, r := range rideRoutes(j) {
			set := append(append([]string{}, base...), r)
			sort.Strings(set)
			if k := strings.Join(set, "|"); !tried[k] {
				tried[k] = true
				queue = append(queue, set)
			}
		}
	}
	add := func(base []string, j Journey) {
		k := signature(j)
		if seen[k] || j.Arrive > limit {
			return
		}
		seen[k] = true
		out = append(out, j)
		push(base, j)
	}
	for _, j := range first {
		add(nil, j)
	}
	for runs := 0; runs < alternativeBudget && len(queue) > 0 && len(out) < MaxAlternatives*2; runs++ {
		ex := queue[0]
		queue = queue[1:]
		r := req
		r.ExcludeRoutes = map[string]bool{}
		for k, v := range req.ExcludeRoutes {
			r.ExcludeRoutes[k] = v
		}
		for _, id := range ex {
			r.ExcludeRoutes[id] = true
		}
		for _, j := range n.Plan(r, times) {
			if len(j.Legs) > 0 {
				add(ex, j)
			}
		}
	}
	sort.SliceStable(out, func(a, b int) bool {
		if out[a].Arrive != out[b].Arrive {
			return out[a].Arrive < out[b].Arrive
		}
		return out[a].Transfers < out[b].Transfers
	})
	if len(out) > MaxAlternatives {
		out = out[:MaxAlternatives]
	}
	return out
}

// rideRoutes : lignes empruntées, dans l'ordre.
func rideRoutes(j Journey) []string {
	var r []string
	for _, l := range j.Legs {
		if !l.Walk {
			r = append(r, l.RouteID)
		}
	}
	return r
}

// signature : suite de lignes et de gares de montée/descente (un train plus tard sur le même
// parcours n'est pas une alternative).
func signature(j Journey) string {
	var b strings.Builder
	for _, l := range j.Legs {
		if !l.Walk {
			b.WriteString(l.RouteID + ":" + l.From + ">" + l.To + ";")
		}
	}
	return b.String()
}
