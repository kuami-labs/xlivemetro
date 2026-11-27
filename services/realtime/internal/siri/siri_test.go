package siri

import (
	"testing"
	"time"
)

const sample = `{"Siri":{"ServiceDelivery":{"ResponseTimestamp":"2026-12-01T08:00:05Z","ProducerRef":"IVTR_HET",
"EstimatedTimetableDelivery":[{"ResponseTimestamp":"2026-12-01T08:00:05Z","EstimatedJourneyVersionFrame":[{"RecordedAtTime":"2026-12-01T08:00:00Z",
"EstimatedVehicleJourney":[{"RecordedAtTime":"2026-12-01T08:00:00Z","LineRef":{"value":"STIF:Line::C01371:"},"DirectionRef":{"value":"Aller"},
"FramedVehicleJourneyRef":{"DataFrameRef":{"value":"any"},"DatedVehicleJourneyRef":"RATP:VJ:1"},
"EstimatedCalls":{"EstimatedCall":[
 {"StopPointRef":{"value":"STIF:StopPoint:Q:463158:"},"AimedDepartureTime":"2026-12-01T08:02:00Z","ExpectedDepartureTime":"2026-12-01T08:03:30Z","DepartureStatus":"delayed"},
 {"StopPointRef":{"value":"STIF:StopPoint:Q:463159:"},"AimedArrivalTime":"2026-12-01T08:04:00Z"}]}}]}]}]}}}`

func TestDecode(t *testing.T) {
	js, err := Decode([]byte(sample))
	if err != nil {
		t.Fatal(err)
	}
	if len(js) != 1 {
		t.Fatalf("courses = %d", len(js))
	}
	j := js[0]
	if line, ok := LineToGTFS(j.LineRef.Value); !ok || line != "IDFM:C01371" {
		t.Errorf("ligne = %q", line)
	}
	calls := j.EstimatedCalls.EstimatedCall
	aimed, _ := calls[0].Aimed()
	exp, _ := calls[0].Expected()
	if exp.Sub(aimed) != 90*time.Second {
		t.Errorf("retard = %v", exp.Sub(aimed))
	}
	if _, ok := calls[1].Expected(); ok {
		t.Error("pas d'heure estimée attendue pour le 2e passage")
	}
	if a, ok := calls[1].Aimed(); !ok || a.Minute() != 4 {
		t.Errorf("théorique du 2e passage = %v", a)
	}
	if _, err := Decode([]byte("{")); err == nil {
		t.Error("erreur attendue sur un JSON invalide")
	}
}

func TestIDs(t *testing.T) {
	if s, ok := StopToGTFS("STIF:StopPoint:Q:463158:"); !ok || s != "IDFM:463158" {
		t.Errorf("arrêt = %q", s)
	}
	for _, bad := range []string{"", "STIF:StopPoint:Q::", "STIF:StopArea:SP:1:", "STIF:StopPoint:Q:1:2:"} {
		if _, ok := StopToGTFS(bad); ok {
			t.Errorf("StopToGTFS(%q) devrait échouer", bad)
		}
	}
	if StopFromGTFS("IDFM:463158") != "STIF:StopPoint:Q:463158:" || LineFromGTFS("IDFM:C01742") != "STIF:Line::C01742:" {
		t.Error("conversion inverse")
	}
	if l, _ := LineToGTFS(LineFromGTFS("IDFM:C01742")); l != "IDFM:C01742" {
		t.Error("aller-retour ligne")
	}
}
