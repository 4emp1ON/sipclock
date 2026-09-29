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
echo "deployed $tag"
