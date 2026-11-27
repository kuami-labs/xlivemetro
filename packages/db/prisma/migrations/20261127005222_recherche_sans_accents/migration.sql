-- Recherche des gares insensible aux accents (« etoile » trouve « Étoile »)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() n'est pas IMMUTABLE : enveloppe à dictionnaire explicite, utilisable dans un index
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN public.unaccent('public.unaccent'::regdictionary, $1);

DROP INDEX IF EXISTS "stops_name_trgm_idx";
CREATE INDEX "stops_name_trgm_idx" ON "stops" USING GIN (lower(immutable_unaccent("name")) gin_trgm_ops);
