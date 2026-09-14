/**
 * ⭐⭐ THE REFUSAL NAMES ITS OWN SUBJECT.
 *
 * `withheldReasonHasAMove.spec.tsx` gave the refusal an ACT. It could not give
 * it a SUBJECT, and said so in the surface it was written against:
 *
 * > *"⚠ NO FACTOR IS NAMED, AND THE ROUTE REFLECTS THAT. Measured on the live
 * > wire, `missing_important_inputs` is EMPTY on this refusal and the sentence
 * > says 'at least ONE of them' — there is no particular estimate to point at
 * > … inventing one would be a deep link to an arbitrary row dressed as the
 * > answer."*
 *
 * CEE now publishes
 * `analysis_admission.semantic_signals.material_parameters_awaiting_user_node_ids`
 * — the parameters this comparison rests on whose value is not the user's. The
 * first clause of that header is therefore superseded by a producer change.
 *
 * ⛔ **THE SECOND CLAUSE IS NOT, AND THIS FILE IS WHERE IT IS ENFORCED.** The
 * producer publishes the ids in GRAPH ORDER and ranks nothing over them, so the
 * surface names THE WHOLE SET and never selects a member. A single name would
 * read as a considered recommendation while being an arbitrary pick — which is
 * worse than the unnamed sentence, because it looks like more information.
 *
 * ## What these tests bind to
 *
 * Every assertion binds by IDENTITY — the exact labels, compared against the
 * rendered text — never by a count another set could satisfy. The negative
 * cases each PIN THEIR OWN PRECONDITION (the refusal is still rendered, so the
 * test cannot pass because the whole panel vanished).
 *
 * ## Scope (trap 3)
 *
 * A built view model plus jsdom renders. They prove the MEMBERSHIP rules, the
 * gate, and the cap disclosure. They do not prove layout.
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

/** ⛔ A cause that does NOT ask for an estimate. Factors cannot invent an option. */
const OPTION_MESSAGE =
  'There is nothing to compare yet, so no figures can be produced. Name at least two different options you are weighing.'

function admission(
  mode: string,
  code: string,
  message: string,
  signals?: Record<string, unknown>,
): unknown {
  return {
    structurally_analysable: true,
    permitted_analysis_mode: mode,
    reasons: [
      { field: 'structurally_analysable', code: 'READY_TO_COMPARE', message: 'Analysis can run.' },
      { field: 'permitted_analysis_mode', code, message },
    ],
    ...(signals === undefined ? {} : { semantic_signals: signals }),
  }
}

const estimateRefusal = (ids?: unknown): unknown =>
  admission(
    'quantified_provisional',
    'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
    ESTIMATE_MESSAGE,
    ids === undefined ? undefined : { material_parameters_awaiting_user_node_ids: ids },
  )

const LABELS = new Map<string, string>([
  ['fac_price', 'Price'],
  ['fac_adoption', 'Adoption rate'],
  ['fac_churn', 'Monthly churn'],
  ['fac_spend', 'Implementation spend'],
  ['fac_staff', 'Staff retention'],
])

const withAdmission = (adm: unknown): ResultsSectionDataReturn => {
  const base = decisionWithLeaderWithheld()
  return {
    ...base,
    recommendation: { ...base.recommendation, analysisAdmission: adm },
  } as ResultsSectionDataReturn
}

const glanceOf = (adm: unknown, nodeLabels: ReadonlyMap<string, string> | undefined = LABELS) =>
  buildAnalysisNewViewModel({
    data: withAdmission(adm),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    nodeLabels,
  }).atAGlance

const renderGlance = (adm: unknown, nodeLabels: ReadonlyMap<string, string> | undefined = LABELS) =>
  render(
    <AtAGlance
      glance={glanceOf(adm, nodeLabels)}
      isRunning={false}
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      onReanalyse={() => {}}
    />,
  )

describe('the refusal names the parameters it is about', () => {
  it('renders every published name, bound by identity', () => {
    renderGlance(estimateRefusal(['fac_price', 'fac_adoption']))

    // PRECONDITION: the refusal itself is on screen, so a pass cannot come from
    // the whole panel having disappeared.
    expect(screen.getByText(ESTIMATE_MESSAGE)).toBeInTheDocument()

    const line = screen.getByTestId('analysis-new-glance-withheld-parameters')
    expect(line).toHaveTextContent(COPY.glance.withheldParametersLeadIn)
    expect(line).toHaveTextContent('Price')
    expect(line).toHaveTextContent('Adoption rate')
  })

  it('discloses its own cap instead of silently shortening the set', () => {
    renderGlance(
      estimateRefusal(['fac_price', 'fac_adoption', 'fac_churn', 'fac_spend', 'fac_staff']),
    )
    const line = screen.getByTestId('analysis-new-glance-withheld-parameters')
    expect(line).toHaveTextContent('Price')
    // The fifth is NOT named, and the reader is told so by number.
    expect(line).not.toHaveTextContent('Staff retention')
    expect(line).toHaveTextContent(COPY.glance.withheldParametersMore(1))
  })

  it('⛔ names NOTHING under a refusal that does not ask for an estimate', () => {
    // OPPOSITE DIRECTION, and the case a "render whenever the ids are present"
    // implementation fails: the ids ARE published here, and naming them would
    // prescribe a futile act under a sentence asking for a second option.
    renderGlance(
      admission('exploratory', 'NOTHING_TO_COMPARE', OPTION_MESSAGE, {
        material_parameters_awaiting_user_node_ids: ['fac_price'],
      }),
    )
    expect(screen.getByText(OPTION_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-glance-withheld-parameters')).toBeNull()
  })

  it('says nothing new when the producer does not publish the field', () => {
    // The pre-#1450 CEE. Today's sentence, unchanged — deploy order is free.
    renderGlance(estimateRefusal(undefined))
    expect(screen.getByText(ESTIMATE_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-glance-withheld-parameters')).toBeNull()
  })
})

/**
 * ⚠⚠ A SURVIVING MUTANT, DEMONSTRATED RATHER THAN ASSERTED, because an
 * undemonstrated survivor is a claim either way (CLAUDE.md trap 13c).
 *
 * MUTANT: in `readIds`, turn the per-member guard
 *   `if (typeof id !== 'string' || id.length === 0) return []`
 * into `continue`. **All ten tests stay GREEN.**
 *
 * WHY, measured: the loop's `continue` skips the bad member but the function
 * still returns the WHOLE raw array, so `42` reaches
 * `namedMaterialParametersAwaitingUser`, `nodeLabels.get(42)` returns
 * `undefined`, and the LABEL gate voids the set — the same answer, one step
 * later. A `ReadonlyMap<string, string>` cannot hold a non-string key, so no
 * reachable fixture separates the two guards.
 *
 * ⭐ THE GUARD STAYS ANYWAY, and this note is why. It makes `readIds` correct
 * IN ISOLATION rather than correct-because-its-caller-happens-to-check, which
 * is the property that survives someone reusing the reader somewhere the label
 * gate does not exist. What is NOT claimed is that this suite pins it — it
 * does not, and a future refactor could remove it with no red anywhere.
 */
describe('fail-closed: an unreadable set is no set', () => {
  it.each([
    ['an empty array (floor met, or no material parameters at all)', []],
    ['a non-array', 'fac_price'],
    ['a member that is not a string', ['fac_price', 42]],
    ['an empty-string member', ['fac_price', '']],
  ])('names nothing for %s', (_why, ids) => {
    expect(glanceOf(estimateRefusal(ids)).designationWithheldParameters).toEqual([])
  })

  it('names nothing when an id resolves to no label — a set it cannot name is not a set', () => {
    // ⚠ VOIDS THE WHOLE SET rather than dropping the member. An id the consumer
    // cannot resolve means its graph and CEE's census disagree; naming the
    // remainder would report a PARTIAL set as the whole one.
    expect(
      glanceOf(estimateRefusal(['fac_price', 'fac_not_on_this_canvas'])).designationWithheldParameters,
    ).toEqual([])
  })

  it('names nothing when the surface has no labels at all', () => {
    // ⚠ Built WITHOUT the helper's default: passing `undefined` to a parameter
    // that has a default would silently restore the labels, and the test would
    // pass for the opposite reason.
    const noLabels = buildAnalysisNewViewModel({
      data: withAdmission(estimateRefusal(['fac_price'])),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    }).atAGlance
    expect(noLabels.designationWithheldParameters).toEqual([])
  })
})
