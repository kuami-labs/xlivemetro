// gtfsimport importe le GTFS d'IDFM (métro, RER, tram) dans PostgreSQL (docs/05-DATABASE.md).
//
//	go run ./cmd/gtfsimport                         # télécharge le GTFS officiel
//	go run ./cmd/gtfsimport --source chemin.zip     # ou un fichier / dossier local
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfsdb"
)

// URL publique du GTFS IDFM (ADR 0010).
const officialURL = "https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip"

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", "gtfsimport"))
	source := flag.String("source", officialURL, "URL, fichier .zip ou dossier GTFS")
	flag.Parse()
	if err := run(context.Background(), *source); err != nil {
		slog.Error("import échoué", "err", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, source string) error {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return fmt.Errorf("DATABASE_URL est absent")
	}
	path, sum, cleanup, err := fetch(ctx, source)
	if err != nil {
		return err
	}
	defer cleanup()

	start := time.Now()
	src, err := gtfs.OpenSource(path)
	if err != nil {
		return err
	}
	defer src.Close()
	feed, err := gtfs.Load(src, gtfs.Options{})
	if err != nil {
		return err
	}
	slog.Info("GTFS lu", "lignes", len(feed.Routes), "courses", len(feed.Trips), "durée", time.Since(start).String())

	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		return err
	}
	defer conn.Close(ctx)
	st, err := gtfsdb.Import(ctx, conn, feed, gtfsdb.Meta{SourceURL: source, SHA256: sum})
	if err != nil {
		return err
	}
	slog.Info("import terminé", "lignes", st.Routes, "courses", st.Trips, "passages", st.StopTimes, "durée", time.Since(start).String())
	return nil
}

// fetch renvoie un chemin local (téléchargé si besoin) et l'empreinte SHA-256 de la source.
func fetch(ctx context.Context, source string) (string, string, func(), error) {
	noop := func() {}
	if !strings.HasPrefix(source, "http://") && !strings.HasPrefix(source, "https://") {
		sum, err := hashPath(source)
		return source, sum, noop, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, source, nil)
	if err != nil {
		return "", "", noop, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", noop, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", "", noop, fmt.Errorf("téléchargement : statut %d", resp.StatusCode)
	}
	tmp, err := os.CreateTemp("", "gtfs-*.zip")
	if err != nil {
		return "", "", noop, err
	}
	cleanup := func() { os.Remove(tmp.Name()) }
	h := sha256.New()
	if _, err := io.Copy(io.MultiWriter(tmp, h), resp.Body); err != nil {
		tmp.Close()
		cleanup()
		return "", "", noop, err
	}
	tmp.Close()
	return tmp.Name(), hex.EncodeToString(h.Sum(nil)), cleanup, nil
}

// hashPath calcule l'empreinte d'un fichier, ou des fichiers .txt d'un dossier.
func hashPath(path string) (string, error) {
	h := sha256.New()
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	files := []string{path}
	if info.IsDir() {
		files, err = filepath.Glob(filepath.Join(path, "*.txt"))
		if err != nil {
			return "", err
		}
	}
	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			return "", err
		}
		h.Write(b)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
