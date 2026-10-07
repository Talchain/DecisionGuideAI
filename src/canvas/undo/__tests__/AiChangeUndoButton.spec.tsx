import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { runCanvasUndo } = vi.hoisted(() => ({ runCanvasUndo: vi.fn(async () => 'done') }))
vi.mock('../undoCommand', () => ({ runCanvasUndo }))

import { AiChangeUndoButton, AI_CHANGE_UNDO_WORDS } from '../AiChangeUndoButton'
import { useUndoJournalStore } from '../captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL, recordEditReceipt } from '../undoJournal'
import { useCanvasStore } from '../../store'

const S = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const step = (gestureId: string) => recordEditReceipt(EMPTY_UNDO_JOURNAL, { scenarioId: S, gestureId, label: "Olumi's change",
  receipt: { mutationId: `m-${gestureId}`, versionId: '66666666-6666-4666-8666-666666666666', fullHash: '6'.repeat(64), undoVersionId: '55555555-5555-4555-8555-555555555555' } })

beforeEach(() => {
  runCanvasUndo.mockClear()
  useCanvasStore.setState({ currentScenarioId: S } as never)
  useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
})

describe('AiChangeUndoButton', () => {
  it('shows "Undo this change" on the reply whose change is the next undo, and the press is ⌘Z\'s own command', async () => {
    useUndoJournalStore.setState({ journal: step('turn-ai') })
    render(<AiChangeUndoButton turnId="turn-ai" />)
    fireEvent.click(screen.getByRole('button', { name: AI_CHANGE_UNDO_WORDS.aria }))
    expect(screen.getByTestId('ai-change-undo').textContent).toBe('Undo this change')
    await waitFor(() => expect(runCanvasUndo).toHaveBeenCalledWith('undo'))
  })
  it('is absent on any other reply, and when there is nothing to undo', () => {
    useUndoJournalStore.setState({ journal: step('turn-ai') })
    const { rerender } = render(<AiChangeUndoButton turnId="turn-other" />)
    expect(screen.queryByTestId('ai-change-undo')).toBeNull()
    useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
    rerender(<AiChangeUndoButton turnId="turn-ai" />)
    expect(screen.queryByTestId('ai-change-undo')).toBeNull()
  })
})
