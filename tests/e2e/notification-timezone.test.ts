import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetch as appFetch } from '@nuxt/test-utils/e2e'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'
import { formatNotificationDateTime } from '../../server/utils/datetime'

await bootShared()

// Regression coverage for R-197 / issue #113.
//
// The bug: several server-side email/reminder bodies rendered a ride's
// scheduled time with a bare `new Date(x).toLocaleString()` (no fixed
// locale/timezone). `toLocaleString()` uses the HOST process timezone, which is
// UTC in the prod container, so volunteers/admins received UTC wall-clock times
// instead of the org timezone (America/Chicago). The four sites were:
//   - server/api/post/rides/[id]/signup.ts   (admin email body)
//   - server/api/post/rides/[id]/unsignup.ts (volunteer + admin email bodies)
//   - server/utils/scheduler.ts              (RIDE_REMINDER `time` field)
//
// The fix routes all four through the pinned helper `formatNotificationDateTime`
// in server/utils/datetime.ts (America/Chicago, en-US), matching the #9
// convention already used by signup.ts's RIDE_ASSIGNED notification.

// ---------------------------------------------------------------------------
// 1. Helper unit test (genuine, host-TZ-independent revert-check).
//
// `formatNotificationDateTime` does not exist pre-fix, so this file fails to
// compile/import against the reverted tree (same shape as the #9 and #21
// helper-absence checks). It asserts the output equals the CENTRAL wall clock
// for a known UTC instant — a bare `.toLocaleString()` on a UTC host would emit
// the UTC wall clock instead, which these assertions reject. Because the helper
// pins `timeZone: 'America/Chicago'` in Intl.DateTimeFormat, the result is the
// same on any host, so this is stable across CI/dev/prod timezones.
// ---------------------------------------------------------------------------
describe('R-197: formatNotificationDateTime pins the org timezone (#113)', () => {
  it('R-197: renders a known winter (CST, UTC-6) instant in Central, not UTC', () => {
    // 2026-02-16T15:00:00Z -> 09:00 in America/Chicago (CST). UTC wall clock is 3:00 PM.
    const out = formatNotificationDateTime(new Date('2026-02-16T15:00:00Z'))
    expect(out).toMatch(/February 16, 2026/)
    expect(out).toMatch(/9:00/)
    expect(out).toMatch(/AM/)
    // Must NOT be the UTC wall clock (the pre-fix bare-toLocaleString behavior on
    // a UTC host).
    expect(out).not.toMatch(/3:00/)
    expect(out).not.toMatch(/PM/)
    // Explicitly host-independent: differs from a UTC-pinned render of the same
    // instant.
    const utcRender = new Date('2026-02-16T15:00:00Z').toLocaleString('en-US', {
      timeZone: 'UTC',
    })
    expect(out).not.toBe(utcRender)
  })

  it('R-197: honors DST for a summer (CDT, UTC-5) instant', () => {
    // 2026-07-15T18:00:00Z -> 13:00 in America/Chicago (CDT).
    const out = formatNotificationDateTime(new Date('2026-07-15T18:00:00Z'))
    expect(out).toMatch(/July 15, 2026/)
    expect(out).toMatch(/1:00/)
    expect(out).toMatch(/PM/)
  })
})

// ---------------------------------------------------------------------------
// 2. Reminder-cron integration for the scheduler.ts site.
//
// The scheduler feeds its `time` field into sendNotification('RIDE_REMINDER'),
// which renders the template body and hands it to sendEmail. Under TEST_HOOKS
// sendEmail is a strict no-op with NO outbox/capture, so the rendered `time`
// STRING is not observable from the harness (the same limitation applies to the
// signup/unsignup email bodies). We therefore do NOT assert the emitted string
// here; the genuine string-level revert-check for the helper is the unit test
// above. What this integration proves is that the fixed call path on
// scheduler.ts executes end-to-end on a genuinely-due reminder — i.e. the new
// `formatNotificationDateTime(scheduledTime)` call is wired into the live cron
// path and the reminder is claimed/processed without error.
// ---------------------------------------------------------------------------
const dbPath = (process.env.DATABASE_URL ?? '').replace(/^file:/, '')
const suffix = randomUUID()
const userId = `t113-user-${suffix}`
const volunteerId = `t113-vol-${suffix}`
const reminderId = `t113-rem-${suffix}`
const rideId = `t113-ride-${suffix}`
const reminderType = '120' // minutesBefore, also the SentReminder.type value

function db() {
  return new Database(dbPath)
}

beforeAll(() => {
  const conn = db()
  try {
    const now = Date.now()
    const iso = (ms: number) => new Date(ms).toISOString()

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
      .run(userId, 'Reminder TZ Vol', `tz-${suffix}@example.com`, iso(now), iso(now))

    conn
      .prepare(
        `INSERT INTO volunteer (id, userId, status) VALUES (?, ?, 'AVAILABLE')`,
      )
      .run(volunteerId, userId)

    // Due now: scheduledTime is +1h (future, so the scan includes it) but
    // minutesBefore is 120, so the threshold = scheduledTime - 2h = ~1h ago.
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
        'Pickup 113',
        'Dropoff 113',
        iso(now + 3600000),
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

describe('R-197: reminder cron renders through the pinned helper (#113)', () => {
  it('R-197: a due RIDE_REMINDER is processed via the pinned datetime path', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')

    expect(sentRows()).toBe(0)

    const res = await appFetch('/api/_test/run-reminders', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    // The scheduler's new formatNotificationDateTime() call is on this path;
    // a green run proves it executes end-to-end without error.
    expect(res.status).toBe(200)

    // The reminder was claimed + processed (the claim precedes the send, so this
    // holds even though the email itself is a no-op in the harness).
    expect(sentRows()).toBe(1)
  })
})
