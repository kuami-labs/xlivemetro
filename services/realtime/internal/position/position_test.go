package position

import (
	"math"
	"testing"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/ref"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/siri"
)

// Course T1 (lundi 7 décembre 2026) : A dép. 08:00:30, B arr. 08:02:00 / dép. 08:02:30, C arr. 25:04
// (soit 01:04 le lendemain). Tracé rectiligne vers l'est, arrêts tous les ~732 m.
var day = time.Date(2026, 12, 7, 0, 0, 0, 0, ref.Paris)

func at(h, m, s int) time.Time {
	return day.Add(time.Duration(h)*time.Hour + time.Duration(m)*time.Minute + time.Duration(s)*time.Second)
}

func engine(t *testing.T) *Engine {
	t.Helper()
	src, err := gtfs.OpenSource("../gtfs/testdata/mini")
	if err != nil {
		t.Fatal(err)
	}
	defer src.Close()
	f, err := gtfs.Load(src, gtfs.Options{})
	if err != nil {
		t.Fatal(err)
	}
	return New(ref.Build(f, day))
}

func only(t *testing.T, vs []Vehicle) Vehicle {
	t.Helper()
	if len(vs) != 1 {
		t.Fatalf("trains = %d, attendu 1", len(vs))
	}
	return vs[0]
}

func near(a, b, tol float64) bool { return math.Abs(a-b) <= tol }

func TestTheoretical(t *testing.T) {
	e := engine(t)
	if vs := e.Compute(at(8, 0, 0)); len(vs) != 0 {
		t.Fatalf("avant le départ : %d trains", len(vs))
	}
	// Mi-chemin entre A (dép. 08:00:30) et B (arr. 08:02:00)
	v := only(t, e.Compute(at(8, 1, 15)))
	if !v.Theoretical || v.AtStop || v.NextStopID != "IDFM:2" || v.DelayS != 0 {
		t.Errorf("état : %+v", v)
	}
	if !near(v.Lon, 2.305, 1e-4) || !near(v.Bearing, 90, 0.5) || !near(v.SpeedMps, 732.0/90, 0.1) {
		t.Errorf("position : %+v", v)
	}
	// À quai à B
	v = only(t, e.Compute(at(8, 2, 10)))
	if !v.AtStop || v.NextStopID != "IDFM:2" || v.SpeedMps != 0 || !near(v.Lon, 2.31, 1e-4) {
		t.Errorf("à quai : %+v", v)
	}
	// Après minuit, toujours en route vers C (service de la veille)
	if v = only(t, e.Compute(at(24, 30, 0))); v.NextStopID != "IDFM:3" {
		t.Errorf("après minuit : %+v", v)
	}
	if vs := e.Compute(at(25, 4, 0)); len(vs) != 0 {
		t.Errorf("au terminus : %d trains", len(vs))
	}
}

func call(stop string, aimed time.Time, delay time.Duration) siri.EstimatedCall {
	exp := aimed.Add(delay)
	return siri.EstimatedCall{
		StopPointRef:     siri.Value{Value: siri.StopFromGTFS(stop)},
		AimedArrivalTime: &aimed, ExpectedArrivalTime: &exp,
		AimedDepartureTime: &aimed, ExpectedDepartureTime: &exp,
	}
}

func journey(calls ...siri.EstimatedCall) siri.EstimatedVehicleJourney {
	var j siri.EstimatedVehicleJourney
	j.LineRef.Value = siri.LineFromGTFS("IDFM:C1")
	j.EstimatedCalls.EstimatedCall = calls
	return j
}

func TestRealtimeDelay(t *testing.T) {
	e := engine(t)
	now := at(8, 0, 0)
	// Retard de 60 s annoncé à A (départ théorique 08:00:30) ; B et C sans estimation
	st := e.Apply([]siri.EstimatedVehicleJourney{
		journey(call("IDFM:1", at(8, 0, 30), time.Minute)),
		journey(call("IDFM:99", at(8, 0, 30), 0)), // arrêt inconnu : non rapproché
	}, now)
	if st != (ApplyStats{Journeys: 2, Matched: 1}) {
		t.Fatalf("stats = %+v", st)
	}
	// À 08:01:15, avec 60 s de retard, le train n'est pas encore parti de son origine
	if vs := e.Compute(at(8, 1, 15)); len(vs) != 0 {
		t.Errorf("avant le départ estimé : %d trains", len(vs))
	}
	// À 08:01:45 : le train théorique serait aux 5/6 du trajet ; en retard, il n'en a fait qu'1/6
	v := only(t, e.Compute(at(8, 1, 45)))
	if v.Theoretical || v.DelayS != 60 || !near(v.Lon, 2.30+0.01/6, 2e-4) {
		t.Errorf("avec retard : %+v", v)
	}
	// Sans nouvelle donnée au-delà du TTL : retour aux horaires théoriques
	e.TTL = time.Minute
	if v := only(t, e.Compute(at(8, 1, 45))); !v.Theoretical || !near(v.Lon, 2.30+0.05/6, 2e-4) {
		t.Errorf("TTL dépassé : %+v", v)
	}
}

func TestEstimatePropagation(t *testing.T) {
	e := engine(t)
	trip := e.ref.Trips[0]
	// Seul B est connu (+120 s) : A prend le retard de B (avant le premier connu), C aussi
	tm := estimate(trip, []siri.EstimatedCall{call("IDFM:2", time.Unix(trip.Calls[1].Dep, 0), 2*time.Minute)}, at(8, 0, 0))
	for i, c := range trip.Calls {
		if tm.dep[i]-c.Dep != 120 {
			t.Errorf("passage %d : retard %d", i, tm.dep[i]-c.Dep)
		}
	}
	// Aucun passage connu : horaires théoriques
	tm = estimate(trip, nil, at(8, 0, 0))
	if tm.dep[0] != trip.Calls[0].Dep {
		t.Error("sans estimation, les horaires doivent rester théoriques")
	}
}

func TestSetRefAndMissingShape(t *testing.T) {
	e := engine(t)
	r := e.ref
	e.SetRef(&ref.Ref{Shapes: map[string]gtfs.Polyline{}, Trips: r.Trips})
	if vs := e.Compute(at(8, 1, 0)); len(vs) != 0 {
		t.Errorf("sans tracé, aucun train ne doit être placé : %d", len(vs))
	}
}

func TestMatchRejects(t *testing.T) {
	e := engine(t)
	bad := journey(call("IDFM:1", at(8, 0, 30), 0))
	bad.LineRef.Value = "inconnue"
	noAimed := journey(siri.EstimatedCall{StopPointRef: siri.Value{Value: siri.StopFromGTFS("IDFM:1")}})
	badStop := journey(siri.EstimatedCall{StopPointRef: siri.Value{Value: "STIF:StopArea:1:"}})
	if st := e.Apply([]siri.EstimatedVehicleJourney{bad, noAimed, badStop}, at(8, 0, 0)); st.Matched != 0 {
		t.Errorf("rapprochements inattendus : %+v", st)
	}
	// Un passage à l'identifiant illisible est ignoré, les autres comptent
	tm := estimate(e.ref.Trips[0], []siri.EstimatedCall{
		{StopPointRef: siri.Value{Value: "illisible"}},
		call("IDFM:3", time.Unix(e.ref.Trips[0].Calls[2].Dep, 0), 30*time.Second),
	}, at(8, 0, 0))
	if tm.arr[2]-e.ref.Trips[0].Calls[2].Arr != 30 {
		t.Errorf("retard au terminus : %d", tm.arr[2]-e.ref.Trips[0].Calls[2].Arr)
	}
}

func TestDeparturesAndCalls(t *testing.T) {
	e := engine(t)
	stops := map[string]bool{"IDFM:2": true, "IDFM:3": true}
	// 07:59 : prochain départ de B à 08:02:30 ; C est un terminus (pas de départ)
	ds := e.Departures(stops, at(7, 59, 0), time.Hour, 10)
	if len(ds) != 1 || ds[0].StopID != "IDFM:2" || !ds[0].Theoretical || ds[0].Expected != ds[0].Aimed {
		t.Fatalf("départs : %+v", ds)
	}
	// Avec 2 min de retard annoncées à A
	e.Apply([]siri.EstimatedVehicleJourney{journey(call("IDFM:1", at(8, 0, 30), 2*time.Minute))}, at(7, 59, 0))
	ds = e.Departures(stops, at(7, 59, 0), time.Hour, 10)
	if len(ds) != 1 || ds[0].Theoretical || ds[0].Expected-ds[0].Aimed != 120 {
		t.Fatalf("départs avec retard : %+v", ds)
	}
	// Deux départs (A puis B), triés par heure estimée
	if ds := e.Departures(map[string]bool{"IDFM:2": true, "IDFM:1": true}, at(7, 59, 0), time.Hour, 10); len(ds) != 2 || ds[0].StopID != "IDFM:1" {
		t.Errorf("tri : %+v", ds)
	}
	if ds := e.Departures(stops, at(7, 59, 0), time.Minute, 10); len(ds) != 0 {
		t.Errorf("hors fenêtre : %+v", ds)
	}
	if ds := e.Departures(stops, at(7, 59, 0), time.Hour, 0); len(ds) != 0 {
		t.Errorf("limite 0 : %+v", ds)
	}

	calls, ok := e.Calls("T1@20261207", at(8, 3, 0)) // retard de 2 min : A est passé, B arrive à 08:04
	if !ok || len(calls) != 2 || calls[0].StopID != "IDFM:2" || calls[1].StopID != "IDFM:3" {
		t.Fatalf("passages restants : %+v", calls)
	}
	e.TTL = 0
	if calls, _ := e.Calls("T1@20261207", at(8, 1, 0)); !calls[0].Theoretical {
		t.Error("TTL dépassé : théorique attendu")
	}
	if _, ok := e.Calls("inconnue", at(8, 1, 0)); ok {
		t.Error("course inconnue")
	}
}
