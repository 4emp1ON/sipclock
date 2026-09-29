#!/bin/sh
# Nightly Postgres dump, kept for 14 days. Cron (deploy user): 45 3 * * * $HOME/sipclock/backup.sh
set -eu
dir="$HOME/backups/sipclock"
mkdir -p "$dir"
cd "$(dirname "$0")"
docker compose exec -T postgres pg_dump -U sipclock -d sipclock --format=custom > "$dir/sipclock-$(date +%F).dump"
find "$dir" -name 'sipclock-*.dump' -mtime +14 -delete
