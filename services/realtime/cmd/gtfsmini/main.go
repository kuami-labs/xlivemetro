// gtfsmini fabrique le jeu réduit de fixtures/gtfs-mini à partir du GTFS IDFM complet :
// quelques lignes, les courses d'une date donnée (journée type, ADR 0011).
//
//	go run ./cmd/gtfsmini --source IDFM-gtfs.zip --date 2026-12-01 --lines 1,14,A,T3a --out ../../fixtures/gtfs-mini
package main

import (
	"flag"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
)

func main() {
	source := flag.String("source", "", "fichier .zip ou dossier GTFS complet")
	date := flag.String("date", "", "journée type (AAAA-MM-JJ, un jour de semaine)")
	lines := flag.String("lines", "1,14,A,T3a", "lignes gardées (noms courts)")
	out := flag.String("out", "../../fixtures/gtfs-mini", "dossier de sortie")
	flag.Parse()

	if err := run(*source, *date, strings.Split(*lines, ","), *out); err != nil {
		slog.Error("échec", "err", err)
		os.Exit(1)
	}
}

func run(source, date string, lines []string, out string) error {
	day, err := time.Parse("2006-01-02", date)
	if err != nil {
		return err
	}
	src, err := gtfs.OpenSource(source)
	if err != nil {
		return err
	}
	defer src.Close()

	// Deux passages : le calendrier dit quels services circulent ce jour-là
	all, err := gtfs.Load(src, gtfs.Options{RouteShortNames: lines})
	if err != nil {
		return err
	}
	feed, err := gtfs.Load(src, gtfs.Options{RouteShortNames: lines, ServiceIDs: all.ActiveServices(day)})
	if err != nil {
		return err
	}
	slog.Info("jeu réduit", "lignes", len(feed.Routes), "courses", len(feed.Trips), "arrêts", len(feed.Stops))
	return feed.WriteDir(out)
}
