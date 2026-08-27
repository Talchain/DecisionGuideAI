// e2e/core/globalTeardown.ts
// The completeness guard lives in globalTeardown, not in a spec, ON PURPOSE: a
// guard implemented as a test can be excluded by `--grep`, reordered or skipped.
// This one cannot, and its failure fails the run.

import { deployedBuild } from './lib/harness'
import { buildAtStart, EXPECTED_CORE_SPECS, readManifest } from './lib/manifest'

export default async function globalTeardown(): Promise<void> {
  // ── BUILD-DRIFT GUARD ────────────────────────────────────────────────────
  // The default target is a MUTABLE ALIAS. If it moved mid-run, the specs did not
  // all measure the same product and the verdict is unattributable. Measured on
  // 2026-08-27: a CEE deploy landed inside a 21-minute measurement window and split
  // it into two populations, which is how a rate gets reported that describes no
  // single build. This makes that loud instead of silent.
  const started = buildAtStart()
  const ended = await deployedBuild()
  if (started !== 'unknown' && ended !== 'unreachable' && started !== ended) {
    throw new Error(
      `[core] BUILD DRIFTED MID-RUN: started on ${started}, ended on ${ended}.\n` +
        `  The specs in this run did not all measure the same build, so the result is\n` +
        `  unattributable and must not be reported as a verdict about either one.\n` +
        `  Point CORE_UI_URL at an immutable SHA-pinned deploy URL and re-run.`,
    )
  }

  const expected: string[] = [...EXPECTED_CORE_SPECS]
  const actual = readManifest()

  if (process.env.CORE_PARTIAL === '1') {
    // eslint-disable-next-line no-console
    console.log(
      `[core] CORE_PARTIAL=1 — completeness guard SKIPPED. Ran ${actual.length} of ` +
      `${expected.length}: ${actual.join(', ') || '(none)'}`,
    )
    return
  }

  if (actual.length === 0) {
    throw new Error(
      `[core] COMPLETENESS GUARD FAILED: ZERO Core specs executed.\n` +
      `  Expected ${expected.length}, BY NAME: ${expected.join(', ')}\n` +
      `  This run measured nothing and MUST NOT be reported as a pass. Playwright exits 0 on\n` +
      `  "no test files found", which is indistinguishable from success at the exit code alone.\n` +
      `  Likely causes: a testMatch that matches nothing, a bad --grep, or every spec skipping.`,
    )
  }

  const missing = expected.filter((n) => !actual.includes(n))
  const unexpected = actual.filter((n) => !expected.includes(n))
  const duplicates = actual.filter((n, i) => actual.indexOf(n) !== i)

  if (missing.length || unexpected.length || duplicates.length) {
    throw new Error(
      `[core] COMPLETENESS GUARD FAILED.\n` +
      (missing.length ? `  DID NOT RUN (expected, absent): ${missing.join(', ')}\n` : '') +
      (unexpected.length ? `  RAN BUT NOT EXPECTED: ${unexpected.join(', ')} — a spec was added and\n` +
        `    EXPECTED_CORE_SPECS was not updated; the list has drifted from the suite.\n` : '') +
      (duplicates.length ? `  DUPLICATE REGISTRATION: ${duplicates.join(', ')}\n` : '') +
      `  Expected set: ${expected.join(', ')}\n  Actually ran: ${actual.join(', ') || '(none)'}`,
    )
  }
}
