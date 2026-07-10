import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { clearSessionCache } from './auth'

// Order-independence for the shared-DB e2e harness (issue #62).
//
// The suite boots ONE server against ONE seeded SQLite file and runs every
// `tests/e2e/*.test.ts` sequentially. Mutating tests (create/complete/delete
// rides, clear phones, …) can corrupt seeded rows that later files assert
// against, making the suite order-dependent and flaky.
//
// Rather than re-run the (slow, ~1.6s) `tsx prisma/seed.ts` subprocess per
// file, we snapshot every table's rows ONCE — right after the initial seed —
// into a JSON file, then restore that snapshot in-process before each file
// runs. Restore is a fast, generic delete-all + bulk re-insert over the same
// better-sqlite3 connection the app uses; SQLite serializes writes across
// connections and the reset runs in `beforeAll` with no concurrent requests
// in flight, so overwriting the live file is safe.

const SNAPSHOT_PATH_ENV = 'NUXT_TEST_DB_SNAPSHOT'

function dbPath(): string {
  const url = process.env.DATABASE_URL ?? ''
  const path = url.replace(/^file:/, '')
  if (!path) throw new Error('DATABASE_URL is not set — cannot locate the test DB')
  return path
}

function snapshotPath(): string {
  if (process.env[SNAPSHOT_PATH_ENV]) return process.env[SNAPSHOT_PATH_ENV]!
  const root = fileURLToPath(new URL('../..', import.meta.url))
  return resolve(root, '.data/test-seed-snapshot.json')
}

function userTables(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '_prisma_%'`
    )
    .all() as { name: string }[]
  return rows.map((r) => r.name)
}

type Snapshot = Record<string, Record<string, unknown>[]>

/**
 * Capture the current contents of every user table. Call once, immediately
 * after the initial seed, from global setup.
 */
export function captureSeedSnapshot(): void {
  const db = new Database(dbPath())
  try {
    const snapshot: Snapshot = {}
    for (const table of userTables(db)) {
      snapshot[table] = db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]
    }
    writeFileSync(snapshotPath(), JSON.stringify(snapshot))
  } finally {
    db.close()
  }
}

/**
 * Restore every table to its post-seed snapshot. Call from a `beforeAll` in
 * each mutating test file (see tests/e2e/*.test.ts) so no file inherits another
 * file's mutations. Cheap: one transaction of deletes + bulk inserts.
 */
export function resetDb(): void {
  const path = snapshotPath()
  if (!existsSync(path)) {
    throw new Error(
      `Seed snapshot missing at ${path}; global setup must call captureSeedSnapshot() first`
    )
  }
  const snapshot = JSON.parse(readFileSync(path, 'utf8')) as Snapshot

  const db = new Database(dbPath())
  try {
    const tables = userTables(db)
    const restore = db.transaction(() => {
      // Defer FK checks until COMMIT: we wipe every table and re-insert the full
      // consistent snapshot, so intermediate states violate FKs. `PRAGMA
      // foreign_keys` is a no-op inside a transaction, but `defer_foreign_keys`
      // works and auto-resets after the transaction.
      db.pragma('defer_foreign_keys = ON')
      for (const table of tables) db.prepare(`DELETE FROM "${table}"`).run()
      for (const table of tables) {
        const rows = snapshot[table] ?? []
        if (rows.length === 0) continue
        const columns = Object.keys(rows[0]!)
        const placeholders = columns.map((c) => `@${c}`).join(', ')
        const insert = db.prepare(
          `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`
        )
        for (const row of rows) insert.run(row)
      }
    })
    restore()
  } finally {
    db.close()
  }

  // Cached login cookies point at `session` rows that we just wiped; drop them
  // so the next `loginAs` re-runs the OTP flow against the restored DB.
  clearSessionCache()
}
