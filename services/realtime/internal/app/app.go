// Package app assemble le service temps réel : référentiel, source, ingestion, positions, diffusion.
package app

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/feed"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/hub"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/position"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/ref"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/siri"
)

// Config règle les cadences.
type Config struct {
	FeedInterval     time.Duration // appel de la source (30 s minimum avec PRIM)
	Tick             time.Duration // calcul et diffusion des positions
	MessagesInterval time.Duration // messages de perturbation (2 min)
}

// App est le service en fonctionnement.
type App struct {
	cfg    Config
	feed   *gtfs.Feed
	source feed.Source
	// Messages de perturbation (SIRI Lite General Message) ; nil = aucun
	Messages feed.Source
	engine   *position.Engine
	Hub      *hub.Hub
	now      func() time.Time

	mu        sync.Mutex
	day       string
	lastCycle time.Time
	lastErr   string
	matched   int
	disrupts  []siri.Disruption
}

// New prépare le service. Le flux synthétique suit automatiquement le référentiel du jour.
func New(cfg Config, f *gtfs.Feed, src feed.Source, h *hub.Hub, now func() time.Time) *App {
	t := now()
	r := ref.Build(f, t)
	if s, ok := src.(*feed.Synthetic); ok {
		s.SetRef(r)
	}
	return &App{cfg: cfg, feed: f, source: src, engine: position.New(r), Hub: h, now: now, day: dayOf(t)}
}

func dayOf(t time.Time) string { return t.In(ref.Paris).Format("2006-01-02") }

// Run lance les deux boucles jusqu'à l'annulation du contexte.
func (a *App) Run(ctx context.Context) {
	a.Cycle(ctx)
	a.Tick()
	a.Disruptions(ctx)
	msgEvery := a.cfg.MessagesInterval
	if msgEvery <= 0 {
		msgEvery = 2 * time.Minute
	}
	feedT := time.NewTicker(a.cfg.FeedInterval)
	tickT := time.NewTicker(a.cfg.Tick)
	msgT := time.NewTicker(msgEvery)
	defer feedT.Stop()
	defer tickT.Stop()
	defer msgT.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-feedT.C:
			a.Cycle(ctx)
		case <-tickT.C:
			a.Tick()
		case <-msgT.C:
			a.Disruptions(ctx)
		}
	}
}

// Cycle interroge la source et intègre les horaires estimés.
func (a *App) Cycle(ctx context.Context) {
	now := a.now()
	a.rollDay(now)
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	b, err := a.source.Fetch(ctx, now)
	if err == nil {
		var js []siri.EstimatedVehicleJourney
		if js, err = siri.Decode(b); err == nil {
			st := a.engine.Apply(js, now)
			a.mu.Lock()
			a.lastCycle, a.lastErr, a.matched = now, "", st.Matched
			a.mu.Unlock()
			slog.Info("cycle", "source", a.source.Name(), "courses", st.Journeys, "rapprochées", st.Matched)
			return
		}
	}
	var rl *feed.RateLimitError
	if errors.As(err, &rl) {
		slog.Warn("quota PRIM", "retry_after", rl.RetryAfter)
	} else {
		slog.Error("cycle échoué", "source", a.source.Name(), "err", err)
	}
	a.mu.Lock()
	a.lastErr = err.Error()
	a.mu.Unlock()
}

// Disruptions met à jour les messages de perturbation. En cas d'erreur, les derniers
// messages connus sont gardés.
func (a *App) Disruptions(ctx context.Context) {
	if a.Messages == nil {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	now := a.now()
	b, err := a.Messages.Fetch(ctx, now)
	if err != nil {
		slog.Error("messages de perturbation", "err", err)
		return
	}
	routes := map[string]bool{}
	for _, r := range a.feed.Routes {
		routes[r.ID] = true
	}
	ds, err := siri.DecodeMessages(b, now, func(id string) bool { return routes[id] })
	if err != nil {
		slog.Error("messages de perturbation", "err", err)
		return
	}
	a.mu.Lock()
	a.disrupts = ds
	a.mu.Unlock()
}

// rollDay reconstruit le référentiel au changement de jour (heure de Paris).
func (a *App) rollDay(now time.Time) {
	d := dayOf(now)
	a.mu.Lock()
	same := d == a.day
	a.day = d
	a.mu.Unlock()
	if same {
		return
	}
	r := ref.Build(a.feed, now)
	a.engine.SetRef(r)
	if s, ok := a.source.(*feed.Synthetic); ok {
		s.SetRef(r)
	}
	slog.Info("référentiel du jour reconstruit", "jour", d, "courses", len(r.Trips))
}

// Tick calcule les positions et les diffuse.
func (a *App) Tick() {
	now := a.now()
	a.mu.Lock()
	data := a.lastCycle
	a.mu.Unlock()
	a.Hub.Update(a.engine.Compute(now), now, data)
}

// Health est la réponse de GET /health.
type Health struct {
	Status        string  `json:"status"`
	Source        string  `json:"source"`
	LastCycleAgeS float64 `json:"last_cycle_age_s"`
	Matched       int     `json:"matched"`
	Vehicles      int     `json:"vehicles"`
	Clients       int     `json:"clients"`
	LastError     string  `json:"last_error,omitempty"`
}

// Routes renvoie les routes HTTP du service.
func (a *App) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		a.mu.Lock()
		h := Health{Status: "ok", Source: a.source.Name(), Matched: a.matched, LastError: a.lastErr, LastCycleAgeS: -1}
		if !a.lastCycle.IsZero() {
			h.LastCycleAgeS = a.now().Sub(a.lastCycle).Round(time.Second).Seconds()
		}
		a.mu.Unlock()
		h.Clients, h.Vehicles = a.Hub.Stats()
		// Données trop anciennes : dégradé, mais le service répond (dernier état servi)
		if h.LastCycleAgeS < 0 || h.LastCycleAgeS > 3*a.cfg.FeedInterval.Seconds() {
			h.Status = "degraded"
		}
		writeJSON(w, h)
	})
	mux.Handle("GET /ws", a.Hub)
	// Utilisé par l'API (fiche d'un train) ; à garder sur le réseau interne
	mux.HandleFunc("GET /vehicles/{id}", func(w http.ResponseWriter, r *http.Request) {
		v, ok := a.Hub.Vehicle(r.PathValue("id"))
		if !ok {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, map[string]any{
			"id": v.Id, "route_id": v.RouteId, "lat": v.Lat, "lon": v.Lon, "bearing": v.Bearing,
			"speed": v.Speed, "delay": v.Delay, "at_stop": v.AtStop, "theoretical": v.Theoretical,
			"next_stop_id": v.NextStopId, "headsign": v.Headsign,
		})
	})
	// Prochains départs : GET /departures?stops=IDFM:1,IDFM:2&limit=10 (pour l'API)
	mux.HandleFunc("GET /departures", func(w http.ResponseWriter, r *http.Request) {
		ids := strings.Split(r.URL.Query().Get("stops"), ",")
		if len(ids) == 0 || len(ids) > 50 || ids[0] == "" {
			http.Error(w, "paramètre stops invalide", http.StatusBadRequest)
			return
		}
		limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
		if err != nil || limit < 1 || limit > 50 {
			limit = 10
		}
		set := make(map[string]bool, len(ids))
		for _, id := range ids {
			set[id] = true
		}
		writeJSON(w, a.engine.Departures(set, a.now(), 90*time.Minute, limit))
	})
	// Perturbations en cours : GET /disruptions?line=IDFM:C01742 (pour l'API)
	mux.HandleFunc("GET /disruptions", func(w http.ResponseWriter, r *http.Request) {
		line := r.URL.Query().Get("line")
		a.mu.Lock()
		out := make([]siri.Disruption, 0, len(a.disrupts))
		for _, d := range a.disrupts {
			if line == "" || slices.Contains(d.LineIDs, line) {
				out = append(out, d)
			}
		}
		a.mu.Unlock()
		writeJSON(w, out)
	})
	// Passages restants d'un train : GET /trips/{id}/calls
	mux.HandleFunc("GET /trips/{id}/calls", func(w http.ResponseWriter, r *http.Request) {
		calls, ok := a.engine.Calls(r.PathValue("id"), a.now())
		if !ok {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, calls)
	})
	return mux
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
