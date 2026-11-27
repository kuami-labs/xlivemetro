package feed

import (
	"context"
	"encoding/json"
	"hash/fnv"
	"sync/atomic"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/ref"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/siri"
)

// Synthetic génère un SIRI Lite plausible à partir des horaires théoriques (ADR 0011) :
// chaque course a un retard déterministe (fonction de sa clé), stable d'un cycle à l'autre.
type Synthetic struct {
	ref atomic.Pointer[ref.Ref]
}

// NewSynthetic crée la source sur un référentiel.
func NewSynthetic(r *ref.Ref) *Synthetic {
	s := &Synthetic{}
	s.SetRef(r)
	return s
}

// SetRef remplace le référentiel (changement de jour).
func (s *Synthetic) SetRef(r *ref.Ref) { s.ref.Store(r) }

// Name implémente Source.
func (*Synthetic) Name() string { return "synthetic" }

// Delay renvoie le retard simulé d'une course : 60 % à l'heure, 30 % de 30 s à 3 min,
// 10 % de 3 à 8 min.
func Delay(key string) time.Duration {
	h := fnv.New32a()
	h.Write([]byte(key))
	v := h.Sum32()
	switch p := v % 100; {
	case p < 60:
		return 0
	case p < 90:
		return time.Duration(30+(v/100)%150) * time.Second
	default:
		return time.Duration(180+(v/100)%300) * time.Second
	}
}

// Fetch implémente Source : courses en circulation et celles qui partent dans l'heure.
func (s *Synthetic) Fetch(_ context.Context, now time.Time) ([]byte, error) {
	r := s.ref.Load()
	var doc siri.Document
	sd := &doc.Siri.ServiceDelivery
	sd.ResponseTimestamp = now.UTC()
	sd.ProducerRef = "XLIVEMETRO_SYNTHETIC"
	frame := siri.EstimatedJourneyVersionFrame{RecordedAtTime: now.UTC()}
	for _, t := range r.Between(now, now.Add(time.Hour)) {
		delay := Delay(t.Key)
		j := siri.EstimatedVehicleJourney{RecordedAtTime: now.UTC()}
		j.LineRef.Value = siri.LineFromGTFS(t.RouteID)
		j.FramedVehicleJourneyRef.DataFrameRef.Value = "any"
		j.FramedVehicleJourneyRef.DatedVehicleJourneyRef = "SYNTH:" + t.Key
		j.DestinationName = []siri.Value{{Value: t.Headsign}}
		for _, c := range t.Calls {
			aimedArr := time.Unix(c.Arr, 0).UTC()
			aimedDep := time.Unix(c.Dep, 0).UTC()
			expArr, expDep := aimedArr.Add(delay), aimedDep.Add(delay)
			status := "onTime"
			if delay > 0 {
				status = "delayed"
			}
			j.EstimatedCalls.EstimatedCall = append(j.EstimatedCalls.EstimatedCall, siri.EstimatedCall{
				StopPointRef:     siri.Value{Value: siri.StopFromGTFS(c.StopID)},
				AimedArrivalTime: &aimedArr, ExpectedArrivalTime: &expArr,
				AimedDepartureTime: &aimedDep, ExpectedDepartureTime: &expDep,
				ArrivalStatus: status, DepartureStatus: status,
			})
		}
		frame.EstimatedVehicleJourney = append(frame.EstimatedVehicleJourney, j)
	}
	sd.EstimatedTimetableDelivery = []siri.EstimatedTimetableDelivery{{
		ResponseTimestamp: now.UTC(), EstimatedJourneyVersionFrame: []siri.EstimatedJourneyVersionFrame{frame},
	}}
	return json.Marshal(doc)
}
