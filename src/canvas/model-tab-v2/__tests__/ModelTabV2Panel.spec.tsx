/**
 * ModelTabV2Panel — direct value editing at the mounted container.
 *
 * WHAT THIS PINS, and why each pin exists:
 *
 *  1. THE CANONICAL WRITE PATH. A v2 factor-value edit must commit through
 *     the SAME transaction the reference surface uses (`FactorsSection`
 *     `handleValueCommit`, ROADMAP 2.121 slice 1 / #513): build the wire event
 *     with `buildFactorValueEditEvent`, capture the optimistic undo BEFORE the
 *     write, write through the sanctioned setter (`setObservedValue` — value +
 *     raw_value + provenance stamp in ONE update), then dispatch
 *     `sendSystemEvent(event, { optimisticFactorEdit })`. A mutant that routes
 *     the write around the dispatch (skips the send, or drops the undo) must
 *     go RED here — that is this spec's primary job.
 *
 *  2. DIRECT EDIT INTENT. Enter and blur share one commit path. Opening an AI
 *     estimate never prefills the user's contribution; unchanged, malformed
 *     and composing input never writes. This brief supersedes the older
 *     Enter → proposal → Confirm interaction for factor values.
 *
 *  3. DISPATCH IS NOT ACCEPTANCE. The real store rerenders after its optimistic
 *     write. The row must still disclose that acknowledgement is unavailable,
 *     rather than borrowing the optimistic provenance stamp as success.
 *
 *  4. HONEST NON-CONNECTED AFFORDANCES. Rows whose edits have NO canonical
 *     wire carrier at this tip (relationships, options, goal) keep the
 *     disabled affordance with the honest label. Enabling them without a
 *     carrier would recreate design §2 F6 (a local write indistinguishable
 *     from a server-backed one) inside the surface built to kill it.
 *
 * The store is REAL (the sanctioned setters read the node back out of
 * `useCanvasStore.getState()` before writing); the conversation context is
 * mocked at the module seam exactly as `modelTabEditsAreTurns.spec.tsx` does.
 * Assertions bind by IDENTITY (testids carrying the node id), never by a value
 * predicate another element could satisfy (trap 19).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module rather than hand-listing its exports.
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'
import { normaliseRawFactorValue } from '../../utils/observedStateHelpers'

const FACTOR_ID = 'fac_monthly_eng_cost'
const CAP = 30000
const COMMITTED_RAW = 30000
const NEW_RAW = 20000
const GOAL_ID = 'goal_arr'
const OPTION_ID = 'opt_premium'
const EDGE_ID = 'e_cost_to_goal'

function cappedFactorNode(source = 'cee_inference'): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Monthly Engineering Cost',
      kind: 'factor',
      category: 'observable',
      observedState: {
        value: COMMITTED_RAW / CAP,
        raw_value: COMMITTED_RAW,
        cap: CAP,
        unit: '£',
        source,
      },
    },
  } as unknown as Node
}

function goalNode(): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Hit ARR target', kind: 'goal' },
  } as unknown as Node
}

function optionNode(): Node {
  return {
    id: OPTION_ID,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { label: 'Premium-first', kind: 'option', interventions: { [FACTOR_ID]: 0.6 } },
  } as unknown as Node
}

function stampedEdge(): Edge {
  return {
    id: EDGE_ID,
    source: FACTOR_ID,
    target: GOAL_ID,
    data: {
      label: 'Cost affects target',
      weight: 0.4,
      direction: 'positive',
      weightSource: 'user',
      directionSource: 'user',
    },
  } as unknown as Edge
}

function allNodes(): Node[] {
  return [goalNode(), optionNode(), cappedFactorNode()]
}

function seedStore(nodes = allNodes()) {
  useCanvasStore.setState(
    { nodes, edges: [stampedEdge()] } as never,
    false,
  )
}

function observed(id: string): Record<string, unknown> {
  const n = useCanvasStore.getState().nodes.find(x => x.id === id)
  return ((n?.data as Record<string, unknown> | undefined)?.observedState ?? {}) as Record<
    string,
    unknown
  >
}

/** Match ModelTabBody's live prop updates instead of freezing pre-edit nodes. */
function StoreBackedPanel({ modelIdentity }: { modelIdentity?: string }) {
  const nodes = useCanvasStore(state => state.nodes)
  const edges = useCanvasStore(state => state.edges)
  return (
    <ModelTabV2Panel
      nodes={nodes}
      edges={edges}
      goalThreshold={null}
      modelIdentity={modelIdentity}
    />
  )
}

function renderPanel(modelIdentity?: string) {
  return render(<StoreBackedPanel modelIdentity={modelIdentity} />)
}

function openValueEditor(id = FACTOR_ID): HTMLInputElement {
  fireEvent.click(screen.getByTestId(`model-row-v2-${id}-value`))
  return screen.getByTestId(`model-row-v2-${id}-value-input`) as HTMLInputElement
}

type CommitGesture = 'Enter' | 'blur'

function commitInput(input: HTMLInputElement, gesture: CommitGesture) {
  if (gesture === 'Enter') fireEvent.keyDown(input, { key: 'Enter' })
  else fireEvent.blur(input)
}

function editFactorValue(raw: string, gesture: CommitGesture = 'Enter', id = FACTOR_ID) {
  const input = openValueEditor(id)
  fireEvent.change(input, { target: { value: raw } })
  commitInput(input, gesture)
  return input
}

function expectNoChangeSettled(id = FACTOR_ID) {
  expect(screen.getByTestId(`model-row-v2-${id}`)).toHaveAttribute('data-phase', 'idle')
  expect(screen.queryByTestId(`model-row-v2-${id}-value-input`)).not.toBeInTheDocument()
  expect(screen.queryByTestId(`model-row-v2-${id}-confirm`)).not.toBeInTheDocument()
}

beforeEach(() => {
  vi.clearAllMocks()
  seedStore()
})

afterEach(() => cleanup())

// ─────────────────────────────────────────────────────────────────────────────
// Rendering + navigation
// ─────────────────────────────────────────────────────────────────────────────

describe('ModelTabV2Panel — outline, filter, tier, detail', () => {
  it('renders the outline with one row per element, bound by id', () => {
    renderPanel()
    expect(screen.getByTestId('model-tab-v2-panel')).toBeInTheDocument()
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()
    expect(screen.getByTestId(`model-row-v2-${GOAL_ID}`)).toBeInTheDocument()
    expect(screen.getByTestId(`model-row-v2-${OPTION_ID}`)).toBeInTheDocument()
    expect(screen.getByTestId(`model-row-v2-${EDGE_ID}`)).toBeInTheDocument()
  })

  it('the filter narrows rows by label — the F3 fix, working on the mounted surface', () => {
    renderPanel()
    fireEvent.change(screen.getByTestId('model-tab-v2-filter'), {
      target: { value: 'Engineering' },
    })
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${OPTION_ID}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${EDGE_ID}`)).not.toBeInTheDocument()
  })

  it('the tier is a content switch: element ids exist only in Advanced', () => {
    renderPanel()
    // Plain by default — the id span is ABSENT from the DOM, not hidden.
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-id`)).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('model-tab-v2-tier-advanced'))
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-id`)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('model-tab-v2-tier-plain'))
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-id`)).not.toBeInTheDocument()
  })

  it('selecting a row opens the detail region bound to that row id', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}`))
    const detail = screen.getByTestId('model-detail-v2')
    expect(detail).toHaveAttribute('data-row-id', FACTOR_ID)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The canonical write path
// ─────────────────────────────────────────────────────────────────────────────

describe('ModelTabV2Panel — factor value edits ride the canonical transaction', () => {
  it('opening an AI estimate leaves the contribution blank and shows Olumi separately', () => {
    renderPanel()
    const input = openValueEditor()
    expect(input.value).toBe('')
    expect(input).toHaveFocus()
    const row = screen.getByTestId(`model-row-v2-${FACTOR_ID}`)
    expect(row).toHaveTextContent(/Olumi/)
    expect(row).toHaveTextContent('£30,000')
    expect(observed(FACTOR_ID).source).toBe('cee_inference')
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it.each(['user_override', 'user_confirmed', 'user'])('a %s value is seeded and selected for replacement', source => {
    seedStore([goalNode(), optionNode(), cappedFactorNode(source)])
    renderPanel()
    const input = openValueEditor()
    expect(input.value).toBe(String(COMMITTED_RAW))
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it.each<CommitGesture>(['Enter', 'blur'])('%s commits once through the real setter and wire event, without Confirm', gesture => {
    renderPanel()
    const input = editFactorValue(String(NEW_RAW), gesture)
    // Enter can be followed by blur when its input unmounts. Replaying that
    // event must not create a second turn.
    fireEvent.blur(input)

    const obs = observed(FACTOR_ID)
    expect(obs.value).toBe(normaliseRawFactorValue(NEW_RAW, CAP))
    expect(obs.raw_value).toBe(NEW_RAW)
    expect(obs.source).toBe('user')

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const [event, opts] = sendSystemEvent.mock.calls[0]
    expect(event.type).toBe('factor_value_edit')
    expect(event.payload).toMatchObject({
      target_id: FACTOR_ID,
      value: normaliseRawFactorValue(NEW_RAW, CAP),
      field: 'value',
      raw_value: NEW_RAW,
      unit: '£',
    })

    expect(opts?.optimisticFactorEdit).toBeDefined()
    expect(opts.optimisticFactorEdit.nodeId).toBe(FACTOR_ID)
    expect(opts.optimisticFactorEdit.sentValue).toBe(normaliseRawFactorValue(NEW_RAW, CAP))
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm`)).not.toBeInTheDocument()

    // The host reads the post-write store, including its optimistic user stamp.
    // That stamp is not an acknowledgement and must not become settled UI truth.
    const row = screen.getByTestId(`model-row-v2-${FACTOR_ID}`)
    expect(row).toHaveAttribute('data-phase', 'unconfirmed')
    expect(row).toHaveTextContent('Not yet confirmed')
    expect(within(row).queryByText('User edited')).not.toBeInTheDocument()
  })

  it.each<CommitGesture>(['Enter', 'blur'])('untouched AI input on %s does not claim a contribution', gesture => {
    renderPanel()
    const input = openValueEditor()
    commitInput(input, gesture)
    expect(observed(FACTOR_ID).raw_value).toBe(COMMITTED_RAW)
    expect(observed(FACTOR_ID).source).toBe('cee_inference')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expectNoChangeSettled()
  })

  it.each(['30000', '30000.0', ' 3e4 ', '+30000'])('numerically unchanged AI value %s does not manufacture authorship', raw => {
    renderPanel()
    editFactorValue(raw)
    expect(observed(FACTOR_ID).raw_value).toBe(COMMITTED_RAW)
    expect(observed(FACTOR_ID).source).toBe('cee_inference')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expectNoChangeSettled()
  })

  it.each(['', '   '])('an empty contribution %j never turns the AI estimate into user authorship', raw => {
    renderPanel()
    editFactorValue(raw)
    expect(observed(FACTOR_ID).raw_value).toBe(COMMITTED_RAW)
    expect(observed(FACTOR_ID).source).toBe('cee_inference')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expectNoChangeSettled()
  })

  it.each<CommitGesture>(['Enter', 'blur'])('an untouched user-owned value on %s is a no-op', gesture => {
    seedStore([goalNode(), optionNode(), cappedFactorNode('user_override')])
    renderPanel()
    commitInput(openValueEditor(), gesture)
    expect(observed(FACTOR_ID).raw_value).toBe(COMMITTED_RAW)
    expect(observed(FACTOR_ID).source).toBe('user_override')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expectNoChangeSettled()
  })

  it('Escape cancels a changed draft and a following blur does not commit it', () => {
    renderPanel()
    const input = openValueEditor()
    fireEvent.change(input, { target: { value: String(NEW_RAW) } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-value-input`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm`)).not.toBeInTheDocument()
    expect(observed(FACTOR_ID).raw_value).toBe(COMMITTED_RAW)
    expect(observed(FACTOR_ID).source).toBe('cee_inference')
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it.each([
    '0.50.85', '0.85 or 0.9', '85%', 'NaN', 'Infinity', '-Infinity',
    '1,000', '0x10', '0b11', '0o17', '1e309', 'not a number',
  ])('rejects the whole invalid scalar %s visibly before any mutation', raw => {
    renderPanel()
    const input = editFactorValue(raw)
    expect(input).toHaveValue(raw)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-error`)).toBeVisible()
    fireEvent.blur(input)
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm`)).not.toBeInTheDocument()
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(observed(FACTOR_ID).raw_value).toBe(COMMITTED_RAW)
    expect(observed(FACTOR_ID).source).toBe('cee_inference')
  })

  it.each([
    ['20000.5', 20000.5],
    [' 2e4 ', 20000],
    ['+20000', 20000],
    ['.5', 0.5],
    ['0', 0],
  ])('accepts a complete finite scalar %s through the existing scale contract', (raw, expected) => {
    renderPanel()
    editFactorValue(String(raw))
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0][0].payload).toMatchObject({
      target_id: FACTOR_ID,
      raw_value: expected,
      value: normaliseRawFactorValue(Number(expected), CAP),
    })
  })

  it.each(['£15,000', 'Moderate'])('an AI display of %s keeps its model-scale cue explicit and sends the entered model value unchanged', displayValue => {
    const factor = cappedFactorNode()
    factor.data.display_value = displayValue
    factor.data.observedState = {
      value: 0.5,
      cap: CAP,
      unit: '£',
      source: 'cee_inference',
    }
    seedStore([goalNode(), factor])
    renderPanel()
    const input = openValueEditor()
    expect(input).toHaveValue('')
    const row = screen.getByTestId(`model-row-v2-${FACTOR_ID}`)
    expect(row).toHaveTextContent(`Olumi estimate: ${displayValue}`)
    expect(row).toHaveTextContent('Current model-scale value: 0.5')
    fireEvent.change(input, { target: { value: '0.85' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0][0].payload.value).toBe(0.85)
    expect(observed(FACTOR_ID).value).toBe(0.85)
  })

  it('a composing Enter and blur do not commit; Enter after composition does', () => {
    renderPanel()
    const input = openValueEditor()
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: String(NEW_RAW) } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 })
    fireEvent.blur(input)
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(observed(FACTOR_ID).raw_value).toBe(COMMITTED_RAW)
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-input`)).toBeInTheDocument()
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('keeps an unconfirmed row marked while another factor is selected and edited', () => {
    const second = { ...cappedFactorNode(), id: 'fac_second' }
    seedStore([...allNodes(), second])
    renderPanel()
    editFactorValue(String(NEW_RAW))

    fireEvent.click(screen.getByTestId('model-row-v2-fac_second'))
    const secondInput = openValueEditor('fac_second')
    expect(secondInput).toHaveFocus()
    const firstRow = screen.getByTestId(`model-row-v2-${FACTOR_ID}`)
    expect(firstRow).toHaveAttribute('data-phase', 'unconfirmed')
    expect(firstRow).toHaveTextContent('Not yet confirmed')
    expect(within(firstRow).queryByText('User edited')).not.toBeInTheDocument()

    fireEvent.change(secondInput, { target: { value: '10000' } })
    fireEvent.blur(secondInput)
    expect(sendSystemEvent).toHaveBeenCalledTimes(2)
    expect(sendSystemEvent.mock.calls.map(([event]) => event.payload.target_id)).toEqual([
      FACTOR_ID, 'fac_second',
    ])
    expect(firstRow).toHaveAttribute('data-phase', 'unconfirmed')
    expect(screen.getByTestId('model-row-v2-fac_second')).toHaveAttribute('data-phase', 'unconfirmed')
  })

  it('a synchronous transport failure never presents the optimistic value as confirmed', () => {
    sendSystemEvent.mockImplementationOnce(() => { throw new Error('transport unavailable') })
    renderPanel()
    editFactorValue(String(NEW_RAW))
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    // The authority may already have written optimistically before transport
    // throws; a store value alone must not certify persistence.
    expect(observed(FACTOR_ID).raw_value).toBe(NEW_RAW)
    const row = screen.getByTestId(`model-row-v2-${FACTOR_ID}`)
    expect(row).toHaveAttribute('data-phase', 'unconfirmed')
    expect(row).toHaveTextContent('Saving could not be confirmed')
    expect(within(row).queryByText('User edited')).not.toBeInTheDocument()
  })

  it.each(['editing', 'unconfirmed'])('changing model identity resets a %s row even when factor IDs are reused', phase => {
    const panel = renderPanel('model-a')
    const input = openValueEditor()
    fireEvent.change(input, { target: { value: String(NEW_RAW) } })
    if (phase === 'unconfirmed') fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toHaveAttribute('data-phase', phase)
    const sentBeforeNavigation = sendSystemEvent.mock.calls.length

    // Same row identity, different Living Model. Checking immediately after
    // rerender catches a reused draft/marker before a later interaction hides it.
    panel.rerender(<StoreBackedPanel modelIdentity="model-b" />)
    const row = screen.getByTestId(`model-row-v2-${FACTOR_ID}`)
    expect(row).toHaveAttribute('data-phase', 'idle')
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-value-input`)).not.toBeInTheDocument()
    expect(within(row).queryByText('Not yet confirmed')).not.toBeInTheDocument()
    expect(sendSystemEvent).toHaveBeenCalledTimes(sentBeforeNavigation)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Honest non-connected values
// ─────────────────────────────────────────────────────────────────────────────

describe('ModelTabV2Panel — rows with no canonical carrier are information, not controls', () => {
  it.each([
    ['relationship', EDGE_ID],
    ['option', OPTION_ID],
    ['goal', GOAL_ID],
  ])('the %s row value is static text', (_kind, id) => {
    renderPanel()
    const value = screen.getByTestId(`model-row-v2-${id}-value`)
    expect(value.tagName).toBe('SPAN')
    expect(value).not.toHaveAttribute('role', 'button')
  })

  it('POSITIVE CONTROL: the canonical factor value remains an enabled button', () => {
    renderPanel()
    const value = screen.getByTestId(`model-row-v2-${FACTOR_ID}-value`)
    expect(value.tagName).toBe('BUTTON')
    expect(value).toBeEnabled()
  })
})

/**
 * THE HAND-OFF SEAM — the third of three, and the one a mutation battery found
 * uncovered (18 Aug 2026, the rehome lane).
 *
 * The rehomed affordances pass through three independent gates before a turn can
 * be sent, and each fails CLOSED on its own:
 *
 *   1. `createOlumiHandOff(undefined)` → `null`      (pinned in olumiHandOff.spec)
 *   2. `ModelOutline` with no `onGroupAction` renders nothing
 *                                                    (pinned in groupActionsRehome.spec)
 *   3. THIS PANEL with no `onHandOffToOlumi` passes nothing down  ← was unpinned
 *
 * ⚠ WHY THAT MATTERED. A mutant that turned gate 1 into a no-op callable reddened
 * ONLY gate 1's spec, because the other two specs bypass it. Three gates guarding
 * one harm, each tested where it sits, and the middle one invisible from either
 * side — so a regression in the panel's own `onHandOffToOlumi ? … : undefined`
 * conditional would have shipped under a fully green suite. That is the estate's
 * "guard agreeing with itself" one layer out: every instrument was correct and
 * none of them was pointed here.
 */
describe('ModelTabV2Panel — the rehomed affordances, at the mounted consumer', () => {
  beforeEach(() => {
    seedStore()
  })

  it('renders the rehomed group actions and hands the EXACT message up', () => {
    const onHandOffToOlumi = vi.fn()
    render(
      <ModelTabV2Panel
        nodes={allNodes()}
        edges={[stampedEdge()]}
        goalThreshold={null}
        onHandOffToOlumi={onHandOffToOlumi}
      />,
    )
    fireEvent.click(screen.getByTestId('model-action-v2-factors-add'))
    expect(onHandOffToOlumi).toHaveBeenCalledTimes(1)
    expect(onHandOffToOlumi.mock.calls[0][0]).toBe('I want to add a new factor to the model')
    // The reason names the action by ID, so a debug trace can be attributed to
    // one affordance rather than to "the Model tab".
    expect(onHandOffToOlumi.mock.calls[0][1]).toBe('model-tab-v2:factors-add')
  })

  it('GATE 3: with no hand-off, the panel renders NO affordance at all', () => {
    renderPanel()
    expect(screen.queryByTestId('model-action-v2-factors-add')).toBeNull()
    expect(screen.queryByTestId('model-action-v2-relationships-add')).toBeNull()
    expect(screen.queryByTestId('model-action-v2-risks-add')).toBeNull()
    expect(screen.queryByTestId('model-action-v2-options-explore')).toBeNull()
    // CONTRAST CONTROL: the panel and its rows DID render, so the absences above
    // are about the affordances and not about a render that never happened.
    expect(screen.getByTestId('model-tab-v2-panel')).toBeInTheDocument()
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()
  })

  it('the goal hand-off quotes the goal row THIS PANEL projected (P5)', () => {
    const onHandOffToOlumi = vi.fn()
    render(
      <ModelTabV2Panel
        nodes={allNodes()}
        edges={[stampedEdge()]}
        goalThreshold={null}
        onHandOffToOlumi={onHandOffToOlumi}
      />,
    )
    fireEvent.click(screen.getByTestId('model-action-v2-goal-discuss'))
    // The label is the goal NODE's label, taken from the projected row — not a
    // second read of the store, and not the node id.
    expect(onHandOffToOlumi.mock.calls[0][0]).toContain("'Hit ARR target'")
    expect(onHandOffToOlumi.mock.calls[0][0]).not.toContain(GOAL_ID)
  })

  it('a relationship row reads in English, not in wire ids, at the mounted consumer', () => {
    // `stampedEdge()` carries its own label, so assert the derived path with an
    // edge that does NOT — the case that produced `fac_… → goal_…` on screen.
    const unlabelled = {
      id: 'e_unlabelled',
      source: FACTOR_ID,
      target: GOAL_ID,
      data: { weight: 0.4, direction: 'positive', weightSource: 'user' },
    } as unknown as Edge
    render(
      <ModelTabV2Panel nodes={allNodes()} edges={[unlabelled]} goalThreshold={null} />,
    )
    const row = screen.getByTestId('model-row-v2-e_unlabelled')
    expect(row.textContent).toContain('Monthly Engineering Cost → Hit ARR target')
    expect(row.textContent).not.toContain(FACTOR_ID)
    expect(row.textContent).not.toContain(GOAL_ID)
  })
})
