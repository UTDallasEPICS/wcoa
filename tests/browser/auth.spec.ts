import { expect, test } from '@playwright/test'
import { getOtp, loginViaUi } from './utils'

// R-290, R-004, R-005, R-006 (REQUIREMENTS.md): the real login/logout UI flows.

test('R-290/R-004: a wrong OTP shows an error and does not create a session', async ({ page }) => {
  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill('bob@example.com')
  await page.getByRole('button', { name: 'Send OTP' }).click()
  await expect(page.getByRole('textbox', { name: 'pin input 1 of 6' })).toBeVisible()

  await page.getByRole('textbox', { name: 'pin input 1 of 6' }).click()
  await page.keyboard.type('000000')
  await page.getByRole('button', { name: 'Login' }).click()

  // Error toast appears and we stay on the OTP step.
  await expect(page.getByText(/invalid|error/i).first()).toBeVisible()
  await expect(page).toHaveURL(/\/auth/)
})

test('R-290/R-005: valid OTP logs an admin in and lands on the dashboard', async ({ page }) => {
  await loginViaUi(page, 'reachtusharwani@gmail.com')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('R-006: logout destroys the session and protected pages redirect to /auth', async ({ page }) => {
  await loginViaUi(page, 'reachtusharwani@gmail.com')
  // The user menu (chip with the first name) → Logout.
  await page.getByText('Tushar', { exact: true }).click()
  await page.getByText('Logout').click()
  await page.waitForURL(/\/auth/)

  await page.goto('/rides')
  await page.waitForURL(/\/auth/)
})

test('R-002: an unknown email cannot request an OTP', async ({ page }) => {
  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill('nobody-here@example.com')
  await page.getByRole('button', { name: 'Send OTP' }).click()
  // Stays on the email step with an error toast — no pin inputs appear.
  await expect(page.getByText(/error|not found|failed/i).first()).toBeVisible()
})

// Keep getOtp referenced for suites that import selectively.
void getOtp
