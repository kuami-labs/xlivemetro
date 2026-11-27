package siri

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// GeneralMessageDocument est une réponse SIRI Lite General Message (messages de perturbation).
// Structure à recaler sur une vraie réponse dès qu'une clé PRIM existe (ADR 0011).
type GeneralMessageDocument struct {
	Siri struct {
		ServiceDelivery struct {
			ResponseTimestamp      time.Time                `json:"ResponseTimestamp"`
			GeneralMessageDelivery []GeneralMessageDelivery `json:"GeneralMessageDelivery"`
		} `json:"ServiceDelivery"`
	} `json:"Siri"`
}

// GeneralMessageDelivery regroupe des messages.
type GeneralMessageDelivery struct {
	InfoMessage []InfoMessage `json:"InfoMessage"`
}

// InfoMessage est un message d'information voyageurs.
type InfoMessage struct {
	InfoMessageIdentifier Value      `json:"InfoMessageIdentifier"`
	InfoChannelRef        Value      `json:"InfoChannelRef"` // Perturbation, Information, Commercial…
	RecordedAtTime        time.Time  `json:"RecordedAtTime"`
	ValidUntilTime        *time.Time `json:"ValidUntilTime,omitempty"`
	Content               struct {
		LineRef []Value `json:"LineRef"`
		Message []struct {
			MessageType string `json:"MessageType"`
			MessageText struct {
				Value string `json:"value"`
				Lang  string `json:"lang"`
			} `json:"MessageText"`
		} `json:"Message"`
	} `json:"Content"`
}

// Disruption est un message de perturbation rattaché aux lignes GTFS.
type Disruption struct {
	ID         string     `json:"id"`
	Channel    string     `json:"channel"`
	LineIDs    []string   `json:"line_ids"`
	Text       string     `json:"text"` // texte brut, jamais interprété comme HTML
	ValidUntil *time.Time `json:"valid_until,omitempty"`
}

// maxText borne la taille d'un message (protection contre un contenu anormal).
const maxText = 2000

// DecodeMessages lit une réponse General Message et garde les messages encore valides
// qui concernent au moins une ligne connue (filtre `known`, nil = toutes).
func DecodeMessages(b []byte, now time.Time, known func(lineID string) bool) ([]Disruption, error) {
	var d GeneralMessageDocument
	if err := json.Unmarshal(b, &d); err != nil {
		return nil, fmt.Errorf("SIRI Lite General Message illisible : %w", err)
	}
	var out []Disruption
	for _, del := range d.Siri.ServiceDelivery.GeneralMessageDelivery {
		for _, m := range del.InfoMessage {
			if m.ValidUntilTime != nil && m.ValidUntilTime.Before(now) {
				continue
			}
			var lines []string
			for _, l := range m.Content.LineRef {
				if id, ok := LineToGTFS(l.Value); ok && (known == nil || known(id)) {
					lines = append(lines, id)
				}
			}
			if len(lines) == 0 {
				continue
			}
			text := messageText(m)
			if text == "" {
				continue
			}
			out = append(out, Disruption{
				ID: m.InfoMessageIdentifier.Value, Channel: m.InfoChannelRef.Value,
				LineIDs: lines, Text: text, ValidUntil: m.ValidUntilTime,
			})
		}
	}
	return out, nil
}

// messageText prend le texte le plus complet (en français s'il existe), réduit les espaces.
func messageText(m InfoMessage) string {
	best := ""
	for _, msg := range m.Content.Message {
		t := strings.Join(strings.Fields(msg.MessageText.Value), " ")
		fr := msg.MessageText.Lang == "" || strings.HasPrefix(msg.MessageText.Lang, "fr")
		if fr && len(t) > len(best) {
			best = t
		}
	}
	if r := []rune(best); len(r) > maxText {
		best = string(r[:maxText]) + "…"
	}
	return best
}
