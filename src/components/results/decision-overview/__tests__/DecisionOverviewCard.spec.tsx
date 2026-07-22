/**
 * Wave 1 + parity O (Analysis-tab rebuild) — Decision overview card.
 *
 * Orientation surface: title + classification pills, framing quality, the
 * four brief-dimension chips, the brief-actions row, one framing question
 * and the persistent Actions menu. Live states: ready / needs-input /
 * unassessed from the wire plus the derived thin (missing success measure)
 * and blocked (blocker critique) — UI-SEM-079. Contradictory / unverified
 * (and fixture thin) remain stateOverride-only (plan review B3). Every
 * coaching ask routes through the Ask-Olumi drawer store — never an
 * invisible auto-send.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DecisionOverviewCard, OVERVIEW_COPY, deriveFramingQuestion } from '../DecisionOverviewCard'
import { REVIEW_BRIEF_ASK } from '../actionsCatalogue'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'

function flagOn() {
  localStorage.setItem('feature.decisionOverview', '1')
}

const READY = { status: 'ready', options: [{ id: 'o1' }], goal_node_id: 'g1' }
const NEEDS_INPUT = {
  status: 'needs_user_input',
  options: [],
  goal_node_id: 'g1',
  user_questions: ['What does success look like?', 'Which options are realistic?', 'Q3', 'Q4'],
}

/** Canvas-store baseline for the card's primitive selectors. */
function resetCanvas(overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    ceeAnalysisReady: null,
    goalThreshold: null,
    nodes: [],
    goalConstraints: null,
    currentBriefText: null,
    graphHealth: null,
    ...overrides,
  } as never)
}

function resetDrawer() {
  useAskOlumiStore.setState({
    isOpen: false,
    context: '',
    draft: '',
    label: '',
    targetId: null,
    parameters: undefined,
    source: 'chip',
  })
}

beforeEach(() => {
  localStorage.clear()
  resetCanvas()
  resetDrawer()
  useGuidanceStore.setState({ guidanceItems: [], _sendMessage: null } as never)
})

describe('DecisionOverviewCard — flag gate', () => {
  it('renders NOTHING when the flag is off (byte-identical pin)', () => {
    resetCanvas({ ceeAnalysisReady: READY, goalThreshold: 20 })
    const { container } = render(<DecisionOverviewCard title="Launch decision" />)
    expect(container.firstChild).toBeNull()
  })
})

describe('DecisionOverviewCard — ready state (live)', () => {
  beforeEach(() => {
    flagOn()
    // Ready requires BOTH the producer ready status AND a success measure
    // (UI-SEM-079: a missing measure derives thin).
    resetCanvas({ ceeAnalysisReady: READY, goalThreshold: 20 })
  })

  it('collapsed and quiet: meta label, title, framing-has-the-basics line', () => {
    render(<DecisionOverviewCard title="Launch decision" />)
    expect(screen.getByText('Decision overview')).toBeInTheDocument()
    expect(screen.getByText('Launch decision')).toBeInTheDocument()
    expect(screen.getByText('Framing has the basics')).toBeInTheDocument()
    // Collapsed by default: dimension chips hidden until expanded.
    expect(screen.queryByText('Constraints')).not.toBeInTheDocument()
    const bar = screen.getByTestId('brief-bar')
    expect(bar.tagName).toBe('BUTTON')
    expect(bar).toHaveAttribute('aria-expanded', 'false')
  })

  it('ready status dot is success green (colour-only dot vocabulary)', () => {
    render(<DecisionOverviewCard title="t" />)
    expect(screen.getByTestId('overview-status-dot').className).toContain('bg-success')
  })

  it('card chrome carries the prototype shadow token', () => {
    render(<DecisionOverviewCard title="t" />)
    expect(screen.getByTestId('decision-overview').className).toContain('shadow-1')
  })

  it('expands to the four canonical dimensions (Goal, Context, Constraints, Options)', () => {
    render(<DecisionOverviewCard title="Launch decision" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByTestId('brief-bar')).toHaveAttribute('aria-expanded', 'true')
    for (const dim of ['Goal', 'Context', 'Constraints', 'Options']) {
      expect(screen.getByText(dim)).toBeInTheDocument()
    }
  })

  it('never says "good framing" or implies objective correctness', () => {
    render(<DecisionOverviewCard title="t" />)
    expect(screen.queryByText(/good framing|good enough/i)).not.toBeInTheDocument()
  })

  it('falls back to the draft-decision title when the scenario is untitled', () => {
    render(<DecisionOverviewCard title={null} />)
    expect(screen.getByText(OVERVIEW_COPY.titleFallback)).toBeInTheDocument()
  })
})

describe('DecisionOverviewCard — classification pills (UI-SEM-077)', () => {
  beforeEach(() => {
    flagOn()
    resetCanvas({ ceeAnalysisReady: READY, goalThreshold: 20 })
  })

  it('renders all four dimensions fail-closed as "not set" when no signal exists', () => {
    render(<DecisionOverviewCard title="t" />)
    expect(screen.getByTestId('decision-pill-stakes')).toHaveTextContent(OVERVIEW_COPY.stakesUnset)
    expect(screen.getByTestId('decision-pill-reversibility')).toHaveTextContent(
      OVERVIEW_COPY.reversibilityUnset,
    )
    expect(screen.getByTestId('decision-pill-horizon')).toHaveTextContent(OVERVIEW_COPY.horizonUnset)
    expect(screen.getByTestId('decision-pill-risk')).toHaveTextContent(OVERVIEW_COPY.riskUnset)
  })

  it('horizon pill shows the decision-node brief timeframe verbatim when present', () => {
    useCanvasStore.setState({
      nodes: [
        {
          id: 'd1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: { label: 'Decide', brief: { timeframe: 'within 6 months' } },
        },
      ],
    } as never)
    render(<DecisionOverviewCard title="t" />)
    expect(screen.getByTestId('decision-pill-horizon')).toHaveTextContent('Horizon: within 6 months')
  })

  it('pill click opens the Ask-Olumi drawer with the classification review ask', () => {
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('decision-pill-stakes'))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.label).toBe('Review stakes')
    expect(drawer.context).toBe(OVERVIEW_COPY.pillContext)
    expect(drawer.draft).toBe('Help me work through: Review stakes')
  })
})

describe('DecisionOverviewCard — brief-dimension chips', () => {
  beforeEach(() => {
    flagOn()
    resetCanvas({ ceeAnalysisReady: READY, goalThreshold: 20 })
  })

  it('Goal chip shows the persisted success target when set', () => {
    useCanvasStore.setState({
      ceeAnalysisReady: { ...READY, goal_threshold_unit: 'percent' },
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByTestId('brief-dim-goal')).toHaveTextContent('Success target ≥ 20%')
  })

  it('Goal chip shows "Success measure missing" when no target exists (fail-closed)', () => {
    useCanvasStore.setState({ goalThreshold: null } as never)
    render(<DecisionOverviewCard title="t" />)
    // thin auto-expands (missing measure)
    expect(screen.getByTestId('brief-dim-goal')).toHaveTextContent(OVERVIEW_COPY.goalNoteMissing)
  })

  it('Options chip counts the canvas option nodes honestly', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'A' } },
        { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'B' } },
        { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'G' } },
      ],
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByTestId('brief-dim-options')).toHaveTextContent('2 options mapped')
  })

  it('Options chip fails closed when no options are mapped', () => {
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByTestId('brief-dim-options')).toHaveTextContent(OVERVIEW_COPY.optionsNoteEmpty)
  })

  it('Context chip reflects brief presence; Constraints chip counts structured limits', () => {
    useCanvasStore.setState({
      currentBriefText: 'We need to choose a supplier before Q3.',
      goalConstraints: [{ id: 'c1', label: 'Budget', operator: '<=', value: 100 }],
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByTestId('brief-dim-context')).toHaveTextContent(OVERVIEW_COPY.capturedInBrief)
    expect(screen.getByTestId('brief-dim-constraints')).toHaveTextContent('1 limit captured')
  })

  it('Context and Constraints chips fail closed to "Not captured yet"', () => {
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByTestId('brief-dim-context')).toHaveTextContent(OVERVIEW_COPY.notCaptured)
    expect(screen.getByTestId('brief-dim-constraints')).toHaveTextContent(OVERVIEW_COPY.notCaptured)
  })

  it('chip click opens the drawer with the dimension-strengthen ask (lower-cased dimension)', () => {
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    fireEvent.click(screen.getByTestId('brief-dim-goal'))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.label).toBe('Review Goal')
    expect(drawer.context).toBe('Help me strengthen the goal in my decision brief.')
    expect(drawer.draft).toBe('Help me work through: Review Goal')
  })
})

describe('DecisionOverviewCard — brief-actions row', () => {
  beforeEach(() => {
    flagOn()
    resetCanvas({ ceeAnalysisReady: READY, goalThreshold: 20 })
  })

  it('renders the review link + one-issue-at-a-time helper when expanded', () => {
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByText(OVERVIEW_COPY.reviewBrief)).toBeInTheDocument()
    expect(screen.getByText(OVERVIEW_COPY.reviewBriefHelper)).toBeInTheDocument()
  })

  it('review link opens the drawer with the shared review-brief ask', () => {
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    fireEvent.click(screen.getByText(OVERVIEW_COPY.reviewBrief))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.label).toBe(REVIEW_BRIEF_ASK.label)
    expect(drawer.context).toBe(REVIEW_BRIEF_ASK.context)
    expect(drawer.draft).toBe(REVIEW_BRIEF_ASK.draft)
  })
})

describe('DecisionOverviewCard — needs-input state (live)', () => {
  beforeEach(() => {
    flagOn()
    resetCanvas({ ceeAnalysisReady: NEEDS_INPUT })
  })

  it('auto-expands and shows at most three focused questions', () => {
    render(<DecisionOverviewCard title="t" />)
    expect(screen.getByTestId('brief-bar')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('What does success look like?')).toBeInTheDocument()
    expect(screen.getByText('Which options are realistic?')).toBeInTheDocument()
    expect(screen.queryByText('Q4')).not.toBeInTheDocument()
  })
})

describe('DecisionOverviewCard — live quality derivation (UI-SEM-079)', () => {
  beforeEach(() => flagOn())

  it('thin: producer-ready with NO success measure names the one clarification and auto-expands', () => {
    resetCanvas({ ceeAnalysisReady: READY, goalThreshold: null })
    render(<DecisionOverviewCard title="t" />)
    expect(screen.getByText('Framing needs one clarification')).toBeInTheDocument()
    expect(screen.getByText(OVERVIEW_COPY.thinLiveNote)).toBeInTheDocument()
    // Never the fixture's broader claim — we only know the measure is missing.
    expect(screen.queryByText(OVERVIEW_COPY.thinNote)).not.toBeInTheDocument()
    expect(screen.getByTestId('brief-bar')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('overview-status-dot').className).toContain('bg-warning')
  })

  it('blocked: a blocker-severity engine critique outranks ready and reads danger', () => {
    resetCanvas({
      ceeAnalysisReady: READY,
      goalThreshold: 20,
      graphHealth: {
        status: 'errors',
        issues: [{ id: 'i1', type: 'cycle', severity: 'blocker', message: 'x' }],
        score: 10,
      },
    })
    render(<DecisionOverviewCard title="t" />)
    expect(screen.getByText(OVERVIEW_COPY.blocked)).toBeInTheDocument()
    expect(screen.getByText(OVERVIEW_COPY.blockedNote)).toBeInTheDocument()
    expect(screen.getByTestId('overview-status-dot').className).toContain('bg-danger')
    expect(screen.getByTestId('brief-bar')).toHaveAttribute('aria-expanded', 'true')
  })

  it('non-blocker issues never derive blocked (fail-closed on severity)', () => {
    resetCanvas({
      ceeAnalysisReady: READY,
      goalThreshold: 20,
      graphHealth: {
        status: 'warnings',
        issues: [{ id: 'i1', type: 'missing_label', severity: 'warning', message: 'x' }],
        score: 70,
      },
    })
    render(<DecisionOverviewCard title="t" />)
    expect(screen.getByText('Framing has the basics')).toBeInTheDocument()
  })
})

describe('DecisionOverviewCard — review folds (S1/S2/S3)', () => {
  beforeEach(() => flagOn())

  it('S2: NO CEE assessment → quiet no-claim state, never "has the basics"', () => {
    resetCanvas({ ceeAnalysisReady: null })
    render(<DecisionOverviewCard title="t" />)
    expect(screen.getByText('Framing not yet assessed')).toBeInTheDocument()
    expect(screen.queryByText('Framing has the basics')).not.toBeInTheDocument()
    expect(screen.getByTestId('brief-bar')).toHaveAttribute('aria-expanded', 'false')
  })

  it('S1: needs-input WITHOUT producer questions never promises "questions below"', () => {
    resetCanvas({
      ceeAnalysisReady: { status: 'needs_encoding', options: [], goal_node_id: 'g1' },
    })
    render(<DecisionOverviewCard title="t" />)
    expect(screen.queryByText(/questions below/i)).not.toBeInTheDocument()
    expect(screen.getByText('Work through the gaps with Olumi when you are ready')).toBeInTheDocument()
  })

  it('S3: only DISCUSSION items are promoted — a mechanical top item is not a question', () => {
    resetCanvas({ ceeAnalysisReady: READY, goalThreshold: 20 })
    useGuidanceStore.setState({
      guidanceItems: [
        { item_id: 'g1', signal_code: 's', category: 'must_fix', source: 'structural', title: 'Connect the isolated risk', primary_action: { type: 'open_inspector', target_id: 'n1' }, priority: 95 },
      ],
      _sendMessage: () => {},
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.queryByTestId('framing-question')).not.toBeInTheDocument()
  })
})

describe('DecisionOverviewCard — gallery-only states (stateOverride)', () => {
  beforeEach(() => flagOn())

  it('contradictory: auto-expands and pauses reliance on the read', () => {
    render(<DecisionOverviewCard title="t" stateOverride="contradictory" />)
    expect(screen.getByText('The brief contains a conflict')).toBeInTheDocument()
    expect(screen.getByTestId('brief-bar')).toHaveAttribute('aria-expanded', 'true')
  })

  it('thin (fixture): keeps the producer-worded broad-goal note', () => {
    render(<DecisionOverviewCard title="t" stateOverride="thin" />)
    expect(screen.getByText('Framing needs one clarification')).toBeInTheDocument()
    expect(screen.getByText(OVERVIEW_COPY.thinNote)).toBeInTheDocument()
  })

  it('unverified: labels the claim as unverified, never asserts it is false', () => {
    render(<DecisionOverviewCard title="t" stateOverride="unverified" />)
    expect(screen.getByText(/unverified/i)).toBeInTheDocument()
    expect(screen.queryByText(/false|wrong|incorrect/i)).not.toBeInTheDocument()
  })
})

describe('deriveFramingQuestion (UI-SEM-078, hardened)', () => {
  it('uses an interrogative title as-is', () => {
    expect(deriveFramingQuestion({ title: 'What would make B clearly better?' })).toBe(
      'What would make B clearly better?',
    )
  })

  it('prefers an interrogative detail over an imperative title', () => {
    expect(
      deriveFramingQuestion({ title: 'Review the goal', detail: 'Is the goal measurable?' }),
    ).toBe('Is the goal measurable?')
  })

  // RETIRED PIN ('falls back to the detail prose when nothing is
  // interrogative'): the verbatim non-interrogative detail passthrough leaked
  // producer rerun copy into the framing slot in production. Non-interrogative
  // prose without framing scope now yields null (the card renders no slot).
  it('returns null for non-interrogative prose without framing scope (no verbatim passthrough)', () => {
    expect(
      deriveFramingQuestion({ title: 'Review the goal', detail: 'The goal lacks a measure.' }),
    ).toBeNull()
  })

  it('never surfaces the leaked rerun-nudge sentence as a framing question', () => {
    expect(
      deriveFramingQuestion({
        title: 'Analysis may be out of date',
        detail: 'Re-run analysis to refresh the insights and explore the updated decision.',
      }),
    ).toBeNull()
  })

  // UPDATED PIN ('composes a question from a bare imperative label'): the
  // mechanical composition is now reserved for framing-scoped items
  // (target_object.type === 'framing') — never applied to arbitrary
  // housekeeping imperatives.
  it('composes a question from a FRAMING-SCOPED imperative (never shown verbatim)', () => {
    expect(
      deriveFramingQuestion({
        title: 'Review a possible bias',
        target_object: { type: 'framing' },
      }),
    ).toBe('What would it take to review a possible bias?')
  })

  it('does not compose from an imperative without framing scope', () => {
    expect(deriveFramingQuestion({ title: 'Review a possible bias' })).toBeNull()
    expect(
      deriveFramingQuestion({
        title: 'Review a possible bias',
        target_object: { type: 'node', id: 'n1' },
      }),
    ).toBeNull()
  })
})

describe('DecisionOverviewCard — framing question (producer-backed)', () => {
  beforeEach(() => {
    flagOn()
    resetCanvas({ ceeAnalysisReady: READY, goalThreshold: 20 })
  })

  it('promotes the TOP guidance item as the one framing question with a drawer route', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        { item_id: 'g2', signal_code: 's', category: 'should_fix', source: 'analysis', title: 'Lower-priority', primary_action: { type: 'discuss', prompt: 'x' }, priority: 10 },
        { item_id: 'g1', signal_code: 's', category: 'must_fix', source: 'analysis', title: 'What would make option B clearly better?', primary_action: { type: 'discuss', prompt: 'Work through the framing question' }, priority: 90, target_object: { type: 'node', id: 'n7' } },
      ],
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByText('What would make option B clearly better?')).toBeInTheDocument()
    expect(screen.queryByText('Lower-priority')).not.toBeInTheDocument()
    expect(screen.getByText(OVERVIEW_COPY.framingLabel)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /work through with olumi/i }))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.draft).toBe('Work through the framing question')
    expect(drawer.context).toBe('What would make option B clearly better?')
    expect(drawer.targetId).toBe('n7')
  })

  it('"Answer directly" primes the drawer for a straight answer (no brief editor exists yet)', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        { item_id: 'g1', signal_code: 's', category: 'must_fix', source: 'analysis', title: 'What does success look like?', primary_action: { type: 'discuss', prompt: 'p' }, priority: 90 },
      ],
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    fireEvent.click(screen.getByRole('button', { name: /answer directly/i }))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.draft).toBe(OVERVIEW_COPY.answerDraftPrefix)
    expect(drawer.context).toBe('What does success look like?')
    expect(drawer.label).toBe('Answer the framing question')
  })

  // UPDATED PIN: the imperative item must now be FRAMING-SCOPED to occupy the
  // slot at all (positive promotion gate); the composed question is preserved
  // for those, and the verbatim imperative still never renders.
  it('a framing-scoped imperative title is composed, never shown verbatim', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        { item_id: 'g1', signal_code: 's', category: 'must_fix', source: 'analysis', title: 'Sharpen the success measure', primary_action: { type: 'discuss', prompt: 'p' }, priority: 90, target_object: { type: 'framing' } },
      ],
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    const block = screen.getByTestId('framing-question')
    expect(block).toHaveTextContent('What would it take to sharpen the success measure?')
    expect(screen.queryByText('Sharpen the success measure')).not.toBeInTheDocument()
  })

  it('renders NO framing question when no guidance exists (never fabricates)', () => {
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.queryByText(/framing question/i)).not.toBeInTheDocument()
  })
})

describe('DecisionOverviewCard — framing-slot honesty (production leak)', () => {
  // The exact sentence production showed under "Olumi's framing question":
  // CEE rerun/housekeeping wire copy, not a framing question. It reached the
  // slot because every derived phase-3 block is stamped with a 'discuss'
  // action and the old promotion filter had no framing-relevance gate.
  const LEAKED_RERUN_SENTENCE =
    'Re-run analysis to refresh the insights and explore the updated decision.'

  beforeEach(() => {
    flagOn()
    resetCanvas({ ceeAnalysisReady: READY, goalThreshold: 20 })
  })

  it('a max-priority rerun nudge (non-interrogative detail, discuss action) never renders the framing card', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        // A guidance item derived from a block with no producer signal_code:
        // extractPhase3 now leaves signal_code ABSENT (it never invents one
        // from block.type). The card does not branch on signal_code.
        { item_id: 'g-rerun', category: 'should_fix', source: 'analysis', title: 'Analysis may be out of date', detail: LEAKED_RERUN_SENTENCE, primary_action: { type: 'discuss', prompt: LEAKED_RERUN_SENTENCE }, priority: 99 },
      ],
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.queryByTestId('framing-question')).not.toBeInTheDocument()
    expect(screen.queryByText(LEAKED_RERUN_SENTENCE)).not.toBeInTheDocument()
    expect(screen.queryByText(OVERVIEW_COPY.framingLabel)).not.toBeInTheDocument()
  })

  it('a genuine interrogative item wins the slot even when a rerun nudge carries higher priority', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        { item_id: 'g-rerun', category: 'should_fix', source: 'analysis', title: 'Analysis may be out of date', detail: LEAKED_RERUN_SENTENCE, primary_action: { type: 'discuss', prompt: LEAKED_RERUN_SENTENCE }, priority: 99 },
        { item_id: 'g-question', category: 'should_fix', source: 'analysis', title: 'What would make option B clearly better?', primary_action: { type: 'discuss', prompt: 'p' }, priority: 40 },
      ],
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByTestId('framing-question')).toHaveTextContent(
      'What would make option B clearly better?',
    )
    expect(screen.queryByText(LEAKED_RERUN_SENTENCE)).not.toBeInTheDocument()
  })

  it('a framing-scoped imperative item qualifies and keeps the composed question', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        { item_id: 'g-framing', category: 'should_fix', source: 'analysis', title: 'Broaden the option set', primary_action: { type: 'discuss', prompt: 'p' }, priority: 50, target_object: { type: 'framing' } },
      ],
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByTestId('framing-question')).toHaveTextContent(
      'What would it take to broaden the option set?',
    )
  })
})
