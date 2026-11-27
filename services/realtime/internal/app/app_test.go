package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/feed"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/hub"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/ref"
)

type clock struct{ t time.Time }

func (c *clock) now() time.Time { return c.t }

type failing struct{}

func (failing) Name() string { return "prim" }
func (failing) Fetch(context.Context, time.Time) ([]byte, error) {
	return nil, &feed.RateLimitError{RetryAfter: "60"}
}

func setup(t *testing.T, src feed.Source, at time.Time) (*App, *clock) {
	t.Helper()
	s, err := gtfs.OpenSource("../gtfs/testdata/mini")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	f, err := gtfs.Load(s, gtfs.Options{})
	if err != nil {
		t.Fatal(err)
	}
	c := &clock{at}
	return New(Config{FeedInterval: 30 * time.Second, Tick: 5 * time.Second}, f, src, hub.New(src.Name(), nil), c.now), c
}

func health(t *testing.T, a *App) Health {
	t.Helper()
	rec := httptest.NewRecorder()
	a.Routes().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))
	var h Health
	if err := json.NewDecoder(rec.Body).Decode(&h); err != nil {
		t.Fatal(err)
	}
	return h
}

func TestCycleTickHealth(t *testing.T) {
	// Mardi 8 décembre 2026, 07:59 : la course T1 part à 08:00:30
	a, c := setup(t, feed.NewSynthetic(nil), time.Date(2026, 12, 8, 7, 59, 0, 0, ref.Paris))
	if h := health(t, a); h.Status != "degraded" || h.LastCycleAgeS != -1 {
		t.Errorf("avant le premier cycle : %+v", h)
	}
	// 30 s après le départ retardé de A (08:00:30 + retard simulé de la course)
	c.t = time.Date(2026, 12, 8, 8, 1, 0, 0, ref.Paris).Add(feed.Delay("T1@20261208"))
	a.Cycle(context.Background())
	a.Tick()
	if h := health(t, a); h.Status != "ok" || h.Source != "synthetic" || h.Matched != 1 || h.Vehicles != 1 || h.LastCycleAgeS != 0 {
		t.Errorf("santé : %+v", h)
	}
	c.t = c.t.Add(2 * time.Minute) // plus de 3 cycles sans données : dégradé
	if h := health(t, a); h.Status != "degraded" || h.LastCycleAgeS != 120 {
		t.Errorf("santé sans données récentes : %+v", h)
	}

	rec := httptest.NewRecorder()
	a.Routes().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/vehicles/T1@20261208", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /vehicles : %d", rec.Code)
	}
	for url, want := range map[string]int{
		"/departures?stops=IDFM:2,IDFM:3&limit=5": http.StatusOK,
		"/departures":              http.StatusBadRequest,
		"/trips/T1@20261208/calls": http.StatusOK,
		"/trips/inconnue/calls":    http.StatusNotFound,
	} {
		rec = httptest.NewRecorder()
		a.Routes().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
		if rec.Code != want {
			t.Errorf("GET %s : %d, attendu %d", url, rec.Code, want)
		}
	}
	rec = httptest.NewRecorder()
	a.Routes().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/vehicles/inconnu", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("véhicule inconnu : %d", rec.Code)
	}
}

func TestCycleErrorAndRollDay(t *testing.T) {
	a, c := setup(t, failing{}, time.Date(2026, 12, 8, 23, 59, 0, 0, ref.Paris))
	a.Cycle(context.Background())
	if h := health(t, a); h.LastError == "" || h.Status != "degraded" {
		t.Errorf("erreur non signalée : %+v", h)
	}
	c.t = c.t.Add(2 * time.Minute) // passage au 9 décembre
	a.rollDay(c.t)
	if a.day != "2026-12-09" {
		t.Errorf("jour = %s", a.day)
	}
}

func TestRun(t *testing.T) {
	a, _ := setup(t, feed.NewSynthetic(nil), time.Date(2026, 12, 8, 8, 1, 0, 0, ref.Paris).Add(feed.Delay("T1@20261208")))
	a.cfg = Config{FeedInterval: 10 * time.Millisecond, Tick: 10 * time.Millisecond}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Millisecond)
	defer cancel()
	a.Run(ctx)
	if _, vehicles := a.Hub.Stats(); vehicles != 1 {
		t.Errorf("véhicules après Run : %d", vehicles)
	}
}

type messages struct{ body string }

func (messages) Name() string { return "prim" }
func (m messages) Fetch(context.Context, time.Time) ([]byte, error) {
	if m.body == "" {
		return nil, &feed.RateLimitError{}
	}
	return []byte(m.body), nil
}

func TestDisruptions(t *testing.T) {
	a, _ := setup(t, feed.NewSynthetic(nil), time.Date(2026, 12, 8, 8, 0, 0, 0, ref.Paris))
	a.Disruptions(context.Background()) // sans source : rien
	a.Messages = messages{body: `{"Siri":{"ServiceDelivery":{"GeneralMessageDelivery":[{"InfoMessage":[
		{"InfoMessageIdentifier":{"value":"m1"},"Content":{"LineRef":[{"value":"STIF:Line::C1:"}],"Message":[{"MessageText":{"value":"Trafic interrompu"}}]}},
		{"InfoMessageIdentifier":{"value":"autre"},"Content":{"LineRef":[{"value":"STIF:Line::C999:"}],"Message":[{"MessageText":{"value":"bus"}}]}}]}]}}}`}
	a.Disruptions(context.Background())
	get := func(url string) []map[string]any {
		rec := httptest.NewRecorder()
		a.Routes().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
		var out []map[string]any
		if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	if ds := get("/disruptions"); len(ds) != 1 || ds[0]["text"] != "Trafic interrompu" {
		t.Errorf("perturbations : %v", ds)
	}
	if ds := get("/disruptions?line=IDFM:C2"); len(ds) != 0 {
		t.Errorf("filtre par ligne : %v", ds)
	}
	// Erreurs : les derniers messages connus sont gardés
	a.Messages = messages{}
	a.Disruptions(context.Background())
	a.Messages = messages{body: "{"}
	a.Disruptions(context.Background())
	if ds := get("/disruptions?line=IDFM:C1"); len(ds) != 1 {
		t.Errorf("après erreur : %v", ds)
	}
}
