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
 * ## The corpus comes from the captures, not from this lane's head
 *
 * ⚠ THE FIRST VERSION OF THE SWEEP BELOW COULD NOT FAIL, AND ADVERSARIAL REVIEW
 * OF THIS PR CAUGHT IT. It swept `ISL_INFERENCE_WARNING_KINDS` and asserted no
 * label placeholder — over a map whose own header says every template it
 * classifies ignores the label BY CONSTRUCTION. A guard agreeing with itself
 * (CLAUDE.md trap 13b), over a set chosen because it was the set this lane had
 * in mind (trap 22).
 *
 * The sweep is now DERIVED FROM THE REPO'S OWN CAPTURES — every
 * `inference_warnings` array in every JSON fixture under `src/` — which reaches
 * three codes the classification does not contain, one of them
 * (`CONSTRAINT_TARGET_UNRELIABLE`) label-interpolating. A CONTRAST CONTROL
 * asserts the corpus still exceeds the classification, so tidying it back to the
 * self-agreeing set fails loudly (trap 13e).
 *
 * Neither corpus can prove completeness, which is why the final block asserts
 * the property over codes that DO NOT EXIST YET — drift can then cost
 * specificity, never a bare enum and never a placeholder.
 */

import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

/**
 * The codes this repo has actually CAPTURED on the `inference_warnings` channel,
 * derived by walking every JSON fixture under `src/`.
 *
 * ⭐⭐ WHY NOT `ISL_INFERENCE_WARNING_KINDS`. The first version of this guard
 * swept that map — and could not fail. Its own header states that every template
 * it classifies ignores the resolved label BY CONSTRUCTION, so a
 * "no label placeholder" assertion over exactly that set is a guard agreeing
 * with itself (CLAUDE.md trap 13b). The set was chosen because it was the set
 * this lane had in mind, which is the definition of a corpus drawn from the
 * author's own head (trap 22).
 *
 * The captures reach further than the classification does: three of the six
 * codes below are NOT in that map, and one of them —
 * `CONSTRAINT_TARGET_UNRELIABLE` — is a LABEL-INTERPOLATING template. That is
 * the class the guard exists to catch, and it was invisible to the old sweep.
 *
 * The CONTRAST CONTROL below is what makes this corpus evidence rather than
 * another self-agreeing set (trap 13e): it asserts the sweep reaches at least
 * one code the classification does not contain. If someone later "tidies" this
 * back to the classified set, that control fails.
 */
function deriveCapturedWarningCodes(): string[] {
  const here = dirname(fileURLToPath(import.meta.url))
  const srcRoot = join(here, '..', '..', '..', '..')
  const codes = new Set<string>()

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue
        walk(p)
      } else if (entry.name.endsWith('.json')) {
        let doc: unknown
        try {
          doc = JSON.parse(readFileSync(p, 'utf-8'))
        } catch {
          continue
        }
        const stack: unknown[] = [doc]
        while (stack.length > 0) {
          const o = stack.pop()
          if (Array.isArray(o)) {
            stack.push(...o)
          } else if (o !== null && typeof o === 'object') {
            for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
              if (k === 'inference_warnings' && Array.isArray(v)) {
                for (const w of v) {
                  const c = (w as { code?: unknown } | null)?.code
                  if (typeof c === 'string' && c.length > 0) codes.add(c)
                }
              }
              stack.push(v)
            }
          }
        }
      }
    }
  }

  walk(srcRoot)
  return [...codes].sort()
}

describe('Model card audit trail — the property, over a CAPTURED corpus and beyond it', () => {
  const CAPTURED_CODES = deriveCapturedWarningCodes()
  const GENERIC = describeAuditInferenceWarningCode(null)

  it('the sweep is non-empty (an empty corpus would pass every assertion below vacuously)', () => {
    expect(CAPTURED_CODES.length).toBeGreaterThanOrEqual(6)
  })

  it('CONTRAST CONTROL: the corpus reaches codes the ISL classification does not contain', () => {
    const unclassified = CAPTURED_CODES.filter(c => !(c in ISL_INFERENCE_WARNING_KINDS))
    // Real absence, not a blind sweep: the classification is a real, non-empty
    // set, and the captures still exceed it.
    expect(Object.keys(ISL_INFERENCE_WARNING_KINDS).length).toBeGreaterThanOrEqual(20)
    expect(unclassified.length).toBeGreaterThanOrEqual(1)
    // Bound by identity to the code that exposed the old guard's blind spot.
    expect(CAPTURED_CODES).toContain('CONSTRAINT_TARGET_UNRELIABLE')
  })

  it('the sentinel used to obtain the generic sentence still means "unmapped"', () => {
    // If the sentinel ever became a real mapped code, every fallback assertion
    // in this file would quietly start comparing against specific copy.
    expect(GENERIC).toBe(describeAuditInferenceWarningCode('__A_DIFFERENT_UNMAPPED_CODE__'))
  })

  it('never renders a sentence built around a factor this surface cannot name', () => {
    for (const code of CAPTURED_CODES) {
      const rendered = describeAuditInferenceWarningCode(code)

      expect(rendered, code).not.toBe(code)
      // ⚠ NOT a length comparison. The first draft asserted the sentence was
      // LONGER than the code and this sweep refuted it: the generic sentence is
      // 33 characters and `EDGE_SENSITIVITY_UNAVAILABLE_V2_WIRE` is 36. Length
      // was a proxy; the property is that the row is never a bare machine-code
      // token, which is what this matches.
      expect(rendered, code).not.toMatch(/^[A-Z0-9_]+$/)

      // Ask the OWNER whether this code's copy depends on a factor label, by
      // resolving it under two different labels — derived, so no placeholder
      // string is mirrored here.
      const underA = humaniseCritique(
        { code, message: '', affectedNodes: ['__probe__'] },
        new Map([['__probe__', 'PROBE_ALPHA']]),
      ).title
      const underB = humaniseCritique(
        { code, message: '', affectedNodes: ['__probe__'] },
        new Map([['__probe__', 'PROBE_BETA']]),
      ).title

      if (underA !== underB) {
        // Label-dependent: the audit row has no factor context, so it must
        // withhold the specific sentence rather than render a placeholder.
        expect(rendered, `${code} is label-dependent`).toBe(GENERIC)
      } else {
        // Label-free: the specific sentence is safe and must be used.
        expect(rendered, `${code} is label-free`).toBe(underA)
      }
      expect(rendered, code).not.toContain('PROBE_ALPHA')
      expect(rendered, code).not.toContain('PROBE_BETA')
    }
  })

  it('CONSTRAINT_TARGET_UNRELIABLE specifically renders the generic sentence, not a placeholder', () => {
    // The named case, bound by identity. Its template is label-interpolating,
    // so with no factor context it produced "This factor's success target…" on
    // an audit trail that names no factor.
    expect(describeAuditInferenceWarningCode('CONSTRAINT_TARGET_UNRELIABLE')).toBe(GENERIC)
  })

  it('still gives a LABEL-FREE mapped code its specific copy (the fix withholds narrowly)', () => {
    const specific = describeAuditInferenceWarningCode('ROOT_NODE_DEFAULT_VALUE')
    expect(specific).not.toBe(GENERIC)
    expect(specific).not.toBe('ROOT_NODE_DEFAULT_VALUE')
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
