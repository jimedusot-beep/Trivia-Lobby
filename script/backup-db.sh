#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
BACKUP_DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
: "${BACKUP_DIR:?Use an absolute directory on encrypted durable storage}"
[[ "$BACKUP_DIR" = /* ]] || { echo 'BACKUP_DIR must be absolute' >&2; exit 1; }
umask 077
mkdir -p "$BACKUP_DIR"
backup_name="trivia-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --dbname="$BACKUP_DATABASE_URL" --format=custom --no-owner --no-acl --file="$BACKUP_DIR/$backup_name.partial"
pg_restore --list "$BACKUP_DIR/$backup_name.partial" > /dev/null
mv "$BACKUP_DIR/$backup_name.partial" "$BACKUP_DIR/$backup_name"
sha256sum "$BACKUP_DIR/$backup_name" > "$BACKUP_DIR/$backup_name.sha256"
echo "Verified backup archive created: $backup_name"
