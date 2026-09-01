/**
 * Analysis (New) — THE PANEL ASKS FOR A SUCCESS TARGET IN ONE PLACE.
 *
 * ⚠⚠ THE DEFECT THIS PINS, MEASURED ON DEPLOYED `3595403b` (guest, a saved
 * model before any run). One fact, four times, three of them inside this panel
 * and two of them sharing a sentence VERBATIM:
 *
 *   canvas goal card  "No target set"                          (outside this lane)
 *   model strip       "Target · None set · Set a target"
 *   glance card       "Define success — No measurable success target is set."
 *   strengthen row    "Define what success looks like — No measurable success
 *                      target is set."
 *
 * ⭐ THE STRIP'S LINE IS THE NEWCOMER AND THE KEEPER. It shipped the day before
 * this fix; it names the goal, states the target, and its control edits in
 * place. It also renders OUTSIDE the strip's disclosure button, so it is on
 * screen whether the strip is open or closed — which is what makes removing the
 * glance's copy safe rather than a quiet deletion of the ask.
 *
 * ⭐ THE STRENGTHEN ROW ALSO KEEPS ITS PLACE, and that is not a compromise. It
 * is the only one of the three that says WHY a target matters ("the analysis
 * cannot say how likely each option is to succeed, only how they compare"), and
 * it carries Try this, I disagree, and the provenance line. The glance card was
 * the one saying nothing the other two did not.
 *
 * ── WHAT IS UNDER TEST, AND WHY IT IS NOT A SENTENCE COUNT ──────────────────
 * A bare "this sentence appears once" invariant is wrong here and would fail
 * honestly in the no-goal case, where the glance card is the ONLY offer of the
 * ask. The property is narrower and is the one the fix implements:
 *
 *   the glance never promotes a recommendation the model strip is already
 *   rendering as its own control
 *
 * So both directions are tested, and EACH HALF PINS ITS OWN PRECONDITION in
 * test (CLAUDE.md trap 21) — the with-goal case asserts the strip's control is
 * genuinely on screen, and the no-goal case asserts it genuinely is not.
 * Without those, a harness that silently stopped rendering the strip would
 * satisfy the suppression assertion while the panel lost the line entirely.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { SUCCESS_MEASURE_RECOMMENDATION_ID } from '../../strengthen/buildRecommendations'
import { resolveGoalNodeId } from '../buildModelStrip'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { openStrategicChallenge } from './analysisNewFixtures'

const GOAL_NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Board wants NRR back above 110%' } },
  { id: 'o1', type: 'option', data: { label: 'Hold current strategy' } },
]
/** ⚠ A model with nodes but NO goal — not an empty canvas, which would also
 *  starve every other section and make the twin pass for the wrong reason. */
const GOALLESS_NODES = [{ id: 'o1', type: 'option', data: { label: 'Hold current strategy' } }]

const seed = (nodes: typeof GOAL_NODES | typeof GOALLESS_NODES) => {
  useCanvasStore.setState({ nodes, goalThreshold: null } as never)
}

const renderPanel = () =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={openStrategicChallenge()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
    />,
  )

/** The glance's promoted card, or null. Bound by TESTID, read by ID. */
const glancePrimaryId = (): string | null =>
  screen.queryByTestId('analysis-new-glance-primary-intervention')?.getAttribute(
    'data-recommendation-id',
  ) ?? null

const previousNodes = { value: [] as unknown }

beforeEach(() => {
  previousNodes.value = useCanvasStore.getState().nodes
  useStrengthenStore.setState({ records: {} })
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: previousNodes.value } as never)
})

describe('THE INSTRUMENT — the probe can see both answers', () => {
  /**
   * ⭐ THE CONTRAST CONTROL. A suppression test whose probe returns null for
   * every input is indistinguishable from a suppression that works (CLAUDE.md
   * trap 13e). These two assertions differ, in the same run, which is the only
   * thing that proves the probe discriminates rather than agreeing with itself.
   */
  it('resolveGoalNodeId separates the two fixtures', () => {
    expect(resolveGoalNodeId(GOAL_NODES)).toBe('g1')
    expect(resolveGoalNodeId(GOALLESS_NODES)).toBeNull()
  })

  it('the id the suppression keys on is the id the builder mints', () => {
    // Derived, not retyped: a rename in the builder moves both sides at once.
    expect(SUCCESS_MEASURE_RECOMMENDATION_ID).toBe('strengthen:success-measure')
  })
})

describe('with a goal — the strip owns the ask, and the glance does not repeat it', () => {
  beforeEach(() => seed(GOAL_NODES))

  /**
   * ⚠ THE PRECONDITION, ASSERTED RATHER THAN ASSUMED. Everything below is only
   * meaningful because the strip is genuinely offering the control. If this
   * ever stops rendering, the suppression becomes a deletion and this REDs
   * first.
   */
  it('the model strip renders the target control', () => {
    renderPanel()
    expect(screen.getByTestId('analysis-new-model-strip-target')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-model-strip-target-none')).toHaveTextContent(
      COPY.successTarget.none,
    )
    expect(screen.getByTestId('analysis-new-model-strip-target-edit')).toBeInTheDocument()
  })

  it('the glance does not promote the success-measure recommendation', () => {
    renderPanel()
    expect(glancePrimaryId()).not.toBe(SUCCESS_MEASURE_RECOMMENDATION_ID)
  })

  /**
   * ⚠ NOTHING IS HIDDEN — the half of the change that is easy to get wrong.
   * The displaced recommendation must still be reachable with its reasoning
   * intact; suppressing it from the glance is a de-duplication, not a removal.
   */
  it('the displaced recommendation still renders in Strengthen the reasoning', () => {
    renderPanel()
    const toggle = screen.queryByTestId('analysis-new-strengthen-toggle')
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
    const section = screen.getByTestId('analysis-new-strengthen')
    expect(section.textContent).toContain('No measurable success target is set.')
  })

  /**
   * ⭐ AND THE SENTENCE IS NOW SAID ONCE. Scoped to the with-goal case on
   * purpose — see the header. Counted by OWN text nodes so it is attributed to
   * the element that prints it rather than to every ancestor containing it.
   */
  it('states the missing target exactly once inside the panel', () => {
    const { container } = renderPanel()
    const toggle = screen.queryByTestId('analysis-new-strengthen-toggle')
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
    let hits = 0
    container.querySelectorAll('*').forEach((el) => {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
      if (own.includes('No measurable success target is set.')) hits += 1
    })
    expect(hits).toBe(1)
  })
})

describe('with no goal — the glance is the only offer, and it keeps it', () => {
  beforeEach(() => seed(GOALLESS_NODES))

  /** ⚠ THE OPPOSITE PRECONDITION. `SuccessTargetLine` returns null with no goal
   *  node — a target affordance writing into nowhere. */
  it('the model strip renders no target control', () => {
    renderPanel()
    expect(screen.queryByTestId('analysis-new-model-strip-target')).toBeNull()
  })

  /**
   * ⭐⭐ THE OPPOSITE-DIRECTION TWIN, and the reason the suppression is
   * conditional at all. Suppressing unconditionally would delete the panel's
   * top ask on exactly the models that have no other place to make it.
   */
  it('the glance still promotes the success-measure recommendation', () => {
    renderPanel()
    expect(glancePrimaryId()).toBe(SUCCESS_MEASURE_RECOMMENDATION_ID)
  })
})
