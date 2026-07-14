// Boot script for the Playwright browser suite (see playwright.config.ts).
//
// Prepares a throwaway seeded SQLite DB and serves the PRODUCTION build on
// :3210 with TEST_HOOKS=1 (same seams as the API e2e harness — email sends are
// no-ops, OTPs are read from the DB by tests/browser/utils.ts). Builds the app
// first if .output is missing, so `pnpm test:browser` works from a fresh clone.
import { execSync, spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dbPath = resolve(root, '.data/browser-test.db')
const env = {
  ...process.env,
  DATABASE_URL: `file:${dbPath}`,
  BETTER_AUTH_SECRET: 'wcoa-browser-suite-secret-0123456789abcdef',
  TEST_HOOKS: '1',
  PORT: process.env.PORT || '3210',
  // Never let a real key leak into the suite — the no-key fallback is asserted.
  NUXT_GOOGLE_MAPS_API_KEY: '',
  NUXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY: '',
}

if (!existsSync(resolve(root, '.output/server/index.mjs'))) {
  console.log('[browser-server] no .output build found — building (one-time, ~2min)…')
  execSync('npx nuxt build', { cwd: root, stdio: 'inherit', env })
}

console.log('[browser-server] provisioning fresh seeded DB at', dbPath)
rmSync(dbPath, { force: true })
execSync('npx prisma db push', { cwd: root, stdio: 'inherit', env })
execSync('npx tsx prisma/seed.ts', { cwd: root, stdio: 'inherit', env })

console.log(`[browser-server] starting prod server on :${env.PORT}`)
const server = spawn('node', ['.output/server/index.mjs'], { cwd: root, stdio: 'inherit', env })
server.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill())
