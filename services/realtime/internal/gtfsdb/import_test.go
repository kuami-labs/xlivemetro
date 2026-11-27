package gtfsdb

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/kuami-labs/xlivemetro/services/realtime/internal/gtfs"
)

// Test d'intégration : exige DATABASE_URL et une base migrée (pnpm db:migrate), comme en CI.
func TestImport(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL absent : test d'intégration ignoré")
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	// Sérialise avec les autres tests qui touchent au référentiel
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(hashtext('xlivemetro-referentiel'))`); err != nil {
		t.Fatal(err)
	}
	defer conn.Exec(ctx, `SELECT pg_advisory_unlock(hashtext('xlivemetro-referentiel'))`) //nolint:errcheck

	src, err := gtfs.OpenSource("../gtfs/testdata/mini")
	if err != nil {
		t.Fatal(err)
	}
	defer src.Close()
	feed, err := gtfs.Load(src, gtfs.Options{})
	if err != nil {
		t.Fatal(err)
	}

	// Deux imports successifs : le second remplace le premier sans doublon
	for range 2 {
		st, err := Import(ctx, conn, feed, Meta{SourceURL: "test", SHA256: "x"})
		if err != nil {
			t.Fatal(err)
		}
		if st != (Stats{Routes: 1, Trips: 2, StopTimes: 6}) {
			t.Fatalf("stats = %+v", st)
		}
	}

	var stops, parents int
	var length, distC float64
	err = conn.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM stops),
		(SELECT count(*) FROM stops WHERE parent_id = 'IDFM:10'),
		(SELECT ST_Length(geom) FROM shapes WHERE id = 'SH1'),
		(SELECT dist_m FROM stop_times WHERE trip_id = 'T1' AND stop_sequence = 3)`).Scan(&stops, &parents, &length, &distC)
	if err != nil {
		t.Fatal(err)
	}
	if stops != 4 || parents != 1 {
		t.Errorf("arrêts = %d, enfants de GA = %d", stops, parents)
	}
	// Longueur PostGIS (géodésique) et longueur calculée à l'import concordent à 0,5 % près
	if length < distC*0.995 || length > distC*1.005 {
		t.Errorf("longueur PostGIS %.1f, distance du terminus %.1f", length, distC)
	}
}
