import nodemailer from 'nodemailer'
import { isFaultArmed } from './testHooks'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

/**
 * Send an email. Returns `true` when the message was sent, `false` when the
 * send threw (the error is still logged). Callers on user-facing paths (OTP
 * send) should surface a `false`; background notifications may ignore it and
 * stay fire-and-forget (issue #25).
 *
 * Test-only seam (issues #25, #45): the e2e harness has no SMTP, so under
 * `TEST_HOOKS=1` this is a strict no-op that reports success WITHOUT sending —
 * `loginAs()` and every normal flow keep working. A test can force a reported
 * failure by arming the `'email-send'` fault (see testHooks.ts), which makes
 * this return `false` so the failure-surfacing paths can be exercised.
 * In production (`TEST_HOOKS` unset) none of this runs: real sends always occur.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
): Promise<boolean> => {
  if (process.env.TEST_HOOKS === '1') {
    return !isFaultArmed('email-send')
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    })
    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}
