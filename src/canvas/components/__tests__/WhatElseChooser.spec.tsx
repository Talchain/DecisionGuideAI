/** The chooser sends registered chip questions; free text sends the person's exact words. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { clearAskTargetBinding, takeAskTargetBinding } from '../../ui/inspector-v2/askTargetBinding'
import { WhatElseChooserHost, WHAT_ELSE_CHOICES, openWhatElseFromDoor, useWhatElseStore } from '../WhatElseChooser'

vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
let dispatch: ReturnType<typeof vi.fn>
let send: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks(); clearAskTargetBinding(); useWhatElseStore.getState().close()
  dispatch = vi.fn(); send = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _sendMessage: send, _prefillChat: null, _isConversationBusy: () => false })
  useCanvasStore.setState({ nodes: [], edges: [], hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null,
    selection: { nodeIds: new Set(['unrelated']), edgeIds: new Set(['unrelated-edge']), anchorPosition: null } } as never)
})

const DOOR_PROMPT = 'What else drives Churn, beside Price and Support quality?'
function openFromFactorDoor() {
  openWhatElseFromDoor({ clientX: 40, clientY: 50, currentTarget: null }, 'factor', DOOR_PROMPT)
  return render(<WhatElseChooserHost />)
}

describe('the "What else…?" chooser', () => {
  it('offers exactly Factor / Risk / Option / Outcome and a free-text line', () => {
    openFromFactorDoor()
    for (const c of ['factor', 'risk', 'option', 'outcome']) expect(screen.getByTestId(`what-else-${c}`)).toBeDefined()
    expect(WHAT_ELSE_CHOICES.map(c => c.label)).toEqual(['Factor', 'Risk', 'Option', 'Outcome'])
    expect(screen.getByTestId('what-else-free')).toBeDefined()
    expect(dispatch).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it.each([
    ['factor', 'ask:missing-factor', 'What else could change how this turns out that the model doesn’t have yet?'],
    ['risk', 'ask:risks', 'What could go wrong, or unexpectedly well, that this model doesn’t have yet?'],
    ['option', 'ask:widen', 'What other ways could we reach the goal that aren’t on the board yet?'],
    ['outcome', 'ask:missing-outcome', 'Where else could this lead that the model doesn’t have yet?'],
  ])('%s sends its registered question on the actual dispatch wire, then closes', (kind, id, message) => {
    openFromFactorDoor()
    fireEvent.click(screen.getByTestId(`what-else-${kind}`))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ id, label: message, message, source: 'chip' })
    expect(message).not.toBe(DOOR_PROMPT)
    const bound = takeAskTargetBinding(message)
    expect(bound?.nodeIds).toEqual(new Set())
    expect(bound?.edgeIds).toEqual(new Set())
    expect(send).not.toHaveBeenCalled()
    expect(screen.queryByTestId('what-else-chooser')).toBeNull()
  })

  it('counted option questions distinguish two actual options from three', () => {
    const nodes = [
      { id: 'd', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Growth route' } },
      { id: 'g', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Retention' } },
      { id: 'a', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Pilot' } },
      { id: 'b', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Partner' } },
    ]
    useCanvasStore.setState({ nodes } as never)
    openFromFactorDoor()
    fireEvent.click(screen.getByTestId('what-else-option'))
    const two = dispatch.mock.calls[0][0].message
    expect(two).toBe('For ‘Growth route’, I have 2 options: ‘Pilot’, ‘Partner’. What other ways could we reach ‘Retention’ that aren’t on the board yet?')
    act(() => {
      useCanvasStore.setState({ nodes: [...nodes, { id: 'c', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hire' } }] } as never)
      useWhatElseStore.getState().show({ x: 40, y: 50, doorKind: 'option' })
      // A fresh dispatcher represents the next send after the first turn settled.
      useGuidanceStore.setState({ _dispatchAction: p => dispatch(p) })
    })
    fireEvent.click(screen.getByTestId('what-else-option'))
    const three = dispatch.mock.calls[1][0].message
    expect(three).toBe('For ‘Growth route’, I have 3 options: ‘Pilot’, ‘Partner’, ‘Hire’. What other ways could we reach ‘Retention’ that aren’t on the board yet?')
    expect(two).not.toBe(three)
    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  it('free text is sent verbatim; an empty line sends nothing', () => {
    openFromFactorDoor()
    const input = screen.getByTestId('what-else-free')
    fireEvent.submit(input.closest('form')!)
    expect(send).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '  supplier delays ' } })
    fireEvent.submit(input.closest('form')!)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('  supplier delays ')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('Escape closes it without asking', () => {
    openFromFactorDoor()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('what-else-chooser')).toBeNull()
    expect(dispatch).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('a refused free-text send keeps the chooser and its exact input', () => {
    openFromFactorDoor()
    const input = screen.getByTestId('what-else-free')
    fireEvent.change(input, { target: { value: '  More context  ' } })
    useGuidanceStore.setState({ _isConversationBusy: () => true })
    fireEvent.submit(input.closest('form')!)
    expect(send).not.toHaveBeenCalled()
    expect(input).toHaveValue('  More context  ')
    expect(screen.getByTestId('what-else-chooser')).toBeInTheDocument()
  })

  it('a refused chip send keeps the chooser open', () => {
    openFromFactorDoor()
    act(() => useGuidanceStore.setState({ _isConversationBusy: () => true }))
    fireEvent.click(screen.getByTestId('what-else-risk'))
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByTestId('what-else-chooser')).toBeInTheDocument()
  })
})
