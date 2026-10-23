/**
 * The composer's reasoning moves (Paul, 23 Oct: restore the icons at the bottom of the AI panel). Each enabled move sends
 * ONE chip turn through the existing press paths, with Olumi's own question; a move that cannot run says why and sends
 * nothing; the person's draft is never touched (the row has no access to it).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ComposerMoves } from '../ComposerMoves'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useActionBarStore } from '../actionBarStore'
import { clearAskTargetBinding, takeAskTargetBinding } from '../../../ui/inspector-v2/askTargetBinding'

vi.mock('../../revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
vi.mock('../../../state/analysisStateSelector', () => ({ selectRunAffirmedCurrent: vi.fn(() => false) }))
vi.mock('../../../ui/inspector-v2/useAnalysisResults', () => ({ selectRunWithholdsFigures: vi.fn(() => false) }))

const nodes = [
  { id: 'cap', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Capacity', value: 42 } },
  { id: 'goal', type: 'goal', position: { x: 1, y: 1 }, data: { label: 'Delivery' } },
  { id: 'q', type: 'decision', position: { x: 2, y: 2 }, data: { label: 'Which plan?' } },
]
let dispatch: ReturnType<typeof vi.fn>
const select = (nodeIds: string[], edgeIds: string[] = []) =>
  useCanvasStore.setState({ selection: { nodeIds: new Set(nodeIds), edgeIds: new Set(edgeIds), anchorPosition: null } } as never)
const move = (id: string) => screen.getAllByTestId('composer-composer-tool').find((b) => b.getAttribute('data-move') === id)!

beforeEach(() => {
  vi.clearAllMocks(); clearAskTargetBinding()
  useCanvasStore.setState({ nodes, edges: [], hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null } as never)
  select([])
  useActionBarStore.setState({ bar: null, scenarioId: null })
  dispatch = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _sendMessage: vi.fn(), _prefillChat: vi.fn(), _isConversationBusy: () => false })
})

describe('the composer reasoning moves', () => {
  it('draws the four moves in the vision order, each named for what it does; no pre-mortem, voice or thinking control', () => {
    render(<ComposerMoves busy={false} testIdBase="composer" />)
    const names = screen.getAllByTestId('composer-composer-tool').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual([
      'Challenge an assumption: Select one card on the canvas, then Olumi can challenge it.',
      'Consider the opposite: The strongest honest case against how this model reads now.',
      'Look for evidence against: Select one card on the canvas, then Olumi can look for evidence against it.',
      'Outside view: How situations like this usually turn out, and how yours differs.',
    ])
    expect(screen.queryByLabelText(/pre-mortem|voice|thinking/i)).toBeNull()
  })

  it('Consider the opposite and Outside view each send one chip turn with Olumi\'s own question', () => {
    render(<ComposerMoves busy={false} testIdBase="composer" />)
    fireEvent.click(move('opposite'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenLastCalledWith({
      id: 'ask:method-opposite', source: 'chip',
      label: 'What is the strongest honest case against how this model reads now, and what would change my mind?',
      message: 'What is the strongest honest case against how this model reads now, and what would change my mind?',
    })
    fireEvent.click(move('outside_view'))
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenLastCalledWith({
      id: 'ask:method-outside-view', source: 'chip',
      label: 'How do decisions like ‘Which plan?’ usually turn out, and how is ours different?',
      message: 'How do decisions like ‘Which plan?’ usually turn out, and how is ours different?',
    })
  })

  it('Challenge and Look for evidence against need ONE selected card: without it they say so and send nothing', () => {
    render(<ComposerMoves busy={false} testIdBase="composer" />)
    for (const id of ['challenge', 'evidence_against']) {
      expect(move(id).getAttribute('aria-disabled')).toBe('true')
      fireEvent.click(move(id))
    }
    // A link is not a card, and neither is the question.
    select(['cap'], ['e1']); fireEvent.click(move('challenge'))
    select(['q']); fireEvent.click(move('challenge'))
    select(['cap', 'goal']); fireEvent.click(move('evidence_against'))
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('with one card selected, Challenge and Look for evidence against ask about THAT card, bound to it', () => {
    select(['cap'])
    render(<ComposerMoves busy={false} testIdBase="composer" />)
    expect(move('challenge').getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(move('challenge'))
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'ask:challenge', source: 'chip' }))
    const challenge = dispatch.mock.calls[0][0].message as string
    expect(challenge).toContain('‘Capacity’'); expect(challenge).not.toContain('42')
    expect(takeAskTargetBinding(challenge)?.nodeIds).toEqual(new Set(['cap']))
    fireEvent.click(move('evidence_against'))
    expect(dispatch).toHaveBeenLastCalledWith({
      id: 'ask:falsify', source: 'chip',
      label: 'What evidence or result would show that ‘Capacity’ will not happen? What would have to be true for it to fail?',
      message: 'What evidence or result would show that ‘Capacity’ will not happen? What would have to be true for it to fail?',
    })
  })

  it('while Olumi is answering, or before there is a model, every move says why and sends nothing', () => {
    select(['cap'])
    const { rerender } = render(<ComposerMoves busy testIdBase="composer" />)
    for (const b of screen.getAllByTestId('composer-composer-tool')) {
      expect(b.getAttribute('aria-disabled')).toBe('true')
      expect(b.getAttribute('aria-label')).toMatch(/: Olumi is still answering — try again in a moment$/)
      fireEvent.click(b)
    }
    useCanvasStore.setState({ nodes: [] } as never)
    rerender(<ComposerMoves busy={false} testIdBase="composer" />)
    for (const b of screen.getAllByTestId('composer-composer-tool')) {
      expect(b.getAttribute('aria-label')).toMatch(/: Build a model first, then Olumi can reason about it with you\.$/)
      fireEvent.click(b)
    }
    expect(dispatch).not.toHaveBeenCalled()
  })
})
