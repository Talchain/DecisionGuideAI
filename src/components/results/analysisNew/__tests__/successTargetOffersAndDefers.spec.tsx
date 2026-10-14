/**
 * E2 + E4 of the reasoning-V2 editability map (Bundle B).
 *
 * E2: the editor offers an AI act — "Ask Olumi to help define success" — at
 * rest, beside the existing Set/Change button, matching the prototype's
 * `ask-goal` (P:536, P:610). It never writes the model; it opens the shared
 * ask composer.
 *
 * E4: the editor offers "Not sure yet" (prototype `goal-later`, P:536, P:612).
 * Pressing it closes the editor WITHOUT writing anything — the product rule
 * this bundle exists to honour. A plain "Cancel" is offered alongside it for
 * the same reason every other editor on this panel has one.
 *
 * ⚠ WRITE ASSERTIONS ARE BOUND BY IDENTITY: this file proves the two dismiss
 * routes call NEITHER the retired store writer (`setGoalThresholdAndUpdateNode`)
 * nor the dispatched carrier (`proposeGoalTarget`). With no dispatcher Save
 * refuses and retains the draft; a dispatched Save contrast in the same run
 * prevents an always-inert editor passing by accident (CLAUDE.md's own
 * "every absence claim needs a contrast control" rule).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useShowToast } from '../../../../canvas/ToastContext'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const setGoalThresholdAndUpdateNode = vi.fn()
let state: Record<string, unknown> = {}
vi.mock('../../../../canvas/store', () => {
  const useCanvasStore = (select: (s: Record<string, unknown>) => unknown) => select(state)
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})

const proposeGoalTarget = vi.fn(() => 'dispatched' as const)
let goalTargetDispatchAvailable = false
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable,
    captureScenarioId: () => 'scenario-1',
    proposeGoalTarget,
  }),
}))

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { SuccessTargetLine } from '../sections/SuccessTargetLine'
import { openAskOlumi } from '../../coaching/askOlumiStore'

const TID = 'target'

beforeEach(() => {
  setGoalThresholdAndUpdateNode.mockReset()
  proposeGoalTarget.mockReset().mockReturnValue('dispatched')
  vi.mocked(openAskOlumi).mockReset()
  goalTargetDispatchAvailable = false
  state = {
    nodes: [{ id: 'g1', type: 'goal', data: { label: 'Grow net revenue retention' } }],
    goalThreshold: null,
    goalThresholdRepresentation: null,
    setGoalThresholdAndUpdateNode,
  }
})
afterEach(cleanup)

const draw = (goalNodeId: string | null = 'g1') => {
  const onCommitOutcome = vi.fn()
  function Target() {
    const showToast = useShowToast()
    return <SuccessTargetLine goalNodeId={goalNodeId} onCommitOutcome={outcome => {
      onCommitOutcome(outcome)
      showToast(outcome === 'dispatched' ? COPY.successTarget.dispatched :
        outcome === 'local_only' ? COPY.successTarget.changedLocally : COPY.successTarget.notEncodable)
    }} testId={TID} />
  }
  render(<ToastProvider><Target /></ToastProvider>)
  return onCommitOutcome
}

describe('E2: the AI act is offered at rest, and it asks rather than writes', () => {
  it('renders the ask control beside Set/Change, before the editor is even opened', () => {
    draw()
    expect(screen.getByTestId(`${TID}-ask`)).toBeInTheDocument()
    // Nothing has been touched yet — no write function may have fired.
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(proposeGoalTarget).not.toHaveBeenCalled()
  })

  it('opens the shared composer bound to THIS goal node, not a fixed id', async () => {
    const user = userEvent.setup()
    draw('goal-alpha')
    await user.click(screen.getByTestId(`${TID}-ask`))

    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(openAskOlumi).mock.calls[0][0]
    expect(payload.targetId).toBe('goal-alpha')
    expect(payload.draft).toMatch(/in words first/i)
    // ⛔ Never a claim of a write — this control cannot commit anything.
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(proposeGoalTarget).not.toHaveBeenCalled()
  })

  /**
   * ⭐ THE DISCRIMINATING TWIN. A button wired to a constant id passes the case
   * above and fails this one.
   */
  it('…and a DIFFERENT goal node produces a DIFFERENT targetId', async () => {
    const user = userEvent.setup()
    cleanup()
    state = {
      nodes: [{ id: 'goal-beta', type: 'goal', data: {} }],
      goalThreshold: null,
      goalThresholdRepresentation: null,
      setGoalThresholdAndUpdateNode,
    }
    draw('goal-beta')
    await user.click(screen.getByTestId(`${TID}-ask`))
    expect(vi.mocked(openAskOlumi).mock.calls[0][0].targetId).toBe('goal-beta')
    expect(vi.mocked(openAskOlumi).mock.calls[0][0].targetId).not.toBe('goal-alpha')
  })
})

describe('E4: "Not sure yet" closes the editor and writes nothing', () => {
  it('is offered inside the open editor', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByTestId(`${TID}-edit`))
    expect(screen.getByTestId(`${TID}-defer`)).toBeInTheDocument()
  })

  it('writes NEITHER carrier, and closes the editor', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByTestId(`${TID}-edit`))
    await user.type(screen.getByTestId(`${TID}-input`), '110')
    await user.click(screen.getByTestId(`${TID}-defer`))

    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    expect(screen.queryByTestId(`${TID}-editor`)).toBeNull()
  })

  /**
   * ⭐⭐ THE NO-DISPATCH CONTRAST: Save refuses visibly and keeps the draft,
   * unlike "Not sure yet", which dismisses it. No local-only store write remains.
   */
  it('CONTROL: Save without a dispatcher refuses, writes nothing and keeps the draft', async () => {
    const user = userEvent.setup()
    const onCommitOutcome = draw()
    await user.click(screen.getByTestId(`${TID}-edit`))
    await user.type(screen.getByTestId(`${TID}-input`), '110')
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    expect(onCommitOutcome).toHaveBeenCalledOnce()
    expect(onCommitOutcome).toHaveBeenCalledWith('local_only')
    expect(COPY.successTarget.changedLocally).toBe("Not saved: this target can't be sent to Olumi right now.")
    expect(screen.getByRole('alert')).toHaveTextContent("Not saved: this target can't be sent to Olumi right now.")
    expect(screen.getByTestId(`${TID}-editor`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-input`)).toHaveValue('110')
  })

  it('CONTROL: Save with a dispatcher still sends the target and closes the editor', async () => {
    const user = userEvent.setup()
    goalTargetDispatchAvailable = true
    state.nodes = [{ id: 'g1', type: 'goal', data: { goal_threshold_unit: '%' } }]
    const onCommitOutcome = draw()
    await user.click(screen.getByTestId(`${TID}-edit`))
    await user.type(screen.getByTestId(`${TID}-input`), '110')
    await user.click(screen.getByTestId(`${TID}-save`))

    expect(proposeGoalTarget).toHaveBeenCalledOnce()
    expect(proposeGoalTarget).toHaveBeenCalledWith('110', '%', 'scenario-1', 'at_least', { onSendSettled: undefined })
    expect(onCommitOutcome).toHaveBeenCalledWith('dispatched')
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(screen.queryByTestId(`${TID}-editor`)).toBeNull()
  })
})

describe('Cancel: a plain dismiss, symmetric with every other editor on this panel', () => {
  it('closes the editor and writes nothing', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByTestId(`${TID}-edit`))
    await user.type(screen.getByTestId(`${TID}-input`), '250')
    await user.click(screen.getByTestId(`${TID}-cancel`))

    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    expect(screen.queryByTestId(`${TID}-editor`)).toBeNull()
  })

  it('is a DIFFERENT control from "Not sure yet" — both exist at once', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByTestId(`${TID}-edit`))
    expect(screen.getByTestId(`${TID}-cancel`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-defer`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-cancel`)).not.toBe(screen.getByTestId(`${TID}-defer`))
  })
})
