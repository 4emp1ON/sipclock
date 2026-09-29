# Deployment

| Part | Where | How |
|---|---|---|
| Web (`apps/web`) | Vercel, project `sipclock` → https://sipclock.vercel.app | `vercel deploy --prod` (Git integration pending) |
| API + Postgres | Jino VPS, compose project `sipclock` | GitHub Actions → GHCR image → SSH forced command |
| Edge router | Same VPS, compose project `edge` | Caddy on port 80, shared with SweetVilka |

Public API base: `https://4db4f06b3824.vps.myjino.ru/sipclock`. The API reference at `/sipclock/docs` is behind
HTTP Basic (`API_DOCS_USERNAME` / `API_DOCS_PASSWORD` in `~/sipclock/.env`).

## Topology

```
Internet ──TLS──▶ Jino nginx ──http:80──▶ edge/caddy ─┬─ host=<vps>, /sipclock/* ─▶ sipclock-api:8787 ─▶ postgres
                                                      └─ everything else ────────▶ sweetvilka-web-1:3000
```

Jino terminates TLS and appends the client IP to `X-Forwarded-For`. Caddy forwards the `X-Forwarded-*`
headers unchanged, so both apps keep reading the client IP from the last entry
(`TRUST_PROXY_HOPS=1` in Sipclock).

## Server layout (user `deploy`)

```
~/edge/      compose.yaml, Caddyfile, .env        (from deploy/edge)
~/sipclock/  compose.yaml, db/init, .env, deploy.sh, backup.sh   (from deploy/sipclock)
```

Copy or update the files with:

```sh
scp -P 49426 -r deploy/edge/{compose.yaml,Caddyfile} deploy@<host>:edge/
scp -P 49426 -r deploy/sipclock/{compose.yaml,db,deploy.sh,backup.sh} deploy@<host>:sipclock/
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
