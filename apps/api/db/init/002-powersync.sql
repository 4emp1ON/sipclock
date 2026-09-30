-- Runs once on a fresh local volume (docker-entrypoint-initdb.d). DEV ONLY: the password is public.
-- Existing volume: `docker compose down -v` (wipes the dev DB) or run this file by hand:
--   docker compose exec -T postgres psql -U sipclock -d sipclock < apps/api/db/init/002-powersync.sql
-- The API migration grants SELECT on the synced tables to powersync_role and creates the `powersync` publication.
CREATE ROLE powersync_role WITH LOGIN REPLICATION BYPASSRLS PASSWORD 'powersync';
CREATE DATABASE powersync_storage OWNER powersync_role;
