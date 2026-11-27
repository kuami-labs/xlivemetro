-- Extensions : PostGIS (géographie) et pg_trgm (recherche floue des gares)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('metro', 'rer', 'tram');

-- CreateTable
CREATE TABLE "feed_versions" (
    "id" SERIAL NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_url" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "routes" INTEGER NOT NULL,
    "trips" INTEGER NOT NULL,
    "stop_times" INTEGER NOT NULL,

    CONSTRAINT "feed_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "long_name" TEXT NOT NULL,
    "mode" "Mode" NOT NULL,
    "color" TEXT NOT NULL,
    "text_color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stops" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "geom" geography(Point, 4326) NOT NULL,
    "location_type" INTEGER NOT NULL DEFAULT 0,
    "parent_id" TEXT,
    "wheelchair" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shapes" (
    "id" TEXT NOT NULL,
    "geom" geography(LineString, 4326) NOT NULL,
    "length_m" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "shapes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "shape_id" TEXT NOT NULL,
    "headsign" TEXT NOT NULL,
    "direction_id" INTEGER NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stop_times" (
    "trip_id" TEXT NOT NULL,
    "stop_sequence" INTEGER NOT NULL,
    "stop_id" TEXT NOT NULL,
    "arrival" INTEGER NOT NULL,
    "departure" INTEGER NOT NULL,
    "dist_m" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "stop_times_pkey" PRIMARY KEY ("trip_id","stop_sequence")
);

-- CreateTable
CREATE TABLE "calendars" (
    "service_id" TEXT NOT NULL,
    "monday" BOOLEAN NOT NULL,
    "tuesday" BOOLEAN NOT NULL,
    "wednesday" BOOLEAN NOT NULL,
    "thursday" BOOLEAN NOT NULL,
    "friday" BOOLEAN NOT NULL,
    "saturday" BOOLEAN NOT NULL,
    "sunday" BOOLEAN NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("service_id")
);

-- CreateTable
CREATE TABLE "calendar_dates" (
    "service_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "exception_type" INTEGER NOT NULL,

    CONSTRAINT "calendar_dates_pkey" PRIMARY KEY ("service_id","date")
);

-- CreateIndex
CREATE INDEX "routes_mode_idx" ON "routes"("mode");

-- CreateIndex
CREATE INDEX "stops_parent_id_idx" ON "stops"("parent_id");

-- CreateIndex
CREATE INDEX "trips_route_id_idx" ON "trips"("route_id");

-- CreateIndex
CREATE INDEX "trips_service_id_idx" ON "trips"("service_id");

-- CreateIndex
CREATE INDEX "stop_times_stop_id_idx" ON "stop_times"("stop_id");

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stops" ADD CONSTRAINT "stops_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_shape_id_fkey" FOREIGN KEY ("shape_id") REFERENCES "shapes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_times" ADD CONSTRAINT "stop_times_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_times" ADD CONSTRAINT "stop_times_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index spatiaux et recherche floue (non exprimables dans le schéma Prisma)
CREATE INDEX "stops_geom_idx" ON "stops" USING GIST ("geom");
CREATE INDEX "shapes_geom_idx" ON "shapes" USING GIST ("geom");
CREATE INDEX "stops_name_trgm_idx" ON "stops" USING GIN ("name" gin_trgm_ops);
