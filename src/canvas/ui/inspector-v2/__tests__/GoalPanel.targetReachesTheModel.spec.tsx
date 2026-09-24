/**
 * ⭐⭐ THE GOAL TARGET IS EDITABLE IN THE CANVAS INSPECTOR, THROUGH THE SAME
 * WRITER THE MODEL TAB USES.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * The Inspector's goal target control was `GoalThresholdEditor`, whose commit
 * is `setGoalThresholdAndUpdateNode` — a store-only write with no wire carrier —
 * and it sat inside `InspectorRouter`'s `<fieldset disabled>` because `'goal'`
 * was not in `AUTHORITY_OWNING_PANELS`. The only route that reached the shared
 * model was the goal card → Model tab → `SuccessTargetLine` →
 * `useModelEditAuthority.proposeGoalTarget` → a typed `add_constraint`.
 * `goalChipPromiseVsDestination.spec.tsx` measured the Inspector destination
 * "present AND INERT" (EDITABILITY-MATRIX-20260924, Goal row 2).
 *
 * ── THE FIX ──────────────────────────────────────────────────────────────────
 * The goal pane opts into `AUTHORITY_OWNING_PANELS` and renders
 * `SuccessTargetLine` ITSELF as its target control — not a copy of it — so the
 * direction (at least / at most), the value and the unit are collected by the
 * same component and committed by the same `proposeGoalTarget`, with no local
 * echo. The carrier-less `GoalThresholdEditor` is not rendered on that pane, and
 * every other writer (description, constraints, advanced editor) sits behind
 * the panel's own fence.
 *
 * ── WHAT THIS FILE ASKS, THROUGH THE REAL ROUTER ─────────────────────────────
 *   1. the target control is operable (userEvent refuses a disabled target);
 *   2. a stated target DISPATCHES `add_constraint` — target id bound by the
 *      goal's identity, value, unit, and the direction the reader chose BY ITS
 *      WORD ON SCREEN, as a direction PAIR (trap 22b: one door is not a guard);
 *   3. no local echo — the node's target fields are untouched by the dispatch;
 *   4. the store-only editor cannot be operated;
 *   5. CONTRAST: description, add-constraint and the advanced editor stay
 *      fenced, and a pane that took on no duty (risk) keeps the Router wrap.
 * Every expectation is a literal (trap 13b).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Node } from '@xyflow/react'

const dispatchAction = vi.fn()
const sendSystemEvent = vi.fn()

vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
vi.mock('../../../conversation/ConversationContext', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOptionalConversationContext: () => ({ dispatchAction, sendSystemEvent }),
}))
vi.mock('../../../../contexts/AuthContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn(() => ({ authenticated: true, user: { id: 'u-1', email: 'a@b.io' } })) }
})

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

const GOAL_ID = 'goal_mrr'
const RISK_ID = 'risk_churn'
const SCENARIO_ID = 'scenario-a'

function goalNode(): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: {
      kind: 'goal',
      label: 'Reach £30k MRR within 18 months',
      // The goal DECLARES its unit, so the control offers no unit box and the
      // dispatch carries the producer's unit.
      goal_threshold_unit: '£',
      // A description, so the fenced description writer is a real <textarea>.
      description: 'Monthly recurring revenue we need by month 18.',
    },
  } as unknown as Node
}

function seed() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      goalNode(),
      { id: RISK_ID, type: 'risk', position: { x: 0, y: 0 }, data: { kind: 'risk', label: 'Churn spikes' } },
    ] as never[],
    edges: [] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    goalThresholdRepresentation: null,
    goalConstraints: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function isInert(el: Element | null): boolean {
  if (el === null) return true
  if (el.hasAttribute('disabled')) return true
  return el.closest('fieldset[disabled]') !== null
}

function openGoal() {
  return render(<InspectorRouter nodeId={GOAL_ID} edgeId={null} onClose={vi.fn()} />)
}

/** Open the target editor, choose a direction BY ITS WORD, type, save. */
async function stateTarget(amount: string, directionWord?: 'at least' | 'at most') {
  const user = userEvent.setup()
  await user.click(screen.getByTestId('goal-panel-target-edit'))
  if (directionWord !== undefined) {
    const select = screen.getByTestId('goal-panel-target-direction')
    await user.selectOptions(select, within(select).getByRole('option', { name: directionWord }))
  }
  const input = screen.getByTestId('goal-panel-target-input')
  await user.clear(input)
  await user.type(input, amount)
  await user.click(screen.getByTestId('goal-panel-target-save'))
}

function onlyDispatch() {
  expect(dispatchAction, 'no add_constraint was dispatched — the target never left the panel').toHaveBeenCalledTimes(1)
  return dispatchAction.mock.calls[0][0] as {
    action_type: string
    parameters: Record<string, unknown>
    message: string
  }
}

beforeEach(() => {
  dispatchAction.mockReset()
  dispatchAction.mockResolvedValue(undefined)
  sendSystemEvent.mockReset()
  seed()
})
afterEach(cleanup)

describe('the goal target control is operable through the mounted Router', () => {
  it('renders the target control and it is NOT inert', () => {
    openGoal()
    const edit = screen.getByTestId('goal-panel-target-edit')
    expect(isInert(edit), 'the goal target control is inert — no user can set a target').toBe(false)
  })

  it('the store-only threshold editor cannot be operated on this pane', () => {
    const { container } = openGoal()
    // `GoalThresholdEditor` owns `#goal-threshold`; its commit is a store-only
    // write. Absent or inert are both acceptable — enabled is the defect.
    const legacy = container.querySelector('#goal-threshold')
    expect(isInert(legacy), 'a carrier-less target writer is live beside the real one').toBe(true)
  })
})

describe('a stated target DISPATCHES add_constraint through proposeGoalTarget', () => {
  it('"at most" — the reader\'s ceiling is what the wire carries', async () => {
    openGoal()
    await stateTarget('30000', 'at most')
    const action = onlyDispatch()
    expect(action.action_type).toBe('add_constraint')
    expect(action.parameters.target_id).toBe(GOAL_ID)
    expect(action.parameters.constraint_type).toBe('at_most')
    expect(action.parameters.value).toBe(30000)
    expect(action.parameters.unit).toBe('£')
    expect(action.message).toBe('This goal must be at most £30000. This is an absolute level, not a change from the current level.')
  })

  it('TWIN — the untouched default is "at least", and says so on the wire', async () => {
    openGoal()
    await stateTarget('30000')
    const action = onlyDispatch()
    expect(action.parameters.target_id).toBe(GOAL_ID)
    expect(action.parameters.constraint_type).toBe('at_least')
    expect(action.message).toBe('This goal must be at least £30000. This is an absolute level, not a change from the current level.')
  })

  it('writes NOTHING locally — the applied response owns the store write', async () => {
    openGoal()
    await stateTarget('30000', 'at most')
    expect(dispatchAction).toHaveBeenCalledTimes(1)
    const data = useCanvasStore.getState().nodes.find(n => n.id === GOAL_ID)!.data as Record<string, unknown>
    expect(data.success_threshold).toBeUndefined()
    expect(data.goal_threshold_raw).toBeUndefined()
    expect(data.threshold_source).toBeUndefined()
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
  })

  /**
   * ⛔ THE RECEIPT PROMISES NO OUTCOME (independent review of #1954, 5820109030).
   * `dispatched` means `add_constraint` was HANDED to the conversation — an
   * LLM-mediated tool that, in OpenAI mode, has no goal-target writer (#63
   * 5818078809: `goal_threshold_raw` unchanged). "The shared model updates when
   * it answers" then sat under the control contradicting both the reply and the
   * model. The reply is the only surface that knows; the receipt points at it.
   */
  it('says it was SENT and that the reply says whether it was recorded — never that the model will update', async () => {
    openGoal()
    await stateTarget('30000')
    expect(screen.getByText('Sent to Olumi. Its reply says whether the target was recorded.')).toBeTruthy()
    expect(screen.queryByText(/shared model updates/i)).toBeNull()
  })

  it('NEGATIVE CONTROL — an unreadable draft dispatches nothing', async () => {
    openGoal()
    await stateTarget('thirty thousand')
    expect(dispatchAction).not.toHaveBeenCalled()
  })
})

describe('every other writer on the goal pane stays fenced', () => {
  it('fences the DESCRIPTION', () => {
    const { container } = openGoal()
    const fence = container.querySelector('fieldset[data-writer-fence="description"]')
    expect(fence, 'the description writer must sit behind its own fence').not.toBeNull()
    expect(isInert(within(fence as HTMLElement).getByRole('textbox'))).toBe(true)
  })

  it('fences a constraint\'s VALUE input — `setGoalConstraints` is not a system-event carrier', () => {
    useCanvasStore.setState({
      goalConstraints: [
        { constraint_id: 'c-churn', node_id: RISK_ID, operator: '<=', value: 5, label: 'Churn', provenance: 'explicit' },
      ],
    } as never)
    const { container } = openGoal()
    const input = container.querySelector('[data-testid="goal-constraint-c-churn-value-input"]')
    expect(input, 'PRECONDITION: the constraint value input is rendered').not.toBeNull()
    expect(input!.closest('fieldset[data-writer-fence="constraint-value"]'),
      'the constraint value writer must sit behind its own fence').not.toBeNull()
    expect(isInert(input), 'a constraint value writer is live with no carrier').toBe(true)
  })

  it('fences ADD CONSTRAINT', () => {
    const { container } = openGoal()
    const fence = container.querySelector('fieldset[data-writer-fence="add-constraint"]')
    expect(fence, 'the add-constraint writer must sit behind its own fence').not.toBeNull()
    expect(isInert(within(fence as HTMLElement).getByTestId('add-constraint-button'))).toBe(true)
  })

  it('fences the ADVANCED EDITOR — its threshold setters are bare store writes', async () => {
    const { container } = openGoal()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Show technical detail' }))
    await user.click(screen.getByRole('button', { name: /Show model detail/i }))
    const fence = container.querySelector('fieldset[data-writer-fence="advanced-editor"]')
    expect(fence, 'the advanced editor must sit behind its own fence').not.toBeNull()
    expect(isInert(within(fence as HTMLElement).getByLabelText('Raw threshold'))).toBe(true)
  })

  it('CONTRAST — a pane that owns no fence keeps the Router wrap', () => {
    const { container } = render(<InspectorRouter nodeId={RISK_ID} edgeId={null} onClose={vi.fn()} />)
    expect(container.querySelector('[data-authority="disabled"]')).not.toBeNull()
  })
})
