import { execSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Creates a fresh, seeded SQLite database for the e2e suite.
// Must compute the same path as vitest.config.ts `env.DATABASE_URL`.
export default function globalSetup() {
  const root = resolve(import.meta.dirname, '..')
  const dbPath = resolve(root, '.data/test.db')

  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(dbPath + suffix, { force: true })
  }
  mkdirSync(dirname(dbPath), { recursive: true })

  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` }
  execSync('npx prisma db push', { cwd: root, env, stdio: 'inherit' })
  execSync('npx tsx prisma/seed.ts', { cwd: root, env, stdio: 'inherit' })
}
