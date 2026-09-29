/**
 * ⭐ E4 — a ghost door opens a "What else…?" choice (Factor / Risk / Option / Outcome + free text) that only
 * PREFILLS the ask: nothing is sent and nothing is written to the graph.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const requestAsk = vi.fn((..._args: unknown[]) => 'composer')
vi.mock('../../ui/inspector-v2/askSemantic', () => ({ requestAsk: (...a: unknown[]) => requestAsk(...a) }))

import { WhatElseChooserHost, WHAT_ELSE_CHOICES, openWhatElseFromDoor, useWhatElseStore } from '../WhatElseChooser'

beforeEach(() => { requestAsk.mockClear(); useWhatElseStore.getState().close() })

const DOOR_PROMPT = 'What else drives Churn, beside Price and Support quality?'
function openFromFactorDoor() {
  openWhatElseFromDoor({ clientX: 40, clientY: 50, currentTarget: null }, 'factor', DOOR_PROMPT)
  return render(<WhatElseChooserHost />)
}

describe('the "What else…?" chooser', () => {
  it('offers exactly Factor / Risk / Option / Outcome and a free-text line', () => {
    openFromFactorDoor()
    for (const c of ['factor', 'risk', 'option', 'outcome']) expect(screen.getByTestId(`what-else-${c}`)).toBeDefined()
    expect(WHAT_ELSE_CHOICES.map((c) => c.label)).toEqual(['Factor', 'Risk', 'Option', 'Outcome'])
    expect(screen.getByTestId('what-else-free')).toBeDefined()
    expect(requestAsk).not.toHaveBeenCalled()
  })

  it("the door's own kind keeps the door's own question; another kind asks its plain question; then it closes", () => {
    openFromFactorDoor()
    fireEvent.click(screen.getByTestId('what-else-factor'))
    expect(requestAsk).toHaveBeenLastCalledWith(expect.objectContaining({ text: DOOR_PROMPT, source: 'ghost-door' }))
    expect(screen.queryByTestId('what-else-chooser')).toBeNull()

    act(() => openWhatElseFromDoor({ clientX: 40, clientY: 50, currentTarget: null }, 'factor', DOOR_PROMPT))
    fireEvent.click(screen.getByTestId('what-else-risk'))
    expect(requestAsk).toHaveBeenLastCalledWith(expect.objectContaining({ text: WHAT_ELSE_CHOICES[1].prompt }))
  })

  it('free text is asked verbatim; an empty line asks nothing', () => {
    openFromFactorDoor()
    const input = screen.getByTestId('what-else-free')
    fireEvent.submit(input.closest('form')!)
    expect(requestAsk).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '  supplier delays ' } })
    fireEvent.submit(input.closest('form')!)
    expect(requestAsk).toHaveBeenCalledWith(expect.objectContaining({ text: 'supplier delays' }))
  })

  it('Escape closes it without asking', () => {
    openFromFactorDoor()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('what-else-chooser')).toBeNull()
    expect(requestAsk).not.toHaveBeenCalled()
  })
})
