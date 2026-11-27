package feed

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

// DefaultPrimURL est la requête globale Estimated Timetable de PRIM (ADR 0010).
// Paramètres exacts à confirmer avec une clé (documentation réservée aux comptes PRIM).
const DefaultPrimURL = "https://prim.iledefrance-mobilites.fr/marketplace/estimated-timetable?LineRef=ALL"

// DefaultPrimMessagesURL est la requête General Message (messages de perturbation) de PRIM.
// Paramètres exacts à confirmer avec une clé.
const DefaultPrimMessagesURL = "https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=ALL"

// Prim interroge l'API PRIM avec la clé de l'instance. La clé ne quitte jamais ce service.
type Prim struct {
	URL    string
	APIKey string
	Client *http.Client
}

// Name implémente Source.
func (Prim) Name() string { return "prim" }

// Fetch implémente Source.
func (p Prim) Fetch(ctx context.Context, _ time.Time) ([]byte, error) {
	if p.APIKey == "" {
		return nil, fmt.Errorf("PRIM_API_KEY est absent")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", p.APIKey)
	req.Header.Set("Accept", "application/json")
	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 25 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("PRIM : %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, &RateLimitError{RetryAfter: resp.Header.Get("Retry-After")}
	}
	if resp.StatusCode != http.StatusOK {
		// Le corps n'est pas journalisé : il pourrait refléter la requête
		return nil, fmt.Errorf("PRIM : statut %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 200<<20))
}

// RateLimitError signale un quota dépassé.
type RateLimitError struct{ RetryAfter string }

func (e *RateLimitError) Error() string {
	return "PRIM : quota dépassé (Retry-After " + e.RetryAfter + ")"
}
