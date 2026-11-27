package feed

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// Replay rejoue en boucle les réponses enregistrées d'un dossier (*.json, ordre alphabétique).
type Replay struct {
	Dir string

	mu    sync.Mutex
	files []string
	next  int
}

// Name implémente Source.
func (*Replay) Name() string { return "replay" }

// Fetch implémente Source.
func (r *Replay) Fetch(_ context.Context, _ time.Time) ([]byte, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.files == nil {
		files, err := filepath.Glob(filepath.Join(r.Dir, "*.json"))
		if err != nil {
			return nil, err
		}
		if len(files) == 0 {
			return nil, fmt.Errorf("aucun enregistrement dans %s", r.Dir)
		}
		sort.Strings(files)
		r.files = files
	}
	f := r.files[r.next%len(r.files)]
	r.next++
	return os.ReadFile(f)
}
