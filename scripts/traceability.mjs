// Traceability gate: REQUIREMENTS.md ⇄ tests.
//
//   pnpm trace          — print the coverage matrix, exit 1 on gaps
//   pnpm trace --quiet  — only print gaps
//
// A requirement row is COVERED when at least one of:
//   1. a test title in tests/**/*.{test,spec}.ts contains its R-ID, or
//   2. every test file named in its Coverage column exists, or
//   3. its Status is `manual` or `decision` (justification lives in the row).
//
// This is what makes REQUIREMENTS.md enforced documentation instead of a wish:
// delete a test file or drop an R-tag and CI goes red.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const quiet = process.argv.includes('--quiet')

// ---- 1. Parse requirement rows out of REQUIREMENTS.md tables
const md = readFileSync(join(root, 'REQUIREMENTS.md'), 'utf8')
const rows = []
for (const line of md.split('\n')) {
  const m = line.match(/^\|\s*(R-\d{3})\s*\|(.+)\|(.+)\|\s*(auto|pin|decision|manual)[^|]*\|(.+)\|\s*$/)
  if (m) {
    rows.push({
      id: m[1],
      requirement: m[2].trim().slice(0, 80),
      status: m[4],
      coverage: m[5].trim(),
    })
  }
}
if (rows.length === 0) {
  console.error('traceability: no requirement rows parsed from REQUIREMENTS.md — table format changed?')
  process.exit(1)
}

// ---- 2. Collect test titles + files
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(test|spec)\.ts$/.test(entry)) out.push(p)
  }
  return out
}
const testFiles = walk(join(root, 'tests'))
const allTestText = testFiles.map((f) => readFileSync(f, 'utf8')).join('\n')
const fileNames = new Set(testFiles.map((f) => f.split('/').pop()))

// ---- 3. Check each requirement
const gaps = []
for (const row of rows) {
  if (row.status === 'manual' || row.status === 'decision') continue

  const taggedInTest = allTestText.includes(row.id)
  // Coverage column: extract file names like `foo.test.ts` / `bar.spec.ts`
  const referenced = [...row.coverage.matchAll(/`?([\w-]+\.(?:test|spec)\.ts)`?/g)].map((m) => m[1])
  const filesExist = referenced.length > 0 && referenced.every((f) => fileNames.has(f))

  if (!taggedInTest && !filesExist) {
    gaps.push(row)
  }
}

// ---- 4. Report
const covered = rows.length - gaps.length
if (!quiet) {
  const byStatus = rows.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {})
  console.log(`traceability: ${rows.length} requirements — ` +
    Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', '))
  console.log(`covered: ${covered}/${rows.length}`)
}
if (gaps.length) {
  console.error('\nUNCOVERED REQUIREMENTS (no R-tag in any test title, coverage files missing):')
  for (const g of gaps) console.error(`  ${g.id}  [${g.status}]  ${g.requirement}`)
  process.exit(1)
}
if (!quiet) console.log('all requirements covered ✔')
