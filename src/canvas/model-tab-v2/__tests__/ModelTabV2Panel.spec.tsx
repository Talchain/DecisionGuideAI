/**
 * ModelTabV2Panel — the mount train's container spec (16 Aug 2026).
 *
 * WHAT THIS PINS, and why each pin exists:
 *
 *  1. THE CANONICAL WRITE PATH. A v2 factor-value confirm must commit through
 *     the SAME transaction the reference surface uses (`FactorsSection`
 *     `handleValueCommit`, ROADMAP 2.121 slice 1 / #513): build the wire event
 *     with `buildFactorValueEditEvent`, capture the optimistic undo BEFORE the
 *     write, write through the sanctioned setter (`setObservedValue` — value +
 *     raw_value + provenance stamp in ONE update), then dispatch
 *     `sendSystemEvent(event, { optimisticFactorEdit })`. A mutant that routes
 *     the write around the dispatch (skips the send, or drops the undo) must
 *     go RED here — that is this spec's primary job.
 *
 *  2. THE INLINE-CHIP CONFIRM (ruling R9). The three-beat is edit → propose
 *     (nothing has changed yet) → confirm/discard chips in the row. No modal.
 *     Until Confirm is clicked the store must be UNTOUCHED and nothing may be
 *     sent — `proposed` is a statement of intent, not a write.
 *
 *  3. HONEST NON-CONNECTED AFFORDANCES. Rows whose edits have NO canonical
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
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
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

function cappedFactorNode(): Node {
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
        source: 'cee_inference',
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

function seedStore() {
  useCanvasStore.setState(
    { nodes: allNodes(), edges: [stampedEdge()] } as never,
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

function renderPanel() {
  render(
    <ModelTabV2Panel
      nodes={allNodes()}
      edges={[stampedEdge()]}
      goalThreshold={null}
    />,
  )
}

/** Drive the row to the PROPOSED state: click value → type → Enter. */
function proposeFactorValue(raw: string) {
  fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value`))
  const input = screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-input`)
  fireEvent.change(input, { target: { value: raw } })
  fireEvent.keyDown(input, { key: 'Enter' })
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
  it('clicking the value opens an input seeded from raw_value (the one seed rule)', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value`))
    const input = screen.getByTestId(
      `model-row-v2-${FACTOR_ID}-value-input`,
    ) as HTMLInputElement
    expect(input.value).toBe(String(COMMITTED_RAW))
  })

  it('Enter proposes: confirm/discard chips render, the store is untouched, nothing is sent', () => {
    renderPanel()
    proposeFactorValue(String(NEW_RAW))
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-confirm`)).toBeInTheDocument()
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-discard`)).toBeInTheDocument()
    // Nothing has changed yet — the design's own words for this beat.
    expect(observed(FACTOR_ID).raw_value).toBe(COMMITTED_RAW)
    expect(observed(FACTOR_ID).source).toBe('cee_inference')
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  /**
   * ⭐⭐ THE CAPTION MAY NOT CONTRADICT THE DIFF IT SITS BESIDE.
   *
   * This beat renders `from → to` and a caption in ONE cell. The caption is
   * about the STORE — nothing is written until Confirm, which the test above
   * pins — but it had been worded "Nothing has changed yet", two atoms to the
   * right of "Not set → 45". Witnessed on the deployed build `b14cd478`
   * (guest, 291px dock, live-drafted model, completed run), the cell read:
   *
   *   "Not set → 45 · Nothing has changed yet · Confirm · Discard"
   *
   * A reader takes that as a denial of the value they just typed. "Not applied
   * yet" makes the same true statement about the same subject without
   * contradicting the diff.
   *
   * This asserts the PROPERTY, not the string: whatever the caption says, it
   * must not claim nothing changed while a proposed value is on screen.
   */
  it('the proposed-value caption does not deny the change staged beside it', () => {
    renderPanel()
    proposeFactorValue(String(NEW_RAW))
    const cell = screen.getByTestId(`model-row-v2-${FACTOR_ID}-value`)

    // Precondition pinned in-arm: a diff must actually be on screen, or the
    // assertion below is about a cell in some other state.
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-to`).textContent).toBe(String(NEW_RAW))

    expect(
      /nothing has changed/i.test(cell.textContent ?? ''),
      `the cell shows a staged change and also claims nothing changed: "${cell.textContent}"`,
    ).toBe(false)
  })

  it('⭐ Confirm commits through the sanctioned setter AND dispatches the wire event with its undo', () => {
    renderPanel()
    proposeFactorValue(String(NEW_RAW))
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-confirm`))

    // The sanctioned-setter write: value + raw_value + stamp, one update.
    const obs = observed(FACTOR_ID)
    expect(obs.value).toBe(normaliseRawFactorValue(NEW_RAW, CAP))
    expect(obs.raw_value).toBe(NEW_RAW)
    expect(obs.source).toBe('user')

    // The wire event — the SAME shape the reference surface emits.
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

    // The optimistic undo rides WITH the send — the dispatcher owns refusal
    // resolution (revert) and acceptance (stamp). A confirm without it would
    // keep a refused number on screen: the 2.129(b) split-brain.
    expect(opts?.optimisticFactorEdit).toBeDefined()
    expect(opts.optimisticFactorEdit.nodeId).toBe(FACTOR_ID)
    expect(opts.optimisticFactorEdit.sentValue).toBe(normaliseRawFactorValue(NEW_RAW, CAP))
  })

  it('Discard reverts to idle: store untouched, nothing sent, original value shown', () => {
    renderPanel()
    proposeFactorValue(String(NEW_RAW))
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-discard`))
    expect(observed(FACTOR_ID).raw_value).toBe(COMMITTED_RAW)
    expect(observed(FACTOR_ID).source).toBe('cee_inference')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    // Back to the idle affordance, still bound to this row.
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value`)).toBeInTheDocument()
    expect(
      screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm`),
    ).not.toBeInTheDocument()
  })

  it('Escape in the input cancels without proposing', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value`))
    const input = screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-input`)
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(
      screen.queryByTestId(`model-row-v2-${FACTOR_ID}-value-input`),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm`)).not.toBeInTheDocument()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('a non-numeric draft cannot be proposed: Enter keeps the input open, nothing is sent', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value`))
    const input = screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-input`)
    fireEvent.change(input, { target: { value: 'not a number' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-input`)).toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm`)).not.toBeInTheDocument()
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(observed(FACTOR_ID).raw_value).toBe(COMMITTED_RAW)
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
