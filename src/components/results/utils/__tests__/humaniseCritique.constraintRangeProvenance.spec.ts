/**
 * The constraint-range critique copy must be grounded in the PRODUCER, and the
 * two constraint rows a bare factor emits must not read as the same finding.
 *
 * ── WHAT THE LEDGER SAID, AND WHY IT WAS WRONG (N-21, item 4) ───────────────
 * N-21 recorded "two producer codes collapsing to one sentence". Derived at the
 * producer's bytes (PLoT `staging` @ fb63b03d, ISL @ 28fe0c9, schemas @ 8149308,
 * with contrast controls — `CONSTRAINT_MISSING_RANGE` 13 hits,
 * `CONSTRAINT_TARGET_NO_OBSERVED_VALUE` 16, `MISSING_OBSERVED_STATE` 8, while
 * `CONSTRAINT_NO_DERIVABLE_RANGE` reads 0/0/0), that framing is REFUTED twice:
 *
 *  1. `CONSTRAINT_NO_DERIVABLE_RANGE` IS NOT A PRODUCER CODE. No emitter in any
 *     of the three repos produces it. It is a UI-local invention whose template
 *     duplicated `CONSTRAINT_TARGET_NO_OBSERVED_VALUE`'s title verbatim
 *     ("{label} has no estimate set" / "Set estimate"). The duplicate sentence
 *     was ours, not the producer's.
 *  2. The genuine pair a user sees on one factor is
 *     `CONSTRAINT_TARGET_NO_OBSERVED_VALUE` (severity `warning`) AND
 *     `CONSTRAINT_MISSING_RANGE` (severity `info`) — PLoT's
 *     `preflight-v2.ts:619` has no `continue` after the first push, so a bare
 *     factor with neither `observed_state.value` nor `state_space.range` trips
 *     both in one pass. They are TWO REAL FINDINGS and must be NAMED APART, not
 *     deduplicated. (L-37's lesson: a ledger row is a symptom, not a fix spec.)
 *
 * ── THE FABRICATION THAT SHIPPED ────────────────────────────────────────────
 * PLoT declares the range case "informational only (no downstream impact since
 * constraint values pass through raw to ISL)" (`preflight-v2.ts:670-671`) and
 * humanises it as "The constraint on {label} cannot be range-checked. The
 * constraint value will be used as-is." The UI's invented template asserted the
 * OPPOSITE — "Constraint results may be less precise. Set a value to sharpen
 * the analysis." — a consequence the producer explicitly says does not exist,
 * and the sibling `CONSTRAINT_MISSING_RANGE` template asserted "A range is
 * needed to assess whether this target can be met", when the producer says the
 * target IS still assessed and only the sanity-check is skipped. P7: the
 * producer declares the meaning; where the UI disagreed, the UI was wrong.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { humaniseCritique } from '../humaniseCritique'
import type { UncertaintyItem } from '../../types'

const SRC = join(__dirname, '..', 'humaniseCritique.ts')

const item = (over: Partial<UncertaintyItem>): UncertaintyItem => ({
  code: 'GENERAL',
  message: 'msg',
  ...over,
})

const LABELS = new Map([['fac_churn', 'Customer churn']])

describe('constraint-range critique copy is grounded in the producer', () => {
  // ── CONTROL, per trap 13: the instrument must be able to SEE a template at
  // all before any of the assertions below mean anything. Bound by identity to
  // a code whose producer emission was counted in the same sweep (16 hits).
  it('CONTROL: the humaniser resolves a real producer code to a labelled title', () => {
    const r = humaniseCritique(
      item({ code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE', affectedNodes: ['fac_churn'] }),
      LABELS,
    )
    expect(r.title).toBe('Customer churn has no estimate set')
    expect(r.suggestion).toBe('Set estimate')
  })

  it('the two REAL producer codes a bare factor emits are named apart', () => {
    const noValue = humaniseCritique(
      item({ code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE', affectedNodes: ['fac_churn'] }),
      LABELS,
    )
    const noRange = humaniseCritique(
      item({ code: 'CONSTRAINT_MISSING_RANGE', affectedNodes: ['fac_churn'] }),
      LABELS,
    )
    // Both are real findings and both keep rendering — this is NOT a dedup.
    expect(noValue.title.length).toBeGreaterThan(0)
    expect(noRange.title.length).toBeGreaterThan(0)
    // …but a user must be able to tell them apart. Titles AND descriptions.
    expect(noRange.title).not.toBe(noValue.title)
    expect(noRange.description).not.toBe(noValue.description)
  })

  it('the range note does not claim a consequence the producer says it has not', () => {
    const r = humaniseCritique(
      item({ code: 'CONSTRAINT_MISSING_RANGE', affectedNodes: ['fac_churn'] }),
      LABELS,
    )
    // PLoT: "no downstream impact since constraint values pass through raw to
    // ISL". Copy asserting reduced precision or an unevaluable target
    // contradicts the emitter.
    expect(r.description).not.toMatch(/less precise|unreliable|can be met|cannot be (met|evaluated)/i)
    // …and it must say the positive thing the producer declares: the value is
    // used as set.
    expect(`${r.title} ${r.description}`).toMatch(/as you set it|used as-is|exactly as/i)
  })

  it('a GENERAL row carrying PLoT\'s range MESSAGE maps to the range finding, not the value one', () => {
    // PLoT's message verbatim (preflight-v2.ts:677).
    const r = humaniseCritique(
      item({
        code: 'GENERAL',
        message:
          'Constraint "constraint_fac_churn_max" target node "fac_churn" has no derivable range. Constraint value will be compared as-is by ISL.',
        affectedNodes: ['fac_churn'],
      }),
      LABELS,
    )
    const range = humaniseCritique(
      item({ code: 'CONSTRAINT_MISSING_RANGE', affectedNodes: ['fac_churn'] }),
      LABELS,
    )
    expect(r.title).toBe(range.title)
    // The defect: it used to resolve to the no-estimate sentence.
    expect(r.title).not.toMatch(/has no estimate set/i)
    // Never echo the producer's internal identifiers.
    expect(r.displayText ?? '').not.toMatch(/constraint_|ISL|derivable/i)
  })

  it('the invented CONSTRAINT_NO_DERIVABLE_RANGE code has no template of its own', () => {
    // ⚠ BOUND TO BEHAVIOUR, NOT TO A SOURCE GREP. The first version of this
    // assertion was `expect(src).not.toContain('CONSTRAINT_NO_DERIVABLE_RANGE')`
    // and it went RED against the fixed tree — because the deletion COMMENT
    // names the key it deleted. A source-text absence check cannot tell a live
    // map entry from prose about a dead one, so it was the wrong instrument for
    // the claim. An unmapped code falls through to the generic fallback, and
    // THAT is observable.
    const r = humaniseCritique(
      item({ code: 'CONSTRAINT_NO_DERIVABLE_RANGE', message: 'msg', affectedNodes: ['fac_churn'] }),
      LABELS,
    )
    expect(r.title).toBe('Part of this analysis was limited')
    expect(r.displayText).toBeNull()
    // …and specifically NOT the sentence it used to fabricate.
    expect(r.title).not.toMatch(/has no estimate set/i)
  })

  it('the contamination detector keeps the phrase it needs (structural backstop)', () => {
    // `INTERNAL_TOKEN_REGEX` also matches "no derivable range", for a DIFFERENT
    // job: never render a raw producer message as a title. Deleting the
    // template must not collaterally strip that. Source-read is the right
    // instrument here because the claim IS about the source.
    const src = readFileSync(SRC, 'utf8')
    expect(src).toContain('no derivable range')
    // CONTRAST CONTROL (trap 13e): the same read sees the codes that must
    // remain, so a pass cannot come from an empty or failed read.
    expect(src).toContain('CONSTRAINT_MISSING_RANGE')
    expect(src).toContain('CONSTRAINT_TARGET_NO_OBSERVED_VALUE')
  })
})
