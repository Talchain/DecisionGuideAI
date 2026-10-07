/** The chooser sends registered chip questions; free text sends the person's exact words. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { clearAskTargetBinding, takeAskTargetBinding } from '../../ui/inspector-v2/askTargetBinding'
import { WhatElseChooserHost, WHAT_ELSE_CHOICES, WHAT_ELSE_CHOOSER_WIDTH, openWhatElseFromDoor, placeWhatElseChooser, useWhatElseStore } from '../WhatElseChooser'

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

describe('the chooser opens inside the visible canvas, never under the Outputs dock (served askAi witness, 7 Oct)', () => {
  // Served (staging d47c8d13, askai-2/-3): the factors-row door sat at x≈1210 with the dock from x=1240; the chooser
  // opened at x+8 and its Factor chip could not be clicked. Dock measured by the estate's authority, measureDockInset().
  const W0 = window.innerWidth, H0 = window.innerHeight
  let dock: HTMLElement | null = null
  const setViewport = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  }
  const mountDock = (left: number) => {
    dock = document.createElement('aside')
    dock.setAttribute('aria-label', 'Outputs dock')
    dock.getBoundingClientRect = () => ({ left, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth - left, height: window.innerHeight, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
    document.body.appendChild(dock)
  }
  afterEach(() => { dock?.remove(); dock = null; setViewport(W0, H0) })

  it('RED: a right-edge door with the dock open → the chooser is wholly left of the dock, and Factor sends', () => {
    setViewport(1600, 900); mountDock(1240)
    openWhatElseFromDoor({ clientX: 1210, clientY: 478, currentTarget: null }, 'factor', DOOR_PROMPT)
    render(<WhatElseChooserHost />)
    const left = parseFloat(screen.getByTestId('what-else-chooser').style.left)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + WHAT_ELSE_CHOOSER_WIDTH).toBeLessThanOrEqual(1240)
    fireEvent.click(screen.getByTestId('what-else-factor'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0][0].id).toBe('ask:missing-factor')
  })

  it('CONTROL: no dock → the previous window clamp, unchanged', () => {
    expect(placeWhatElseChooser({ x: 40, y: 50 }, { width: 1600, height: 900 }, 0)).toEqual({ left: 48, top: 58 })
    expect(placeWhatElseChooser({ x: 1500, y: 880 }, { width: 1600, height: 900 }, 0)).toEqual({ left: 1600 - 260, top: 900 - 160 })
  })

  it('a door well left of the dock keeps its place beside the pointer', () => {
    expect(placeWhatElseChooser({ x: 600, y: 300 }, { width: 1600, height: 900 }, 360)).toEqual({ left: 608, top: 308 })
  })
})
