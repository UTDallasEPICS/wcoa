import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetch as appFetch } from '@nuxt/test-utils/e2e'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Regression test for #17 (crash-recovery race in processReminders).
//
// The bug: processReminders sent the email and only THEN wrote the SentReminder
// row. If the process crashed between the send and the write, no row was
// recorded, so every subsequent cron tick re-sent the same reminder forever.
//
// The fix ("claim before send"): write the SentReminder row FIRST (relying on
// @@unique([rideId, type]) for atomic/idempotent claiming), then send. A crash
// after the claim leaves the row behind, so a later run sees it and skips.
//
// How this pins the bug (revert-check shape):
//   - We build a ride that is genuinely due for a reminder (ASSIGNED, future
//     scheduledTime, a volunteer with a Reminder whose window has arrived).
//   - We drive processReminders via the gated _test/run-reminders endpoint with
//     the 'reminder-after-claim' fault armed. That fault throws AFTER the claim
//     and AROUND the send — i.e. "claimed but crashed before finishing the send".
//   - POST-FIX: the claim happened before the fault, so the SentReminder row
//     EXISTS after the faulted run. A subsequent un-faulted run sees it and does
//     NOT re-send: still exactly one row.
//   - PRE-FIX: the create was after the send/fault, so NO row exists after the
//     faulted run, and the subsequent run re-sends and creates the row only then.
//     The assertion "a row exists immediately after the faulted run" FAILS
//     pre-fix, which is the revert-check.

const dbPath = (process.env.DATABASE_URL ?? '').replace(/^file:/, '')

// Unique entities so we never touch seeded data other reminder-scanning tests use.
const suffix = randomUUID()
const userId = `t17-user-${suffix}`
const volunteerId = `t17-vol-${suffix}`
const reminderId = `t17-rem-${suffix}`
const rideId = `t17-ride-${suffix}`
const reminderType = '7200' // minutesBefore, also the SentReminder.type value

function db() {
  return new Database(dbPath)
}

beforeAll(() => {
  const conn = db()
  try {
    const now = Date.now()
    const iso = (ms: number) => new Date(ms).toISOString()

    // A seeded client to satisfy the required Ride.clientId FK.
    const clientId = (
      conn
        .prepare(
          `SELECT c.id AS id FROM client c
             JOIN user u ON u.id = c.userId
            WHERE u.email = 'martha@example.com'`,
        )
        .get() as { id: string }
    ).id

    conn
      .prepare(
        `INSERT INTO user (id, name, email, emailVerified, role, createdAt, updatedAt)
         VALUES (?, ?, ?, 1, 'VOLUNTEER', ?, ?)`,
      )
      .run(userId, 'Reminder Race Vol', `race-${suffix}@example.com`, iso(now), iso(now))

    conn
      .prepare(
        `INSERT INTO volunteer (id, userId, status) VALUES (?, ?, 'AVAILABLE')`,
      )
      .run(volunteerId, userId)

    // Reminder window has already arrived: scheduledTime is +2 days but
    // minutesBefore is 5 days, so threshold = scheduledTime - 5d = ~3 days ago.
    conn
      .prepare(
        `INSERT INTO reminder (id, volunteerId, minutesBefore, type, createdAt, updatedAt)
         VALUES (?, ?, ?, 'email', ?, ?)`,
      )
      .run(reminderId, volunteerId, Number(reminderType), iso(now), iso(now))

    conn
      .prepare(
        `INSERT INTO ride (id, status, clientId, volunteerId, pickupDisplay, dropoffDisplay, scheduledTime, createdAt, updatedAt)
         VALUES (?, 'ASSIGNED', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        rideId,
        clientId,
        volunteerId,
        'Pickup 17',
        'Dropoff 17',
        iso(now + 2 * 86400000),
        iso(now),
        iso(now),
      )
  } finally {
    conn.close()
  }
})

afterAll(() => {
  const conn = db()
  try {
    conn.prepare(`DELETE FROM sent_reminder WHERE rideId = ?`).run(rideId)
    conn.prepare(`DELETE FROM ride WHERE id = ?`).run(rideId)
    conn.prepare(`DELETE FROM reminder WHERE id = ?`).run(reminderId)
    conn.prepare(`DELETE FROM volunteer WHERE id = ?`).run(volunteerId)
    conn.prepare(`DELETE FROM user WHERE id = ?`).run(userId)
  } finally {
    conn.close()
  }
})

async function runReminders(cookie: string, fault?: string): Promise<number> {
  const res = await appFetch('/api/_test/run-reminders', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(fault ? { fault } : {}),
  })
  return res.status
}

function sentRows(): number {
  const conn = db()
  try {
    const row = conn
      .prepare(`SELECT COUNT(*) AS n FROM sent_reminder WHERE rideId = ? AND type = ?`)
      .get(rideId, reminderType) as { n: number }
    return row.n
  } finally {
    conn.close()
  }
}

describe('reminder claim-before-send (#17)', () => {
  it('a faulted run leaves the reminder claimed and a later run does not re-send', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')

    // Sanity: nothing sent yet for our ride.
    expect(sentRows()).toBe(0)

    // Simulate a crash mid-run: the fault fires after the claim, around the send.
    // The endpoint arms the fault, so the run 500s.
    expect(await runReminders(cookie, 'reminder-after-claim')).toBe(500)

    // Revert-check: post-fix the claim was written BEFORE the fault, so exactly
    // one row exists now. Pre-fix the create was after the fault -> 0 rows, and
    // this assertion fails.
    expect(sentRows()).toBe(1)

    // A subsequent clean run must NOT re-send: the row already claims it.
    expect(await runReminders(cookie)).toBe(200)
    expect(sentRows()).toBe(1)
  })
})
