/**
 * ⭐⭐ "RANKED BY LARGEST VALUE" IS A SENTENCE THE PRODUCT MUST SAY OUT LOUD.
 *
 * ## The defect, measured on two real founder sessions (2026-09-19)
 *
 * Both sessions carried `GOAL_DIRECTION_UNATTESTED` on
 * `inference_warnings`. Its producer text is explicit and honest:
 *
 *   "No objective sense was stated for the goal node, so options were ranked
 *    by largest goal value. That is an assumption, not the team's stated aim:
 *    if the goal is a quantity to reduce, or the aim is to land near a target
 *    rather than as high as possible, this ranking answers a different
 *    question."
 *
 * ⛔ Both of that founder's goals were TARGETS TO REACH — "reach 200
 * mid-market customers with NRR above 110%", and a hiring decision — so the
 * sentence was true of his runs and material to how he should read them.
 *
 * **He could not have read it.** `humaniseCritique` holds no template for this
 * code, so every surface that renders it — the Model card's audit trail
 * included — resolved it through the GENERIC FALLBACK: *"Part of this analysis
 * was limited. Olumi's engine reported a condition this version has no wording
 * for yet."* The fallback is honest and it is the right protection for a code
 * this build has never seen. It is the wrong answer for a code ISL has been
 * emitting, with ratified copy of its own, since before this tip.
 *
 * ## Why the classification map missed it, and it said so in advance
 *
 * `ISL_INFERENCE_WARNING_KINDS` carries its own warning: *"THIS IS A
 * CROSS-REPO, CROSS-LANGUAGE MIRROR AND IT WILL DRIFT."* It was enumerated by
 * an AST walk at ISL `staging` 28fe0c95. `GOAL_DIRECTION_UNATTESTED` was added
 * to ISL after that walk (`services/robustness_analyzer_v2.py:4205` at ISL
 * `staging` c9ab543d93ef4fa3b760fe192dc36603bb05b41c, re-derived by the same
 * method on 2026-09-19). The mirror drifted exactly where its author predicted.
 *
 * ## ⛔ WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not tell the reader to state their aim. **There is nowhere to state
 * it.** Measured 2026-09-19 with contrast controls in the same sweep:
 * `goal_direction` reads ZERO in this repo, ZERO in `olumi-assistants-service`
 * `staging` 84abbb92 and ZERO in `plot-lite-service` `staging` 350b0fb6, while
 * `goal_threshold` reads 177 here and 76 in PLoT. The contract for the field is
 * `olumi-schemas` PR #48 (open, CONFLICTING) and its transport is PLoT PR #352
 * (open); neither has landed. An instruction the product gives no way to follow
 * is the exact defect removed from `GOAL_THRESHOLD_NOT_CONVERTIBLE`, and
 * reinstating it one code over would move the lie rather than fix it.
 *
 * It also does not invent the aim. The warning is the honest state; a guessed
 * direction would be worse than the disclosure it replaced.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelHealthSection } from '../ModelHealthSection'
import type { AuditTrailData } from '../ModelHealthSection'
import { DetailToggleContext } from '../DetailToggleContext'
import { describeAuditInferenceWarningCode } from '../auditInferenceWarnings'
import { humaniseCritique } from '../../../../components/results/utils/humaniseCritique'

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../../components/results/Accordion', () => ({
  Accordion: ({ children, testId }: { children: React.ReactNode; testId?: string }) => (
    <div data-testid={testId}>{children}</div>
  ),
}))

/**
 * Resolved at runtime against a code that can never be mapped, so this file
 * owns no copy of the fallback and cannot drift from it.
 */
const GENERIC_FALLBACK = humaniseCritique({
  code: '__NOT_A_CODE_THIS_FILE_OWNS_NO_COPY__',
  message: '',
} as never).title

/**
 * ⚠ VERBATIM FROM THE PRODUCER'S BYTES, not from the founder's export summary.
 * ISL `services/robustness_analyzer_v2.py:4213-4220` at `staging` c9ab543d.
 * Kept whole because the no-raw-message assertion below is only meaningful
 * against the real string — and because it carries `goal_direction`, the token
 * `INTERNAL_TOKEN_REGEX` exists to keep off the surface.
 */
const PRODUCER_MESSAGE =
  'No objective sense was stated for the goal node, so options were ranked by ' +
  'largest goal value. That is an assumption, not the team\'s stated aim: if ' +
  'the goal is a quantity to reduce, or the aim is to land near a target ' +
  'rather than as high as possible, this ranking answers a different question. ' +
  'Send goal_direction to rank against the stated objective.'

function auditWith(
  inferenceWarnings: AuditTrailData['inferenceWarnings'],
): AuditTrailData {
  return {
    seedUsed: '325022',
    responseHash: '4d11687e9836abcdef',
    nSamples: 1000,
    repairsApplied: null,
    inferenceWarnings,
    autoNoiseApplied: null,
    autoNoiseProvenance: null,
    stabilityPenaltyFactor: null,
  }
}

function renderAudit(inferenceWarnings: AuditTrailData['inferenceWarnings']) {
  return render(
    <DetailToggleContext.Provider value={{ showDetail: true }}>
      <ModelHealthSection auditTrail={auditWith(inferenceWarnings)} />
    </DetailToggleContext.Provider>,
  )
}

/** The founder's warning, in the shape PLoT forwards it (`run.ts:3967-4013`:
 *  code + derived message + severity mapped through + `field` preserved). */
const FOUNDER_WARNING = {
  code: 'GOAL_DIRECTION_UNATTESTED',
  severity: 'warning',
  message: PRODUCER_MESSAGE,
  field: 'goal_direction',
} as const

describe('Model card audit trail — the ranking says what it ranked by', () => {
  it('renders the objective-sense disclosure, not the "no wording for yet" fallback', () => {
    renderAudit([{ ...FOUNDER_WARNING }])

    const rows = screen.getAllByTestId('audit-inference-warning-row')
    expect(rows).toHaveLength(1)

    // Bound by IDENTITY — this code, resolved through the copy's owner.
    const expected = describeAuditInferenceWarningCode('GOAL_DIRECTION_UNATTESTED')

    // ⭐ THE LOAD-BEARING ASSERTION. A row that renders SOME text passes a bare
    // `toContain` against the fallback too. This is the one that reds at
    // pristine and reds again if the template is deleted.
    expect(expected).not.toBe(GENERIC_FALLBACK)
    expect(rows[0].textContent).toContain(expected)
    expect(rows[0].textContent).not.toContain(GENERIC_FALLBACK)

    // The code stays — the audit trail is where humaniseCritique's fallback
    // promises a reader can find it.
    expect(rows[0].textContent).toContain('GOAL_DIRECTION_UNATTESTED')
  })

  it('states WHAT the ranking used, so the reader can judge whether it is their question', () => {
    renderAudit([{ ...FOUNDER_WARNING }])
    const card = screen.getByTestId('model-health-section').textContent ?? ''
    // The two facts the producer states, bound as substance rather than as a
    // whole sentence another template could not supply.
    expect(card).toMatch(/largest value/i)
    expect(card).toMatch(/different question/i)
  })

  it('⛔ prescribes NO action, because the product offers no way to state an aim', () => {
    // The complement of the assertion above, and the reason this code is in
    // `NO_ROUTE_EXISTS` rather than carrying a route like its model_shape
    // siblings. Asserted rather than left to the reviewer's eye: the verb set
    // is the one `humaniseCritique.inferenceWarningVocabulary.spec.ts` uses to
    // require a route of every OTHER model_shape code.
    const sentence = describeAuditInferenceWarningCode('GOAL_DIRECTION_UNATTESTED')
    expect(sentence).not.toMatch(/\b(state|restate|add|connect|give|record|move|try)\b/i)
  })

  it('⛔ NEVER ECHOES THE PRODUCER MESSAGE — the V14.3 no-raw-message rule', () => {
    renderAudit([{ ...FOUNDER_WARNING }])
    const list = screen.getByTestId('audit-inference-warnings').textContent ?? ''
    // The wire token the internal-token guard exists for.
    expect(list).not.toContain('goal_direction')
    // ...and the producer's own distinctive phrasing.
    expect(list).not.toContain('No objective sense was stated')
    expect(list).not.toContain('Send goal_direction')
  })

  /**
   * ⭐ THE CONTRAST CONTROL. Without it, a change that made EVERY row render
   * specific copy — or that broke the fallback — would pass every assertion
   * above. A code ISL has not written must still land on the generic sentence.
   */
  it('a code this build has never seen still lands on the generic fallback', () => {
    renderAudit([{ code: 'A_CODE_ISL_HAS_NOT_WRITTEN_YET', severity: 'warning', message: 'x' }])
    const rows = screen.getAllByTestId('audit-inference-warning-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain(GENERIC_FALLBACK)
  })
})
