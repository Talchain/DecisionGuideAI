/**
 * DecisionNode — the invitations are on the card, not behind a hover.
 *
 * "Explore more options" and "What could go wrong?" are the two most
 * reasoning-shaped affordances the canvas has, on the anchor node of the whole
 * model. They rendered in exactly two places: the Detailed (expert) view, and a
 * HOVER POPOVER.
 *
 * Measured on the deployed build: `viewMode: 'standard'` and NONE of the four
 * coaching chips anywhere on the page, with a contrast control ("Show whole
 * model") proving the probe could read it. So for a default-view user they did
 * not exist, and on a touch device they could not — `hover` is not an input
 * that device has.
 *
 * ⚠ THE STANDARD-VIEW CASE IS THE WHOLE POINT, so every test here runs in
 * Standard. `DecisionNode.spec.tsx` sets `viewMode: 'expert'`, which is exactly
 * the setting under which this defect is invisible: a suite written only there
 * would have stayed green throughout (trap 3b — a test bound to a mode the
 * deployment does not render is not evidence about the deployed surface).
 *
 * CLAUDE.md trap 3: these assert presence and absence of TEXT. jsdom cannot
 * prove visibility and nothing here claims it does.
 *
 * ⭐ LOCKED CANVAS DESIGN (23 Sep 2026) — THE INVITATION IS THE RAIL'S ONE
 * COACHING ICON. ED 11:52Z point 1 ("coaching behind the one icon") took the
 * chip rows off the Standard face; `node-coaching-icon-<id>` asks the FIRST
 * resolved chip ("Explore more options" before a run) and the rest stay in
 * Detailed. The property this file exists for is unchanged — the invitation is
 * reachable WITHOUT a hover, is a real button, and is not duplicated into the
 * popover — so every test is re-pointed to the icon, never deleted. What the
 * icon SENDS for an untyped chip is now a prefill-and-confirm draft
 * (`requestAsk` → the Ask-Olumi drawer), not an auto-dispatched turn, so the
 * message is read from that draft.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

// Transparent popover — the real one sits behind a 300ms hover delay and an
// anchor measurement, neither of which fire in jsdom. Rendering it inline is
// what lets the "not ONLY in the popover" assertion below discriminate.
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

/**
 * ⭐ CAPTURES WHAT THE CHIP ACTUALLY SENDS — through the REAL store.
 *
 * The assertion at the bottom of this file ("asserts nothing about the model")
 * scanned RENDERED TEXT, and the chip's falsehood was in `message`, which never
 * renders. Guard and defect on different strings, so the suite stayed green
 * while "Suggest a third option" went out on every model. These tests click the
 * chip and read the dispatched payload instead.
 *
 * ⚠ NOT MOCKED, AND THAT IS THE FIX. I first mocked the module with an object
 * exposing `getState`. `useGuidanceStore` is a zustand hook and DecisionNode
 * calls it AS ONE — `useGuidanceStore(canReceiveAsk)` at :582 — so every test in
 * this file died on "useGuidanceStore is not a function", and a repair probe hit
 * a SECOND consumer (`NodeCoachingMarker`) behind the first. A hand-built stub
 * of a store has to keep pace with every consumer that reads it, which is the
 * hand-maintained mirror in test clothing.
 *
 * The real store already supports this: `_dispatchAction` defaults to `null`
 * and is settable. So the capture is a real state write, the selectors are the
 * real selectors, and any future consumer is served without an edit here — the
 * same approach the sibling `restingState.spec.tsx` takes.
 */
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'

const dispatched: Array<Record<string, unknown>> = []

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

const setStore = (overrides: Record<string, unknown> = {}) => {
  hoisted.state = {
    edges: optionEdges,
    nodes: [decisionNode, ...optionNodes],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    // THE DEPLOYED DEFAULT. Not 'expert'.
    viewMode: 'standard',
    selectNodeWithoutHistory: vi.fn(),
    ...overrides,
  }
}

const baseProps = {
  id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 },
  selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  data: { label: 'Should we hire?', type: 'decision' },
}

const renderDecision = () =>
  render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} />
    </ReactFlowProvider>,
  )

/** Everything on the card EXCLUDING the popover — what a non-pointer user gets. */
const outsidePopover = (container: HTMLElement): string => {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-testid="decision-node-popover"]').forEach(n => n.remove())
  return clone.textContent ?? ''
}

/**
 * Locked Canvas design (23 Sep 2026): the card's ONE coaching affordance — the
 * rail icon — bound by IDENTITY (its testid), inside THIS render's container.
 */
const COACHING_ICON = `node-coaching-icon-${DECISION_ID}`
const coachingIconIn = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${COACHING_ICON}"]`)

/** Every control on the card OUTSIDE the popover whose accessible name is `name`. */
const faceControlsNamed = (container: HTMLElement, name: string): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('button'))
    .filter(b => !b.closest('[data-testid="decision-node-popover"]'))
    .filter(b => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === name)

describe('DecisionNode — invitations in Standard view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setStore()
    dispatched.length = 0
    // `guidanceItems: []` — the coaching icon yields to a producer item that
    // names this node, so the fixture states that none does.
    useGuidanceStore.setState({
      _dispatchAction: (a: Record<string, unknown>) => { dispatched.push(a) },
      guidanceItems: [],
    } as never)
    useAskOlumiStore.setState({ isOpen: false, draft: '', label: '', parameters: undefined })
  })
  afterEach(() => cleanup())

  it('offers "Explore more options" WITHOUT hovering', () => {
    // Locked Canvas design (23 Sep 2026): ED 11:52Z point 1 — the invitation is
    // the rail's coaching icon, outside the popover; the chip row is off the face.
    const { container } = renderDecision()
    const icon = coachingIconIn(container)
    expect(icon, 'coaching icon missing').not.toBeNull()
    expect(icon!.getAttribute('aria-label')).toBe('Explore more options')
    expect(icon!.closest('[data-testid="decision-node-popover"]')).toBeNull()
    expect(outsidePopover(container)).not.toContain('Explore more options')
  })

  it('"What could go wrong?" is off the Standard face (the icon asks the FIRST chip), reachable in the Standard popover and in Detailed', () => {
    // Locked Canvas design (23 Sep 2026): ED 11:52Z point 1 — ONE coaching icon
    // per card; the secondary chip keeps its home in Detailed's chip row.
    const { container } = renderDecision()
    // Precondition: the fixture really resolves the second chip (no run CTA).
    expect(coachingIconIn(container)?.getAttribute('aria-label')).toBe('Explore more options')
    expect(outsidePopover(container)).not.toContain('What could go wrong?')
    expect(faceControlsNamed(container, 'What could go wrong?')).toHaveLength(0)
    // …but REACHABLE in Standard: the popover (hover or tap) offers every
    // invitation EXCEPT the one the icon already asks — never the same question
    // twice on one surface.
    const popover = screen.getByTestId('decision-node-popover')
    expect(within(popover).getByText('What could go wrong?')).toBeDefined()
    expect(within(popover).queryByText('Explore more options')).toBeNull()
    cleanup()

    setStore({ viewMode: 'expert' })
    const detailed = renderDecision()
    const chip = within(detailed.container).getByText('What could go wrong?').closest('button')
    expect(chip).not.toBeNull()
  })

  it('⭐ MOVED to the card, not duplicated onto it', () => {
    // The defect was not that the chips were missing; they rendered, in a place
    // a touch user cannot reach. My first fix rendered them in BOTH, which put
    // the same chip on one node twice for a pointer user — worse than either
    // placement alone, and `render-matrix`'s own `getByText` audit caught it.
    // Stripping the popover and asserting what is LEFT is what distinguishes
    // "present" from "reachable"; asserting the popover no longer holds them is
    // what stops the duplication coming back.
    //
    // Locked Canvas design (23 Sep 2026): ED 11:52Z point 1 — re-pointed to the
    // rail's coaching icon, and "not duplicated" is now counted: exactly ONE
    // control on the whole card carries the invitation.
    const { container } = renderDecision()
    const popover = screen.queryByTestId('decision-node-popover')
    expect(popover, 'popover fixture missing — this test would pass vacuously').not.toBeNull()
    expect(coachingIconIn(container)?.closest('[data-testid="decision-node-popover"]')).toBeNull()
    expect(faceControlsNamed(container, 'Explore more options')).toHaveLength(1)
    expect(within(popover as HTMLElement).queryByText('Explore more options')).toBeNull()
    expect(within(popover as HTMLElement).queryByRole('button', { name: 'Explore more options' })).toBeNull()
    // The popover keeps what it is uniquely good at.
    expect(popover?.textContent).toContain('Model readiness')
  })

  it('they are real BUTTONS, so tap and keyboard reach them with no key handling of ours', () => {
    // Locked Canvas design (23 Sep 2026): the invitation is the rail icon.
    const { container } = renderDecision()
    const icon = coachingIconIn(container)
    expect(icon?.tagName).toBe('BUTTON')
    expect(icon?.getAttribute('type')).toBe('button')
  })

  it('says nothing when the decision has no options — an invitation to explore alternatives to nothing', () => {
    // A door on an empty tier asserts the tier ought to have members. Same rule
    // the reasoning frontier follows.
    //
    // Locked Canvas design (23 Sep 2026): re-pointed to the rail's coaching icon,
    // which is where the invitation now lives — a text scan alone became vacuous
    // once the chip row left the face. Positive control: the card rendered its
    // no-options line, so the absence is the rule and not an unmounted card.
    setStore({ edges: [], nodes: [decisionNode] })
    const { container } = renderDecision()
    expect(screen.getByTestId('decision-node-resting-state').textContent).toContain('No options')
    expect(outsidePopover(container)).not.toContain('Explore more options')
    expect(faceControlsNamed(container, 'Explore more options')).toHaveLength(0)
  })

  it('the card never carries three chips at once', () => {
    // `preAnalysisCoachingChips` already drops "What could go wrong?" while the
    // Run CTA is up. Pinned here because the body now renders both, so a change
    // to that rule would show up as clutter on the anchor node rather than in a
    // popover nobody opens.
    //
    // Locked Canvas design (23 Sep 2026): ED 11:52Z point 1 — the chips are rail
    // icons now, so they are counted by ACCESSIBLE NAME rather than text.
    //
    // DESIGN-GAP-AUDIT row 5(b), 24 Sep 2026: the run icon is gone from the
    // rail entirely (running lives in the panel's Analyse button), so `run` is
    // now 0 in BOTH arms — the ready arm is kept, unchanged in its setup, to
    // prove the removal holds even in the one state that used to render it.
    // `resolveNodeCoaching` still withholds "What could go wrong?" while
    // `showRunAnalysis` is true (that coupling predates the Play icon and is
    // untouched here), so `questions` stays 1 in both arms too — this test's
    // own point, "never three chips at once", is unaffected by which of the
    // two mechanisms is doing the withholding.
    const QUESTIONS = ['Explore more options', 'What could go wrong?']
    const countOn = (container: HTMLElement) => ({
      questions: QUESTIONS.flatMap(q => faceControlsNamed(container, q)).length,
      run: container.querySelectorAll(`[data-testid="decision-run-analysis-${DECISION_ID}"]`).length,
    })

    const notReady = renderDecision()
    expect(countOn(notReady.container)).toEqual({ questions: 1, run: 0 })
    cleanup()

    // Run-ready: a stated target and no factor missing a value.
    setStore({ goalThreshold: 0.5 })
    const ready = renderDecision()
    const readyCount = countOn(ready.container)
    expect(readyCount).toEqual({ questions: 1, run: 0 })
    expect(readyCount.questions + readyCount.run).toBeLessThanOrEqual(2)
  })

  it('asserts nothing about the model — these are invitations, not findings', () => {
    const { container } = renderDecision()
    const text = outsidePopover(container)
    const JUDGEMENT = /\b(too similar|too few|not enough|weak|incomplete|you should)\b/i
    expect(text).not.toMatch(JUDGEMENT)
  })

  /**
   * ⭐ THE SENT MESSAGE IS A STATEMENT ABOUT THE USER'S MODEL, MADE IN THE
   * USER'S NAME — so it has to be true of the model it is sent from.
   */
  describe('what the chip sends, not what it shows', () => {
    // Locked Canvas design (23 Sep 2026): the chip is the rail's coaching icon,
    // and an UNTYPED chip is prefill-and-confirm (`requestAsk` → the Ask-Olumi
    // drawer draft the user sends) — never auto-dispatched. So the "sent"
    // message is the draft, and nothing may have been dispatched.
    const messageFor = (label: string): string => {
      dispatched.length = 0
      useAskOlumiStore.setState({ isOpen: false, draft: '' })
      const { container } = renderDecision()
      const btn = coachingIconIn(container)
      if (!btn || btn.getAttribute('aria-label') !== label) {
        throw new Error(`refusing to assert: no "${label}" coaching icon rendered`)
      }
      fireEvent.click(btn)
      const ask = useAskOlumiStore.getState()
      if (!ask.isOpen || ask.draft.length === 0) throw new Error('refusing to assert: click opened no draft')
      if (dispatched.length !== 0) throw new Error('an untyped chip was dispatched on the user’s behalf')
      return ask.draft
    }

    it('does not claim the model has exactly two options', () => {
      // The hardcoded string read "Suggest a third option I haven't considered
      // for this decision" on every model — asking for a third that would be
      // the second on a one-option model, and a sixth-that-already-exists on a
      // seven-option one.
      expect(messageFor('Explore more options')).not.toMatch(/\ba third option\b/i)
    })

    it('DISCRIMINATION: the message differs between two models of different size', () => {
      // Without this, any fixed replacement string passes the test above. This
      // is the assertion that makes the message model-aware rather than merely
      // differently-generic — the same property #1060 pins for the frontier
      // doors, and the reason this string was worth changing at all.
      const two = messageFor('Explore more options')
      setStore({
        nodes: [decisionNode, ...optionNodes, { id: 'option-3', type: 'option', data: { type: 'option', label: 'Hire one' } }],
        edges: [...optionEdges, { id: 'e3', source: DECISION_ID, target: 'option-3', data: {} }],
      })
      const three = messageFor('Explore more options')
      expect(two).not.toBe(three)
      expect(two).toContain('2 options')
      expect(three).toContain('3 options')
    })

    it('counts, and does not assess', () => {
      // The line this whole surface stays on: how many options exist is
      // observable from the graph. "Too few" or "too similar" would be a claim
      // about the user's reasoning and belongs to the producer.
      const msg = messageFor('Explore more options')
      expect(msg).not.toMatch(/\b(too similar|too few|not enough|weak|incomplete|you should)\b/i)
    })
  })

  /**
   * ⭐ A DUPLICATE EDGE IS NOT A SECOND OPTION.
   *
   * `optionCount` counted outgoing edges, which was harmless while its only
   * readers were `> 0` / `=== 0` tests. The message above is the first thing in
   * the product to say the number OUT LOUD, so the change that removes the
   * generic copy is the change that makes this reachable.
   *
   * Reachable, not theoretical: `store.addEdge` blocks duplicates, but the CEE
   * patch path (`applyPatch.ts:350`) appends edges with no duplicate check, and
   * `useModelHealth.ts:180` already warns on the resulting state.
   */
  describe('counting the model honestly', () => {
    // Locked Canvas design (23 Sep 2026): read from the rail icon's draft — see
    // `messageFor` above for why the draft, not a dispatch.
    const messageWithEdges = (edges: unknown[], nodes: unknown[]): string => {
      dispatched.length = 0
      useAskOlumiStore.setState({ isOpen: false, draft: '' })
      setStore({ edges, nodes })
      const { container } = renderDecision()
      const btn = coachingIconIn(container)
      if (!btn || btn.getAttribute('aria-label') !== 'Explore more options') {
        throw new Error('refusing to assert: no "Explore more options" coaching icon rendered')
      }
      fireEvent.click(btn)
      const ask = useAskOlumiStore.getState()
      if (!ask.isOpen || ask.draft.length === 0) throw new Error('refusing to assert: click opened no draft')
      if (dispatched.length !== 0) throw new Error('an untyped chip was dispatched on the user’s behalf')
      return ask.draft
    }

    it('one option linked twice is one option', () => {
      const msg = messageWithEdges(
        [...optionEdges, { id: 'e1-dup', source: DECISION_ID, target: 'option-1', data: {} }],
        [decisionNode, ...optionNodes],
      )
      expect(msg).toContain('2 options')
      expect(msg).not.toContain('3 options')
    })

    it('CONTRAST CONTROL: a genuine third option still counts as three', () => {
      // Without this, the assertion above passes for a count stuck at 2 — or for
      // any implementation that under-counts. The pair is what proves the change
      // removed duplicates rather than removed counting.
      const msg = messageWithEdges(
        [...optionEdges, { id: 'e3', source: DECISION_ID, target: 'option-3', data: {} }],
        [decisionNode, ...optionNodes, { id: 'option-3', type: 'option', data: { type: 'option', label: 'Hire one' } }],
      )
      expect(msg).toContain('3 options')
    })

    it('singular stays singular when the one option is linked twice', () => {
      const msg = messageWithEdges(
        [
          { id: 'e1', source: DECISION_ID, target: 'option-1', data: {} },
          { id: 'e1-dup', source: DECISION_ID, target: 'option-1', data: {} },
        ],
        [decisionNode, optionNodes[0]],
      )
      expect(msg).toContain('1 option ')
      expect(msg).not.toContain('1 options')
    })
  })
})
