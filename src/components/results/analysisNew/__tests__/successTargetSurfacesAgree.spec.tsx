/**
 * ⭐⭐ THE PANEL MAY NOT SHOW A TARGET AND DENY ONE IN THE SAME VIEWPORT.
 *
 * ⚠⚠ WITNESSED ON DEPLOYED `f59ffc26`, as a guest, before any run. Open the
 * saved example "International Expansion Strategy" and the Reasoning tab
 * renders both of these, in the same panel and the same pre-run state:
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
const panelAsksForATarget = () => {
  // ⚠ SCOPED TO THE REGION, NOT THE DOCUMENT. This sentence has TWO producers —
  // `buildRecommendations` (the strengthen row) and the glance card. On a model
  // with no goal node the glance renders it without the strengthen section
  // being open at all, so a document-wide read would answer about a different
  // surface than the one under test. The testid is already asserted by
  // `openStrengthen`, so scoping is free.
  const region = screen.queryByTestId(`${STRENGTHEN}-region`)
  return (region?.textContent ?? '').includes(SENTENCE)
}

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
/**
 * ⭐⭐ THE THREE SHAPES THAT MUST STILL ASK, AND THE REASON THIS FILE GREW.
 *
 * ⚠ FOUND BY INDEPENDENT REVIEW, ON THE FIRST CUT OF THIS FIX. Handing the
 * card `effectiveGoalThreshold` — a COMPUTE fallback — silenced the coaching on
 * every one of these while the strip correctly rendered "None set". A false
 * claim traded for a missing prompt, which is worse than the defect being fixed
 * because nothing on screen looks wrong.
 *
 * ⚠ AND THE CORPUS LESSON: the original pair here was "a full target" and
 * "nothing at all" — the two ENDS. Every one of these lives in between, and a
 * corpus of endpoints cannot see a predicate that is too broad in the middle.
 * Check what a corpus EXCLUDES, not what it covers.
 */
const GOAL_OBSERVED_STATE_ONLY = {
  id: 'g1', type: 'goal',
  // An observed state is a measurement, never a target somebody set.
  data: { label: 'Grow Total ARR', observed_state: { value: 3.2 } },
}
const GOAL_BLANK_RAW = {
  id: 'g1', type: 'goal',
  // A blank arrives in practice — `goalTarget.ts` and `GoalNode` BOTH guard it.
  data: { label: 'Grow Total ARR', goal_threshold_raw: '' },
}
const GOAL_UNGATED_SUCCESS = {
  id: 'g1', type: 'goal',
  // No `threshold_source: 'user'`, so nobody stated this as the target.
  data: { label: 'Grow Total ARR', success_threshold: 0.6 },
}
/** ⚠ A STRING, in a field the type says is a number. It does arrive. */
const GOAL_STRING_RAW = {
  id: 'g1', type: 'goal',
  data: { label: 'Grow Total ARR', goal_threshold_raw: '11', goal_threshold_unit: '£M ARR' },
}

const CENSUS = [
  { id: 'o1', type: 'option', data: { label: 'Germany first' } },
  { id: 'o2', type: 'option', data: { label: 'Nordics first' } },
  { id: 'f1', type: 'factor', data: { label: 'Target market size' } },
  { id: 'r1', type: 'risk', data: { label: 'Localisation drag' } },
  { id: 'x1', type: 'outcome', data: { label: 'New market ARR growth' } },
]

/** Pre-run: no report, first run not completed. The state a saved model opens in. */
const seedPreRun = (goal: { id: string; type: string; data: Record<string, unknown> }) => {
  useCanvasStore.setState({
    nodes: [goal, ...CENSUS],
    edges: [],
    results: null,
    runMeta: {},
    hasCompletedFirstRun: false,
    rawV2Response: null,
    goalThreshold: null,
    goalThresholdRepresentation: null,
    /**
     * ⚠ RESET EXPLICITLY. Without this, a case that seeds `ceeAnalysisReady`
     * leaks it into every later case in the file — which is exactly what
     * happened when the blank-threshold cases below were added, and it turned
     * two unrelated tests red. A seed that does not clear every field it can
     * set is a shared-state bug wearing a fixture's clothes.
     */
    ceeAnalysisReady: null,
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

    // ⚠⚠ THE CLAIM. No distance is asserted — see the header. Co-presence in
    // one panel state is the whole defect and is all that is claimed.
    expect(panelAsksForATarget()).toBe(false)
  })

  /**
   * ⭐⭐⭐ THE REGRESSION THIS FIX ALMOST SHIPPED, PINNED AS A TABLE.
   *
   * Each of these carries something a COMPUTE fallback would happily use as a
   * target, and none of them is a target anyone STATED. The card must keep
   * asking on all three, and the strip must keep saying "none" — the two
   * surfaces agreeing about an absence, which is the state the first cut broke.
   *
   * ⚠ `.each` so the failure names the shape. A loop that fails on case two
   * reports one red and hides the other two.
   */
  it.each([
    ['an observed state, which is a measurement and not a target', GOAL_OBSERVED_STATE_ONLY],
    ['a BLANK goal_threshold_raw', GOAL_BLANK_RAW],
    ['a success_threshold nobody marked as user-set', GOAL_UNGATED_SUCCESS],
  ])('still asks for a target when the goal carries only %s', (_name, goal) => {
    seedPreRun(goal)
    render(<RealPanel />)
    openStrengthen()

    // The strip agrees there is nothing to show — so a silent card would be the
    // panel losing the ask entirely, not two surfaces disagreeing.
    expect(screen.getByTestId(`${STRIP}-none`)).toBeInTheDocument()
    expect(panelAsksForATarget()).toBe(true)
  })

  /**
   * ⚠ A STRING IN A FIELD TYPED `number | null`. `goal_threshold_raw` is
   * `number` on the node type and `string | number` at `GoalTargetSource`, and
   * the first cut let `'11'` reach `recommendation.goalThreshold` AS A STRING.
   * It is coerced at the owner now, so the card is correctly silent AND the
   * value that got there is a number.
   */
  /**
   * ⚠⚠ `Number('')` IS `0`, NOT `NaN` — so a blank arriving on the CEE branch
   * coerced to a finite zero and silenced the card on a model with no target.
   * The node branch was already safe (`resolveGoalTarget` guards blanks); this
   * pins the two that were not, plus the zero someone genuinely typed, which
   * must still count as a target.
   */
  it.each([
    ['a blank CEE threshold', { goal_threshold_raw: '' }, null],
    ['a whitespace CEE threshold', { goal_threshold_raw: '   ' }, null],
    ['a real zero, which IS a target', { goal_threshold_raw: 0 }, 0],
  ])('%s', (_n, ready, expected) => {
    seedPreRun(GOAL_WITHOUT_TARGET)
    useCanvasStore.setState({ ceeAnalysisReady: ready } as never)
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.recommendation.goalThreshold ?? null).toBe(expected)
  })

  it('coerces a string target rather than passing it through', () => {
    seedPreRun(GOAL_STRING_RAW)
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.recommendation.goalThreshold).toBe(11)
    expect(typeof result.current.recommendation.goalThreshold).toBe('number')
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
  it('the implication holds across every model: strip shows a target ⇒ no ask', () => {
    let antecedentSeen = 0
    for (const goal of [
      GOAL_WITH_TARGET, GOAL_WITHOUT_TARGET, GOAL_STRING_RAW,
      GOAL_OBSERVED_STATE_ONLY, GOAL_BLANK_RAW, GOAL_UNGATED_SUCCESS,
    ]) {
      cleanup()
      seedPreRun(goal)
      render(<RealPanel />)
      openStrengthen()

      const stripShowsATarget = screen.queryByTestId(`${STRIP}-value`) !== null
      if (stripShowsATarget) {
        antecedentSeen += 1
        expect(panelAsksForATarget()).toBe(false)
      }
    }
    /**
     * ⭐ THE ASSERTION FLOOR, AND WITHOUT IT THIS TEST WAS VACUOUS. An
     * `if (antecedent)` with no floor passes when the antecedent NEVER HOLDS —
     * proven by renaming the strip's `-value` testid, at which point this case
     * went green with its named claim never once evaluated. Two of the six
     * models must show a target; a change that stops the strip rendering one
     * now REDs here instead of silently emptying the test.
     */
    expect(antecedentSeen).toBe(2)
  })
})
