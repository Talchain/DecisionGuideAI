/**
 * ⭐⭐ THE DEFECT AT THE LEVEL IT WAS SEEN — two rows, one sentence.
 *
 * `twoCodesTheEngineSendsToday.spec.ts` proves each CODE now resolves to its own
 * copy. That is necessary and it is NOT what Paul saw. He saw the "Model gaps
 * the analysis worked around" GROUP, which is built by
 * `selectHumanisedInferenceWarningsOutsideStrip` from the whole warning list —
 * so this binds to that selector, with his actual payload, and asserts the two
 * ROWS differ.
 *
 * ⚠ WHY A SELECTOR TEST AND NOT A DOM TEST. jsdom cannot prove visibility
 * (CLAUDE.md trap 3), and the group renders one row per returned entry with the
 * title as its text — so the selector's output IS the row set. A render test
 * would add mounting risk and prove nothing more about this defect.
 *
 * ⚠⚠ A SURVIVING MUTANT, DEMONSTRATED RATHER THAN EXPLAINED AWAY. Deleting
 * `FACTOR_EVPPI_NOT_COMPUTED` from `ISL_INFERENCE_WARNING_KINDS` leaves this
 * file GREEN — measured, not assumed. That is correct and not a hole: the kinds
 * map is METADATA (what the vocabulary spec reasons over), while `CODE_TEMPLATES`
 * decides the sentence. Two maps, two questions (CLAUDE.md trap 21), and they
 * are guarded by two different files on purpose. The mutants that DO bite here
 * are the ones that change the copy: removing the template (2 RED) and pointing
 * both codes at one template (1 RED) — the latter reproducing the exact
 * two-identical-rows defect this file is named for.
 *
 * ⭐ AND WHY THE SEVERITY SPLIT IS ASSERTED TOO. Both fixed codes are
 * `severity: 'info'`, so `isStripEntry` keeps them OUT of the amber strip and
 * they reach the reader only through this complement. If that routing ever
 * changed, the fix would still be correct and would stop being visible — which
 * is exactly the "built but unreachable" failure this estate keeps paying for.
 */
import { describe, it, expect } from 'vitest'
import { INFERENCE_WARNINGS_95B92672 } from '../__fixtures__/inferenceWarnings.95b92672'
import {
  selectHumanisedInferenceWarningsOutsideStrip,
  isStripEntry,
} from '../humaniseInferenceWarning'

const FALLBACK_TITLE = 'Part of this analysis was limited'

const warnings = [...INFERENCE_WARNINGS_95B92672] as Array<{
  code: string
  message?: string
  severity?: string
}>

describe('the two rows Paul saw, on the payload he saw them with', () => {
  /**
   * ⛔ PRECONDITION. Every assertion below reads the selector's output. If the
   * record were ever emptied or the selector stopped returning rows, they would
   * all pass vacuously.
   */
  it('PRECONDITION: the record carries the three warnings, with messages', () => {
    expect(warnings).toHaveLength(3)
    for (const w of warnings) {
      expect(typeof w.message === 'string' && w.message.trim().length > 0, w.code).toBe(true)
    }
  })

  it('PRECONDITION: exactly one is strip-severity, so two reach the detail group', () => {
    expect(warnings.filter(isStripEntry).map((w) => w.code)).toEqual(['GOAL_DIRECTION_UNATTESTED'])
  })

  it('the detail group carries the two info-severity codes', () => {
    const rows = selectHumanisedInferenceWarningsOutsideStrip(warnings)
    expect(rows.map((r) => r.code).sort()).toEqual([
      'EDGE_E_VALUE_NON_FINITE_DROPPED',
      'FACTOR_EVPPI_NOT_COMPUTED',
    ])
  })

  /**
   * ⛔⛔ THE DEFECT ITSELF. Before the fix both rows read
   * "Part of this analysis was limited" — same string, twice, on one screen.
   */
  it('the two rows are DIFFERENT sentences', () => {
    const titles = selectHumanisedInferenceWarningsOutsideStrip(warnings).map((r) => r.title)
    expect(titles).toHaveLength(2)
    expect(titles[0]).not.toBe(titles[1])
  })

  it('and neither row is the generic fallback any more', () => {
    for (const r of selectHumanisedInferenceWarningsOutsideStrip(warnings)) {
      expect(r.title, `${r.code} still renders the fallback`).not.toBe(FALLBACK_TITLE)
    }
  })

  /**
   * ⭐ THE ROW THAT ANSWERS THE QUESTION ABOVE IT. `FACTOR_EVPPI_NOT_COMPUTED`
   * is the explanation for the empty value-of-information area on the same
   * screen. Bound by CODE, never by position (trap 19).
   */
  it('the value-of-information row says the step ran and returned nothing', () => {
    const row = selectHumanisedInferenceWarningsOutsideStrip(warnings).find(
      (r) => r.code === 'FACTOR_EVPPI_NOT_COMPUTED',
    )
    expect(row).toBeDefined()
    expect(row!.title).toMatch(/ran|returned/i)
    expect(row!.title).not.toMatch(/re-?run|failed/i)
  })

  /**
   * ⛔ CONTRAST CONTROL. A payload of codes nobody has mapped must still produce
   * the honest fallback — twice, indistinguishably. That is the PRE-FIX state,
   * pinned, so this file proves the difference is the mapping and not something
   * about the selector.
   */
  it('CONTRAST: two unmapped codes still collapse to one sentence, as they should', () => {
    const rows = selectHumanisedInferenceWarningsOutsideStrip([
      { code: 'NOT_A_REAL_CODE_A', message: 'x', severity: 'info' },
      { code: 'NOT_A_REAL_CODE_B', message: 'y', severity: 'info' },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].title).toBe(FALLBACK_TITLE)
    expect(rows[1].title).toBe(FALLBACK_TITLE)
  })
})
