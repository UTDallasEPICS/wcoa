#!/bin/sh
set -e

# Apply any pending Prisma schema migrations to the (persistent) production
# database before starting the server (issue #33). This is a no-op once the DB
# is already at the latest migration, so it is safe on every container start.
#
# DATABASE_URL must be set in the container environment and point at the
# persistent SQLite file (e.g. a mounted volume) — the same value the app uses.
# `--no-install` guarantees we use the prisma CLI baked into the image rather
# than fetching one from the network at runtime.
echo "[entrypoint] applying database migrations (prisma migrate deploy)…"
npx --no-install prisma migrate deploy

echo "[entrypoint] starting server…"
exec node .output/server/index.mjs
