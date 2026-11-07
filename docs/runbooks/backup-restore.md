# Backup & restore

## Script

[`scripts/backup-db.sh`](../../scripts/backup-db.sh) dumps Postgres via Docker Compose.

**Local / dev (default):**

```bash
./scripts/backup-db.sh
# uses docker/docker-compose.yml, user `store`, db `online_store`
```

**Production VPS:**

```bash
export BACKUP_ENV=prod
export BACKUP_DIR=/var/backups/online-store
export POSTGRES_USER=store
export POSTGRES_DB=online_store
# optional: COMPOSE_FILE=/opt/online-store/docker/docker-compose.prod.yml
./scripts/backup-db.sh
```

Cron example:

```cron
0 2 * * * BACKUP_ENV=prod BACKUP_DIR=/var/backups/online-store /opt/online-store/scripts/backup-db.sh
```

## Restore

```bash
gunzip -c online-store-YYYYMMDD.sql.gz | \
  docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Verify: `GET /health/ready` returns `{ "status": "ready" }`.

Optional: sync object storage (R2/MinIO) separately from SQL dumps.
