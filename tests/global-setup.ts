import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { captureSeedSnapshot } from './utils/reset-db'

// One-time e2e setup (issue #45): build the Nuxt app ONCE, seed a fresh SQLite
// DB, and start a SINGLE server that every test file connects to (via
// `setup({ host })`). Previously each test file called @nuxt/test-utils
// `setup()`, which built + booted the app per file (~12 builds → slow, and the
// first cold build could blow past the 120s per-file hook timeout).

async function freePort(): Promise<number> {
  return await new Promise((res, rej) => {
    const srv = createServer()
    srv.once('error', rej)
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port
      srv.close(() => res(port))
    })
  })
}

function waitForReady(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  return new Promise((res, rej) => {
    const tick = async () => {
      try {
        // Any HTTP response (even 401/404) means the server is up.
        await fetch(url)
        res()
      } catch {
        if (Date.now() > deadline) rej(new Error(`server not ready after ${timeoutMs}ms: ${url}`))
        else setTimeout(tick, 250)
      }
    }
    tick()
  })
}

export default async function globalSetup() {
  const root = resolve(import.meta.dirname, '..')
  const dbPath = resolve(root, '.data/test.db')

  // Fresh, seeded database.
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(dbPath + suffix, { force: true })
  }
  mkdirSync(dirname(dbPath), { recursive: true })

  const dbEnv = { ...process.env, DATABASE_URL: `file:${dbPath}` }
  execSync('npx prisma db push', { cwd: root, env: dbEnv, stdio: 'inherit' })
  execSync('npx tsx prisma/seed.ts', { cwd: root, env: dbEnv, stdio: 'inherit' })

  // Snapshot the freshly-seeded rows so each test file can cheaply restore them
  // and stay order-independent (issue #62). Point resetDb() at the same file.
  process.env.DATABASE_URL = `file:${dbPath}`
  captureSeedSnapshot()

  // Build the production server once.
  execSync('npx nuxt build', { cwd: root, env: dbEnv, stdio: 'inherit' })

  // Start the single shared server the whole suite talks to.
  const port = await freePort()
  const host = `http://127.0.0.1:${port}`
  const server: ChildProcess = spawn('node', ['.output/server/index.mjs'], {
    cwd: root,
    env: {
      ...dbEnv,
      PORT: String(port),
      NITRO_PORT: String(port),
      HOST: '127.0.0.1',
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'test-secret-not-for-production',
      // Enables the test-only seams (issue #45): the concurrency read→write
      // delay (x-test-race-delay) and the per-request query counter
      // (x-test-count-queries → x-query-count). Both are per-request opt-in and
      // strict no-ops without this flag, which only the harness ever sets.
      TEST_HOOKS: '1',
      DISABLE_RATE_LIMIT: 'true',
      // Maps are key-less open-source services now (Photon geocoding + OSRM
      // routing). MAPS_OFFLINE=1 makes those helpers skip every outbound call so
      // the suite stays hermetic + deterministic: geocoding returns no results
      // and routing returns null, exactly like a real outage, with no network
      // (server/utils/maps.ts).
      MAPS_OFFLINE: '1',
    },
    stdio: 'inherit',
  })

  await waitForReady(host, 120_000)

  // Expose the shared host to worker processes. Env is inherited by forks
  // spawned after globalSetup; the file is a robust fallback the harness reads.
  process.env.NUXT_TEST_SHARED_HOST = host
  writeFileSync(resolve(root, '.data/test-host.txt'), host)

  return async () => {
    server.kill('SIGTERM')
  }
}
