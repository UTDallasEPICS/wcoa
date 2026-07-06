import { describe, expect, it } from 'vitest'
import { resolveTrustedOrigins } from '../../server/utils/auth'

// Pure-function unit test for the trusted-origins resolver (issue #21).
// Intentionally does NOT call setup() — it exercises a pure helper and must
// not boot the Nuxt app, so it stays fast.
describe('resolveTrustedOrigins', () => {
  it('falls back to the localhost dev default when no relevant env is set', () => {
    const origins = resolveTrustedOrigins({})
    expect(origins).toContain('http://localhost:3000')
  })

  it('never includes the old hardcoded LAN IP by default', () => {
    const origins = resolveTrustedOrigins({})
    expect(origins).not.toContain('http://192.168.4.240:3000')
  })

  it('includes BETTER_AUTH_URL when set', () => {
    const origins = resolveTrustedOrigins({
      BETTER_AUTH_URL: 'https://rides.example.org',
    })
    expect(origins).toContain('https://rides.example.org')
  })

  it('includes APP_URL when set', () => {
    const origins = resolveTrustedOrigins({
      APP_URL: 'https://app.example.org',
    })
    expect(origins).toContain('https://app.example.org')
  })

  it('includes both BETTER_AUTH_URL and APP_URL when both are set', () => {
    const origins = resolveTrustedOrigins({
      BETTER_AUTH_URL: 'https://auth.example.org',
      APP_URL: 'https://app.example.org',
    })
    expect(origins).toContain('https://auth.example.org')
    expect(origins).toContain('https://app.example.org')
  })

  it('includes every origin from a comma-separated TRUSTED_ORIGINS', () => {
    const origins = resolveTrustedOrigins({
      TRUSTED_ORIGINS: 'https://a.com,https://b.com',
    })
    expect(origins).toContain('https://a.com')
    expect(origins).toContain('https://b.com')
  })

  it('trims whitespace and ignores blank entries in TRUSTED_ORIGINS', () => {
    const origins = resolveTrustedOrigins({
      TRUSTED_ORIGINS: ' https://a.com ,  , https://b.com , ',
    })
    expect(origins).toContain('https://a.com')
    expect(origins).toContain('https://b.com')
    expect(origins).not.toContain('')
    expect(origins).not.toContain(' ')
  })

  it('does not produce duplicate origins', () => {
    const origins = resolveTrustedOrigins({
      BETTER_AUTH_URL: 'http://localhost:3000',
      APP_URL: 'http://localhost:3000',
    })
    const unique = new Set(origins)
    expect(unique.size).toBe(origins.length)
  })
})
