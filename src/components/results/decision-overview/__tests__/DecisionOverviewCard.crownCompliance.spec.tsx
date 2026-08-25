/**
 * STEP 6, SECOND HALF — THE USER SEES WHETHER THEIR STATED LIMIT WAS MET.
 *
 * ── WHAT THIS CLOSES ────────────────────────────────────────────────────────
 * `DecisionOverviewCard.statedLimits.spec.tsx` beside this file closed step 6's
 * FIRST half: the limit the user stated is visible on the results surface. The
 * card was then "deliberately silent about COMPLIANCE", on the recorded grounds
 * that PLoT's `constraints_status` is stripped on the CEE→UI hop.
 *
 * That reasoning was right about `constraints_status` and does NOT hold for the
 * field this suite exercises. PLoT #338 (staging `e19ac506`) emits
 * `robustness.recommended_option_compliance` + `_reason` UNCONDITIONALLY, and
 * CEE keep-lists `robustness` WHOLE (`compose.ts:723`) with a shallow keep plus
 * a deep DENY-strip (`compose.ts:1079`), so the members ride through — verified
 * at the CEE bytes, and at the deployed bundle, in the lane report. They were
 * dropped inside THIS repo, at the two mapper keep-lists, and read by nothing.
 *
 * ── WHAT THE PRODUCER OWNS ──────────────────────────────────────────────────
 * The reason strings below are PLoT's, verbatim
 * (`src/routes/v2/crown-eligibility.ts`, `CROWN_COMPLIANCE_REASONS`). The UI
 * authors no copy for a verdict, so every assertion on screen text is an
 * assertion that the producer's sentence survived unedited.
 *
 * ── BINDING ─────────────────────────────────────────────────────────────────
 * Assertions bind by EXACT testid and EXACT enum value carried on a
 * `data-verdict` attribute — never by a tone or a truthiness predicate another
 * state could satisfy. The suite deliberately drives BOTH a rendered state and
 * a silent one so a render broken for all states is distinguishable from a
 * render broken for one (the discriminating mutant pair in the lane report).
 *
 * ⚠ PRECONDITION PINNING. Every case asserts the STATED LIMIT is on screen
 * BEFORE asserting anything about compliance. Without that, a suite could reach
 * the right verdict through a card that failed to render the limits region at
 * all, and pass with zero coverage of the pairing this step is about.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DecisionOverviewCard } from '../DecisionOverviewCard'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'

const READY = { status: 'ready', options: [{ id: 'o1' }], goal_node_id: 'g1' }
const GOAL_NODE_WITH_MEASURE = {
  id: 'g1',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'G', threshold_source: 'user', success_threshold: 20 },
}

/** The same £50,000 cap the first-half suite uses — one chain, one fixture. */
const BUDGET_CAP = {
  constraint_id: 'constraint_cost_max',
  node_id: 'n_cost',
  label: 'Budget',
  operator: '<=' as const,
  value: 50000,
  unit: '£',
  source_quote: 'the budget cannot exceed £50,000',
  provenance: 'explicit' as const,
}

/** PLoT's own table, quoted — never authored here. */
const REASON = {
  not_applicable: 'no limits were set for this decision',
  compliant: 'this option met every limit you set, in all the scenarios we tested',
  uncertain: 'this option met your limits in some scenarios but not others',
  unverified: 'we could not check this option against your limits on a reliable scale',
  not_assessed: 'we could not check every limit you set on this run',
  no_eligible_option: 'no option met the limits you set, so none is being recommended',
} as const

/**
 * Seed the card AND the raw analysis response.
 *
 * `rawV2Response` is the FRESH-RUN seam — permissive, carries the producer's
 * robustness object verbatim (`analysisEnrichmentShape.ts` casts it whole). The
 * mapped `results.report.robustness` is the saved/hydrated fallback, exercised
 * separately below.
 */
function seed(opts: {
  goalConstraints: unknown
  rawRobustness?: Record<string, unknown> | null
  reportRobustness?: Record<string, unknown> | null
}) {
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
    goalConstraints: opts.goalConstraints,
    currentBriefText: null,
    graphHealth: null,
    rawV2Response: opts.rawRobustness ? { robustness: opts.rawRobustness } : null,
    results: {
      status: 'complete',
      report: {
        summary: 'A leads on the modelled outcome.',
        ...(opts.reportRobustness ? { robustness: opts.reportRobustness } : {}),
      },
    },
  } as never)
}

function openBrief() {
  fireEvent.click(screen.getByTestId('brief-bar'))
}

/**
 * PRECONDITION. Assert we are in the state the case claims to be in — the
 * stated limit is on screen — before reading anything about compliance.
 */
function expectStatedLimitVisible() {
  expect(screen.getByTestId('stated-limits')).toBeInTheDocument()
  expect(screen.getByTestId('stated-limit-constraint_cost_max')).toHaveTextContent(
    'Budget ≤ £50,000',
  )
}

function renderWith(rawRobustness: Record<string, unknown> | null) {
  seed({ goalConstraints: [BUDGET_CAP], rawRobustness })
  render(<DecisionOverviewCard title="Take £4m out of opex" />)
  openBrief()
  expectStatedLimitVisible()
}

describe('step 6 — the stated limit is paired with the producer’s compliance verdict', () => {
  beforeEach(() => {
    seed({ goalConstraints: null })
  })

  it('⭐ no_eligible_option — the withheld crown is EXPLAINED, never an empty slot', () => {
    renderWith({
      // No recommended_option_id — the producer omits it in this state, and
      // that absence is exactly why the reason must carry the message.
      recommended_option_compliance: 'no_eligible_option',
      recommended_option_compliance_reason: REASON.no_eligible_option,
    })

    const row = screen.getByTestId('crown-compliance')
    expect(row).toHaveAttribute('data-verdict', 'no_eligible_option')
    expect(row).toHaveTextContent(REASON.no_eligible_option)
  })

  it('OPPOSITE-DIRECTION TWIN — a compliant run still reads as compliant', () => {
    renderWith({
      recommended_option_id: 'opt_a',
      recommended_option_compliance: 'compliant',
      recommended_option_compliance_reason: REASON.compliant,
    })

    const row = screen.getByTestId('crown-compliance')
    expect(row).toHaveAttribute('data-verdict', 'compliant')
    expect(row).toHaveTextContent(REASON.compliant)
  })

  it('⭐ uncertain renders as UNKNOWN and never as a breach', () => {
    renderWith({
      recommended_option_id: 'opt_a',
      recommended_option_compliance: 'uncertain',
      recommended_option_compliance_reason: REASON.uncertain,
    })

    const row = screen.getByTestId('crown-compliance')
    expect(row).toHaveAttribute('data-verdict', 'uncertain')
    expect(row).toHaveAttribute('data-tone', 'unknown')
    // Bound in BOTH directions: "not negative" alone would also pass for a
    // positive render, which would be the opposite falsehood.
    expect(row).not.toHaveAttribute('data-tone', 'negative')
    expect(row).not.toHaveAttribute('data-tone', 'positive')
    expect(row).toHaveTextContent(REASON.uncertain)
  })

  it('⭐ unverified renders as UNKNOWN — no claim in EITHER direction', () => {
    renderWith({
      recommended_option_id: 'opt_a',
      recommended_option_compliance: 'unverified',
      recommended_option_compliance_reason: REASON.unverified,
    })

    const row = screen.getByTestId('crown-compliance')
    expect(row).toHaveAttribute('data-verdict', 'unverified')
    expect(row).toHaveAttribute('data-tone', 'unknown')
    expect(row).toHaveTextContent(REASON.unverified)
  })

  it('⭐ not_assessed renders, and does NOT say "no limits were set"', () => {
    renderWith({
      recommended_option_id: 'opt_a',
      recommended_option_compliance: 'not_assessed',
      recommended_option_compliance_reason: REASON.not_assessed,
    })

    const row = screen.getByTestId('crown-compliance')
    expect(row).toHaveAttribute('data-verdict', 'not_assessed')
    expect(row).toHaveTextContent(REASON.not_assessed)
    // The falsehood PLoT #338 fixed one layer up must not be recreated here.
    expect(row).not.toHaveTextContent(REASON.not_applicable)
  })
})

describe('step 6 — the surface stays silent where the producer makes no claim', () => {
  beforeEach(() => {
    seed({ goalConstraints: null })
  })

  it('not_applicable renders NO compliance row — the limits still render', () => {
    renderWith({
      recommended_option_compliance: 'not_applicable',
      recommended_option_compliance_reason: REASON.not_applicable,
    })

    // The precondition above already proved the limits region is present, so
    // this null is about the compliance row and not about a card that failed
    // to render.
    expect(screen.queryByTestId('crown-compliance')).toBeNull()
  })

  it('an OLDER producer (field absent) renders no compliance row', () => {
    renderWith({ recommended_option_id: 'opt_a', level: 'high' })
    expect(screen.queryByTestId('crown-compliance')).toBeNull()
  })

  it('an UNRECOGNISED future token renders no compliance row', () => {
    renderWith({
      recommended_option_compliance: 'partially_compliant',
      recommended_option_compliance_reason: 'something this build has never heard of',
    })
    expect(screen.queryByTestId('crown-compliance')).toBeNull()
  })

  it('a verdict with NO producer reason renders no compliance row', () => {
    renderWith({ recommended_option_compliance: 'no_eligible_option' })
    expect(screen.queryByTestId('crown-compliance')).toBeNull()
  })
})

describe('step 6 — the saved/hydrated report is the fallback seam', () => {
  beforeEach(() => {
    seed({ goalConstraints: null })
  })

  it('reads the mapped report slot when the raw response is absent', () => {
    // The hydrated path: no fresh rawV2Response, but a persisted report that
    // travelled through the mapper keep-list this lane extended.
    seed({
      goalConstraints: [BUDGET_CAP],
      rawRobustness: null,
      reportRobustness: {
        recommended_option_compliance: 'no_eligible_option',
        recommended_option_compliance_reason: REASON.no_eligible_option,
      },
    })
    render(<DecisionOverviewCard title="Take £4m out of opex" />)
    openBrief()
    expectStatedLimitVisible()

    const row = screen.getByTestId('crown-compliance')
    expect(row).toHaveAttribute('data-verdict', 'no_eligible_option')
    expect(row).toHaveTextContent(REASON.no_eligible_option)
  })

  it('the FRESH raw response wins over a stale mapped report', () => {
    // Precedence must match `display_verdict`'s (`raw ?? mapped`), or a
    // hydrated verdict from a previous run would outrank the current one.
    seed({
      goalConstraints: [BUDGET_CAP],
      rawRobustness: {
        recommended_option_compliance: 'compliant',
        recommended_option_compliance_reason: REASON.compliant,
      },
      reportRobustness: {
        recommended_option_compliance: 'no_eligible_option',
        recommended_option_compliance_reason: REASON.no_eligible_option,
      },
    })
    render(<DecisionOverviewCard title="Take £4m out of opex" />)
    openBrief()
    expectStatedLimitVisible()

    const row = screen.getByTestId('crown-compliance')
    expect(row).toHaveAttribute('data-verdict', 'compliant')
  })
})

/**
 * ⭐ THE GATE IS "DID THE USER SET LIMITS", NOT "CAN WE FORMAT THEM".
 *
 * Review finding on this PR. The row was first gated on `statedLimits.length > 0`.
 * `selectStatedLimits` (statedLimits.ts:96-98) SKIPS any constraint whose
 * `value` is non-finite or whose `operator` is empty, so that gate silently
 * suppressed the disclosure whenever the user's limit was unformattable — and
 * `not_assessed` ("we could not check every limit you set on this run") is
 * EXACTLY the state a malformed or withheld constraint produces. The gate was
 * quietest precisely where the producer was speaking loudest.
 *
 * Both directions are pinned here, because widening naively would reopen the
 * opposite falsehood.
 */
const MALFORMED_NON_FINITE = {
  constraint_id: 'constraint_broken_value',
  node_id: 'n_cost',
  label: 'Programme cost',
  operator: '<=' as const,
  value: Number.NaN, // skipped by selectStatedLimits — unformattable
  unit: '£',
}
const MALFORMED_EMPTY_OPERATOR = {
  constraint_id: 'constraint_broken_operator',
  node_id: 'n_margin',
  label: 'Gross margin',
  operator: '' as const, // skipped by selectStatedLimits
  value: 78,
  unit: '%',
}

describe('step 6 — a limit we cannot FORMAT is still a limit the user SET', () => {
  beforeEach(() => {
    seed({ goalConstraints: null })
  })

  it('⭐ non-finite value + not_assessed — the disclosure RENDERS, though no limit can be listed', () => {
    seed({
      goalConstraints: [MALFORMED_NON_FINITE],
      rawRobustness: {
        recommended_option_compliance: 'not_assessed',
        recommended_option_compliance_reason: REASON.not_assessed,
      },
    })
    render(<DecisionOverviewCard title="Take £4m out of opex" />)
    openBrief()

    // PRECONDITION, pinned: this is genuinely the unformattable case — the
    // limits region is ABSENT, so the assertion below is about the compliance
    // gate and not about a card that happened to render limits anyway.
    expect(screen.queryByTestId('stated-limits')).toBeNull()

    const row = screen.getByTestId('crown-compliance')
    expect(row).toHaveAttribute('data-verdict', 'not_assessed')
    expect(row).toHaveTextContent(REASON.not_assessed)
  })

  it('⭐ empty operator + no_eligible_option — the withheld crown is still explained', () => {
    seed({
      goalConstraints: [MALFORMED_EMPTY_OPERATOR],
      rawRobustness: {
        recommended_option_compliance: 'no_eligible_option',
        recommended_option_compliance_reason: REASON.no_eligible_option,
      },
    })
    render(<DecisionOverviewCard title="Take £4m out of opex" />)
    openBrief()

    expect(screen.queryByTestId('stated-limits')).toBeNull()
    const row = screen.getByTestId('crown-compliance')
    expect(row).toHaveAttribute('data-verdict', 'no_eligible_option')
    expect(row).toHaveTextContent(REASON.no_eligible_option)
  })

  it('OPPOSITE-DIRECTION TWIN — a well-formed limit still renders BOTH the limit and the verdict', () => {
    // Proves the widening did not trade the pairing away: where the limit CAN
    // be shown, it is still shown beside the verdict. That pairing is the whole
    // point of step 6.
    renderWith({
      recommended_option_compliance: 'not_assessed',
      recommended_option_compliance_reason: REASON.not_assessed,
    })
    expect(screen.getByTestId('stated-limit-constraint_cost_max')).toHaveTextContent(
      'Budget ≤ £50,000',
    )
    expect(screen.getByTestId('crown-compliance')).toHaveAttribute('data-verdict', 'not_assessed')
  })
})

describe('step 6 — the auto-synthesised-constraint falsehood stays suppressed', () => {
  beforeEach(() => {
    seed({ goalConstraints: null })
  })

  /**
   * ⚠ THE REASON THE GATE IS NOT SIMPLY "ALWAYS RENDER".
   *
   * PLoT synthesises a `'Goal target'` constraint (`auto_goal_threshold`,
   * run.ts:6035-6042) from the goal node's threshold when the user set NO
   * limits, and can then return `compliant` carrying "this option met every
   * limit YOU SET" — about limits nobody set. That synthesis happens inside
   * PLoT's run handler and never reaches this store, so `goalConstraints` is
   * genuinely empty in that case and this gate keeps the sentence off screen.
   *
   * A PLoT-side fix for the wording is commissioned separately. Until it lands,
   * THIS TEST IS LOAD-BEARING — deleting it reopens a producer falsehood.
   */
  it('⭐ NO user-set limits + compliant — renders NOTHING, even though a verdict arrived', () => {
    seed({
      goalConstraints: [],
      rawRobustness: {
        recommended_option_compliance: 'compliant',
        recommended_option_compliance_reason: REASON.compliant,
      },
    })
    render(<DecisionOverviewCard title="Take £4m out of opex" />)
    openBrief()

    expect(screen.queryByTestId('crown-compliance')).toBeNull()
  })

  it('null goalConstraints + compliant — renders NOTHING', () => {
    seed({
      goalConstraints: null,
      rawRobustness: {
        recommended_option_compliance: 'compliant',
        recommended_option_compliance_reason: REASON.compliant,
      },
    })
    render(<DecisionOverviewCard title="Take £4m out of opex" />)
    openBrief()

    expect(screen.queryByTestId('crown-compliance')).toBeNull()
  })

  it('DISCRIMINATING CONTROL — the SAME verdict WITH a user-set limit does render', () => {
    // Without this, the two nulls above could pass because the verdict is
    // unrenderable for some unrelated reason rather than because of the gate.
    renderWith({
      recommended_option_compliance: 'compliant',
      recommended_option_compliance_reason: REASON.compliant,
    })
    expect(screen.getByTestId('crown-compliance')).toHaveAttribute('data-verdict', 'compliant')
  })
})
