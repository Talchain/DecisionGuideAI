/**
 * The Model card's audit trail never renders a machine code ALONE.
 *
 * ## The defect
 *
 * `ModelHealthSection` rendered its warning row as
 * `inferenceWarnings.map(w => w?.code ?? 'UNKNOWN').join(', ')`, so with the
 * repo's own captured staging payload the Model card's "Show full detail" view
 * showed:
 *
 *     Inference warnings: CONSTRAINT_NODE_DEFAULT_BASE
 *
 * `CONSTRAINT_NODE_DEFAULT_BASE` is the code in
 * `src/test/fixtures/golden-path-staging-2026-04-05.json`
 * (`plot_response.inference_warnings[0]`) — a real run, not a hypothetical.
 *
 * ## What is NOT being changed, and why that matters here
 *
 * The code STAYS on this surface. `components/results/utils/humaniseCritique.ts`
 * routes readers here on purpose — its generic fallback ends *"the raw code is
 * listed in the run's audit details"* and its comment ratifies that *"a machine
 * code is correct content for an audit trail and wrong content for a caveat
 * strip"*. A test that asserted the code's ABSENCE would falsify that promise
 * and break the other surface. The property pinned below is therefore
 * `code + sentence`, never `sentence instead of code`.
 *
 * ## Why the expectations are DERIVED
 *
 * The sentences belong to `humaniseCritique`. Pinning a copied sentence here
 * would hollow out the moment that copy is reworded (the failure mode PLoT #332
 * hit and fixed the same way), so every expectation resolves through that owner
 * at runtime. The load-bearing assertion is the STRONGER one: a mapped code must
 * render copy that is NOT the generic fallback — an assertion a copied string
 * cannot make.
 *
 * ## Vocabulary is derived, not listed
 *
 * The ISL code list comes from the exported `ISL_INFERENCE_WARNING_KINDS`, so a
 * code added to that classification is swept here automatically. That map cannot
 * prove its own completeness (its header says so), which is why the last block
 * asserts the property over codes that DO NOT EXIST YET — drift can then cost
 * specificity, never a bare enum.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelHealthSection } from '../ModelHealthSection'
import type { AuditTrailData } from '../ModelHealthSection'
import { DetailToggleContext } from '../DetailToggleContext'
import {
  describeAuditInferenceWarnings,
  describeAuditInferenceWarningCode,
} from '../auditInferenceWarnings'
import {
  humaniseCritique,
  ISL_INFERENCE_WARNING_KINDS,
} from '../../../../components/results/utils/humaniseCritique'

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../../components/results/Accordion', () => ({
  Accordion: ({ children, testId }: { children: React.ReactNode; testId?: string }) => (
    <div data-testid={testId}>{children}</div>
  ),
}))

/**
 * The generic sentence `humaniseCritique` returns for a code it has no template
 * for — resolved at runtime against a code that cannot ever be mapped, so this
 * file owns no copy of it.
 */
const GENERIC_FALLBACK = humaniseCritique({
  code: '__NOT_A_CODE_THIS_FILE_OWNS_NO_COPY__',
  message: '',
}).title

/** The exact string the ISL producer put on the wire in the captured run. */
const CAPTURED_ISL_MESSAGE =
  "Node 'goal_midmarket' has no ParameterUncertainty — defaulted to base=0.0, constraint probability may be unreliable"

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

describe('Model card audit trail — an inference warning renders its explanation, not a bare code', () => {
  it('renders the captured staging code WITH its ratified sentence, and keeps the code', () => {
    renderAudit([
      {
        code: 'CONSTRAINT_NODE_DEFAULT_BASE',
        severity: 'info',
        message: CAPTURED_ISL_MESSAGE,
      },
    ])

    const rows = screen.getAllByTestId('audit-inference-warning-row')
    expect(rows).toHaveLength(1)

    // Bound by IDENTITY: this row, this code, this owner's sentence for it.
    const expected = describeAuditInferenceWarningCode('CONSTRAINT_NODE_DEFAULT_BASE')
    expect(rows[0].textContent).toContain(expected)

    // ⭐ THE LOAD-BEARING HALF. A row that merely renders SOME text would pass a
    // `toContain` against the fallback too. Deleting the mapped template must
    // show up here, so assert the copy is the SPECIFIC one.
    expect(expected).not.toBe(GENERIC_FALLBACK)
    expect(rows[0].textContent).not.toContain(GENERIC_FALLBACK)

    // The code is still on the surface — humaniseCritique's fallback promises it.
    expect(rows[0].textContent).toContain('CONSTRAINT_NODE_DEFAULT_BASE')

    // ...and it is no longer the WHOLE row, which is the defect.
    expect(rows[0].textContent?.trim()).not.toBe('CONSTRAINT_NODE_DEFAULT_BASE')
  })

  /**
   * Bound to the SECTION, not to this change's own test id.
   *
   * Every other render assertion here queries `audit-inference-warning-row`, a
   * marker this change introduces — so at pristine they fail on a MISSING
   * ELEMENT, and a change that added the marker and nothing else would satisfy
   * them. This one queries the pre-existing `model-health-section` container and
   * asserts CONTENT, so its red is about the sentence being absent from the
   * user's screen rather than about a test hook.
   */
  it('puts the explanation on the Model card itself, not only behind a new test id', () => {
    renderAudit([
      { code: 'CONSTRAINT_NODE_DEFAULT_BASE', severity: 'info', message: CAPTURED_ISL_MESSAGE },
    ])

    const card = screen.getByTestId('model-health-section').textContent ?? ''
    const expected = describeAuditInferenceWarningCode('CONSTRAINT_NODE_DEFAULT_BASE')
    expect(expected).not.toBe(GENERIC_FALLBACK)
    expect(card).toContain(expected)
    expect(card).toContain('CONSTRAINT_NODE_DEFAULT_BASE')
  })

  it('withholds specificity for a code it does not know — generic sentence, code still shown, never "UNKNOWN"', () => {
    renderAudit([{ code: 'A_CODE_ISL_HAS_NOT_WRITTEN_YET', severity: 'warning', message: 'x' }])

    const rows = screen.getAllByTestId('audit-inference-warning-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain(GENERIC_FALLBACK)
    expect(rows[0].textContent).toContain('A_CODE_ISL_HAS_NOT_WRITTEN_YET')
    expect(rows[0].textContent?.trim()).not.toBe('A_CODE_ISL_HAS_NOT_WRITTEN_YET')
  })

  it('renders no fabricated "UNKNOWN" token for a warning that carries no code', () => {
    renderAudit([{ severity: 'info', message: CAPTURED_ISL_MESSAGE }])

    const rows = screen.getAllByTestId('audit-inference-warning-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain(GENERIC_FALLBACK)
    // A code we do not have is ABSENT, not "unknown".
    expect(screen.getByTestId('audit-inference-warnings').textContent).not.toContain('UNKNOWN')
  })

  it('never echoes the producer\'s diagnostic message onto the surface', () => {
    renderAudit([
      { code: 'CONSTRAINT_NODE_DEFAULT_BASE', severity: 'info', message: CAPTURED_ISL_MESSAGE },
      { code: 'ROOT_NODE_DEFAULT_VALUE', severity: 'info', message: "No observed value provided for root node 'n_arr_growth'; defaulted to 0.0." },
    ])

    const list = screen.getByTestId('audit-inference-warnings').textContent ?? ''
    // Raw node identifiers and engine vocabulary from ISL's debug string.
    expect(list).not.toContain('goal_midmarket')
    expect(list).not.toContain('n_arr_growth')
    expect(list).not.toContain('ParameterUncertainty')
    expect(list).not.toContain('base=0.0')
    expect(list).not.toContain(CAPTURED_ISL_MESSAGE)
  })

  it('collapses repeats of one code into a single row with a count', () => {
    renderAudit([
      { code: 'ROOT_NODE_DEFAULT_VALUE', severity: 'info', message: 'a' },
      { code: 'ROOT_NODE_DEFAULT_VALUE', severity: 'info', message: 'b' },
      { code: 'CONSTRAINT_NODE_DEFAULT_BASE', severity: 'info', message: 'c' },
    ])

    const rows = screen.getAllByTestId('audit-inference-warning-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('ROOT_NODE_DEFAULT_VALUE x2')
    expect(rows[1].textContent).toContain('CONSTRAINT_NODE_DEFAULT_BASE')
    expect(rows[1].textContent).not.toContain('x2')
  })
})

describe('Model card audit trail — the property, over the derived vocabulary and beyond it', () => {
  const ISL_CODES = Object.keys(ISL_INFERENCE_WARNING_KINDS)

  it('sweeps a non-trivial ISL vocabulary (guards against an empty sweep passing vacuously)', () => {
    expect(ISL_CODES.length).toBeGreaterThanOrEqual(20)
  })

  it('gives every classified ISL code a sentence that is not the code', () => {
    for (const code of ISL_CODES) {
      const text = describeAuditInferenceWarningCode(code)
      expect(text, code).not.toBe(code)
      expect(text.length, code).toBeGreaterThan(code.length)
      // No template may leak the unresolved-label placeholder onto this surface:
      // PLoT forwards no affected nodes for this channel.
      expect(text, code).not.toContain('This factor')
    }
  })

  it('holds for codes that do not exist yet', () => {
    const future = [
      'SOME_FUTURE_ISL_CODE',
      'ANOTHER_ONE_2027',
      'X',
      'lowercase_code',
    ]
    for (const code of future) {
      const rows = describeAuditInferenceWarnings([{ code, severity: 'info', message: 'raw' }])
      expect(rows, code).toHaveLength(1)
      expect(rows[0].text, code).toBe(GENERIC_FALLBACK)
      expect(rows[0].code, code).toBe(code)
      expect(rows[0].text, code).not.toBe(code)
    }
  })

  it('returns nothing at all for an absent or empty warning list', () => {
    expect(describeAuditInferenceWarnings(null)).toEqual([])
    expect(describeAuditInferenceWarnings(undefined)).toEqual([])
    expect(describeAuditInferenceWarnings([])).toEqual([])
  })
})
