# Backup & restore

## Nightly backup (VPS cron)

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="/var/backups/online-store-$STAMP.sql.gz"
docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILE"
# optional: upload "$FILE" to R2/S3
```

Install as root cron: `0 2 * * * /opt/online-store/scripts/backup-db.sh`

## Restore

```bash
gunzip -c online-store-YYYYMMDD.sql.gz | \
  docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Verify: `GET /health/ready` returns `{ "status": "ready" }`.
