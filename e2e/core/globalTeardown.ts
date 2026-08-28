// e2e/core/globalTeardown.ts
// The completeness guard lives in globalTeardown, not in a spec, ON PURPOSE: a
// guard implemented as a test can be excluded by `--grep`, reordered or skipped.
// This one cannot, and its failure fails the run.

import { deployedBuild } from './lib/harness'
import {
  assertRunCompleteness,
  buildAtStart,
  EXPECTED_CORE_SPECS,
  readManifest,
} from './lib/manifest'

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

  // The completeness arithmetic itself lives in `assertRunCompleteness` so it can be
  // executed by a FAST spec in the required suite. The CALL SITE stays here, in
  // teardown, for the original reason: a guard implemented as a test can be excluded
  // by `--grep`, reordered or skipped. This one still cannot.
  assertRunCompleteness(
    [...EXPECTED_CORE_SPECS],
    readManifest(),
    process.env.CORE_PARTIAL === '1',
  )
}
