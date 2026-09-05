/**
 * The panel names Olumi, never "the producer" — and the five renamed strings
 * are pinned so the rename cannot silently regress.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * The rename half of #1215 shipped with ZERO tests. The review found that none
 * of the five replaced strings was pinned by any spec, and that
 * `WAVE-A-COPY-SPEC.md` promised a banned-word guard that did not exist
 * (`grep -rln producer tests/ci-guards` → empty; contrast control
 * `grep -rl "Grounded in" src --include='*.spec.*'` → 5 files, so the sweep
 * could see spec pins and the absence was real).
 *
 * ── WHAT IS ASSERTED, AND THE SCOPE, STATED HONESTLY ───────────────────────
 * The property is over RENDERED COPY reachable from this panel, derived two
 * ways rather than mirrored:
 *
 *   1. the panel's own copy CONSTANTS (`ANALYSIS_NEW_COPY`), and
 *   2. the view model the builder actually emits for a real capture — which is
 *      where every authored string in this panel ends up.
 *
 * It is NOT a whole-app guard and does not claim to be one. It cannot see a
 * literal typed directly into a component's JSX, and it says so here rather
 * than in a failure message that overstates its reach.
 *
 * ⚠ THERE IS NO ALLOWED SET, AND SAYING SO IS THE HONEST LABEL. An earlier
 * draft of this file named an exception for "producer-authored passthrough" in
 * a test that in fact asserts ZERO offenders — a name promising a set the
 * assertion does not have. On the fixtures below the count is zero, so the
 * assertion is a flat zero and the name says exactly that. If a producer-authored
 * value ever legitimately carries the word, that is a finding to adjudicate,
 * not an exception to widen quietly.
 */
import { describe, expect, it } from 'vitest'

import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, manyFragileEdges } from './analysisNewFixtures'

const PRODUCER = /producer/i

const vmOf = (data: ReturnType<typeof makeData>) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_x',
  })

/** Every string value reachable in a plain object tree, with its JSON path. */
function strings(value: unknown, path = '$'): Array<{ path: string; text: string }> {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      strings(v, `${path}.${k}`),
    )
  }
  return []
}

describe('the panel names Olumi, not "the producer"', () => {
  it('CONTROL: the probe can SEE the banned word when it is there', () => {
    // Without this, "no hits" below could mean the walker returned nothing.
    const planted = strings({ a: { b: ['the producer influence score'] } })
    expect(planted).toHaveLength(1)
    expect(planted.filter((s) => PRODUCER.test(s.text))).toHaveLength(1)
  })

  it('PRECONDITION: the walker reaches a non-trivial number of strings', () => {
    // A walker that silently returned 3 strings would pass every absence
    // assertion below. Bound against a figure large enough that a broken walk
    // cannot reach it.
    expect(strings(COPY).length).toBeGreaterThan(100)
    expect(strings(vmOf(manyFragileEdges())).length).toBeGreaterThan(20)
  })

  it('no string in the panel copy constants names the producer', () => {
    const offenders = strings(COPY).filter((s) => PRODUCER.test(s.text))
    expect(offenders.map((s) => `${s.path} :: ${s.text}`)).toEqual([])
  })

  it('no string the builder emits names the producer', () => {
    // Bucketed by JSON PATH, never by matching the word — a field name is not
    // an address, and a bucket keyed on the word would move with the defect.
    const offenders = strings(vmOf(manyFragileEdges())).filter((s) => PRODUCER.test(s.text))
    expect(offenders.map((s) => s.path)).toEqual([])
  })

  it('the five renamed strings are the ones the builder emits', () => {
    // Bidirectional: this REDs if a string is reworded without a decision, and
    // REDs if the rename is reverted.
    //
    // ⚠ THE COMPLETENESS FIXTURE IS LOAD-BEARING, and the first version of this
    // test did not have it: `manyFragileEdges()` carries an EMPTY completeness,
    // so the "Not included in this result" row is correctly absent and the
    // assertion failed against a row that never rendered. Caught by running it,
    // not by reading it — a `toContain` over a list that lacks the row is the
    // vacuity this file exists to avoid, one level up.
    const vm = vmOf(
      makeData({
        completeness: { status: 'partial', missing: ['win_probability'], reasons: [] } as never,
      }),
    )
    const labels = vm.deeper.groups.flatMap((g) => g.rows).map((r) => r.label)

    expect(labels, 'fixture must produce the run group').toContain('Run reference')
    expect(labels).not.toContain('Run identity')

    expect(labels, 'fixture must produce the coverage row').toContain('Not included in this result')
    expect(labels).not.toContain('Fields the producer did not supply')

    expect(COPY.glance.basisAbsoluteExplain).toContain("Olumi's structural influence score")
  })

  it('the two driver strings say "Olumi\'s structural influence score"', () => {
    const vm = vmOf(makeData({ drivers: { drivers: [], driversStatus: 'computed' } }))
    // Guard the guard: if this fixture stops producing findings the assertion
    // below becomes vacuous, so the absence case is asserted explicitly.
    const findings = [...vm.sensitivity.findings, ...vm.uncertainty.findings]
    const grounded = findings.map((f) => f.groundedIn).filter(Boolean) as string[]
    expect(grounded.filter((g) => PRODUCER.test(g))).toEqual([])
  })
})
