// e2e/core/globalTeardown.ts
// The completeness guard lives in globalTeardown, not in a spec, ON PURPOSE: a
// guard implemented as a test can be excluded by `--grep`, reordered or skipped.
// This one cannot, and its failure fails the run.

import { deployedBuild } from './lib/harness'
import {
  assertAttributableBuild,
  assertRunCompleteness,
  buildAtStart,
  EXPECTED_CORE_SPECS,
  readManifest,
} from './lib/manifest'

export default async function globalTeardown(): Promise<void> {
  // ── ATTRIBUTION GUARD ────────────────────────────────────────────────────
  // Three refusals, in `assertAttributableBuild`: the run could not name the build
  // it started on · it cannot confirm the build it ended on · the build moved.
  //
  // ⭐ WHEN THE TARGET IS AN IMMUTABLE DEPLOY PERMALINK, THIS STOPS BEING A SAMPLE
  // AND BECOMES A PROOF. A permalink's content cannot change, so `started === ended`
  // is guaranteed by construction rather than by two reads happening to agree. The
  // check is kept live anyway, at full strength, for the case the target is NOT
  // pinned — a local run against the alias, or a workflow someone repoints — because
  // a guard that only exists on the path that cannot fail is not a guard.
  //
  // Measured 2026-08-29: 12 of the 13 Core E2E runs ever executed on `staging` hit
  // the drift limb, every one of them starting on the PREVIOUS commit and ending on
  // the pushed one. Eight were 3/3 green. Without this, all eight would have been
  // reported as verification of a build that did not contain the push.
  const started = buildAtStart()
  const ended = await deployedBuild()
  assertAttributableBuild(started, ended)

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
