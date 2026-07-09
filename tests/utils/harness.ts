import { setup, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The single shared server is built + started once by tests/global-setup.ts.
// It publishes its URL via env (inherited by worker forks) and a file fallback.
export function sharedHost(): string {
  if (process.env.NUXT_TEST_SHARED_HOST) return process.env.NUXT_TEST_SHARED_HOST
  const root = fileURLToPath(new URL('../..', import.meta.url))
  return readFileSync(resolve(root, '.data/test-host.txt'), 'utf8').trim()
}

// Every e2e test file calls this instead of @nuxt/test-utils `setup()` directly.
// Passing `host` makes @nuxt/test-utils connect to the already-running shared
// server rather than building + booting its own (issue #45), while keeping
// `$fetch`/`fetch`/`url` from '@nuxt/test-utils/e2e' pointed at that host.
export async function bootShared() {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    host: sharedHost(),
  })
}

// Query-count seam (issue #45). Issues a request with the count opt-in header
// and returns how many Prisma queries the handler ran (post-auth) alongside the
// parsed JSON body, so tests can pin N+1 / unbounded-query regressions.
//
// IMPORTANT: the counter is a module-level global on the server, so the caller
// must AWAIT this (one measured request in flight at a time) — do not fire
// concurrent counted requests, or the counts will interleave.
export async function fetchWithQueryCount<T = unknown>(
  path: string,
  opts: { headers?: Record<string, string>; method?: string; body?: unknown } = {},
): Promise<{ status: number; queryCount: number; body: T }> {
  const res = await appFetch(path, {
    method: opts.method ?? 'GET',
    headers: { ...opts.headers, 'x-test-count-queries': '1' },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })
  const header = res.headers.get('x-query-count')
  const body = (await res.json().catch(() => null)) as T
  return {
    status: res.status,
    queryCount: header === null ? NaN : Number(header),
    body,
  }
}
