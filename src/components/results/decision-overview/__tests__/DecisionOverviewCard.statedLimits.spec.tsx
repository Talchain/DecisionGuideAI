/**
 * STEP 6 OF THE HARD-CONSTRAINT CHAIN — THE USER SEES THE LIMIT THEY STATED.
 *
 * ── THE GAP THIS PINS ───────────────────────────────────────────────────────
 * Steps 1-5 are closed: CEE mints `goal_constraints[]` from a stated limit,
 * transport preserves it, PLoT returns an honest verdict, and eligibility
 * consumes it (the leader claim is withheld and the limit named in chat).
 *
 * On the RESULTS surface, though, the limit itself was never shown. This card
 * rendered a COUNT — "1 limit captured" — and nothing else. A user who told
 * Olumi "the budget cannot exceed £50,000" could read the whole framing panel
 * and never see £50,000 on it.
 *
 * Derived at this tip, the complete set of live constraint renders was:
 *   · this card                     — the COUNT only
 *   · GoalNode (canvas badge)       — "{operator} {label}", no value
 *   · GoalPanel (inspector-v2)      — label + operator + value, but only after
 *                                     selecting the Goal node, inside a
 *                                     `<fieldset disabled>`
 *   · FactorNode                    — an aria/title string only
 * and the three components that DID render "{label} {operator} {value}" as
 * body copy (`SuccessTarget`, `DraftNotes`, `PreAnalysisPanel`) have ZERO
 * mount sites — dead code. Hence: on the surface where the recommendation is
 * read, the stated limit was absent.
 *
 * ── THE SEPARATION THIS SUITE ENFORCES ──────────────────────────────────────
 * The user's stated limit and the producer's computed probability are
 * different facts with different trust levels. The limit is trustworthy (the
 * user said it, CEE recorded it). The probabilities are gated OFF for cause.
 * This card shows the FIRST and must never state or imply the SECOND — see
 * `probability is never rendered` below, which seeds a constraint carrying a
 * probability and proves it does not reach the surface.
 *
 * ── BINDING ─────────────────────────────────────────────────────────────────
 * Every assertion binds to a limit BY ITS CONSTRAINT ID, never by a value
 * predicate another limit could satisfy. The fixture deliberately carries TWO
 * limits so that a render broken for one is distinguishable from a render
 * broken for all (the discriminating mutant pair recorded in the lane report).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DecisionOverviewCard } from '../DecisionOverviewCard'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'

/** The card is flag-gated; the chips only exist once it renders. */
const READY = { status: 'ready', options: [{ id: 'o1' }], goal_node_id: 'g1' }
const GOAL_NODE_WITH_MEASURE = {
  id: 'g1',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'G', threshold_source: 'user', success_threshold: 20 },
}

/**
 * Two limits, distinct on EVERY axis a lazy assertion might key on: different
 * ids, labels, operators, values and units. `probability` is present on the
 * first deliberately — it is the distrusted field, and it must not surface.
 */
const BUDGET_CAP = {
  constraint_id: 'constraint_cost_max',
  node_id: 'n_cost',
  label: 'Budget',
  operator: '<=' as const,
  value: 50000,
  unit: '£',
  probability: 0.92,
  source_quote: 'the budget cannot exceed £50,000',
  provenance: 'explicit' as const,
}
const MARGIN_FLOOR = {
  constraint_id: 'constraint_margin_min',
  node_id: 'n_margin',
  label: 'Gross margin',
  operator: '>=' as const,
  value: 78,
  unit: '%',
}
const REDUNDANCY_CAP = {
  constraint_id: 'constraint_redundancy_max',
  node_id: 'n_red',
  label: 'Compulsory redundancy rounds',
  operator: '<=' as const,
  value: 1,
}

function seed(goalConstraints: unknown) {
  localStorage.clear()
  localStorage.setItem('feature.decisionOverview', '1')
  useGuidanceStore.setState({ guidanceItems: [], _sendMessage: null } as never)
  useAskOlumiStore.setState({
    isOpen: false,
    context: '',
    draft: '',
    label: '',
    targetId: null,
    parameters: undefined,
    source: 'chip',
  })
  useCanvasStore.setState({
    ceeAnalysisReady: READY,
    goalThreshold: 20,
    nodes: [GOAL_NODE_WITH_MEASURE],
    goalConstraints,
    currentBriefText: null,
    graphHealth: null,
  } as never)
}

function openBrief() {
  fireEvent.click(screen.getByTestId('brief-bar'))
}

/**
 * Put the card in the POST-ANALYSIS state the mount gate guarantees
 * (`OutputsDock.tsx:3155` only mounts it once there is a report). This is what
 * makes `hasResult` true and therefore `autoExpand` false — i.e. the ordinary
 * success path, collapsed.
 */
function withCompletedAnalysis() {
  useCanvasStore.setState({
    results: { status: 'complete', report: { summary: 'A leads on the modelled outcome.' } },
  } as never)
}

describe('step 6 — the model shows the user the hard limit they stated', () => {
  beforeEach(() => {
    seed(null)
  })

  // ── TWIN A: no stated limit ⇒ nothing new renders ─────────────────────────
  describe('a model with NO stated limit is unchanged', () => {
    it('renders no stated-limits region at all', () => {
      seed(null)
      render(<DecisionOverviewCard title="Take £4m out of opex" />)
      openBrief()

      expect(screen.queryByTestId('stated-limits')).toBeNull()
    })

    it('renders no stated-limits region for an EMPTY constraint array', () => {
      seed([])
      render(<DecisionOverviewCard title="Take £4m out of opex" />)
      openBrief()

      expect(screen.queryByTestId('stated-limits')).toBeNull()
    })

    it('still reports the zero exactly as before, in the same words', () => {
      seed(null)
      render(<DecisionOverviewCard title="Take £4m out of opex" />)
      openBrief()

      // The pre-existing honesty fix (LINK-R1 C7) is untouched by this lane.
      expect(screen.getByTestId('brief-dim-constraints')).toHaveTextContent(
        'Nothing set as a hard limit',
      )
    })
  })

  // ── TWIN B: a stated limit ⇒ the user sees it ─────────────────────────────
  describe('a model WITH a stated limit shows it', () => {
    it('shows the £50,000 budget cap, bound by its constraint id', () => {
      seed([BUDGET_CAP, MARGIN_FLOOR])
      render(<DecisionOverviewCard title="Take £4m out of opex" />)
      openBrief()

      const row = screen.getByTestId('stated-limit-constraint_cost_max')
      expect(row).toHaveTextContent('Budget ≤ £50,000')
    })

    it('shows the 78% margin floor, bound by its OWN constraint id', () => {
      seed([BUDGET_CAP, MARGIN_FLOOR])
      render(<DecisionOverviewCard title="Take £4m out of opex" />)
      openBrief()

      const row = screen.getByTestId('stated-limit-constraint_margin_min')
      expect(row).toHaveTextContent('Gross margin ≥ 78%')
    })

    it('renders the region once both limits are present', () => {
      seed([BUDGET_CAP, MARGIN_FLOOR])
      render(<DecisionOverviewCard title="Take £4m out of opex" />)
      openBrief()

      expect(screen.getByTestId('stated-limits')).toBeInTheDocument()
    })
  })

  // ── CLAUSE 4: never state or imply a probability ──────────────────────────
  describe('the distrusted probability never reaches the surface', () => {
    it('does not render the constraint probability that rode in on the fixture', () => {
      // BUDGET_CAP carries `probability: 0.92`. Every rendering of it a reader
      // could mistake for a likelihood is pinned absent here.
      seed([BUDGET_CAP, MARGIN_FLOOR])
      render(<DecisionOverviewCard title="Take £4m out of opex" />)
      openBrief()

      const region = screen.getByTestId('stated-limits')
      expect(region).not.toHaveTextContent('92%')
      expect(region).not.toHaveTextContent('0.92')
      // The margin floor legitimately renders "78%" as the USER'S OWN UNIT, so
      // a blanket "no % anywhere" assertion would be wrong. Bind to the budget
      // row instead: it has no percentage of any kind to show.
      expect(screen.getByTestId('stated-limit-constraint_cost_max')).not.toHaveTextContent('%')
    })
  })

  // ── DEFENSIVE READS AT AN UNTYPED BOUNDARY ────────────────────────────────
  describe('a constraint that is not a statable limit is omitted, not guessed at', () => {
    it('omits a constraint whose value is missing', () => {
      seed([{ constraint_id: 'constraint_no_value', label: 'Headcount', operator: '<=' }])
      render(<DecisionOverviewCard title="Take £4m out of opex" />)
      openBrief()

      expect(screen.queryByTestId('stated-limit-constraint_no_value')).toBeNull()
      expect(screen.queryByTestId('stated-limits')).toBeNull()
    })

    it('shows the boundary alone when the producer sent no label', () => {
      seed([{ constraint_id: 'constraint_unlabelled', operator: '<=', value: 3, unit: 'count' }])
      render(<DecisionOverviewCard title="Take £4m out of opex" />)
      openBrief()

      const row = screen.getByTestId('stated-limit-constraint_unlabelled')
      // No invented name, no trailing unknown unit — just the limit.
      expect(row).toHaveTextContent('≤ 3')
      expect(row).not.toHaveTextContent('count')
    })
  })
})

/**
 * ⭐ THE CLOSURE CONDITION ITSELF — WITHOUT A CLICK.
 *
 * ── WHY THIS BLOCK EXISTS (the review finding, recorded) ────────────────────
 * The first cut of this lane rendered the limits ONLY inside
 * `{expanded && (…)}`. Post-analysis `hasResult` is structurally true, so
 * `autoExpand` collapses to `state === 'blocked'` — meaning on the ORDINARY
 * SUCCESS PATH (`state === 'ready'`) the card is COLLAPSED and the limit did
 * not render at all. Every test above passed because each one calls
 * `openBrief()` first.
 *
 * That is the exact criterion this lane used to disqualify `SuccessTarget`
 * ("only inside the default-collapsed T3 Advanced accordion") applied to the
 * rival and not to itself. A user who said "the budget cannot exceed £50,000"
 * and got a successful analysis saw the word "constraints" and no £50,000.
 *
 * ── WHY NOT SIMPLY MOVE THE BLOCK OUT OF `expanded` ─────────────────────────
 * Because that regresses the ratified ANSWER-FIRST gate: this card sits ABOVE
 * the results region, and on deployed `4d1e650b` the verdict sentence already
 * sat 573px down a 515px-tall region when this card auto-expanded. Adding the
 * limits list to the collapsed card would push the verdict down again.
 *
 * The limit is therefore named in the collapsed `brief-bar` NOTE, which
 * already renders and already occupies exactly one line.
 */
describe('the closure condition: a successful analysis shows the limit with NO click', () => {
  beforeEach(() => {
    seed(null)
  })

  it('names the stated limit on the COLLAPSED card, post-analysis, no interaction', () => {
    seed([BUDGET_CAP])
    withCompletedAnalysis()
    render(<DecisionOverviewCard title="Take £4m out of opex" />)

    // Deliberately NO openBrief() — this is the whole point.
    expect(screen.queryByTestId('stated-limits')).toBeNull()
    expect(screen.getByTestId('brief-bar')).toHaveTextContent('Budget ≤ £50,000')
  })

  it('names the first limit and discloses the count of the rest', () => {
    seed([BUDGET_CAP, MARGIN_FLOOR, REDUNDANCY_CAP])
    withCompletedAnalysis()
    render(<DecisionOverviewCard title="Take £4m out of opex" />)

    const bar = screen.getByTestId('brief-bar')
    // One complete limit is always visible; the rest are counted, never
    // truncated mid-value, so the bar stays exactly one line.
    expect(bar).toHaveTextContent('Budget ≤ £50,000')
    expect(bar).toHaveTextContent('+2 more')
  })

  it('POSITIVE CONTROL on the precondition: the card really is COLLAPSED here', () => {
    // Pins `autoExpand === false` post-analysis as a DELIBERATE recorded fact.
    // Without this, a future change to the default expansion would leave every
    // other test in this file green while the user saw nothing.
    seed([BUDGET_CAP])
    withCompletedAnalysis()
    render(<DecisionOverviewCard title="Take £4m out of opex" />)

    expect(screen.getByTestId('brief-bar')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('brief-dim-constraints')).toBeNull()
  })

  it('still shows nothing extra when there is no stated limit', () => {
    seed(null)
    withCompletedAnalysis()
    render(<DecisionOverviewCard title="Take £4m out of opex" />)

    expect(screen.getByTestId('brief-bar')).toHaveTextContent(
      'Goal, context, constraints and options',
    )
    expect(screen.queryByTestId('brief-bar-stated-limits')).toBeNull()
  })

  it('does NOT displace an urgent state note with a limit', () => {
    // `blocked` says "Resolve it before relying on the read" — a safety
    // instruction about trusting the result. A limit must never push that off
    // the collapsed bar. (`blocked` also auto-expands, so the full list is
    // visible there anyway.)
    seed([BUDGET_CAP])
    withCompletedAnalysis()
    useCanvasStore.setState({
      graphHealth: { issues: [{ severity: 'blocker' }] },
    } as never)
    render(<DecisionOverviewCard title="Take £4m out of opex" />)

    expect(screen.getByTestId('brief-bar')).toHaveTextContent(
      'Resolve it before relying on the read',
    )
    expect(screen.getByTestId('brief-bar')).not.toHaveTextContent('+1 more')
  })
})
