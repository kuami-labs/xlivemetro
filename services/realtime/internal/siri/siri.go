// Package siri décode le SIRI Lite Estimated Timetable d'IDFM (JSON, ADR 0010)
// et convertit ses identifiants vers ceux du GTFS.
//
// Structure suivie : norme SIRI, profil SIRI Lite publié par IDFM (valeurs enveloppées
// dans {"value": …}). À recaler sur une vraie réponse dès qu'une clé PRIM existe (ADR 0011).
package siri

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Value est l'enveloppe {"value": "…"} du SIRI Lite IDFM.
type Value struct {
	Value string `json:"value"`
}

// Document est la racine d'une réponse.
type Document struct {
	Siri struct {
		ServiceDelivery ServiceDelivery `json:"ServiceDelivery"`
	} `json:"Siri"`
}

// ServiceDelivery contient les livraisons.
type ServiceDelivery struct {
	ResponseTimestamp          time.Time                    `json:"ResponseTimestamp"`
	ProducerRef                string                       `json:"ProducerRef,omitempty"`
	EstimatedTimetableDelivery []EstimatedTimetableDelivery `json:"EstimatedTimetableDelivery"`
}

// EstimatedTimetableDelivery regroupe des versions de journées.
type EstimatedTimetableDelivery struct {
	ResponseTimestamp            time.Time                      `json:"ResponseTimestamp"`
	EstimatedJourneyVersionFrame []EstimatedJourneyVersionFrame `json:"EstimatedJourneyVersionFrame"`
}

// EstimatedJourneyVersionFrame contient les courses.
type EstimatedJourneyVersionFrame struct {
	RecordedAtTime          time.Time                 `json:"RecordedAtTime"`
	EstimatedVehicleJourney []EstimatedVehicleJourney `json:"EstimatedVehicleJourney"`
}

// EstimatedVehicleJourney est une course et ses passages estimés.
type EstimatedVehicleJourney struct {
	RecordedAtTime          time.Time `json:"RecordedAtTime"`
	LineRef                 Value     `json:"LineRef"`
	DirectionRef            Value     `json:"DirectionRef"`
	FramedVehicleJourneyRef struct {
		DataFrameRef           Value  `json:"DataFrameRef"`
		DatedVehicleJourneyRef string `json:"DatedVehicleJourneyRef"`
	} `json:"FramedVehicleJourneyRef"`
	DestinationName []Value `json:"DestinationName,omitempty"`
	EstimatedCalls  struct {
		EstimatedCall []EstimatedCall `json:"EstimatedCall"`
	} `json:"EstimatedCalls"`
}

// EstimatedCall est un passage à un arrêt.
type EstimatedCall struct {
	StopPointRef          Value      `json:"StopPointRef"`
	AimedArrivalTime      *time.Time `json:"AimedArrivalTime,omitempty"`
	ExpectedArrivalTime   *time.Time `json:"ExpectedArrivalTime,omitempty"`
	AimedDepartureTime    *time.Time `json:"AimedDepartureTime,omitempty"`
	ExpectedDepartureTime *time.Time `json:"ExpectedDepartureTime,omitempty"`
	ArrivalStatus         string     `json:"ArrivalStatus,omitempty"`
	DepartureStatus       string     `json:"DepartureStatus,omitempty"`
}

// Aimed renvoie l'heure théorique du passage (départ, sinon arrivée).
func (c EstimatedCall) Aimed() (time.Time, bool) {
	return first(c.AimedDepartureTime, c.AimedArrivalTime)
}

// Expected renvoie l'heure estimée du passage (départ, sinon arrivée).
func (c EstimatedCall) Expected() (time.Time, bool) {
	return first(c.ExpectedDepartureTime, c.ExpectedArrivalTime)
}

func first(ts ...*time.Time) (time.Time, bool) {
	for _, t := range ts {
		if t != nil && !t.IsZero() {
			return *t, true
		}
	}
	return time.Time{}, false
}

// Decode lit une réponse et renvoie toutes ses courses.
func Decode(b []byte) ([]EstimatedVehicleJourney, error) {
	var d Document
	if err := json.Unmarshal(b, &d); err != nil {
		return nil, fmt.Errorf("SIRI Lite illisible : %w", err)
	}
	var out []EstimatedVehicleJourney
	for _, del := range d.Siri.ServiceDelivery.EstimatedTimetableDelivery {
		for _, fr := range del.EstimatedJourneyVersionFrame {
			out = append(out, fr.EstimatedVehicleJourney...)
		}
	}
	return out, nil
}

// LineToGTFS convertit « STIF:Line::C01742: » en « IDFM:C01742 ».
func LineToGTFS(ref string) (string, bool) {
	return convert(ref, "STIF:Line::")
}

// StopToGTFS convertit « STIF:StopPoint:Q:463158: » en « IDFM:463158 ».
func StopToGTFS(ref string) (string, bool) {
	return convert(ref, "STIF:StopPoint:Q:")
}

// LineFromGTFS et StopFromGTFS font la conversion inverse (flux synthétique).
func LineFromGTFS(id string) string { return "STIF:Line::" + strings.TrimPrefix(id, "IDFM:") + ":" }

// StopFromGTFS convertit « IDFM:463158 » en « STIF:StopPoint:Q:463158: ».
func StopFromGTFS(id string) string {
	return "STIF:StopPoint:Q:" + strings.TrimPrefix(id, "IDFM:") + ":"
}

func convert(ref, prefix string) (string, bool) {
	code, ok := strings.CutPrefix(ref, prefix)
	if !ok {
		return "", false
	}
	// Les codes peuvent contenir « : » (ex. « monomodalStopPlace:45102 » pour certains quais RER)
	code = strings.TrimSuffix(code, ":")
	if code == "" {
		return "", false
	}
	return "IDFM:" + code, true
}
