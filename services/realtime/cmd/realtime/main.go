// Service temps réel de XLiveMetro : flux SIRI Lite, positions estimées, diffusion WebSocket.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/app"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/feed"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/hub"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/refdb"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", "realtime"))
	if err := run(); err != nil {
		slog.Error("arrêt", "err", err)
		os.Exit(1)
	}
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	interval, err := time.ParseDuration(env("FEED_INTERVAL", "30s"))
	if err != nil {
		return fmt.Errorf("FEED_INTERVAL : %w", err)
	}

	db, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	f, err := refdb.Load(ctx, db)
	db.Close()
	if err != nil {
		return err
	}
	slog.Info("référentiel chargé", "lignes", len(f.Routes), "courses", len(f.Trips))

	var src feed.Source
	switch name := env("FEED_SOURCE", "synthetic"); name {
	case "synthetic":
		src = feed.NewSynthetic(nil)
	case "replay":
		src = &feed.Replay{Dir: env("REPLAY_DIR", "./fixtures/replay")}
	case "prim":
		if interval < 30*time.Second {
			return errors.New("FEED_INTERVAL doit être d'au moins 30 s avec PRIM (quotas)")
		}
		src = feed.Prim{URL: env("PRIM_ET_URL", feed.DefaultPrimURL), APIKey: os.Getenv("PRIM_API_KEY")}
	default:
		return fmt.Errorf("FEED_SOURCE inconnu : %q", name)
	}

	h := hub.New(src.Name(), origins(env("WEB_URL", "http://localhost:3000")))
	a := app.New(app.Config{FeedInterval: interval, Tick: 5 * time.Second}, f, src, h, time.Now)
	go a.Run(ctx)

	srv := &http.Server{Addr: ":" + env("REALTIME_PORT", "4100"), Handler: a.Routes(), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
	}()
	slog.Info("écoute", "addr", srv.Addr, "source", src.Name())
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// origins convertit WEB_URL (liste séparée par des virgules) en motifs d'origine WebSocket.
func origins(webURLs string) []string {
	var out []string
	for _, s := range strings.Split(webURLs, ",") {
		if u, err := url.Parse(strings.TrimSpace(s)); err == nil && u.Host != "" {
			out = append(out, u.Host)
		}
	}
	return out
}
