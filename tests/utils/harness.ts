import { setup } from '@nuxt/test-utils/e2e'
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
