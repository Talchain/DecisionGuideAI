/**
 * DecisionNode — THE HONEST RESTING STATE.
 *
 * Measured on deployed `2db13473` (a real model, decision node `354e7649`):
 * the anchor node of the whole model rendered as an EMPTY BOX carrying nothing
 * but its title. Neither of `DecisionNode`'s two body branches put a single
 * child on screen, so `BaseNode`'s children wrapper never rendered at all.
 *
 * Two reachable ways to get there, and this file pins both:
 *
 *  1. PRE-ANALYSIS with no option linked — `optionCount === 0` fell through
 *     both ternary arms to a literal `null`.
 *  2. POST-ANALYSIS in Standard view when the producer made no owned leader
 *     claim — the `<div className="mt-1">` rendered with no children, because
 *     the stability line and the post chips are Detailed-only.
 *
 * ─── WHAT THE FIRST CUT GOT WRONG, AND WHAT THAT CHANGES HERE ──────────────
 *
 * An independent review found three blockers, and each one is a lesson about
 * WHERE these tests must bind. They are named because the shape recurs:
 *
 * B1 · THE CTA HAD NO DESTINATION. It called `requestNodeRename` +
 *      `openNodeInspector` on the strength of #1020/#1024 — and #1025 REVERTED
 *      #1024, because a node-label edit has no wire carrier. `onLabelChange`
 *      now has ZERO product callers, so `EditableLabel:91`'s auto-edit effect
 *      returns immediately and the panel says changes cannot be saved.
 *      ⭐ THE TEST DEFECT IS THE INTERESTING HALF: the old spec asserted only
 *      that the intent store held the id and the open event fired. Both were
 *      TRUE against a completely inert seam, so every render test and every
 *      mutant passed while the user got a read-only panel. **A test that
 *      asserts a store write proves a store write.** The tests below bind to
 *      the DESTINATION RECEIVING THE TEXT — the composer's own prefill
 *      callback, or the Ask-Olumi drawer's own state — and to the fact that
 *      nothing is auto-sent.
 *
 * B2 · THE HONESTY GUARD COVERED 1 OF 3 LINES. It ran against one rendered
 *      fixture, so mutating the other two into `'This decision is not named
 *      yet'`, `'…for this question'`, `'…the options are too close to call'`
 *      and `'…so no option is leading'` left the suite 8/8 GREEN — a
 *      fabricated analysis verdict shipping past the guard written to forbid
 *      exactly that. The copy now lives in one exported record and the guard
 *      ENUMERATES it, with a rendered corpus kept alongside (trap 12d: a
 *      derived guard proves agreement and can never prove completeness; only a
 *      corpus notices a string that was never declared).
 *
 * B3 · "Nothing on this node yet" WAS FALSE ON A COMPLETED RUN. With
 *      `recommendation_stability: 0.62` present, the body said nothing had
 *      happened while the SAME node's popover carried "62%", "sensitive" and
 *      both post-analysis chips. The old fixture omitted that field — the
 *      corpus EXCLUDED the class where the contradiction is visible. The
 *      fixture is added, and the copy on that path now points at the popover
 *      instead, with a positive control asserting the popover really does hold
 *      what the pointer claims.
 *
 * ⛔ WHAT THIS COPY MAY NOT DO. It must not describe a finding the producer did
 * not state. Case (2) is REACHED BY a withheld leader claim, so "no leading
 * option" is the obvious sentence to write — and `headline` is also null for
 * canvas-side lookup failures, so it would be false on a reachable path, not
 * merely unearned. ⛔ AND NO NODE-TYPE WORD: `DECISION_NODE_LABEL`
 * (`canvas/domain/vocabulary.ts`) is another lane's and is still not on
 * `staging`, so this copy is written never to need the word.
 *
 * CLAUDE.md trap 3: these assert the presence/absence of TEXT. jsdom cannot
 * prove visibility and nothing here claims it does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode, DECISION_RESTING_COPY } from '../DecisionNode'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

// Transparent popover, same reason as DecisionNode.spec.tsx: the real one is
// behind a 300ms hover delay and an anchor measurement, neither of which fire
// in jsdom. B3's positive control reads its CONTENT through this.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

const hoisted = vi.hoisted(() => ({ state: null as any }))

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => unknown) => selector(hoisted.state)),
    { getState: () => hoisted.state },
  ),
}))

const DECISION_ID = 'decision-1'

const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire three' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Hire none' } },
]
const optionEdges = [
  { id: 'e1', source: DECISION_ID, target: 'option-1', data: {} },
  { id: 'e2', source: DECISION_ID, target: 'option-2', data: {} },
]

/** Two comparable options with win probabilities, and NO producer leader claim. */
const WITHHELD_REPORT = {
  option_probabilities: {
    'option-1': { win_probability: 0.55 },
    'option-2': { win_probability: 0.45 },
  },
  robustness: { recommended_option_id: 'option-1' },
}

/**
 * B3's missing class: the SAME withheld run, but carrying the stability the
 * popover renders. This is the fixture whose absence hid the contradiction.
 */
const WITHHELD_REPORT_WITH_STABILITY = {
  ...WITHHELD_REPORT,
  robustness: { recommended_option_id: 'option-1', recommendation_stability: 0.62 },
}

/** The same run, plus the producer's own `near_tie` leader claim. */
const PERMITTED_REPORT = {
  ...WITHHELD_REPORT,
  robustness: {
    recommended_option_id: 'option-1',
    near_tie: { is_tie: false, top_option_id: 'option-1' },
  },
}

const setStore = (overrides: Record<string, unknown> = {}) => {
  hoisted.state = {
    edges: [],
    nodes: [decisionNode],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    viewMode: 'standard',
    selectNodeWithoutHistory: vi.fn(),
    ...overrides,
  }
}

const baseProps = {
  id: DECISION_ID,
  type: 'decision',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  data: { label: 'Should we hire?', type: 'decision' },
}

const renderDecision = (overrides: Partial<typeof baseProps> = {}) =>
  render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} {...(overrides as any)} />
    </ReactFlowProvider>,
  )

const RESTING = 'decision-node-resting-state'
const RESTING_CTA = 'decision-node-resting-cta'

/**
 * ⛔ THE CONSTRAINT, AS ONE PREDICATE, APPLIED IN TWO PLACES.
 *
 * Left half: any word that would make this node describe the analysis.
 * Right half: the node-type vocabulary another lane owns.
 *
 * `canvasCopyIsHonest` is used BOTH over the declared record (complete over
 * what is declared) AND over every rendered case (notices what was never
 * declared). Neither alone is sufficient — that is the whole of B2.
 */
const FORBIDDEN =
  /lead|winner|win |robust|stabil|scenario|too close|tie|result|analysis|confiden|likel|probab|\bdecisions?\b|\bquestions?\b/i

const canvasCopyIsHonest = (text: string) => !FORBIDDEN.test(text)

/**
 * ⭐⭐ READ THE TEXT THE WAY THE USER READS IT — ONE LINE PER TEXT NODE.
 *
 * `Element.textContent` concatenates descendants with NO separator, and that
 * silently blinded this guard. Measured on the review's own R2 mutation
 * (`'No options linked yet for this question'`): the rendered string came back
 * as `"No options linked yet for this questionAdd options"`, so the banned word
 * was glued to the CTA's first letter, `\bquestions?\b` found no word boundary
 * after it, and the RENDERED corpus passed. Only the enumeration guard caught
 * it — i.e. the belt held while the braces had quietly come undone, and a
 * banned word at the END of any line would have walked straight through.
 *
 * The guard function was never wrong. The EXTRACTION was lossy, which is the
 * harder failure to see: the instrument agreed with a healthy answer for a
 * reason that had nothing to do with the property (CLAUDE.md trap 13e — a
 * control that fires can still be lossy enough to manufacture a pass).
 * `extractionIsNotLossy` below pins the separation itself.
 */
function visibleText(el: HTMLElement): string {
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */)
  const parts: string[] = []
  let node: Node | null = walker.nextNode()
  while (node) {
    parts.push(node.textContent ?? '')
    node = walker.nextNode()
  }
  return parts.join('\n')
}

describe('DecisionNode — honest resting state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setStore()
    // A composer IS registered by default: the CTA is gated on a conversation
    // surface existing, so a default of "none" would make every CTA test pass
    // for the wrong reason.
    useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn() } as any)
    useAskOlumiStore.getState().close()
    useAskOlumiStore.setState({ draft: '', label: '', context: '', targetId: undefined } as any)
  })

  afterEach(() => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as any)
  })

  // ── (1) The measured shape: pre-analysis, nothing linked ────────────────
  it('pre-analysis with no option linked: the body says what is absent instead of nothing', () => {
    renderDecision()
    // Positive control first — an absence pin below is only meaningful if the
    // node rendered at all (CLAUDE.md trap 13).
    expect(screen.getByText('Should we hire?')).toBeDefined()

    const resting = screen.getByTestId(RESTING)
    expect(within(resting).getByText(DECISION_RESTING_COPY.noOptionsLine)).toBeDefined()
    expect(within(resting).getByTestId(RESTING_CTA).textContent).toBe(DECISION_RESTING_COPY.noOptionsCta)
  })

  it('an unnamed node invites the user to name it', () => {
    renderDecision({ data: { type: 'decision' } as any })
    const resting = screen.getByTestId(RESTING)
    expect(within(resting).getByText(DECISION_RESTING_COPY.unnamedLine)).toBeDefined()
    expect(within(resting).getByTestId(RESTING_CTA).textContent).toBe(DECISION_RESTING_COPY.unnamedCta)
  })

  // ── (2) B1: THE CTA'S DESTINATION ACTUALLY RECEIVES THE ASK ─────────────
  //
  // Not "a store field changed" — the surface that shows the user an editable
  // draft is the thing under test, because the previous seam wrote its store
  // faithfully and rendered a read-only panel.

  it('CTA: the composer receives the exact ask text, and nothing is sent', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: dispatch } as any)

    renderDecision()
    fireEvent.click(screen.getByTestId(RESTING_CTA))

    // THE DESTINATION: the composer's own callback, with the exact text.
    expect(prefill).toHaveBeenCalledTimes(1)
    expect(prefill).toHaveBeenCalledWith(DECISION_RESTING_COPY.noOptionsAsk)
    // NEVER auto-sent — the user presses Send on a draft they can see and edit.
    expect(send).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('CTA: with no composer registered the ask lands in the Ask-Olumi drawer, still unsent', () => {
    const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: send, _dispatchAction: null } as any)

    renderDecision({ data: { type: 'decision' } as any })
    fireEvent.click(screen.getByTestId(RESTING_CTA))

    // THE FALLBACK DESTINATION: the drawer holds the draft, bound to THIS node.
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.draft).toBe(DECISION_RESTING_COPY.unnamedAsk)
    expect(drawer.targetId).toBe(DECISION_ID)
    expect(send).not.toHaveBeenCalled()
  })

  it('CTA: with NO conversation surface at all the button does not render — it must not pretend', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as any)
    renderDecision()
    // Positive control: the resting LINE is still there, so this is a claim
    // about the button and not about a component that failed to render.
    expect(screen.getByTestId(RESTING)).toBeDefined()
    expect(screen.queryByTestId(RESTING_CTA)).toBeNull()
  })

  // ── (3) B2: THE HONESTY GUARD, OVER EVERY VARIANT ───────────────────────

  it('the guard itself can fail (positive control)', () => {
    // An absence assertion must first prove it can see a presence. These are
    // the four strings an independent review mutated past the old guard.
    expect(canvasCopyIsHonest('This decision is not named yet')).toBe(false)
    expect(canvasCopyIsHonest('No options linked yet for this question')).toBe(false)
    expect(canvasCopyIsHonest('Not named yet — the options are too close to call')).toBe(false)
    expect(canvasCopyIsHonest('No options linked yet, so no option is leading')).toBe(false)
    // …and it passes honest copy, so it is not simply always-false.
    expect(canvasCopyIsHonest('No options linked yet')).toBe(true)
  })

  it('every declared copy string is non-empty (the enumeration is not vacuous)', () => {
    const values = Object.values(DECISION_RESTING_COPY)
    expect(values.length).toBeGreaterThanOrEqual(10)
    for (const v of values) expect(v.trim().length).toBeGreaterThan(0)
  })

  it.each(Object.entries(DECISION_RESTING_COPY))(
    'declared copy %s makes no claim about the analysis and names no node type',
    (_key, text) => {
      expect(canvasCopyIsHonest(text)).toBe(true)
    },
  )

  // The corpus half. Enumeration proves every DECLARED string is honest; only
  // rendering notices a string that was never declared.
  const renderedCases: Array<[string, () => void]> = [
    ['pre-analysis, no option linked', () => { setStore(); renderDecision() }],
    ['unnamed node', () => { setStore(); renderDecision({ data: { type: 'decision' } as any }) }],
    ['post-analysis Standard, leader withheld', () => {
      setStore({
        nodes: [decisionNode, ...optionNodes],
        edges: optionEdges,
        results: { status: 'complete', report: WITHHELD_REPORT },
        viewMode: 'standard',
      })
      renderDecision()
    }],
    ['post-analysis Standard, leader withheld, stability present', () => {
      setStore({
        nodes: [decisionNode, ...optionNodes],
        edges: optionEdges,
        results: { status: 'complete', report: WITHHELD_REPORT_WITH_STABILITY },
        viewMode: 'standard',
      })
      renderDecision()
    }],
  ]

  it.each(renderedCases)('rendered resting copy is honest — %s', (_name, mount) => {
    mount()
    const text = visibleText(screen.getByTestId(RESTING))
    expect(text.trim().length).toBeGreaterThan(0)
    expect(canvasCopyIsHonest(text)).toBe(true)
  })

  // The control for the EXTRACTION, not for the predicate. Every rendered
  // string must arrive on its own line — that separation is the only reason a
  // banned word at the end of a line is still bounded, and it is exactly what
  // `textContent` destroyed.
  it('the rendered-copy extraction is not lossy: each string arrives on its own line', () => {
    setStore()
    renderDecision()
    const text = visibleText(screen.getByTestId(RESTING))
    expect(text).toMatch(new RegExp(`^${DECISION_RESTING_COPY.noOptionsLine}$`, 'm'))
    expect(text).toMatch(new RegExp(`^${DECISION_RESTING_COPY.noOptionsCta}$`, 'm'))
    // And the concatenation that hid the defect is gone: the line and the CTA
    // are no longer adjacent characters.
    expect(text).not.toContain(
      `${DECISION_RESTING_COPY.noOptionsLine}${DECISION_RESTING_COPY.noOptionsCta}`,
    )
  })

  // ── (4) B3: THE COMPLETED-RUN PATH ──────────────────────────────────────

  it('post-analysis Standard with no owned leader claim: the body is not empty', () => {
    setStore({
      nodes: [decisionNode, ...optionNodes],
      edges: optionEdges,
      results: { status: 'complete', report: WITHHELD_REPORT },
      viewMode: 'standard',
    })
    renderDecision()
    // The leader sentence stays withheld — this is not a softening of it.
    expect(screen.queryByText(/leads in \d+% of scenarios/i)).toBeNull()
    expect(screen.getByTestId(RESTING)).toBeDefined()
  })

  it('a completed run does NOT say nothing has happened, and does NOT prescribe an unrelated act', () => {
    setStore({
      nodes: [decisionNode, ...optionNodes],
      edges: optionEdges,
      results: { status: 'complete', report: WITHHELD_REPORT_WITH_STABILITY },
      viewMode: 'standard',
    })
    renderDecision()

    const resting = screen.getByTestId(RESTING)
    // ⭐ THE POSITIVE CONTROL THAT MAKES THE POINTER TRUE. The copy points at
    // the popover, so the popover must actually hold something — on the SAME
    // node, in the same render. Without this the pointer is an unfalsifiable
    // claim about a surface no test opened.
    const popover = screen.getByTestId('decision-node-popover')
    expect(within(popover).getByText(/62%/)).toBeDefined()
    expect(within(popover).getByText(/sensitive/i)).toBeDefined()
    expect(within(popover).getByText('Challenge this result')).toBeDefined()

    expect(within(resting).getByText(DECISION_RESTING_COPY.completedRunLine)).toBeDefined()
    // "yet" would assert that nothing has happened. A run had.
    expect(visibleText(resting)).not.toMatch(/\byet\b/i)
    // No authoring CTA here: the absence is not something the user writes away,
    // and the previous "Rename it" prescribed an act unrelated to it.
    expect(within(resting).queryByTestId(RESTING_CTA)).toBeNull()
  })

  // ── (5) Discriminating controls: bound to EMPTINESS, not always-on ──────
  it('does NOT render when the pre-analysis body already has a triage line', () => {
    setStore({
      nodes: [
        decisionNode,
        ...optionNodes,
        { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Salary budget', category: 'controllable' } },
      ],
      edges: optionEdges,
    })
    renderDecision()
    // Positive control: the body genuinely has content on this fixture.
    expect(screen.getByText(/Top gap: estimate/i)).toBeDefined()
    expect(screen.queryByTestId(RESTING)).toBeNull()
  })

  it('does NOT render when the post-analysis body carries the producer-owned leader sentence', () => {
    setStore({
      nodes: [decisionNode, ...optionNodes],
      edges: optionEdges,
      results: { status: 'complete', report: PERMITTED_REPORT },
      viewMode: 'standard',
    })
    renderDecision()
    // Positive control: the headline really is on screen on this fixture.
    expect(screen.getByText(/leads in 55% of scenarios/i)).toBeDefined()
    expect(screen.queryByTestId(RESTING)).toBeNull()
  })
})
