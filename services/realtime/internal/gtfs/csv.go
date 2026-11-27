package gtfs

import (
	"bufio"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// eachRow appelle fn pour chaque ligne du fichier, avec ses colonnes indexées par nom.
func eachRow(src Source, name string, fn func(row func(col string) string) error) error {
	f, err := src.Open(name)
	if err != nil {
		return fmt.Errorf("%s : %w", name, err)
	}
	defer f.Close()

	r := csv.NewReader(bufio.NewReaderSize(f, 1<<20))
	r.ReuseRecord = true
	r.FieldsPerRecord = -1
	header, err := r.Read()
	if err != nil {
		return fmt.Errorf("%s : en-tête : %w", name, err)
	}
	idx := make(map[string]int, len(header))
	for i, h := range header {
		idx[strings.TrimPrefix(strings.TrimSpace(h), "\uFEFF")] = i
	}
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("%s : %w", name, err)
		}
		get := func(col string) string {
			if i, ok := idx[col]; ok && i < len(rec) {
				return rec[i]
			}
			return ""
		}
		if err := fn(get); err != nil {
			return fmt.Errorf("%s : %w", name, err)
		}
	}
}

// ParseTime convertit « HH:MM:SS » en secondes depuis minuit du jour de service (peut dépasser 24 h).
func ParseTime(s string) (int, error) {
	parts := strings.Split(strings.TrimSpace(s), ":")
	if len(parts) != 3 {
		return 0, fmt.Errorf("heure invalide %q", s)
	}
	var total int
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return 0, fmt.Errorf("heure invalide %q", s)
		}
		total += n * [3]int{3600, 60, 1}[i]
	}
	return total, nil
}

// FormatTime est l'inverse de ParseTime.
func FormatTime(sec int) string {
	return fmt.Sprintf("%02d:%02d:%02d", sec/3600, sec/60%60, sec%60)
}

func atoi(s string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}

func atof(s string) (float64, error) {
	return strconv.ParseFloat(strings.TrimSpace(s), 64)
}
