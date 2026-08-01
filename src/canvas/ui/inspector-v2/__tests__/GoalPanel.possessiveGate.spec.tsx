/**
 * GoalPanel — THE POSSESSIVE GATE (ROADMAP 2.282).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS PANEL WAS DOING
 * ─────────────────────────────────────────────────────────────────────────
 * `GoalPanel` correctly refuses to be a CHOOSER — #496 deleted its
 * reach-around and it now calls `selectGoalProbability` and renders what it
 * is given. But it was still a NARRATOR: it destructured `.goalProbability`
 * and `.jointGoalProbability` and walked straight past `.basis`, so on a
 * substituted run it rendered the joint figure as
 *
 *   ":278  {N}% chance of reaching this target based on the current model."
 *   ":505  {N}% chance of success"
 *
 * — possessive goal framing over a number whose owner had published
 * `mayUsePossessiveGoalFraming: false`.
 *
 * ⚠ AND IT CONTRADICTED ITSELF ABOUT THE SAME NUMBER. Under substitution the
 * selector returns `goalProbability === jointGoalProbability` BY
 * CONSTRUCTION (`goalProbabilityIsJoint ⇒ goalProbability = jointGoalProb`).
 * So the Impact block stated one value twice, in two incompatible voices:
 * "{N}% chance of success" directly above "Chance of hitting every target:
 * {N}%". A reader had no way to tell those were the same measurement — and
 * exactly one of the two sentences was true. That is the sharpest form of
 * this defect anywhere in the estate, and it gets its own test below.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIXTURE PROVENANCE
 * ─────────────────────────────────────────────────────────────────────────
 * `probability_of_joint_goal: 0.0054` with no `goal_probability` and no
 * `constraint_analysis` is the witnessed staging shape (2026-08-01,
 * `witness-2258-raw/run1b/`), where CEE left `goal_threshold_frame`
 * unstamped and ISL therefore refused `probability_of_goal` outright.
 *
 * The gate is scoped to `joint_goal_substituted` ONLY. `joint_goal_
 * constrained` — the user's own goal AND their own limits — keeps the
 * possessive, and the last test pins that so a blanket copy deletion fails.
 *
 * RED-first: tests 2, 3 and 4 fail at `fef179ce`.
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

/** The witnessed substituted report: joint present, goal absent, unconstrained. */
const SUBSTITUTED_REPORT = {
  probability_of_joint_goal: 0.0054,
  goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
  meta: { n_samples: 10000 },
}

/** The same panel on a run that carries a REAL goal probability. */
const REAL_GOAL_REPORT = {
  probability_of_goal: 0.55,
  probability_of_joint_goal: 0.0054,
  meta: { n_samples: 10000 },
}

/** The CONSTRAINED joint case — possessive earned, must survive. */
const CONSTRAINED_REPORT = {
  probability_of_joint_goal: 0.42,
  constraint_analysis: { constraints: [{ id: 'c1' }] },
  meta: { n_samples: 10000 },
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

describe('GoalPanel — possessive gate on a substituted joint goal figure (ROADMAP 2.282)', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReset()
    vi.mocked(useAuth).mockReturnValue(REAL_AUTH as unknown as ReturnType<typeof useAuth>)
  })

  it('control: each fixture drives the selector to the basis this suite claims for it', () => {
    // Anti-vacuity (trap 13) — without this, every absence assertion below
    // could pass because the fixture stopped reaching the branch under test.
    const sub = selectGoalProbability(SUBSTITUTED_REPORT)
    expect(sub.basis).toBe('joint_goal_substituted')
    expect(sub.mayUsePossessiveGoalFraming).toBe(false)
    // The identity that makes the two Impact sentences the SAME number.
    expect(sub.goalProbability).toBe(sub.jointGoalProbability)

    expect(selectGoalProbability(REAL_GOAL_REPORT).basis).toBe('goal_probability')
    expect(selectGoalProbability(CONSTRAINED_REPORT).basis).toBe('joint_goal_constrained')
  })

  it('RED-first: the success-target line does NOT say "chance of reaching this target" over a substituted joint figure', () => {
    setStore(SUBSTITUTED_REPORT)
    const { container } = renderPanel()
    const text = container.textContent ?? ''

    expect(text).not.toContain('chance of reaching this target')
    // Renamed, not removed — the register's compact readout, with the panel's
    // existing "current model" qualifier kept.
    expect(text).toContain(`${GOAL_ANCHOR_COPY.phrase('1%', true)}, based on the current model.`)
  })

  it('RED-first: the Impact readout does NOT say "chance of success" over a substituted joint figure', () => {
    setStore(SUBSTITUTED_REPORT)
    const { container } = renderPanel()
    const text = container.textContent ?? ''

    expect(text).not.toContain('chance of success')
    expect(text).toContain(GOAL_ANCHOR_COPY.phrase('1%', true))
  })

  it('RED-first — THE SELF-CONTRADICTION: the Impact block states ONE claim about the substituted number, not two incompatible ones', () => {
    setStore(SUBSTITUTED_REPORT)
    const { container } = renderPanel()

    // Scoped to the IMPACT group specifically — `PanelGroup` renders
    // `<section data-panel-group={kind}>`, so this is a real DOM anchor, not
    // a guess. The scoping matters: the honest readout legitimately appears
    // in the "Your input" group TOO (the success-target line), and a
    // whole-panel count would conflate two different surfaces with the
    // duplication inside one of them.
    const impact = container.querySelector('[data-panel-group="impact"]')
    expect(impact).not.toBeNull()
    const text = impact?.textContent ?? ''

    // Before the fix this ONE block rendered "1% chance of success" AND
    // "Chance of hitting every target: 1%" — the same measurement asserted
    // twice, once truthfully and once not.
    expect(text).not.toContain('chance of success')
    expect(text).not.toContain('Chance of hitting every target')

    // Exactly one goal-attainment claim survives here, and it names the
    // quantity the number actually is.
    const honest = GOAL_ANCHOR_COPY.phrase('1%', true)
    expect(text.split(honest).length - 1).toBe(1)
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

  it('techMode: the diagnostic names the field the number ACTUALLY is under substitution', () => {
    // The most literally false line in the block, and the one a tech-mode
    // reader would trust most: it labelled the value `probability_of_goal`
    // when `probability_of_goal` is precisely the field ISL refused to emit.
    setStore(SUBSTITUTED_REPORT)
    const { container } = render(
      <GoalPanel nodeId="goal1" techMode onClose={() => {}} onNavigate={() => {}} />,
    )
    const text = container.textContent ?? ''

    expect(text).toContain('probability_of_joint_goal (substituted for absent probability_of_goal)')
    expect(text).not.toContain('System: probability_of_goal:')
  })
})
