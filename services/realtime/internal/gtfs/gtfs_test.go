package gtfs

import (
	"math"
	"testing"
	"time"
)

func TestParseTime(t *testing.T) {
	for in, want := range map[string]int{"00:00:00": 0, "08:02:30": 8*3600 + 150, "25:04:00": 25*3600 + 240} {
		got, err := ParseTime(in)
		if err != nil || got != want {
			t.Errorf("ParseTime(%q) = %d, %v ; attendu %d", in, got, err, want)
		}
		if FormatTime(got) != in {
			t.Errorf("FormatTime(%d) = %q", got, FormatTime(got))
		}
	}
	for _, bad := range []string{"", "8:00", "aa:00:00", "-1:00:00"} {
		if _, err := ParseTime(bad); err == nil {
			t.Errorf("ParseTime(%q) : erreur attendue", bad)
		}
	}
}

func TestModeOf(t *testing.T) {
	cases := []struct {
		typ, name string
		mode      Mode
		ok        bool
	}{
		{"1", "14", Metro, true},
		{"0", "T3a", Tram, true},
		{"0", "ORLYVAL", "", false},
		{"0", "CDG VAL", "", false},
		{"2", "A", RER, true},
		{"2", "E", RER, true},
		{"2", "H", "", false},
		{"2", "AB", "", false},
		{"3", "38", "", false},
	}
	for _, c := range cases {
		m, ok := ModeOf(c.typ, c.name)
		if m != c.mode || ok != c.ok {
			t.Errorf("ModeOf(%s, %s) = %s, %v", c.typ, c.name, m, ok)
		}
	}
}

func near(a, b, tol float64) bool { return math.Abs(a-b) <= tol }

func TestPolyline(t *testing.T) {
	// 0,01° de longitude à 48,85° de latitude ≈ 732 m
	line := NewPolyline([]Point{{48.85, 2.30}, {48.85, 2.31}, {48.85, 2.32}})
	if !near(line.Length(), 1464, 3) {
		t.Fatalf("longueur = %.1f", line.Length())
	}
	if d := line.Project(Point{48.8501, 2.315}, 0); !near(d, 1098, 3) {
		t.Errorf("projection = %.1f", d)
	}
	// Un arrêt ne recule jamais le long du tracé
	if d := line.Project(Point{48.85, 2.30}, 800); d < 800 {
		t.Errorf("projection avec minimum = %.1f", d)
	}
	p, cap := line.At(line.Length() / 2)
	if !near(p.Lon, 2.31, 1e-6) || !near(cap, 90, 0.1) {
		t.Errorf("At(milieu) = %+v, cap %.1f", p, cap)
	}
	if p, _ := line.At(-5); p != line.Points[0] {
		t.Errorf("At(<0) = %+v", p)
	}
	if p, _ := line.At(1e9); p != line.Points[2] {
		t.Errorf("At(>longueur) = %+v", p)
	}
}

func TestLoad(t *testing.T) {
	src, err := OpenSource("testdata/mini")
	if err != nil {
		t.Fatal(err)
	}
	defer src.Close()

	f, err := Load(src, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(f.Routes) != 1 || f.Routes[0].Mode != Metro || f.Routes[0].Color != "FFBE00" {
		t.Fatalf("lignes = %+v", f.Routes)
	}
	if len(f.Trips) != 2 || len(f.Shapes) != 1 {
		t.Fatalf("courses = %d, tracés = %d", len(f.Trips), len(f.Shapes))
	}
	// 4 arrêts : A, B, C et la gare parente GA, insérée en premier
	if len(f.Stops) != 4 || f.Stops[0].ID != "IDFM:10" {
		t.Fatalf("arrêts = %+v", f.Stops)
	}
	sts := f.StopTimes["T1"]
	if len(sts) != 3 || sts[2].Arrival != 25*3600+240 {
		t.Fatalf("passages = %+v", sts)
	}
	if !near(sts[0].DistM, 0, 1) || !near(sts[1].DistM, 732, 3) || !near(sts[2].DistM, 1464, 3) {
		t.Errorf("distances = %.0f %.0f %.0f", sts[0].DistM, sts[1].DistM, sts[2].DistM)
	}
	if len(f.Calendars) != 2 || !f.Calendars[0].Days[0] || len(f.CalendarDates) != 1 {
		t.Errorf("calendriers = %+v %+v", f.Calendars, f.CalendarDates)
	}

	f2, err := Load(src, Options{ServiceIDs: map[string]bool{"S2": true}})
	if err != nil || len(f2.Trips) != 1 || f2.Trips[0].ID != "T2" {
		t.Errorf("filtre par service : %v %+v", err, f2)
	}
	if _, err := Load(src, Options{RouteShortNames: []string{"99"}}); err == nil {
		t.Error("erreur attendue sans ligne")
	}
}

func TestActiveServicesAndWriteDir(t *testing.T) {
	src, _ := OpenSource("testdata/mini")
	defer src.Close()
	f, err := Load(src, Options{})
	if err != nil {
		t.Fatal(err)
	}
	mon := time.Date(2026, 12, 7, 0, 0, 0, 0, time.UTC)
	if a := f.ActiveServices(mon); !a["S1"] || a["S2"] {
		t.Errorf("lundi : %v", a)
	}
	if a := f.ActiveServices(time.Date(2026, 12, 25, 0, 0, 0, 0, time.UTC)); a["S1"] {
		t.Errorf("25 décembre (exception) : %v", a)
	}
	if a := f.ActiveServices(time.Date(2026, 12, 12, 0, 0, 0, 0, time.UTC)); !a["S2"] {
		t.Errorf("samedi : %v", a)
	}

	dir := t.TempDir()
	if err := f.WriteDir(dir); err != nil {
		t.Fatal(err)
	}
	src2, _ := OpenSource(dir)
	defer src2.Close()
	g, err := Load(src2, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Trips) != 2 || len(g.Stops) != 4 || !near(g.StopTimes["T1"][2].DistM, 1464, 3) {
		t.Errorf("relecture : %d courses, %d arrêts", len(g.Trips), len(g.Stops))
	}
	if a := g.ActiveServices(mon); !a["JOUR_TYPE"] {
		t.Errorf("journée type inactive : %v", a)
	}
}
