// Package health expose l'état du service.
package health

import (
	"encoding/json"
	"net/http"
)

// Status est la réponse de GET /health.
type Status struct {
	Status string `json:"status"`
	Source string `json:"source"`
}

// Handler renvoie l'état du service et la source du flux temps réel.
func Handler(source string) http.Handler {
	if source == "" {
		source = "replay"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Status{Status: "ok", Source: source})
	})
}
