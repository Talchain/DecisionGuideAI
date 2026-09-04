/**
 * COMPLETENESS GUARD — the canvas gate may not report success having run nothing.
 *
 * "A check in this repo reported SUCCESS having run nothing for 204 days." This
 * is the mechanism that stops this one doing the same, and it is a direct
 * sibling of `e2e/visual/globalTeardown.ts` — read that file's header too.
 *
 * A green exit code, a zero-failure line and a healthy-looking total are ALL
 * fully consistent with zero gated assertions executing. If the app fails to
 * boot every test errors and the run is red; but if a rename, a `--grep`, a
 * `test.skip`, a moved file or a silently-emptied test list removes the work,
 * NOTHING IS RED AND NOTHING WAS MEASURED. Playwright's own zero-test error
 * covers only the totally-empty case, and says nothing about a run that
 * collected two of three.
 *
 * So the run is asserted against `GATED_TESTS`, BY NAME, in BOTH directions:
 *   - expected but absent      -> the assertion did not run
 *   - ran but not expected     -> the tag was added and the registry was not
 *                                 updated, i.e. the set has started to grow
 *                                 silently, which is the other half of the brief
 *
 * ⭐ WHY A TEARDOWN AND NOT A SPEC. `--grep` can exclude a spec — and `--grep`
 * is exactly one of the ways the gated set goes quietly empty, so a guard that
 * the same flag can remove is a guard that disappears in the case it exists
 * for. `globalTeardown` cannot be filtered out. Verified at the bytes rather
 * than assumed (`playwright/lib/runner/taskRunner.js`): the teardown task is
 * registered BEFORE its task's setup runs, so it executes even when
 * `globalSetup` failed, and `run()` returns
 * `status === "passed" ? teardownStatus : status`, so a throw here fails the
 * run.
 *
 * `CANVAS_GATE_PARTIAL=1` is the documented escape hatch for a targeted LOCAL
 * run. It prints what it skipped, and it is REFUSED outright when `CI` is set —
 * an off-switch for the check that proves the run measured anything must not be
 * reachable on the merge path. "It is never set in CI" was the first version of
 * this sentence; a convention is not a guard.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'

import { GATE_MANIFEST_PATH, GEOMETRY_DIR, MEASURE_SUFFIX } from './canvasGatePaths'
import {
  DELIBERATE_EXCLUSIONS,
  GATE_TAG,
  coverageFailureMessage,
  expectedGatedKeys,
  registryCoverage,
} from './canvasGateSet'

interface Recorded {
  readonly key: string
  readonly ran: boolean
  readonly status: string
}

function readManifest(): { begun: boolean; records: Recorded[] } {
  if (!existsSync(GATE_MANIFEST_PATH)) return { begun: false, records: [] }
  const lines = readFileSync(GATE_MANIFEST_PATH, 'utf8').split('\n').filter(Boolean)
  const begun = lines.includes('__begin__')
  const records = lines
    .filter((l) => l.includes('\t'))
    .map((l) => {
      const [ran, key, status] = l.split('\t')
      return { key, ran: ran === 'ran', status }
    })
  return { begun, records }
}

export default function canvasGateTeardown(): void {
  const expected = expectedGatedKeys()
  const { begun, records } = readManifest()
  const ranKeys = records.filter((r) => r.ran).map((r) => r.key)
  const notRun = records.filter((r) => !r.ran)

  /*
   * ⭐⭐ THE OFF-SWITCH IS REFUSED UNDER CI, AND THE REFUSAL IS THE POINT.
   *
   * An env var that disables the check proving the run measured anything is
   * EXACTLY the shape of "a check reported SUCCESS having run nothing for 204
   * days". A local escape hatch for a deliberately filtered run is genuinely
   * useful; the same hatch reachable in CI is a way for this gate to go quietly
   * vacuous — and nobody would see it, because the run would be GREEN.
   *
   * ⚠ ENFORCED HERE RATHER THAN AS A WORKFLOW STEP, deliberately. A CI-side
   * check lives in the file whose author would be the one setting the variable,
   * so it can be removed in the same edit that sets it. This cannot: disabling
   * the guard in CI now requires editing the guard itself, which is a reviewable
   * change to a file whose whole subject is not being bypassable.
   *
   * Note the direction of the failure — it REDs on the ATTEMPT rather than
   * ignoring the variable and continuing. Silently overriding an operator would
   * leave them believing they had filtered a run when they had not.
   */
  if (process.env.CANVAS_GATE_PARTIAL === '1') {
    if (process.env.CI) {
      throw new Error(
        `[canvas-gate] CANVAS_GATE_PARTIAL=1 IS REFUSED IN CI.\n` +
          `  This variable disables the guard that proves the run measured anything, so in CI\n` +
          `  it converts a merge-path check into a green no-op. It is a LOCAL affordance for a\n` +
          `  deliberately filtered run and nothing else.\n` +
          `  Ran ${ranKeys.length} of ${expected.length}: ${ranKeys.join(' | ') || '(none)'}\n` +
          `  If a CI run genuinely needs a subset, change GATED_TESTS — that is a reviewable\n` +
          `  decision with a stated reason, which is what this gate is for.`,
      )
    }
    // eslint-disable-next-line no-console
    console.log(
      `[canvas-gate] CANVAS_GATE_PARTIAL=1 — completeness guard SKIPPED (local only). ` +
        `Ran ${ranKeys.length} of ${expected.length}: ${ranKeys.join(' | ') || '(none)'}`,
    )
    return
  }

  /*
   * The reporter's BEGIN marker is missing. This is a DIFFERENT and worse
   * finding than "the set is incomplete", so it gets its own message: an
   * incomplete set means the run measured the wrong things, whereas a missing
   * marker means the instrument that observes the run was not present at all.
   */
  if (!begun) {
    throw new Error(
      `[canvas-gate] COMPLETENESS GUARD FAILED: NO RUN MANIFEST.\n` +
        `  Looked in: ${GATE_MANIFEST_PATH}\n` +
        `  The reporter's onBegin marker is absent, so this run cannot show that a\n` +
        `  single gated assertion executed. Two causes, in order of likelihood:\n` +
        `    1. The run never reached the test phase — look FURTHER UP this log for an\n` +
        `       earlier hard error, most often globalSetup's identity assertion refusing\n` +
        `       to measure somebody else's checkout.\n` +
        `    2. canvasGateReporter is no longer wired into playwright.canvasgate.config.ts,\n` +
        `       in which case this guard has lost its eyes and must be repaired, not skipped.`,
    )
  }

  const missing = expected.filter((k) => !ranKeys.includes(k))
  const unexpected = ranKeys.filter((k) => !expected.includes(k))
  const duplicates = ranKeys.filter((k, i) => ranKeys.indexOf(k) !== i)

  if (ranKeys.length === 0) {
    throw new Error(
      `[canvas-gate] COMPLETENESS GUARD FAILED: ZERO gated assertions ran.\n` +
        `  Expected ${expected.length}:\n${expected.map((k) => `    - ${k}`).join('\n')}\n` +
        (notRun.length
          ? `  Collected but NOT executed (${notRun.length}): ${notRun.map((r) => `${r.key} [${r.status}]`).join(', ')}\n`
          : `  Nothing was even collected — check that the '${GATE_TAG}' tag still exists on the tests.\n`) +
        `  This run measured nothing and MUST NOT be reported as a pass.`,
    )
  }

  if (missing.length > 0 || unexpected.length > 0 || duplicates.length > 0) {
    throw new Error(
      `[canvas-gate] COMPLETENESS GUARD FAILED.\n` +
        `  ran        ${ranKeys.length}/${expected.length}\n` +
        (missing.length
          ? `  MISSING    (expected, did not run)\n${missing.map((k) => `    - ${k}`).join('\n')}\n` +
            `             Causes: the test was renamed, skipped, filtered out by --grep, or lost its\n` +
            `             '${GATE_TAG}' tag. A gated assertion that stops running is the failure this\n` +
            `             guard exists for — do not "fix" it by deleting the registry entry unless the\n` +
            `             assertion is genuinely being retired, which is a decision, not a tidy-up.\n`
          : '') +
        (unexpected.length
          ? `  UNEXPECTED (ran, not registered)\n${unexpected.map((k) => `    - ${k}`).join('\n')}\n` +
            `             Something carries the '${GATE_TAG}' tag but is not in GATED_TESTS. The gated\n` +
            `             set may not grow silently: add it to e2e/geometry/canvasGateSet.ts WITH the\n` +
            `             shipped defect it would have caught, or remove the tag.\n`
          : '') +
        (duplicates.length ? `  DUPLICATE  ${duplicates.join(', ')}  (a retry slipped in, or two tests share a title)\n` : '') +
        (notRun.length ? `  NOT RUN    ${notRun.map((r) => `${r.key} [${r.status}]`).join(', ')}\n` : '') +
        `  Registry: e2e/geometry/canvasGateSet.ts\n` +
        `  Set CANVAS_GATE_PARTIAL=1 only for a deliberately filtered local run.`,
    )
  }

  // ⭐ THE EXCLUSION LIST IS NOW ASSERTED, NOT JUST PRINTED.
  //
  // Until this block existed, the line below PRINTED `DELIBERATE_EXCLUSIONS`
  // and nothing checked it against reality — so a new `*.measure.ts` was
  // neither gated nor recorded, and no run went red. It had already drifted by
  // four files (see `canvasGateSet.ts`). The same reconciliation runs in
  // `tests/ci-guards/canvas-gate-registry-covers-geometry.spec.ts`, which is
  // where it BLOCKS a merge; this copy makes it loud in the job that owns the
  // gate, and costs one directory read.
  const coverage = registryCoverage(
    readdirSync(GEOMETRY_DIR)
      .filter((f) => f.endsWith(MEASURE_SUFFIX))
      .sort(),
  )
  const coverageFailure = coverageFailureMessage(coverage)
  if (coverageFailure) throw new Error(coverageFailure)

  // eslint-disable-next-line no-console
  console.log(
    `[canvas-gate] completeness guard OK — ${ranKeys.length}/${expected.length} gated assertions ran, by name.\n` +
      `[canvas-gate] registry coverage OK — every *.measure.ts in e2e/geometry is gated or recorded as excluded.\n` +
      DELIBERATE_EXCLUSIONS.map((e) => `[canvas-gate] not gated (by decision): ${e.what}`).join('\n'),
  )
}
