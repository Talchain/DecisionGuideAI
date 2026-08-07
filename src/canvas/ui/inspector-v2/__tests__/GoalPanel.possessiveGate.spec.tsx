/**
 * GoalPanel — THE POSSESSIVE GATE (ROADMAP 2.282), NOW OVER THE REAL SHAPE
 * (ROADMAP 2.296 item 5 / 2.282-C2).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS PANEL WAS DOING
 * ─────────────────────────────────────────────────────────────────────────
 * `GoalPanel` correctly refuses to be a CHOOSER — #496 deleted its
 * reach-around — and #556 gated its possessive copy on the selector's basis.
 * But the panel passed the WHOLE REPORT into `selectGoalProbability`, a
 * selector that expects ONE option-probability record. The live V5 mapper
 * stores every such record under `report.option_probabilities[optionId]`
 * (`mapV5AnalysisToReport`), and the report root carries none of the owned
 * fields — so on every real V5 payload `probGoal` was null, the Impact block
 * fell back to its empty state, and the entire #556 gate was DARK: correct
 * copy, wired to a read that could never produce a number.
 *
 * The panel now reads through `useNodeDisplayMetadata` — the established
 * pointer-owner for the goal surface family (the same hop `GoalNode` uses,
 * so the panel and the canvas cannot disagree about one report) — which
 * forwards `selectGoalProbability`'s decision verbatim.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIXTURE PROVENANCE — BUILT THROUGH THE REAL MAPPER (the named lesson)
 * ─────────────────────────────────────────────────────────────────────────
 * The previous fixtures fabricated ROOT-LEVEL probability fields
 * (`{ probability_of_joint_goal: 0.0054 }` on the report itself) — a shape NO
 * producer emits — which is exactly how a green suite certified a dark gate.
 * This estate has now paid for that lesson three times. Every V5 fixture here
 * is produced by the REAL `mapV5AnalysisToReport` over an analysis block
 * whose per-option shape is the witnessed one (2026-08-01,
 * `witness-2258-raw/run1b/`: joint present, goal absent, unconstrained).
 *
 * ⚠ ONE DECLARED DEPARTURE, same as `useNodeDisplayMetadata.goalBasis.spec.ts`:
 * the witnessed runs omit `robustness.recommended_option_id` (the separately
 * rowed 2.275 pointer gap, during which the goal surfaces honestly show no
 * figure). These fixtures supply the pointer so the gate under test is
 * EXECUTED; the 2026-07-31 witnessed payload
 * (`cee-analysis-turn-probe2154-2026-07-31.json`) carries the pointer for
 * real, so this is a live shape, not an invention.
 *
 * ⚠ THE CONSTRAINED FIXTURE CANNOT COME FROM THIS MAPPER, AND SAYS SO. The V5
 * mapper never emits per-option `constraint_analysis` (seam 2 of UI-SEM-088
 * is constant-gated in the V4 responseMapper). The constrained positive
 * control therefore uses the INTERNAL post-mapper record shape directly,
 * declared as such — it pins the panel's basis-narrowing, not a V5 wire shape.
 *
 * The gate is scoped to `joint_goal_substituted` ONLY. `joint_goal_
 * constrained` — the user's own goal AND their own limits — keeps the
 * possessive, and the last test pins that so a blanket copy deletion fails.
 *
 * RED-first (2.296 item 5): at pristine tip 925eb818 every PRESENCE assertion
 * on a mapper-built report fails — the panel renders no probability at all.
 *
 * Scope limit (trap 3): jsdom pins string presence/absence only.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'
import { selectGoalProbability } from '../../../../components/results/utils/selectGoalProbability'
import { GOAL_ANCHOR_COPY } from '../../../../components/results/utils/goalAnchorCopy'
import { GOAL_CONSTRAINT_COPY, GOAL_STRINGS } from '../inspectorStrings'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

const REAL_AUTH = { authenticated: true, user: { id: 'u-123', email: 'real@user.io' } }
const GOAL_NODE = {
  id: 'goal1',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'Grow Annual Revenue to £6,000,000' },
}

/**
 * A real V5 analysis block → report, through the REAL mapper. `optionEntry`
 * is spread into the recommended option's `option_comparison` entry — the
 * wire location the mapper actually reads the goal quantities from.
 */
function analysisReport(optionEntry: Record<string, unknown>) {
  const block = {
    type: 'analysis_result',
    summary: 'A summary',
    leading_option_id: 'opt_a',
    win_probabilities: { 'Option A': 0.6, 'Option B': 0.4 },
    enrichment: {
      option_comparison: [
        { option_id: 'opt_a', option_label: 'Option A', win_probability: 0.6, ...optionEntry },
        { option_id: 'opt_b', option_label: 'Option B', win_probability: 0.4 },
      ],
      robustness: { recommended_option_id: 'opt_a', display_verdict: 'fragile' },
    },
  } as unknown as AnalysisResultBlock
  return mapV5AnalysisToReport(block) as unknown as Record<string, unknown>
}

/** The witnessed substituted shape: joint present, goal absent, unconstrained. */
const SUBSTITUTED_REPORT = analysisReport({
  probability_of_joint_goal: 0.0054,
  goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
})

/** The same panel on a run that carries a REAL goal probability. */
const REAL_GOAL_REPORT = analysisReport({
  probability_of_goal: 0.55,
  probability_of_joint_goal: 0.0054,
})

/**
 * The CONSTRAINED joint case — possessive earned, must survive. INTERNAL
 * post-mapper shape, declared above: the V5 mapper cannot emit per-option
 * `constraint_analysis`, so this pins the panel's basis-narrowing only.
 */
const CONSTRAINED_REPORT = {
  option_probabilities: {
    opt_a: {
      probability_of_joint_goal: 0.42,
      constraint_analysis: { constraints: [{ id: 'c1' }] },
      confidence: 0.5,
    },
  },
  robustness: { recommended_option_id: 'opt_a', display_verdict: 'fragile' },
}

/** The record the panel's read must land on. */
function recordOf(report: Record<string, unknown>) {
  return (report.option_probabilities as Record<string, unknown>).opt_a as Parameters<
    typeof selectGoalProbability
  >[0]
}

function setStore(report: Record<string, unknown>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [GOAL_NODE],
    edges: [],
    goalThreshold: 0.8,
    goalConstraints: null,
    results: { status: 'complete', report },
  } as any)
}

function renderPanel() {
  return render(
    <GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />,
  )
}

describe('GoalPanel — possessive gate on a substituted joint goal figure (2.282, real shape per 2.296 item 5)', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReset()
    vi.mocked(useAuth).mockReturnValue(REAL_AUTH as unknown as ReturnType<typeof useAuth>)
  })

  it('control: the MAPPER-BUILT fixtures drive the selector to the basis this suite claims', () => {
    // Anti-vacuity (trap 13) — and this time the control also proves the REAL
    // mapper writes the owned fields where the panel's read must look.
    const sub = selectGoalProbability(recordOf(SUBSTITUTED_REPORT))
    expect(sub.basis).toBe('joint_goal_withheld')
    expect(sub.mayUsePossessiveGoalFraming).toBe(false)
    // ⭐ L62: the identity 2.296 pinned here (`goalProbability ===
    // jointGoalProbability`) is precisely the substitution, and it is gone.
    // The joint quantity survives for the panel's own labelled row; the
    // goal-fit slot is empty.
    expect(sub.goalProbability).toBeNull()
    expect(sub.jointGoalProbability).toBe(0.0054)

    expect(selectGoalProbability(recordOf(REAL_GOAL_REPORT)).basis).toBe('goal_probability')
    expect(selectGoalProbability(recordOf(CONSTRAINED_REPORT)).basis).toBe(
      'joint_goal_constrained',
    )
  })

  /**
   * ⭐ AMENDED BY L62. 2.296 proved the gate was no longer dark by asserting
   * the substituted figure RENDERED (re-voiced). L60 §5–§8 showed the figure
   * itself is the untruth, so the panel now renders no goal-fit figure at all
   * on this basis. Both halves of the original assertion — the possessive one
   * and the re-voiced one — must now be absent.
   */
  it('L62: the substituted figure does not render at all off the real mapper shape', () => {
    setStore(SUBSTITUTED_REPORT)
    const { container } = renderPanel()
    const text = container.textContent ?? ''

    expect(text).not.toContain('chance of reaching this target')
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('1%', true))
    expect(text).not.toContain('1% chance')
  })

  it('L62: the Impact readout says neither "chance of success" nor the withheld phrase over a joint-only run', () => {
    setStore(SUBSTITUTED_REPORT)
    const { container } = renderPanel()
    const text = container.textContent ?? ''

    expect(text).not.toContain('chance of success')
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('1%', true))
  })

  it('L62 — THE SELF-CONTRADICTION, resolved by subtraction: the Impact block states ZERO claims about the withheld number', () => {
    // 2.283 fixed one-number-two-voices by picking the honest voice. L62 fixes
    // it by removing the number, so the honest count is zero. The positive
    // controls below are what stop that reading as "the panel went blank".
    setStore(SUBSTITUTED_REPORT)
    const { container } = renderPanel()

    const impact = container.querySelector('[data-panel-group="impact"]')
    expect(impact).not.toBeNull()
    const text = impact?.textContent ?? ''

    expect(text).not.toContain('chance of success')
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('1%', true))
    // The panel's own honest-absence string for this block.
    expect(text).toContain(GOAL_STRINGS.impactUnavailable)
  })

  it('positive control: a REAL probability_of_goal KEEPS the possessive wording on BOTH sites', () => {
    setStore(REAL_GOAL_REPORT)
    const { container } = renderPanel()
    const text = container.textContent ?? ''

    expect(text).toContain('55% chance of reaching this target based on the current model.')
    expect(text).toContain('55% chance of success')
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('55%', true))
    // The joint line is a genuinely DIFFERENT quantity here, so it stays.
    expect(text).toContain('Chance of hitting every target')
  })

  it('positive control: the CONSTRAINED joint basis KEEPS the possessive wording (the gate is basis-scoped, not joint-scoped)', () => {
    setStore(CONSTRAINED_REPORT)
    const { container } = renderPanel()
    const text = container.textContent ?? ''

    expect(text).toContain('42% chance of success')
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('42%', true))
  })

  it('L62 — techMode: the diagnostic states NO goal field for a withheld run, and above all does not name `probability_of_goal`', () => {
    // 2.282's fix was to stop the tech-mode line calling the substituted value
    // `probability_of_goal` — "the most literally false line in the block, and
    // the one a tech-mode reader would trust most". With no value to diagnose,
    // the line is gone. Both false spellings are pinned absent, so a
    // regression in either direction REDs.
    setStore(SUBSTITUTED_REPORT)
    const { container } = render(
      <GoalPanel nodeId="goal1" techMode onClose={() => {}} onNavigate={() => {}} />,
    )
    const text = container.textContent ?? ''

    expect(text).not.toContain('System: probability_of_goal:')
    expect(text).not.toContain(
      'probability_of_joint_goal (substituted for absent probability_of_goal)',
    )
  })

  it('honest absence: WITHOUT the producer pointer the panel shows no figure (the 2.275 posture, same as the canvas)', () => {
    // Strip the pointer the fixtures add: the hook never reaches the selector
    // and the panel must fabricate nothing — the same honest state GoalNode
    // shows on the witnessed pointer-less runs.
    const report = analysisReport({
      probability_of_joint_goal: 0.0054,
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
    })
    delete (report.robustness as Record<string, unknown>).recommended_option_id
    setStore(report)
    const { container } = renderPanel()
    const text = container.textContent ?? ''
    expect(text).not.toContain('chance of success')
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('1%', true))
  })
})

/**
 * ROADMAP 2.283 — the #556 review rowables, over the real shape.
 *
 * #556 suppressed the Impact block's duplicate under substitution. The SAME
 * sentence in the Constraints section is gated on the STORE-level
 * `goalConstraints` — independent of the basis — so on the live posture
 * (user constraints defined, run substituted) it restated the suppressed
 * number one section down.
 */
describe('GoalPanel — the Constraints-section restatement (ROADMAP 2.283, real shape)', () => {
  function setStoreWithConstraints(report: Record<string, unknown>) {
    const state = useCanvasStore.getState()
    useCanvasStore.setState({
      ...state,
      nodes: [GOAL_NODE],
      edges: [],
      goalThreshold: 0.8,
      goalConstraints: [{ id: 'c1', label: 'Stay under budget', value: 100 }],
      results: { status: 'complete', report },
    } as any)
  }

  const JOINT_LINE = GOAL_CONSTRAINT_COPY.jointProbability

  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReset()
    vi.mocked(useAuth).mockReturnValue(REAL_AUTH as unknown as ReturnType<typeof useAuth>)
  })

  it('control: the Constraints section actually renders for these fixtures', () => {
    setStoreWithConstraints(REAL_GOAL_REPORT)
    const { container } = renderPanel()
    expect(container.textContent ?? '').toContain('Stay under budget')
  })

  /**
   * ⭐ AMENDED BY L62, AND THE DIRECTION REVERSES — read this one carefully.
   *
   * 2.283 SUPPRESSED this line under substitution, because the Impact block
   * above was already stating the identical number in the honest voice and two
   * findings from one measurement is a lie of arithmetic. That reasoning was
   * entirely contingent on the substitution: `goalProbability ===
   * jointGoalProbability` BY CONSTRUCTION was the whole argument.
   *
   * With the substitution withheld, the Impact block states nothing, so there
   * is no duplicate — and the joint quantity is exactly the thing this section
   * is FOR. It is the one surface where the figure is honestly labelled as
   * what it is: P(all your limits met), not P(you reach your target). So it
   * comes BACK, and this test pins its presence rather than its absence.
   */
  it('L62: the Constraints section DOES state the joint figure under its own honest label — the goal-fit slot is what was withheld, not the quantity', () => {
    setStoreWithConstraints(SUBSTITUTED_REPORT)
    const { container } = renderPanel()
    const text = container.textContent ?? ''

    expect(text).toContain('Stay under budget')
    expect(text).toContain(JOINT_LINE)
    // …and the goal-fit claim it used to be duplicating is gone, so this is
    // one statement of one measurement, not two.
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('1%', true))
    expect(text).not.toContain('chance of success')
  })

  it('positive control: with constraints defined, a REAL probability_of_goal KEEPS the Constraints line', () => {
    setStoreWithConstraints(REAL_GOAL_REPORT)
    expect(renderPanel().container.textContent ?? '').toContain(JOINT_LINE)
  })

  it('positive control: the CONSTRAINED basis KEEPS the Constraints line (basis-scoped, not joint-scoped)', () => {
    // COUNTED, NOT `toContain` — both sites must render on this basis, so the
    // count is 2 and dropping either one REDs (the mutation lesson recorded in
    // this file's previous revision).
    setStoreWithConstraints(CONSTRAINED_REPORT)
    const text = renderPanel().container.textContent ?? ''
    expect(text.split(JOINT_LINE).length - 1).toBe(2)
  })

  it('DEDUP: both sites render the REGISTER string — neither re-types the literal', () => {
    // DERIVED guard, not a mirror (trap 12): the expectation is the REGISTER
    // VALUE. Re-type either site with different wording and the count drops to
    // 1; change the register and both sites move together.
    setStoreWithConstraints(REAL_GOAL_REPORT)
    const text = renderPanel().container.textContent ?? ''
    expect(text.split(JOINT_LINE).length - 1).toBe(2)
  })
})
