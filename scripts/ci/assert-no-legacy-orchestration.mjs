#!/usr/bin/env node
/**
 * BLOCKING GATE — there is ONE production orchestration architecture.
 *
 * Asserts that a production bundle cannot execute, ship, or silently fall back
 * to the superseded V4 orchestration path. Exits NON-ZERO on violation. This is
 * deliberately NOT the estate's flag-drift checker, which is "REPORTING, NOT
 * BLOCKING — exit 0 even when divergences are found" and is precisely why the
 * deployed bundle carried a V4 client for a 404-ing route without anyone noticing.
 *
 * ── WHY A BUNDLE ASSERTION AND NOT A SOURCE GREP ─────────────────────────────
 * Source can be dead and still ship; source can look clean while Vite inlines an
 * env var into a legacy literal. The bundle is what a user executes, so the
 * bundle is what gets asserted.
 *
 * ── HOW THIS AVOIDS BEING GUARANTEE THEATRE ──────────────────────────────────
 * A scanner that reads nothing and a clean bundle are byte-identical. Four
 * independent self-checks run BEFORE the verdict, and any of them failing is a
 * hard error rather than a pass:
 *
 *   C1 FILE FLOOR    — at least MIN_CHUNKS .js files were found and read.
 *   C2 BYTE FLOOR    — the total bytes read exceed MIN_BYTES.
 *   C3 MATCHER BITES — every banned pattern is run against a synthetic sample
 *                      that MUST match. A regex that has stopped discriminating
 *                      (a rename, a bad escape) fails here instead of passing
 *                      silently. This is the control that a "0 occurrences"
 *                      result cannot supply for itself.
 *   C4 POSITIVE CTRL — strings known to be in every real build MUST be found in
 *                      the scanned bytes. Proves the reader read THIS bundle,
 *                      not an empty set. ⚠ Each control is load-bearing app
 *                      surface, never "whatever happened to be there" — a
 *                      control pinned to something incidental decays into a
 *                      tautology the first time that thing moves.
 *
 * ── ENUMERATION: DISK, NOT CRAWL ─────────────────────────────────────────────
 * Chunks are enumerated from the filesystem, which is a strict SUPERSET of any
 * entry-graph crawl. This matters: Vite emits chunk references in THREE forms —
 * absolute `/assets/x.js`, relative `./x.js`, and bare `assets/x.js` inside a
 * `__vite__mapDeps([...])` array — and a crawler that follows only the first
 * finds one chunk and reports a false clean. Walking the directory cannot miss a
 * chunk because it never has to parse a reference at all. C1/C2 then guard the
 * one failure mode disk-walking still has: pointing at the wrong (or an empty)
 * directory.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const DIST = process.argv[2] ?? 'dist'
const MIN_CHUNKS = 10
const MIN_BYTES = 500_000

/**
 * The retired family. `/orchestrate/v1/*` was the V4 turn transport; it is closed
 * at the Netlify edge (`orchestrator-proxy.ts`: ALLOWED_TARGETS = []) and CEE has
 * deleted the server routes, so anything reaching it can only fail.
 *
 * `sample` is the C3 control: a string this pattern MUST match.
 */
const BANNED = [
  {
    name: 'V4 orchestrator turn endpoint',
    re: /\/orchestrate\/v1\/turn/,
    sample: '/bff/orchestrate/v1/turn',
  },
  {
    name: 'V4 orchestrator turn endpoint (proxy-prefixed literal)',
    re: /\/bff\/orchestrate\/v1\//,
    sample: 'const U="/bff/orchestrate/v1/turn/stream"',
  },
]

/**
 * C4 controls. Both are live product surface, not incidental strings:
 *  - `/bff/cee/` is the edge prefix every CEE call uses (e.g. graph-readiness,
 *    probed live and reaching CEE).
 *  - `orchestrate/v2` survives ONLY inside the diagnostic trace-matching
 *    regexes, which is itself worth pinning: if it ever disappears, the thing
 *    that classifies CEE traffic has changed and this gate should be re-derived.
 */
const POSITIVE_CONTROLS = ['/bff/cee/', 'orchestrate/v2']

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (entry.endsWith('.js')) out.push(p)
  }
  return out
}

function fail(msg) {
  console.error(`::error::${msg}`)
  process.exitCode = 1
}

// ── C3 first: prove the matcher discriminates before trusting any absence ─────
let matcherOk = true
for (const b of BANNED) {
  if (!b.re.test(b.sample)) {
    fail(`SELF-TEST FAILED (C3): pattern "${b.name}" did not match its own sample ` +
         `${JSON.stringify(b.sample)}. The gate is blind; a clean result would be meaningless.`)
    matcherOk = false
  }
}
if (!matcherOk) {
  console.error('Refusing to report a verdict with a non-discriminating matcher.')
  process.exit(1)
}

if (!existsSync(DIST)) {
  fail(`No build directory at "${DIST}". This gate must run AFTER the production build.`)
  process.exit(1)
}

const files = walk(DIST)
let bytes = 0
const hits = []
const controlsSeen = new Set()

for (const f of files) {
  const text = readFileSync(f, 'latin1') // byte-faithful; never NUL-blind
  bytes += text.length
  for (const b of BANNED) {
    if (b.re.test(text)) hits.push({ file: relative(DIST, f), name: b.name })
  }
  for (const c of POSITIVE_CONTROLS) {
    if (text.includes(c)) controlsSeen.add(c)
  }
}

console.log(`scanned ${files.length} .js chunk(s), ${bytes.toLocaleString()} bytes under ${DIST}/`)

// ── C1 / C2 ──────────────────────────────────────────────────────────────────
if (files.length < MIN_CHUNKS) {
  fail(`FILE FLOOR (C1): found ${files.length} chunk(s), expected >= ${MIN_CHUNKS}. ` +
       `A near-empty scan reports "clean" for the wrong reason.`)
}
if (bytes < MIN_BYTES) {
  fail(`BYTE FLOOR (C2): read ${bytes} bytes, expected >= ${MIN_BYTES}.`)
}

// ── C4 ───────────────────────────────────────────────────────────────────────
for (const c of POSITIVE_CONTROLS) {
  if (!controlsSeen.has(c)) {
    fail(`POSITIVE CONTROL (C4) MISSING: ${JSON.stringify(c)} was not found in the bundle. ` +
         `Either the scanner is not reading real output, or product surface moved and this ` +
         `control must be re-derived. Absence of the banned string is NOT trustworthy here.`)
  } else {
    console.log(`  positive control OK: ${c}`)
  }
}

// ── The actual assertion ─────────────────────────────────────────────────────
if (hits.length > 0) {
  fail('LEGACY ORCHESTRATION PATH FOUND IN THE PRODUCTION BUNDLE.')
  for (const h of hits) console.error(`  ${h.file}: ${h.name}`)
  console.error(
    '\nThe V4 orchestration path was deleted on 2026-08-29 because it CANNOT FUNCTION:\n' +
    '  - /bff/orchestrate/* is closed at the Netlify edge (ALLOWED_TARGETS = []),\n' +
    '  - and CEE has deleted the server-side routes.\n' +
    'Anything that reaches it is reachable only to fail. Do not re-add a fallback;\n' +
    'configure VITE_V5_ENDPOINT instead (src/v5/v5Adapter.ts fails closed without it).',
  )
}

if (process.exitCode === 1) {
  console.error('::error::assert-no-legacy-orchestration: FAILED')
  process.exit(1)
}
console.log('assert-no-legacy-orchestration: PASS (one orchestration architecture)')
