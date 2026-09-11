/**
 * ⭐⭐ THE NAMED SET READS AS ONE SENTENCE.
 *
 * `withheldParametersAreNamed.spec.tsx` proved the MEMBERSHIP rules: which
 * parameters appear, the gate that decides whether any appear at all, and that
 * a capped list discloses its own cut. It did not prove the line is READABLE,
 * and it could not have: its cap assertion is
 *
 * ```ts
 * expect(line).toHaveTextContent(COPY.glance.withheldParametersMore(1))
 * ```
 *
 * — a substring check against the copy constant itself. That is satisfied by
 * `… Implementation spend and and 1 more`, which is what the surface actually
 * rendered, because the constant already opened with `and ` and
 * `formatConjunctionList` (`Intl.ListFormat`, `type: 'conjunction'`) supplies
 * its own before the final member. **A guard written in terms of the constant
 * cannot see a defect in how the constant is composed** (CLAUDE.md trap 13b).
 *
 * Measured at `c5b5e86a` with the eight labels from a refusal witnessed on
 * deployed staging:
 *
 * > *Brand Modernity Level, Rebranding Investment, Stakeholder Disruption,
 * > Customer and Staff Engagement **and and** 4 more*
 *
 * ## What these tests bind to
 *
 * The FULL rendered text of `…-withheld-parameters`, compared for EXACT
 * equality — never a substring another string could satisfy, and never
 * recomposed from `formatConjunctionList` or `COPY.glance.withheldParametersMore`,
 * which would make the expectation agree with the code by construction. The
 * English is written out literally here on purpose: this file is where the
 * sentence is pinned, so a change to either the joiner or the constant has to
 * come past it.
 *
 * ⚠ ONE LABEL CONTAINS "and" — `Customer and Staff Engagement`, a real label
 * from that refusal. A fix that deleted doubled conjunctions by string surgery
 * would corrupt it, and these expectations would catch that; a test built from
 * `and`-free labels would not.
 *
 * ## Scope (trap 3)
 *
 * A built view model plus a jsdom render. This proves the TEXT. It does not
 * prove layout, wrapping, or that the line is on screen for a real user.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'

afterEach(cleanup)

/** The producer's real sentence for the cause that asks for an estimate. */
const ESTIMATE_MESSAGE =
  'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.'

/**
 * The eight parameters carried by the witnessed refusal, in graph order.
 * ⚠ `Customer and Staff Engagement` is deliberate — see the header.
 */
const WITNESSED: readonly (readonly [string, string])[] = [
  ['fac_brand', 'Brand Modernity Level'],
  ['fac_invest', 'Rebranding Investment'],
  ['fac_disrupt', 'Stakeholder Disruption'],
  ['fac_engage', 'Customer and Staff Engagement'],
  ['fac_share', 'Market Share Shift'],
  ['fac_compete', 'Competitor Response'],
  ['fac_retain', 'Retention Risk'],
  ['fac_delay', 'Cost of Delay'],
]

const LABELS = new Map<string, string>(WITNESSED.map(([id, label]) => [id, label]))

const estimateRefusal = (ids: readonly string[]): unknown => ({
  structurally_analysable: true,
  permitted_analysis_mode: 'quantified_provisional',
  reasons: [
    { field: 'structurally_analysable', code: 'READY_TO_COMPARE', message: 'Analysis can run.' },
    {
      field: 'permitted_analysis_mode',
      code: 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      message: ESTIMATE_MESSAGE,
    },
  ],
  semantic_signals: { material_parameters_awaiting_user_node_ids: ids },
})

const withAdmission = (adm: unknown): ResultsSectionDataReturn => {
  const base = decisionWithLeaderWithheld()
  return {
    ...base,
    recommendation: { ...base.recommendation, analysisAdmission: adm },
  } as ResultsSectionDataReturn
}

/** Renders the glance for the first `n` witnessed parameters and returns the line. */
function lineFor(n: number): HTMLElement {
  const ids = WITNESSED.slice(0, n).map(([id]) => id)
  render(
    <AtAGlance
      glance={
        buildAnalysisNewViewModel({
          data: withAdmission(estimateRefusal(ids)),
          recommendations: [],
          isPreRun: false,
          isRunning: false,
          isStale: false,
          nodeLabels: LABELS,
        }).atAGlance
      }
      isRunning={false}
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      onReanalyse={() => {}}
    />,
  )
  // PRECONDITION, pinned in-test: the refusal itself is rendered, so an
  // assertion about this line cannot pass because the panel vanished, and the
  // set was not voided by the fail-closed label gate in
  // `materialParametersAwaitingUser.ts`.
  expect(screen.getByText(ESTIMATE_MESSAGE)).toBeInTheDocument()
  return screen.getByTestId('analysis-new-glance-withheld-parameters')
}

const LEAD_IN = COPY.glance.withheldParametersLeadIn

describe('the named set reads as one sentence', () => {
  it('over the cap: the disclosure takes the final conjunction slot, and there is no second "and"', () => {
    const line = lineFor(8)

    // IDENTITY. The whole line, exactly. Written out rather than recomposed.
    expect(line.textContent).toBe(
      `${LEAD_IN} Brand Modernity Level, Rebranding Investment, Stakeholder Disruption, Customer and Staff Engagement and 4 more`,
    )

    // The defect, named. `Intl.ListFormat` supplies the conjunction; the copy
    // constant must not supply a second one.
    expect(line.textContent).not.toMatch(/\band and\b/)

    // The number is the REMAINDER, not the total and not the cap. Spelled out
    // because `toContain('4 more')` is satisfied by '14 more' and by '4 more'
    // inside a larger number.
    expect(line.textContent).not.toMatch(/\b8 more\b/)
    expect(line.textContent).not.toMatch(/\b(?:14|24|40) more\b/)

    // The cap still discloses itself: the four it did NOT name are absent.
    for (const [, label] of WITNESSED.slice(4)) {
      expect(line.textContent).not.toContain(label)
    }
  })

  it('one over the cap: the same sentence, singular remainder', () => {
    // The boundary. `WITHHELD_PARAMETER_CAP` is 4, so this is the smallest set
    // that can render the disclosure at all.
    expect(lineFor(5).textContent).toBe(
      `${LEAD_IN} Brand Modernity Level, Rebranding Investment, Stakeholder Disruption, Customer and Staff Engagement and 1 more`,
    )
  })

  it('at the cap: unchanged, and no disclosure is invented', () => {
    // OPPOSITE DIRECTION. This branch was always correct and must stay byte-
    // identical: the four names joined by the formatter, nothing appended.
    const line = lineFor(4)
    expect(line.textContent).toBe(
      `${LEAD_IN} Brand Modernity Level, Rebranding Investment, Stakeholder Disruption and Customer and Staff Engagement`,
    )
    expect(line.textContent).not.toMatch(/\bmore\b/)
  })

  it('under the cap: unchanged at two and at one', () => {
    expect(lineFor(2).textContent).toBe(
      `${LEAD_IN} Brand Modernity Level and Rebranding Investment`,
    )
    cleanup()
    expect(lineFor(1).textContent).toBe(`${LEAD_IN} Brand Modernity Level`)
  })
})
