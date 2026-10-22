#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Use a new isolated staging database, never production}"
: "${BACKUP_FILE:?BACKUP_FILE required}"
[[ "${ALLOW_EMPTY_RESTORE:-}" = 'yes' ]] || { echo 'Set ALLOW_EMPTY_RESTORE=yes for the isolated empty target' >&2; exit 1; }
table_count=$(psql "$RESTORE_DATABASE_URL" -X -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public'")
[[ "$table_count" = '0' ]] || { echo 'Restore target must be empty' >&2; exit 1; }
sha256sum --check "$BACKUP_FILE.sha256"
pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-acl --exit-on-error --single-transaction "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM decks; SELECT count(*) FROM cards; SELECT count(*) FROM universal_questions;'
