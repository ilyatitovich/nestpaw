#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/online-store-$STAMP.sql.gz"
docker compose -f "$ROOT/docker/docker-compose.yml" exec -T postgres \
  pg_dump -U store online_store | gzip > "$FILE"
echo "Wrote $FILE"
