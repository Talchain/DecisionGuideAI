/**
 * ⭐⭐ THE PANEL MAY NOT SHOW A TARGET AND DENY ONE IN THE SAME VIEWPORT.
 *
 * ⚠⚠ WITNESSED ON DEPLOYED `f59ffc26`, as a guest, before any run. Open the
 * saved example "International Expansion Strategy" and the Reasoning tab
 * renders both of these, ~120px apart, with no scrolling:
 *
 *     model strip      Target 11 £M ARR · From brief · Change
 *     strengthen card  Define what success looks like
 *                      No measurable success target is set.
 *                      Source: your goal has no success threshold
 *                      (checked directly).
 *
 * The last line is the part that makes it a defect rather than a difference:
 * the card claims to have checked the goal directly, and it had never been
 * shown one. `market-entry.draft.json` (11) and `pricing-model.draft.json`
 * (110) both ship with a brief-set target, so this is the ordinary saved-model
 * path, not an edge case.
 *
 * ── THE TWO QUESTIONS, WRITTEN DOWN BEFORE THE ASSERTIONS (trap 21) ────────
 * These surfaces are NOT two implementations of one question, and the fix is
 * emphatically not to align their defaults — `successTargetLine.spec.tsx`
 * :176-187 ruled that out and was right:
 *
 *   the strip  "is there a target we can SHOW, in this reader's units, and
 *               whose is it?"                        → EXPRESSIBILITY
 *   the card   "has anyone set a measurable target
 *               at all?"                             → EXISTENCE
 *
 * Existence is the broader question, so the only invariant that follows is
 * one-directional, and it is the only one this file asserts:
 *
 *     the strip displaying a target  ⟹  the card's sentence is absent
 *
 * ⚠ THE CONVERSE IS DELIBERATELY NOT ASSERTED. A goal carrying only a
 * normalised threshold is genuinely held-but-unexpressible to the strip and
 * genuinely set to the card. Those are two true sentences about one model, and
 * a test that demanded they match would be the alignment trap 21 warns about.
 *
 * ── WHY THE OWNER, AND WHY THE REAL HOOK ──────────────────────────────────
 * The defect is not in either surface. `useResultsSectionData`'s pre-run early
 * return omitted `goalThreshold` from the recommendation object, so the card's
 * `goalThreshold == null` gate fired on every model, whatever the goal carried.
 * A spec that handed the panel a fixture would therefore pass with the defect
 * still live — the fixture would simply supply what the owner does not. So
 * layer 1 renders the REAL hook, and layer 2 feeds the REAL hook's output into
 * the REAL panel.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useResultsSectionData } from '../../useResultsSectionData'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'

const STRIP = 'analysis-new-model-strip-target'
const STRENGTHEN = 'analysis-new-strengthen'
const SENTENCE = 'No measurable success target is set.'

/**
 * ⚠⚠ THE SECTION IS COLLAPSED BY DEFAULT (`SectionShell`), AND THE FIRST
 * VERSION OF THIS FILE DID NOT OPEN IT. Every "the sentence is absent"
 * assertion then passed on a SHUT ACCORDION — the probe could not have found
 * that sentence on any model, so it was measuring nothing. The twin below is
 * what exposed it: the case that must FIND the sentence failed, which is the
 * only reason the vacuity was visible at all.
 *
 * Opening is therefore a precondition of every assertion here, and the
 * expansion is asserted rather than assumed, so a renamed toggle REDs instead
 * of quietly restoring the vacuum.
 */
/**
 * ⚠⚠ READ THE RENDERED TEXT, NOT AN ELEMENT. `getByText(SENTENCE)` matches an
 * element whose WHOLE normalised text equals the string, and this sentence
 * shares its paragraph with the rest of the card's copy ("…is set. Without a
 * target the analysis cannot say…"). So that query returned null on EVERY
 * model, and both directions of this test were vacuous until the twin caught
 * it. The question the panel is actually being asked is "do you say this
 * sentence anywhere on screen", so the predicate reads the text.
 */
const panelAsksForATarget = () => (document.body.textContent ?? '').includes(SENTENCE)

const openStrengthen = () => {
  fireEvent.click(screen.getByTestId(`${STRENGTHEN}-toggle`))
  expect(screen.getByTestId(`${STRENGTHEN}-toggle`)).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByTestId(`${STRENGTHEN}-region`)).toBeInTheDocument()
}

/**
 * The shipped `market-entry` goal node, reduced to the fields both readers use.
 * `goal_threshold_raw` is the brief-set figure in user units; `goal_threshold`
 * is its normalised twin; the cap is what converts between them.
 */
const GOAL_WITH_TARGET = {
  id: 'g1',
  type: 'goal',
  data: {
    label: 'Grow Total ARR Materially Within 12 Months',
    goal_threshold_raw: 11,
    goal_threshold: 0.73,
    goal_threshold_unit: '£M ARR',
    goal_threshold_cap: 15,
  },
}
/** ⚠ The twin's goal keeps the WORDS and loses the number — the honest "none". */
const GOAL_WITHOUT_TARGET = {
  id: 'g1',
  type: 'goal',
  data: { label: 'Grow Total ARR Materially Within 12 Months' },
}
const CENSUS = [
  { id: 'o1', type: 'option', data: { label: 'Germany first' } },
  { id: 'o2', type: 'option', data: { label: 'Nordics first' } },
  { id: 'f1', type: 'factor', data: { label: 'Target market size' } },
  { id: 'r1', type: 'risk', data: { label: 'Localisation drag' } },
  { id: 'x1', type: 'outcome', data: { label: 'New market ARR growth' } },
]

/** Pre-run: no report, first run not completed. The state a saved model opens in. */
const seedPreRun = (goal: typeof GOAL_WITH_TARGET | typeof GOAL_WITHOUT_TARGET) => {
  useCanvasStore.setState({
    nodes: [goal, ...CENSUS],
    edges: [],
    results: null,
    runMeta: {},
    hasCompletedFirstRun: false,
    rawV2Response: null,
    goalThreshold: null,
    goalThresholdRepresentation: null,
  } as never)
}

/** The real owner feeding the real panel — no fixture anywhere in the chain. */
function RealPanel() {
  const data = useResultsSectionData()
  return (
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun
      isRunning={false}
      isStale={false}
      responseHash="run_pre"
    />
  )
}

const previous = { nodes: [] as unknown }
beforeEach(() => {
  previous.nodes = useCanvasStore.getState().nodes
  useStrengthenStore.setState({ records: {} })
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: previous.nodes } as never)
})

describe('THE OWNER — the pre-run recommendation carries the model’s target', () => {
  it('hands over the brief-set target before any run has completed', () => {
    seedPreRun(GOAL_WITH_TARGET)
    const { result } = renderHook(() => useResultsSectionData())

    // ⭐ PRECONDITION, PINNED IN-TEST. Without this the case could silently
    // become the POST-run branch — which already carried the threshold — and
    // pass while proving nothing about the branch under test.
    expect(result.current.recommendation.allOptions).toEqual([])
    expect(result.current.recommendation.recommendedOption).toBeNull()

    // ⚠⚠ THE DEFECT. `undefined` here is what made the card deny the target.
    expect(result.current.recommendation.goalThreshold).toBe(11)
  })

  it('…and still reports absence honestly when the goal carries no number', () => {
    seedPreRun(GOAL_WITHOUT_TARGET)
    const { result } = renderHook(() => useResultsSectionData())

    expect(result.current.recommendation.allOptions).toEqual([])
    expect(result.current.recommendation.goalThreshold ?? null).toBeNull()
  })
})

describe('THE PANEL — one viewport, one answer about the target', () => {
  it('shows the target and does NOT ask for it', () => {
    seedPreRun(GOAL_WITH_TARGET)
    render(<RealPanel />)
    openStrengthen()

    // ⭐ PRECONDITION. An absence assertion under a panel that rendered no
    // strip at all would pass for the wrong reason. Prove the strip is
    // genuinely displaying a target FIRST, then assert the sentence is gone.
    expect(screen.getByTestId(`${STRIP}-value`)).toHaveTextContent('11')
    expect(screen.queryByTestId(`${STRIP}-none`)).toBeNull()

    // ⚠⚠ THE CLAIM. This is the sentence that stood 120px below the target.
    expect(panelAsksForATarget()).toBe(false)
  })

  /**
   * ⭐⭐ THE OPPOSITE-DIRECTION TWIN, AND THE PROBE'S POSITIVE CONTROL.
   * `queryByText(SENTENCE)` returning null proves nothing unless the same query
   * can be shown to FIND that sentence on a model that deserves it. This case
   * is that proof, and it is also the thing that stops the fix degenerating
   * into "delete the ask": on a goal with no number the coaching must still
   * fire. It must be GREEN both before and after the fix.
   */
  it('asks for the target, and shows none, when the goal has no number', () => {
    seedPreRun(GOAL_WITHOUT_TARGET)
    render(<RealPanel />)
    openStrengthen()

    expect(screen.getByTestId(`${STRIP}-none`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${STRIP}-value`)).toBeNull()
    expect(panelAsksForATarget()).toBe(true)
  })

  /**
   * The invariant itself, asserted as the implication rather than an equality,
   * over the discriminating pair. Written this way so it stays true if a third
   * target representation is added later: it constrains only the direction that
   * is actually a contradiction.
   */
  it('the implication holds over both models: strip shows a target ⇒ no ask', () => {
    for (const goal of [GOAL_WITH_TARGET, GOAL_WITHOUT_TARGET]) {
      cleanup()
      seedPreRun(goal)
      render(<RealPanel />)
      openStrengthen()

      const stripShowsATarget = screen.queryByTestId(`${STRIP}-value`) !== null
      if (stripShowsATarget) expect(panelAsksForATarget()).toBe(false)
    }
  })
})
