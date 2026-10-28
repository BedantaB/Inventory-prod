-- Trigram search ("instant search" by name/SKU/phone). On Supabase extensions live in the
-- "extensions" schema, which is on the default search_path.
CREATE SCHEMA IF NOT EXISTS extensions;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
