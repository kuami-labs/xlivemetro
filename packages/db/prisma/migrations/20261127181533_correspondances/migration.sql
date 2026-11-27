-- Correspondances à pied entre arrêts (transfers.txt d'IDFM), pour le moteur d'itinéraire (ADR 0018)
CREATE TABLE "transfers" (
    "from_stop_id" TEXT NOT NULL,
    "to_stop_id" TEXT NOT NULL,
    "min_sec" INTEGER NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("from_stop_id","to_stop_id")
);
