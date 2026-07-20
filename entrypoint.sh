#!/bin/sh
set -e

# Apply any pending schema migrations to the persistent production database,
# then start the server. This is idempotent and safe on every container start.
#
# DO NOT run `prisma db seed` here: prisma/seed.ts unconditionally wipes the
# database (deleteMany on users/clients/rides/addresses/sessions) with no
# environment guard, so seeding on boot would destroy production data on every
# deploy/restart. Seeding is a dev/test-only operation.
#
# `prisma generate` is also intentionally omitted — the client is already
# generated at image build time (see dockerfile), so regenerating at boot is
# redundant.
pnpm prisma migrate deploy

# Run the CMD command from the dockerfile (node ./server/index.mjs)
exec "$@"
