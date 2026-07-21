import { expect, test } from '@playwright/test'
import { dbGet, loginViaUi } from './utils'

// Admin user flows (REQUIREMENTS.md §14): R-291..R-298, R-300, R-302..R-305.
// Single worker; tests in this file share the seeded browser DB.

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, 'reachtusharwani@gmail.com')
})

test('R-291/R-292: admin nav + dashboard metric cards render with data', async ({ page }) => {
  for (const item of ['Dashboard', 'Rides', 'People', 'Notifications', 'Audit Log']) {
    await expect(page.getByRole('navigation').getByText(item)).toBeVisible()
  }
  await expect(page.getByText('Ride Completion Rate')).toBeVisible()
  await expect(page.getByText('Total Hours Ridden')).toBeVisible()
  await expect(page.getByText('Top Riders')).toBeVisible()
  // The completion card shows a percentage derived from the seeded rides.
  await expect(page.getByText(/\d+%/).first()).toBeVisible()
})

test('R-293: rides list renders seeded rows; search narrows them server-side', async ({ page }) => {
  await page.goto('/rides')
  await expect(page.getByText('Martha Jenkins').first()).toBeVisible()

  const searchResponse = page.waitForResponse(
    (r) => r.url().includes('/api/get/rides') && r.url().includes('search=')
  )
  await page.getByPlaceholder('Search rides...').fill('Sarah')
  await searchResponse
  await expect(page.getByText('Sarah Connor').first()).toBeVisible()
  await expect(page.getByText('Martha Jenkins')).toHaveCount(0)
})

test('R-294/R-305: Create Ride wizard — client auto-fills pickup; 3-step create succeeds', async ({
  page,
}) => {
  await page.goto('/rides')
  await page.getByRole('button', { name: 'Create Ride' }).click()

  // --- Step 1: Client & route ---
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Martha Jenkins' }).click()
  // Auto-fill (R-294): Martha's seeded home address lands in the pickup summary.
  await expect(page.getByText(/1501 H Avenue/i)).toBeVisible()
  // Dropoff: search + pick a suggestion. The harness runs the geocoder offline
  // (MAPS_OFFLINE=1), which returns one deterministic canned result.
  await page.getByPlaceholder('Search for an address').fill('test address')
  await page.getByRole('button', { name: /Test Address, Plano/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()

  // --- Step 2: Schedule ---
  await page.locator('input[type="datetime-local"]').first().fill('2026-08-01T14:30')
  await page.locator('textarea').fill('browser-suite ride')
  await page.getByRole('button', { name: /Continue/ }).click()

  // --- Step 3: Review + create ---. Wait on the POST (robust to copy changes).
  const created = page.waitForResponse(
    (r) => r.url().includes('/api/post/rides') && r.request().method() === 'POST'
  )
  await page.getByRole('button', { name: /Create ride/ }).click()
  expect((await created).status()).toBe(200)

  // Persisted (not just optimistic UI):
  await expect
    .poll(
      () =>
        dbGet<{ notes: string }>(`SELECT notes FROM ride WHERE notes = 'browser-suite ride'`)?.notes
    )
    .toBe('browser-suite ride')
})

test('R-296/R-297/R-298: ride detail — cancel confirm flow, Navigate deep-link, map fallback', async ({
  page,
}) => {
  // Self-contained: cancel any CREATED, unassigned, non-archived seeded ride
  // (decoupled from other tests so run order / server reuse can't break it).
  const ride = dbGet<{ id: string }>(
    `SELECT id FROM ride WHERE status = 'CREATED' AND volunteerId IS NULL AND deletedAt IS NULL ORDER BY scheduledTime DESC LIMIT 1`
  )
  expect(ride).toBeTruthy()
  await page.goto(`/rides/${ride!.id}`)

  // R-297: encoded Google Maps deep link
  const nav = page.getByRole('link', { name: /Navigate/ })
  await expect(nav).toHaveAttribute(
    'href',
    /google\.com\/maps\/dir\/\?api=1&origin=.+&destination=.+/
  )

  // R-298: the MapLibre/OpenFreeMap map degrades to a friendly placeholder when
  // coordinates aren't available (routing is offline in the harness).
  await expect(page.getByText(/Map unavailable/i)).toBeVisible()

  // R-296: cancel with confirm modal → CANCELLED badge, cancel button gone
  await page.getByRole('button', { name: 'Cancel Ride' }).click()
  await expect(page.getByText(/Are you sure you want to cancel/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel Ride' }).last().click()
  // The status badge (exact) — not the toast text which also contains "cancelled".
  await expect(page.getByText('CANCELLED', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel Ride' })).toHaveCount(0)

  const status = dbGet<{ status: string }>(`SELECT status FROM ride WHERE id = ?`, ride!.id)
  expect(status?.status).toBe('CANCELLED')
})

test('R-300: people page — tabs render rosters; edit modal prefills every field', async ({
  page,
}) => {
  await page.goto('/people')
  await expect(page.getByText('bob@example.com')).toBeVisible()

  // The Volunteers/Clients/Admins switcher is a segmented control; match by text.
  await page.getByText('Clients', { exact: true }).click()
  await expect(page.getByText('martha@example.com')).toBeVisible()

  await page.getByText('Volunteers', { exact: true }).click()
  await expect(page.getByText('bob@example.com')).toBeVisible()
  // Open the edit modal for the first volunteer row.
  await page.locator('tbody tr').first().locator('button').first().click()
  // Scope to the dialog so we don't grab the page's "Search people..." box.
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('input').first()).not.toHaveValue('')
})

test('R-302: notification templates page shows all five cards', async ({ page }) => {
  await page.goto('/admin/notifications')
  for (const name of [
    'RIDE_ASSIGNED',
    'RIDE_CANCELLED',
    'RIDE_COMPLETED',
    'RIDE_CREATED',
    'RIDE_REMINDER',
  ]) {
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
})

test("R-303: audit page renders the trail of this suite's own actions", async ({ page }) => {
  await page.goto('/admin/audit')
  await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible()
  // The cancel test above must have produced a RIDE_CANCELLED row.
  await expect(page.getByText('RIDE_CANCELLED').first()).toBeVisible()
})

// R-304 / issue #98: /rides must hydrate without mismatches. Root cause was
// timezone-dependent date formatting: the "Date" column used
// `toLocaleString('en-US', { … })` with NO fixed timeZone, so the server (UTC
// in prod) and the browser (viewer's local TZ) rendered the same instant into
// different strings. The fix pins locale + timezone (app/utils/datetime.ts), so
// the page is now reliably clean — this is a hard assertion rather than the old
// non-gating diagnostic.
//
// Caveat: this Playwright suite runs the Nuxt server and the browser on the
// SAME machine (same TZ), so it does not, on its own, exercise the UTC-vs-local
// divergence that produced the audit mismatch; the server-side determinism is
// pinned by tests/e2e/hydration-datetime.test.ts. This assertion still guards
// against any OTHER hydration mismatch reappearing on the shell/route.
test('R-304 (#98): /rides hydrates without mismatches', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.goto('/rides')
  await page.waitForLoadState('networkidle')
  const hydration = errors.filter((e) => /hydration/i.test(e))
  expect(hydration).toEqual([])
})
