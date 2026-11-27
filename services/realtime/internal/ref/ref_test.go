package ref

import (
	"testing"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
)

func load(t *testing.T) *gtfs.Feed {
	t.Helper()
	src, err := gtfs.OpenSource("../gtfs/testdata/mini")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { src.Close() })
	f, err := gtfs.Load(src, gtfs.Options{})
	if err != nil {
		t.Fatal(err)
	}
	return f
}

func TestBuild(t *testing.T) {
	// Mardi 8 décembre 2026 à 0 h 30 : la course T1 (service de semaine) d'hier arrive à 25:04
	now := time.Date(2026, 12, 8, 0, 30, 0, 0, Paris)
	r := Build(load(t), now)

	// T1 lundi + T1 mardi (S1) ; T2 (week-end) absent
	if len(r.Trips) != 2 {
		t.Fatalf("courses = %d", len(r.Trips))
	}
	monday := r.Trips[0]
	if monday.Key != "T1@20261207" {
		t.Fatalf("clé = %s", monday.Key)
	}
	end := time.Unix(monday.End(), 0).In(Paris)
	if end.Day() != 8 || end.Hour() != 1 || end.Minute() != 4 {
		t.Errorf("terminus de la course de lundi = %v", end)
	}
	if got := r.Between(now, now.Add(time.Minute)); len(got) != 1 || got[0] != monday {
		t.Errorf("en circulation à 0 h 30 : %d", len(got))
	}

	aimed := time.Date(2026, 12, 8, 8, 2, 30, 0, Paris)
	if tr, ok := r.Match("IDFM:C1", "IDFM:2", aimed); !ok || tr.Key != "T1@20261208" {
		t.Errorf("rapprochement : %v %v", tr, ok)
	}
	if _, ok := r.Match("IDFM:C1", "IDFM:2", aimed.Add(time.Minute)); ok {
		t.Error("aucune course attendue à une autre heure")
	}
}

func TestBuildDST(t *testing.T) {
	// Passage à l'heure d'été le dimanche 29 mars 2026 : les heures GTFS restent des heures de Paris
	r := Build(load(t), time.Date(2026, 3, 30, 12, 0, 0, 0, Paris))
	want := map[string]int{"T1": 8, "T2": 9}
	if len(r.Trips) != 2 {
		t.Fatalf("courses = %d", len(r.Trips))
	}
	for _, tr := range r.Trips {
		if dep := time.Unix(tr.Start(), 0).In(Paris); dep.Hour() != want[tr.TripID] || dep.Minute() != 0 {
			t.Errorf("%s : départ %v", tr.Key, dep)
		}
	}
}
