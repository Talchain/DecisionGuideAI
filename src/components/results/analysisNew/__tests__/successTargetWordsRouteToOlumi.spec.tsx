/**
 * E3 of the reasoning-V2 editability map (Bundle B, interim chat route).
 *
 * There is no words field on a goal node — `goalTarget.ts` reads only
 * `success_threshold` / `goal_threshold_raw` — so "In words" cannot commit
 * anything. The map's own fix (E3, "Bundle B interim, LOW") is: offer the
 * field, and route it through the existing ask composer, honestly labelled as
 * a message rather than a save.
 *
 * ⚠⚠ THE CENTRAL CLAIM THIS FILE PINS: sending words NEVER calls either write
 * carrier (`setGoalThresholdAndUpdateNode` or `proposeGoalTarget`) and NEVER
 * reports a commit outcome to the caller. A control that quietly wrote a
 * number from a words draft, or told its caller "dispatched" for a message
 * that was never a proposal, would be the exact lying-editor defect this
 * file's sibling (`successTargetDispatches.spec.tsx`) already found once on
 * this same component.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const setGoalThresholdAndUpdateNode = vi.fn()
let state: Record<string, unknown> = {}
vi.mock('../../../../canvas/store', () => {
  const useCanvasStore = (select: (s: Record<string, unknown>) => unknown) => select(state)
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})

const proposeGoalTarget = vi.fn(() => 'dispatched' as const)
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable: true,
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
  state = {
    nodes: [{ id: 'goal-words', type: 'goal', data: { label: 'Reduce onboarding time' } }],
    goalThreshold: null,
    goalThresholdRepresentation: null,
    setGoalThresholdAndUpdateNode,
  }
})
afterEach(cleanup)

const openWordsEditor = async () => {
  const user = userEvent.setup()
  const onCommitOutcome = vi.fn()
  render(
    <SuccessTargetLine goalNodeId="goal-words" onCommitOutcome={onCommitOutcome} testId={TID} />,
  )
  await user.click(screen.getByTestId(`${TID}-edit`))
  await user.click(screen.getByTestId(`${TID}-mode-words`))
  return { user, onCommitOutcome }
}

describe('the editor offers an "In words" mode', () => {
  it('shows the words textarea and hides the numeric input once selected', async () => {
    await openWordsEditor()
    expect(screen.getByTestId(`${TID}-words-input`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-input`)).toBeNull()
  })

  it('defaults to number mode on a fresh open — the untouched interaction is unchanged', async () => {
    const user = userEvent.setup()
    render(<SuccessTargetLine goalNodeId="goal-words" onCommitOutcome={vi.fn()} testId={TID} />)
    await user.click(screen.getByTestId(`${TID}-edit`))
    expect(screen.getByTestId(`${TID}-input`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-words-input`)).toBeNull()
  })

  it('the send act is disabled until something is typed', async () => {
    await openWordsEditor()
    expect(screen.getByTestId(`${TID}-words-send`)).toBeDisabled()
  })
})

describe('sending words routes to Olumi, and commits nothing', () => {
  it('opens the shared composer with the exact words typed, prefixed honestly', async () => {
    const { user } = await openWordsEditor()
    await user.type(
      screen.getByTestId(`${TID}-words-input`),
      'Faster delivery without more overtime',
    )
    await user.click(screen.getByTestId(`${TID}-words-send`))

    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(openAskOlumi).mock.calls[0][0]
    expect(payload.draft).toBe(
      'This is what success would look like:\nFaster delivery without more overtime',
    )
    expect(payload.targetId).toBe('goal-words')
  })

  /**
   * ⭐⭐ THE DISCRIMINATING TWIN. A control that always sent the same fixed
   * sentence would pass the case above. This binds the draft to the ACTUAL
   * typed text, not to a message the component composed on its own.
   */
  it('…and a DIFFERENT typed sentence produces a DIFFERENT draft', async () => {
    const { user } = await openWordsEditor()
    await user.type(screen.getByTestId(`${TID}-words-input`), 'Zero customer-visible outages')
    await user.click(screen.getByTestId(`${TID}-words-send`))
    const payload = vi.mocked(openAskOlumi).mock.calls[0][0]
    expect(payload.draft).toContain('Zero customer-visible outages')
    expect(payload.draft).not.toContain('overtime')
  })

  it('⛔ never writes the local carrier', async () => {
    const { user } = await openWordsEditor()
    await user.type(screen.getByTestId(`${TID}-words-input`), 'A calmer on-call rotation')
    await user.click(screen.getByTestId(`${TID}-words-send`))
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
  })

  it('⛔ never asks the dispatch authority — this is a message, not a proposal', async () => {
    const { user } = await openWordsEditor()
    await user.type(screen.getByTestId(`${TID}-words-input`), 'A calmer on-call rotation')
    await user.click(screen.getByTestId(`${TID}-words-send`))
    expect(proposeGoalTarget).not.toHaveBeenCalled()
  })

  it('⛔⛔ never reports a commit outcome — nothing was committed to report', async () => {
    const user = userEvent.setup()
    const onCommitOutcome = vi.fn()
    render(
      <SuccessTargetLine goalNodeId="goal-words" onCommitOutcome={onCommitOutcome} testId={TID} />,
    )
    await user.click(screen.getByTestId(`${TID}-edit`))
    await user.click(screen.getByTestId(`${TID}-mode-words`))
    await user.type(screen.getByTestId(`${TID}-words-input`), 'A calmer on-call rotation')
    await user.click(screen.getByTestId(`${TID}-words-send`))
    expect(onCommitOutcome).not.toHaveBeenCalled()
  })

  it('closes the editor once sent', async () => {
    const { user } = await openWordsEditor()
    await user.type(screen.getByTestId(`${TID}-words-input`), 'A calmer on-call rotation')
    await user.click(screen.getByTestId(`${TID}-words-send`))
    expect(screen.queryByTestId(`${TID}-editor`)).toBeNull()
  })

  it('a blank draft sends nothing at all', async () => {
    const { user } = await openWordsEditor()
    // The button is disabled; a stray Enter/click must not slip a blank
    // message past it either.
    await user.click(screen.getByTestId(`${TID}-words-send`))
    expect(openAskOlumi).not.toHaveBeenCalled()
    expect(screen.getByTestId(`${TID}-words-input`)).toBeInTheDocument()
  })
})
