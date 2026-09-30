-- One-time, idempotent PowerSync setup for the EXISTING production database. Run after the API migration
-- (the three tables must exist; the script exits non-zero otherwise) and before starting the powersync service:
--   docker compose exec -T postgres psql -U sipclock -d sipclock -v ON_ERROR_STOP=1 \
--     -v password="$(grep ^POWERSYNC_DB_PASSWORD= .env | cut -d= -f2)" < powersync-setup.sql
\set ON_ERROR_STOP on

-- Fail if the migration has not run.
SELECT count(*) = 3 AS tables_ok
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('bar_item', 'favorite', 'drink_log')
\gset
\if :tables_ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'bar_item, favorite and drink_log are missing: deploy the API migration first'; END $$;
\endif

-- Role: create if absent, always (re)set the password.
SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'powersync_role') AS create_role \gset
\if :create_role
  CREATE ROLE powersync_role WITH LOGIN REPLICATION BYPASSRLS;
\endif
ALTER ROLE powersync_role WITH LOGIN REPLICATION BYPASSRLS PASSWORD :'password';

GRANT SELECT ON bar_item, favorite, drink_log TO powersync_role;

-- Bucket storage database, owned by the role. CREATE DATABASE cannot run in a transaction or a DO block.
SELECT NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'powersync_storage') AS create_db \gset
\if :create_db
  CREATE DATABASE powersync_storage OWNER powersync_role;
\endif

-- The publication is created by the API migration; verify it covers the tables.
SELECT count(*) = 3 AS publication_ok
FROM pg_publication_tables
WHERE pubname = 'powersync' AND tablename IN ('bar_item', 'favorite', 'drink_log')
\gset
\if :publication_ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'publication powersync is missing or incomplete: the API migration did not create it'; END $$;
\endif
\echo 'PowerSync setup OK'
