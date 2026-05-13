#!/usr/bin/env bash
# push-schema-to-prod.sh
#
# Pushes the current Drizzle schema (shared/schema.ts) to the PRODUCTION
# database. Run this BEFORE sync-dev-to-prod.ts whenever you've added/changed
# columns or tables in dev.
#
# IMPORTANT: drizzle-kit only updates the `public` schema. Because we use
# schema-per-tenant isolation, we then run sync-tenant-schemas.mjs to
# propagate any additive changes (new columns, relaxed NOT NULLs, new
# indexes) into every `tenant_<slug>` schema. Without this second step,
# tenants silently see "0 results" or "column does not exist" errors after
# any schema push.
#
# Usage:
#   bash scripts/push-schema-to-prod.sh
#
# Reads the prod connection string from the `PROD_DATABASE_URL` secret.

set -euo pipefail

if [ -z "${PROD_DATABASE_URL:-}" ]; then
  echo "Missing env var 'PROD_DATABASE_URL' (prod connection string)." >&2
  exit 1
fi

echo "Step 1/2: Pushing schema to PRODUCTION public schema..."
DATABASE_URL="$PROD_DATABASE_URL" npx drizzle-kit push --force

echo ""
echo "Step 2/2: Propagating additive changes to all tenant_<slug> schemas..."
node scripts/sync-tenant-schemas.mjs --prod

echo ""
echo "✓ Schema push complete (public + all tenant schemas in sync)."
