// Package journey calcule des itinéraires métro/RER/tram avec RAPTOR (Delling, Pajor,
// Werneck, 2012) sur les courses du jour en mémoire, horaires estimés compris (ADR 0018).
package journey

import (
	"sort"
	"strings"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/ref"
)

// pattern regroupe les courses qui desservent exactement la même suite d'arrêts.
type pattern struct {
	stops []string
	trips []*ref.Trip // triées par départ théorique au premier arrêt
}

type stopRef struct {
	pattern int
	index   int
}

// Network est le réseau préparé pour la recherche (une fois par référentiel du jour).
type Network struct {
	ref       *ref.Ref
	patterns  []pattern
	byStop    map[string][]stopRef
	transfers map[string][]ref.Hop
}

// NewNetwork prépare le réseau à partir du référentiel.
func NewNetwork(r *ref.Ref) *Network {
	n := &Network{ref: r, byStop: map[string][]stopRef{}, transfers: r.Transfers}
	index := map[string]int{}
	for _, t := range r.Trips {
		var key strings.Builder
		key.WriteString(t.RouteID)
		for _, c := range t.Calls {
			key.WriteByte('|')
			key.WriteString(c.StopID)
		}
		i, ok := index[key.String()]
		if !ok {
			stops := make([]string, len(t.Calls))
			for j, c := range t.Calls {
				stops[j] = c.StopID
			}
			i = len(n.patterns)
			index[key.String()] = i
			n.patterns = append(n.patterns, pattern{stops: stops})
		}
		n.patterns[i].trips = append(n.patterns[i].trips, t)
	}
	for i := range n.patterns {
		p := &n.patterns[i]
		sort.Slice(p.trips, func(a, b int) bool { return p.trips[a].Calls[0].Dep < p.trips[b].Calls[0].Dep })
		for j, s := range p.stops {
			n.byStop[s] = append(n.byStop[s], stopRef{pattern: i, index: j})
		}
	}
	return n
}

// Ref renvoie le référentiel du réseau.
func (n *Network) Ref() *ref.Ref { return n.ref }
