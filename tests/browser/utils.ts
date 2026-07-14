import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { expect, type Page } from '@playwright/test'

const DB_PATH = resolve(import.meta.dirname, '../../.data/browser-test.db')

/**
 * Read the most recent OTP for an email straight from the verification table —
 * the same no-SMTP trick as tests/utils/auth.ts, but for the browser suite's DB.
 * Polls briefly because the row is written by the server after the UI click.
 */
export async function getOtp(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const db = new Database(DB_PATH, { readonly: true })
    try {
      const row = db
        .prepare(
          `SELECT value FROM verification WHERE identifier LIKE ? ORDER BY createdAt DESC LIMIT 1`
        )
        .get(`%${email}%`) as { value: string } | undefined
      if (row?.value) return row.value.split(':')[0]!
    } finally {
      db.close()
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`no OTP found for ${email}`)
}

/** Drive the real two-step OTP login UI (R-290). Lands wherever the app routes the role. */
export async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByRole('button', { name: 'Send OTP' }).click()
  await expect(page.getByRole('textbox', { name: 'pin input 1 of 6' })).toBeVisible()

  const otp = await getOtp(email)
  await page.getByRole('textbox', { name: 'pin input 1 of 6' }).click()
  await page.keyboard.type(otp)
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
}

/** Query the suite DB directly (assertions on persisted state). */
export function dbGet<T>(sql: string, ...params: unknown[]): T | undefined {
  const db = new Database(DB_PATH, { readonly: true })
  try {
    return db.prepare(sql).get(...params) as T | undefined
  } finally {
    db.close()
  }
}
