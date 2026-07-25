/**
 * AIInputBar — the add-option journey, from typed sentence to dispatched chip.
 *
 * This is the reachability proof the capability was missing: it asserts that a
 * user who TYPES "add an option called X" reaches `dispatchAction` with
 * `intent: 'add_option'` and a canvas-resolved parameter spec — and that
 * nothing they typed is ever lost on any exit from the panel.
 *
 * jsdom cannot prove layout or the live wire; the live capture in
 * parallel-briefs/ADD-OPTION-LANE-2026-07-25.md carries those claims.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'

import { AIInputBar } from '../AIInputBar'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useCanvasStore } from '../../store'

const sendMessage = vi.fn()
const dispatchAction = vi.fn()

vi.mock('../../conversation/useConversation', () => ({
  useConversation: () => ({
    messages: [],
    isThinking: false,
    longRunningHint: null,
    lastSendFailure: null,
    sendMessage,
    sendSystemEvent: vi.fn(),
    sendChip: vi.fn(),
    dispatchAction,
    clearHistory: vi.fn(),
    retryLast: vi.fn(),
    cancelTurn: vi.fn(),
    patchBlockStates: new Map(),
    setPatchBlockState: vi.fn(),
    patchRejections: new Map(),
    setPatchRejection: vi.fn(),
  }),
}))

vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))

function n(id: string, kind: string, label: string, observed?: Record<string, unknown>) {
  return {
    id,
    type: kind,
    position: { x: 0, y: 0 },
    data: { label, kind, ...(observed ? { observedState: observed } : {}) },
  }
}

const NODES = [
  n('dec_1', 'decision', 'Open a second site'),
  n('fac_capex', 'factor', 'Capital Investment', { value: 0.65, raw_value: 26000, unit: '£', cap: 40000 }),
  n('fac_timing', 'factor', 'Speed of Launch', { value: 0.4 }),
]

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

function renderBar() {
  return render(
    <Wrapper>
      <AIInputBar variant="floating" />
    </Wrapper>,
  )
}

function type(text: string) {
  const ta = screen.getByTestId('ai-input-bar-floating-textarea')
  fireEvent.change(ta, { target: { value: text } })
  return ta
}

function send(text: string) {
  const ta = type(text)
  fireEvent.keyDown(ta, { key: 'Enter' })
}

describe('AIInputBar — add-option interception', () => {
  beforeEach(() => {
    sendMessage.mockClear()
    dispatchAction.mockClear()
    act(() => {
      useCanvasStore.setState({ nodes: NODES as never, edges: [] as never })
    })
  })

  it('opens the configuration panel instead of sending the free-text message', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')
    expect(screen.getByTestId('add-option-panel')).toBeTruthy()
    expect(sendMessage).not.toHaveBeenCalled()
    expect((screen.getByTestId('add-option-label-input') as HTMLInputElement).value).toBe(
      'Hybrid Pilot',
    )
  })

  it('lists every factor on the canvas, with its current value', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')
    const list = screen.getByTestId('add-option-factor-list')
    expect(list.textContent).toContain('Capital Investment')
    expect(list.textContent).toContain('Speed of Launch')
    expect(list.textContent).toContain('£26,000')
  })

  it('does NOT intercept an ordinary message', () => {
    renderBar()
    send('What should I do next?')
    expect(screen.queryByTestId('add-option-panel')).toBeNull()
    expect(sendMessage).toHaveBeenCalledWith('What should I do next?')
  })

  it('does NOT intercept a deliberative question about options', () => {
    renderBar()
    send('Should I add an option called Hybrid Pilot?')
    expect(screen.queryByTestId('add-option-panel')).toBeNull()
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('does NOT intercept when the canvas has no decision node', () => {
    act(() => {
      useCanvasStore.setState({ nodes: [n('fac_a', 'factor', 'A')] as never })
    })
    renderBar()
    send('Add an option called Hybrid Pilot')
    expect(screen.queryByTestId('add-option-panel')).toBeNull()
    expect(sendMessage).toHaveBeenCalledWith('Add an option called Hybrid Pilot')
  })

  // ⭐ THE REACHABILITY PROOF
  it('dispatches the typed add_option chip with canvas-resolved ids', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')

    fireEvent.click(screen.getByLabelText('New value for Capital Investment', { exact: false }).previousSibling as Element)
    fireEvent.change(screen.getByTestId('add-option-value-fac_capex'), {
      target: { value: '20000' },
    })
    fireEvent.click(screen.getByTestId('add-option-submit'))

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    expect(dispatchAction).toHaveBeenCalledWith({
      id: 'ui_add_option_form',
      intent: 'add_option',
      label: 'Add option "Hybrid Pilot"',
      message: 'Add an option called "Hybrid Pilot" that changes "Capital Investment".',
      parameters: {
        parent_decision_id: 'dec_1',
        label: 'Hybrid Pilot',
        interventions: [{ factor_id: 'fac_capex', value: 0.5, unit: '£', raw_value: 20000 }],
      },
      source: 'chip',
    })
    // The chip replaces the free-text send — never both.
    expect(sendMessage).not.toHaveBeenCalled()
    expect(screen.queryByTestId('add-option-panel')).toBeNull()
  })

  it('dispatches an option with no changes when none are ticked', () => {
    renderBar()
    send('Add an option called Status Quo Plus')
    fireEvent.click(screen.getByTestId('add-option-submit'))
    expect(dispatchAction).toHaveBeenCalledTimes(1)
    expect(dispatchAction.mock.calls[0][0].parameters.interventions).toEqual([])
  })

  it('uses the EDITED label, not the extracted one', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')
    fireEvent.change(screen.getByTestId('add-option-label-input'), {
      target: { value: 'Renamed By User' },
    })
    fireEvent.click(screen.getByTestId('add-option-submit'))
    expect(dispatchAction.mock.calls[0][0].parameters.label).toBe('Renamed By User')
  })

  // --- nothing the user typed is ever lost --------------------------------

  it('"send as a message instead" sends the ORIGINAL text verbatim', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')
    fireEvent.click(screen.getByTestId('add-option-send-as-message'))
    expect(sendMessage).toHaveBeenCalledWith('Add an option called Hybrid Pilot')
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(screen.queryByTestId('add-option-panel')).toBeNull()
  })

  it('cancel keeps the text in the composer and sends nothing', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')
    fireEvent.click(screen.getByTestId('add-option-cancel'))
    expect(screen.queryByTestId('add-option-panel')).toBeNull()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(dispatchAction).not.toHaveBeenCalled()
    expect((screen.getByTestId('ai-input-bar-floating-textarea') as HTMLTextAreaElement).value).toBe(
      'Add an option called Hybrid Pilot',
    )
  })

  it('Escape cancels without losing the text', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('add-option-panel')).toBeNull()
    expect((screen.getByTestId('ai-input-bar-floating-textarea') as HTMLTextAreaElement).value).toBe(
      'Add an option called Hybrid Pilot',
    )
  })

  // --- refusals are surfaced, never swallowed ------------------------------

  it('refuses — naming the reason — when a ticked factor leaves the canvas', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')
    fireEvent.click(screen.getByLabelText('New value for Capital Investment', { exact: false }).previousSibling as Element)
    fireEvent.change(screen.getByTestId('add-option-value-fac_capex'), { target: { value: '20000' } })
    // The node disappears while the panel is open (another surface deleted it).
    act(() => {
      useCanvasStore.setState({ nodes: [NODES[0], NODES[2]] as never })
    })
    fireEvent.click(screen.getByTestId('add-option-submit'))
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(screen.getByTestId('add-option-refusal').textContent).toMatch(/no longer on the canvas/i)
  })

  it('blocks submit — naming the reason — when a ticked factor has no number', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')
    fireEvent.click(screen.getByLabelText('New value for Speed of Launch', { exact: false }).previousSibling as Element)
    fireEvent.change(screen.getByTestId('add-option-value-fac_timing'), { target: { value: '' } })
    expect(screen.getByTestId('add-option-invalid')).toBeTruthy()
    fireEvent.click(screen.getByTestId('add-option-submit'))
    expect(dispatchAction).not.toHaveBeenCalled()
  })

  it('blocks submit when the name is cleared', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')
    fireEvent.change(screen.getByTestId('add-option-label-input'), { target: { value: '  ' } })
    fireEvent.click(screen.getByTestId('add-option-submit'))
    expect(dispatchAction).not.toHaveBeenCalled()
  })

  // --- the panel is a request, never a receipt ----------------------------

  it('claims no outcome anywhere in the panel', () => {
    renderBar()
    send('Add an option called Hybrid Pilot')
    const text = screen.getByTestId('add-option-panel').textContent!.toLowerCase()
    for (const banned of ['added', 'created', 'saved', 'applied', 'updated', 'success']) {
      expect(text).not.toMatch(new RegExp(`\\b${banned}\\b`))
    }
    // Positive control: the assertion above can SEE a claim when one is present.
    expect('option added to your model').toMatch(/\badded\b/)
  })
})
