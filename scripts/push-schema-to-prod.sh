#!/usr/bin/env bash
# push-schema-to-prod.sh
#
# Pushes the current Drizzle schema (shared/schema.ts) to the PRODUCTION
# database. Run this BEFORE sync-dev-to-prod.ts whenever you've added/changed
# columns or tables in dev.
#
# Usage:
#   bash scripts/push-schema-to-prod.sh
#
# Reads the prod connection string from the `engineer1_prod_db` secret.

set -euo pipefail

if [ -z "${engineer1_prod_db:-}" ]; then
  echo "Missing env var 'engineer1_prod_db' (prod connection string)." >&2
  exit 1
fi

echo "Pushing schema to PRODUCTION database..."
DATABASE_URL="$engineer1_prod_db" npx drizzle-kit push --force
echo "✓ Schema push complete."
