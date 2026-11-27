package feed

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/ref"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/siri"
)

func testRef(t *testing.T, now time.Time) *ref.Ref {
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
	return ref.Build(f, now)
}

func TestSyntheticRoundTrip(t *testing.T) {
	now := time.Date(2026, 12, 8, 7, 30, 0, 0, ref.Paris)
	r := testRef(t, now)
	b, err := NewSynthetic(r).Fetch(context.Background(), now)
	if err != nil {
		t.Fatal(err)
	}
	js, err := siri.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	if len(js) != 1 {
		t.Fatalf("courses = %d (T1 part à 8 h, dans l'heure)", len(js))
	}
	j := js[0]
	line, _ := siri.LineToGTFS(j.LineRef.Value)
	call := j.EstimatedCalls.EstimatedCall[1]
	stop, _ := siri.StopToGTFS(call.StopPointRef.Value)
	aimed, _ := call.Aimed()
	trip, ok := r.Match(line, stop, aimed)
	if !ok || trip.Key != "T1@20261208" {
		t.Fatalf("rapprochement : %v %v", trip, ok)
	}
	exp, _ := call.Expected()
	if exp.Sub(aimed) != Delay(trip.Key) {
		t.Errorf("retard %v, attendu %v", exp.Sub(aimed), Delay(trip.Key))
	}
}

func TestDelayDistribution(t *testing.T) {
	var zero, small, big int
	for i := range 10000 {
		switch d := Delay(time.Duration(i).String()); {
		case d == 0:
			zero++
		case d < 3*time.Minute:
			small++
		case d < 8*time.Minute:
			big++
		default:
			t.Fatalf("retard hors bornes : %v", d)
		}
	}
	if zero < 5500 || zero > 6500 || small < 2500 || big < 700 {
		t.Errorf("répartition : %d à l'heure, %d petits, %d gros", zero, small, big)
	}
	if Delay("abc") != Delay("abc") {
		t.Error("retard non déterministe")
	}
}

func TestReplay(t *testing.T) {
	dir := t.TempDir()
	for _, n := range []string{"b.json", "a.json"} {
		if err := os.WriteFile(filepath.Join(dir, n), []byte(n), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	r := &Replay{Dir: dir}
	var got []string
	for range 3 {
		b, err := r.Fetch(context.Background(), time.Now())
		if err != nil {
			t.Fatal(err)
		}
		got = append(got, string(b))
	}
	if got[0] != "a.json" || got[1] != "b.json" || got[2] != "a.json" {
		t.Errorf("ordre = %v", got)
	}
	if _, err := (&Replay{Dir: t.TempDir()}).Fetch(context.Background(), time.Now()); err == nil {
		t.Error("erreur attendue sans fichier")
	}
}

func TestPrim(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Header.Get("apikey") {
		case "ok":
			w.Write([]byte(`{}`))
		case "quota":
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
		default:
			w.WriteHeader(http.StatusUnauthorized)
		}
	}))
	defer srv.Close()
	ctx := context.Background()
	if b, err := (Prim{URL: srv.URL, APIKey: "ok"}).Fetch(ctx, time.Now()); err != nil || string(b) != "{}" {
		t.Errorf("ok : %q %v", b, err)
	}
	var rl *RateLimitError
	if _, err := (Prim{URL: srv.URL, APIKey: "quota"}).Fetch(ctx, time.Now()); err == nil || !asRateLimit(err, &rl) || rl.RetryAfter != "60" {
		t.Errorf("quota : %v", err)
	}
	if _, err := (Prim{URL: srv.URL, APIKey: "mauvaise"}).Fetch(ctx, time.Now()); err == nil {
		t.Error("erreur attendue (401)")
	}
	if _, err := (Prim{URL: srv.URL}).Fetch(ctx, time.Now()); err == nil {
		t.Error("erreur attendue sans clé")
	}
}

func asRateLimit(err error, target **RateLimitError) bool {
	rl, ok := err.(*RateLimitError)
	*target = rl
	return ok
}
