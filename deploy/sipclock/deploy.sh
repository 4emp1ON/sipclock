#!/bin/sh
# Forced command for the CI deploy key (see deploy/README.md). The only input is the image tag,
# passed as the SSH command; anything else is rejected, so the key cannot run arbitrary commands.
set -eu

tag="${SSH_ORIGINAL_COMMAND:-}"
if ! printf '%s' "$tag" | grep -Eq '^sha-[0-9a-f]{7,40}$'; then
  echo "refusing tag: '$tag'" >&2
  exit 2
fi

cd "$(dirname "$0")"
# Persist the tag in .env so a reboot or a manual `docker compose up -d` keeps running this version.
if grep -q '^SIPCLOCK_TAG=' .env; then
  sed -i "s/^SIPCLOCK_TAG=.*/SIPCLOCK_TAG=$tag/" .env
else
  printf '\nSIPCLOCK_TAG=%s\n' "$tag" >> .env
fi
docker compose pull --quiet migrate api
docker compose up -d --wait api
docker image prune -f --filter "label=org.opencontainers.image.source=https://github.com/4emp1ON/sipclock" >/dev/null

# Smoke test through the edge router on this host: GitHub's runners cannot always reach Jino on 443,
# so the check that gates the deploy runs here. Host comes from PUBLIC_BASE_URL (https://<host>/sipclock).
host=$(sed -n 's|^PUBLIC_BASE_URL=https\{0,1\}://\([^/]*\).*|\1|p' .env)
for i in 1 2 3 4 5 6; do
  if curl -fsS --max-time 5 -H "Host: $host" http://127.0.0.1/sipclock/ready >/dev/null; then
    echo "deployed $tag"
    exit 0
  fi
  sleep 5
done
echo "smoke test failed: /sipclock/ready via the edge router" >&2
exit 1
