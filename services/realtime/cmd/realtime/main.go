// Service temps réel de XLiveMetro : ingestion PRIM, positions estimées, diffusion WebSocket.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/health"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", "realtime")
	slog.SetDefault(logger)

	port := os.Getenv("REALTIME_PORT")
	if port == "" {
		port = "4100"
	}

	mux := http.NewServeMux()
	mux.Handle("GET /health", health.Handler(os.Getenv("FEED_SOURCE")))

	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		slog.Info("écoute", "port", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("serveur arrêté", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
