import { expect, test } from '@playwright/test'
import { dbGet, loginViaUi } from './utils'

// Volunteer user flows (REQUIREMENTS.md §14): R-291, R-028, R-299, R-301, R-135.
// This is the actor the old suite never drove through the UI — exactly the
// blind spot that hid issue #87.

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, 'bob@example.com')
})

test('R-291: volunteer nav shows Rides only (no admin sections)', async ({ page }) => {
  const nav = page.getByRole('navigation')
  await expect(nav.getByText('Rides')).toBeVisible()
  for (const admin of ['Dashboard', 'People', 'Notifications', 'Audit Log']) {
    await expect(nav.getByText(admin)).toHaveCount(0)
  }
})

test('R-028: direct navigation to admin pages redirects the volunteer to /rides', async ({ page }) => {
  for (const path of ['/people', '/admin/audit', '/admin/notifications', '/']) {
    await page.goto(path)
    await page.waitForURL(/\/rides/)
  }
})

test('R-299: signup then unsignup on a CREATED ride through the UI', async ({ page }) => {
  const ride = dbGet<{ id: string }>(
    `SELECT id FROM ride WHERE status = 'CREATED' AND deletedAt IS NULL ORDER BY scheduledTime LIMIT 1`
  )
  expect(ride).toBeTruthy()
  await page.goto(`/rides/${ride!.id}`)

  const signup = page.waitForResponse((r) => r.url().includes('/signup') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Sign Up' }).click()
  expect((await signup).status()).toBe(200)
  await expect(page.getByText('ASSIGNED')).toBeVisible()
  await expect
    .poll(() => dbGet<{ status: string }>(`SELECT status FROM ride WHERE id = ?`, ride!.id)?.status)
    .toBe('ASSIGNED')

  const unsignup = page.waitForResponse((r) => r.url().includes('/unsignup') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Unsign Up' }).click()
  expect((await unsignup).status()).toBe(200)
  await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible()
  await expect
    .poll(() => dbGet<{ status: string }>(`SELECT status FROM ride WHERE id = ?`, ride!.id)?.status)
    .toBe('CREATED')
  const released = dbGet<{ volunteerId: string | null }>(
    `SELECT volunteerId FROM ride WHERE id = ?`, ride!.id
  )
  expect(released?.volunteerId).toBeNull()
})

// R-135 pins issue #87 end-to-end: the UI offers "Mark as Completed" but the
// middleware 403s the PUT. `test.fail` flips when #87 lands — then remove the
// annotation and this becomes the permanent volunteer-completion regression test.
test('R-135 (#87): a volunteer completes their own ride through the UI', async ({ page }) => {
  test.fail()
  const ride = dbGet<{ id: string }>(
    `SELECT id FROM ride WHERE status = 'CREATED' AND deletedAt IS NULL ORDER BY scheduledTime LIMIT 1`
  )
  await page.goto(`/rides/${ride!.id}`)
  await page.getByRole('button', { name: 'Sign Up' }).click()
  await expect(page.getByText('ASSIGNED')).toBeVisible()

  await page.getByRole('button', { name: 'Mark as Completed' }).click()
  await page.getByRole('spinbutton').fill('1.5')
  await page.getByRole('button', { name: 'Mark as Completed' }).last().click()

  await expect(page.getByText('COMPLETED')).toBeVisible()
  const row = dbGet<{ status: string; totalRideTime: number }>(
    `SELECT status, totalRideTime FROM ride WHERE id = ?`, ride!.id
  )
  expect(row?.status).toBe('COMPLETED')
  expect(row?.totalRideTime).toBe(1.5)
})

test('R-301: settings — status + notification toggles persist across reload', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByText('Volunteer Profile')).toBeVisible()

  // Flip the first notification toggle off, reload, expect it stayed off, restore.
  const firstSwitch = page.getByRole('switch').first()
  const before = await firstSwitch.getAttribute('aria-checked')
  await firstSwitch.click()
  await page.waitForTimeout(500) // persistence request
  await page.reload()
  const after = await page.getByRole('switch').first().getAttribute('aria-checked')
  expect(after).not.toBe(before)

  await page.getByRole('switch').first().click()
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.getByRole('switch').first()).toHaveAttribute('aria-checked', before!)
})
