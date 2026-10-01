# Deployment

| Part | Where | How |
|---|---|---|
| Web (`apps/web`) | Vercel, project `sipclock` → https://sipclock.champ1ons.space (CNAME in Jino DNS; `sipclock.vercel.app` 308-redirects to it) | Vercel Git integration: every push to `main` |
| API + Postgres | Jino VPS, compose project `sipclock` | GitHub Actions → GHCR image → SSH forced command |
| Edge router | Same VPS, compose project `edge` | Caddy on port 80, shared with SweetVilka |

Public API base: `https://4db4f06b3824.vps.myjino.ru/sipclock`. The API reference at `/sipclock/docs` is behind
HTTP Basic (`API_DOCS_USERNAME` / `API_DOCS_PASSWORD` in `~/sipclock/.env`).

## Topology

```
Internet ──TLS──▶ Jino nginx ──http:80──▶ edge/caddy ─┬─ host=<vps>, /sipclock/powersync/* ─▶ sipclock-powersync:8080 ─▶ postgres
                                                      ├─ host=<vps>, /sipclock/* ─▶ sipclock-api:8787 ─▶ postgres
                                                      └─ everything else ────────▶ sweetvilka-web-1:3000
```

Jino terminates TLS and appends the client IP to `X-Forwarded-For`. Caddy forwards the `X-Forwarded-*`
headers unchanged, so both apps keep reading the client IP from the last entry
(`TRUST_PROXY_HOPS=1` in Sipclock).

## Server layout (user `deploy`)

```
~/edge/      compose.yaml, Caddyfile, .env        (from deploy/edge)
~/sipclock/  compose.yaml, db/init, powersync/, powersync-setup.sql, .env, deploy.sh, backup.sh   (from deploy/sipclock and infra/powersync)
```

Copy or update the files with:

```sh
scp -P 49426 -r deploy/edge/{compose.yaml,Caddyfile} deploy@<host>:edge/
scp -P 49426 -r deploy/sipclock/{compose.yaml,db,deploy.sh,backup.sh,powersync-setup.sql} deploy@<host>:sipclock/
scp -P 49426 -r infra/powersync deploy@<host>:sipclock/       # PowerSync config: service.yaml, sync-config.yaml
```

`.env` files are created on the server from the `.env.example` next to each compose file; secrets are
generated there (`openssl rand -base64 32`) and never leave the server.

## Continuous deployment

`.github/workflows/deploy-api.yml` runs after CI succeeds on `main`:

1. builds `apps/api/Dockerfile` (esbuild bundle, ~250 MB image, no `node_modules`) and pushes
   `ghcr.io/4emp1on/sipclock-api:sha-<commit>` and `:latest`;
2. connects with a deploy key whose `authorized_keys` entry is pinned to `~/sipclock/deploy.sh`
   (`command="…",restrict`). The script accepts only a `sha-…` tag, pulls it, runs migrations
   (one-shot `migrate` service) and restarts the API with `--wait`;
3. smoke-tests `/sipclock/ready`.

Repository settings: secrets `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_PORT`;
variable `DEPLOY_ENABLED=true`; environment `production`.

## Manual operations

```sh
ssh sweetvilka                                  # deploy user
cd ~/sipclock && docker compose ps
docker compose logs -f api
SIPCLOCK_TAG=sha-<commit> docker compose up -d --wait api   # roll back to a previous image
./backup.sh                                     # dump to ~/backups/sipclock (cron: 45 3 * * *)
```

## Edge cutover and rollback

SweetVilka's web container used to publish port 80. The cutover moves it to `127.0.0.1:3080` and hands
port 80 to the edge router:

```sh
cd ~/SweetVilka && sed -i 's/^WEB_PORT=80$/WEB_PORT=127.0.0.1:3080/' .env && docker compose up -d --no-deps --no-build web
cd ~/edge && docker compose up -d
```

Rollback:

```sh
cd ~/edge && docker compose down
cd ~/SweetVilka && sed -i 's/^WEB_PORT=.*/WEB_PORT=80/' .env && docker compose up -d --no-deps --no-build web
```

## Accounts rollout: settings before merging (one time)

Merging to `main` deploys the web (Vercel) and the API (CD) at once, so set these first:

- **VPS `~/sipclock/.env`**: `RESEND_API_KEY`, `EMAIL_FROM`, `EDGE_PROXY_SECRET` (`openssl rand -hex 32`). The API
  refuses to start in production without the key and the secret, and CD's smoke test then fails.
- **Vercel project env (Production and Preview)**: `API_ORIGIN=https://<host>/sipclock` and the same
  `EDGE_PROXY_SECRET`. Without `API_ORIGIN` the web proxy answers 503; without the secret every web user shares the
  rate limit of Vercel's egress IP.

## PowerSync rollout (one time)

The sync service (`journeyapps/powersync-service`, pinned in `compose.yaml`, override with `POWERSYNC_TAG`) shares the
Postgres server: it reads the `sipclock` database through the `powersync_role` replication role and keeps its bucket
storage in a separate `powersync_storage` database. Config is `infra/powersync/{service.yaml,sync-config.yaml}`, the same
files local dev uses. Public URL: `https://<host>/sipclock/powersync` (the edge strips the prefix). Memory limit 768 MB.

New `.env` value on the server: `POWERSYNC_DB_PASSWORD` (`openssl rand -hex 24`, hex only because it goes into URLs).
The JWKS is read over the internal network (`http://api:8787/api/auth/jwks`).

Order matters. Everything below runs on the server as `deploy`, in `~/sipclock` unless noted.

1. **Copy files** (see Server layout): `compose.yaml`, `powersync-setup.sql`, `powersync/`, and the edge `Caddyfile`
   into `~/edge/` (not applied yet). Add `POWERSYNC_DB_PASSWORD` to `.env`.
2. **Back up**: `./backup.sh` (dumps `sipclock`; `powersync_storage` is rebuildable and not backed up).
3. **Enable logical WAL**: `docker compose up -d postgres` recreates it with `wal_level=logical` and
   `max_slot_wal_keep_size=2GB`. Check: `docker compose exec postgres psql -U sipclock -c 'SHOW wal_level'` prints `logical`.
   This restarts Postgres, so the API is unavailable for a few seconds.
4. **Deploy the API migration** (creates the three tables and the `powersync` publication): merge to `main` and let CD run,
   or `docker compose pull migrate api && docker compose up -d --wait api`.
5. **Create the role and storage database** (idempotent; exits non-zero if the tables or publication are missing):
   ```sh
   docker compose exec -T postgres psql -U sipclock -d sipclock -v ON_ERROR_STOP=1 \
     -v password="$(grep ^POWERSYNC_DB_PASSWORD= .env | cut -d= -f2)" < powersync-setup.sql
   ```
6. **Start PowerSync**: `docker compose up -d --wait powersync`. `docker compose logs powersync` should show
   `Created replication slot` and `Replicating "public"."bar_item"`.
7. **Route it at the edge**: `cd ~/edge && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`
   (or `docker compose up -d` if the Caddyfile is a read-only bind mount that did not pick up the change).
8. **Smoke test**: `curl -i https://<host>/sipclock/powersync/probes/liveness` returns `200`. Then sign in on a device and
   watch the sync stream stay open (`curl -N` against `/sipclock/powersync/sync/stream` needs a token, so use the app).

Rollback, newest step first:

```sh
# edge: revert the Caddyfile (remove the @sipclock_powersync block), then reload as in step 7
cd ~/sipclock && docker compose stop powersync && docker compose rm -f powersync
# free the replication slot, otherwise WAL piles up on disk
docker compose exec postgres psql -U sipclock -d sipclock -c "SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE slot_name LIKE 'powersync%'"
```

`wal_level=logical` and the publication can stay: they are harmless without a slot. To drop the storage data as well:
`DROP DATABASE powersync_storage; DROP ROLE powersync_role;` (drop the role after revoking its grants: `DROP OWNED BY powersync_role;`).

## Local PowerSync

`docker compose up -d` starts Postgres (`wal_level=logical`) and PowerSync on `http://localhost:8080`. PowerSync fetches
the JWKS from the API running on the host (`pnpm --filter @sipclock/api dev`, port 8787; override with `PS_JWKS_URI`).
`apps/api/db/init/002-powersync.sql` creates `powersync_role` (dev password) and `powersync_storage` on a **fresh volume
only**. With an existing volume run `docker compose down -v` (wipes the dev DB) or apply the file by hand:
`docker compose exec -T postgres psql -U sipclock -d sipclock < apps/api/db/init/002-powersync.sql` and restart Postgres
with the new command (`docker compose up -d`). The service logs replication errors until the API migration has created
the tables and the publication.
