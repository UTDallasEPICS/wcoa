import { beforeAll } from 'vitest'
import { resetDb } from './utils/reset-db'

// Per-file DB reset for order-independence (issue #62).
//
// vitest runs this setup file once inside every test worker, before the test
// module is evaluated. Restoring the seed snapshot here means every
// `tests/e2e/*.test.ts` file starts from an identical, freshly-seeded DB no
// matter what earlier files did to the shared SQLite database — killing the
// order-dependence that made the shared-DB harness flaky.
beforeAll(() => {
  resetDb()
})
