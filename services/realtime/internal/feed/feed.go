// Package feed fournit le flux SIRI Lite Estimated Timetable : PRIM, rejeu de fichiers
// enregistrés, ou flux synthétique (ADR 0005, 0011). Choix par FEED_SOURCE.
package feed

import (
	"context"
	"time"
)

// Source renvoie une réponse SIRI Lite Estimated Timetable (JSON) pour l'instant now.
type Source interface {
	Name() string
	Fetch(ctx context.Context, now time.Time) ([]byte, error)
}
