/**
 * COMPLETENESS GUARD — the run may not report success having captured nothing.
 *
 * "A check in this repo reported SUCCESS having run nothing for 204 days." A
 * green exit code, a zero-failure line and a healthy-looking total are all
 * fully consistent with zero screenshots being taken: if the app fails to boot,
 * every test errors and the suite is red — but if a filter, a rename, a skipped
 * describe or a silently-emptied test list removes the work, nothing is red and
 * nothing was measured.
 *
 * So the run is asserted against an EXPECTED SET, BY NAME, in BOTH directions:
 *   - anything expected but missing  -> the state did not run
 *   - anything captured but unexpected -> a state was added and the expected
 *     set was not updated, i.e. the list has started to drift from reality
 *
 * This lives in `globalTeardown` rather than in a spec on purpose. A guard
 * implemented as a test can be excluded by `--grep`, reordered, or skipped;
 * this one cannot. It runs after every invocation of this config and its
 * failure fails the run.
 *
 * `VISREG_PARTIAL=1` is the documented escape hatch for a targeted local run
 * (`--grep "Model tab"`). It is never set in CI, and it prints what it skipped.
 */

import { expectedCaptureNames, readManifest } from './harness'

export default function globalTeardown(): void {
  const expected = expectedCaptureNames()
  const actual = readManifest()

  if (process.env.VISREG_PARTIAL === '1') {
    // eslint-disable-next-line no-console
    console.log(
      `[visreg] VISREG_PARTIAL=1 — completeness guard SKIPPED. ` +
        `Captured ${actual.length} of ${expected.length}: ${actual.join(', ') || '(none)'}`,
    )
    return
  }

  // A duplicate is a real signal: the same state captured twice means a retry
  // slipped in, or two tests are writing the same reference name.
  const duplicates = actual.filter((n, i) => actual.indexOf(n) !== i)
  const missing = expected.filter((n) => !actual.includes(n))
  const unexpected = actual.filter((n) => !expected.includes(n))

  if (actual.length === 0) {
    throw new Error(
      `[visreg] COMPLETENESS GUARD FAILED: ZERO screenshots were captured.\n` +
        `  Expected ${expected.length}: ${expected.join(', ')}\n` +
        `  This run measured nothing. It must not be reported as a pass — the most likely\n` +
        `  causes are that the app failed to boot, or that no test matched.\n` +
        `  NOTE: a stale-reference cascade no longer lands here. captureState records\n` +
        `  coverage in a \`finally\`, so a state that ran and FAILED its comparison still\n` +
        `  counts as captured. If you are reading this, the states genuinely did not run.`,
    )
  }

  if (missing.length > 0 || unexpected.length > 0 || duplicates.length > 0) {
    throw new Error(
      `[visreg] COMPLETENESS GUARD FAILED.\n` +
        `  captured   ${actual.length}/${expected.length}\n` +
        (missing.length ? `  MISSING    ${missing.join(', ')}\n` : '') +
        (unexpected.length ? `  UNEXPECTED ${unexpected.join(', ')}  (add it to STATE_NAMES in harness.ts)\n` : '') +
        (duplicates.length ? `  DUPLICATE  ${duplicates.join(', ')}\n` : '') +
        `  Set VISREG_PARTIAL=1 only for a deliberately filtered local run.`,
    )
  }

  // eslint-disable-next-line no-console
  console.log(`[visreg] completeness guard OK — ${actual.length}/${expected.length} states captured by name.`)
}
