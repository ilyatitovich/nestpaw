#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/online-store-$STAMP.sql.gz"

COMPOSE_FILE="${COMPOSE_FILE:-}"
if [[ -z "$COMPOSE_FILE" ]]; then
  if [[ "${BACKUP_ENV:-dev}" == "prod" ]]; then
    COMPOSE_FILE="$ROOT/docker/docker-compose.prod.yml"
  else
    COMPOSE_FILE="$ROOT/docker/docker-compose.yml"
  fi
fi

PG_USER="${POSTGRES_USER:-store}"
PG_DB="${POSTGRES_DB:-online_store}"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$FILE"
echo "Wrote $FILE"
