/**
 * A value edit the model REFUSED must not stay in the field as if it were saved.
 *
 * THE DEFECT (served UI `11ed8874`, CEE `8428207`, 24 Sep 2026 —
 * `output/canvas-completion-20260923/FIRST-DELIVERY-POPULATED-EDIT-WITNESS-20260924.md`):
 * £70,000 → £150,000 on a factor capped at £120,000. CEE answered HTTP 200,
 * "I haven't changed anything", and wrote nothing; the dispatcher reverted the
 * optimistic write, so the CARD went back to £70,000. The inspector's field
 * still read **150000**, with no inline error — the refusal was visible only in
 * the chat, and the panel's own notice said "Sent to Olumi".
 *
 * WHAT IS PINNED, bound to the REAL revert (`revertOptimisticFactorEdit`, the
 * function the dispatcher calls on a 200 that did not apply the edit — never a
 * hand-built store write that merely looks like one):
 *   1. After a refusal the field shows the MODEL's value, not the refused one.
 *   2. A "Not saved" alert is shown, and "Sent to Olumi" is not.
 *   3. CONTRAST — an accepted edit keeps the typed value and says "Sent to
 *      Olumi", with no alert. Without this, 1–2 pass for a panel that reverts
 *      and alarms on every edit.
 *   4. The field is never rewritten while the person is typing in it.
 *   5. The field has an accessible name (it had none: `aria-label` was null).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { revertOptimisticFactorEdit, type OptimisticFactorEdit } from '../../../conversation/optimisticFactorEdit'

const sendSystemEvent = vi.fn()

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { useCanvasStore } from '../../../store'

const NODE_ID = 'fac_annual_cost'
const LABEL = 'Annual Platform Cost'
const CAP = 120000
const COMMITTED_RAW = 70000
const REFUSED_RAW = 150000
const ACCEPTED_RAW = 80000

const noop = () => {}

function seed() {
  useCanvasStore.setState(
    {
      nodes: [
        {
          id: NODE_ID,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: LABEL,
            kind: 'factor',
            factor_type: 'lever',
            observedState: { value: COMMITTED_RAW / CAP, raw_value: COMMITTED_RAW, cap: CAP, unit: '£' },
          },
        } as unknown as Node,
      ],
      edges: [],
      results: { status: 'idle', report: null },
    } as any,
    false,
  )
}

const valueInput = () => screen.getByPlaceholderText('Enter value') as HTMLInputElement

function commit(next: string) {
  const input = valueInput()
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: next } })
  fireEvent.blur(input)
}

/** The dispatcher on a 200 that did not apply the edit: revert, THEN resolve. */
function serverRefuses() {
  sendSystemEvent.mockImplementation(async (_event: unknown, opts?: { optimisticFactorEdit?: OptimisticFactorEdit }) => {
    if (opts?.optimisticFactorEdit) revertOptimisticFactorEdit(opts.optimisticFactorEdit)
    return undefined
  })
}

/** The dispatcher on a 200 that applied it: the optimistic value stands. */
function serverAccepts() {
  sendSystemEvent.mockImplementation(async () => undefined)
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe('a refused value edit is not shown as saved', () => {
  beforeEach(() => {
    sendSystemEvent.mockReset()
    seed()
  })
  afterEach(() => cleanup())

  it('PRECONDITION: the real revert returns the store to the pre-edit value', async () => {
    serverRefuses()
    render(<FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />)
    commit(String(REFUSED_RAW))
    await flush()
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const raw = (useCanvasStore.getState().nodes[0].data as any).observedState.raw_value
    expect(raw).toBe(COMMITTED_RAW)
  })

  it('after a refusal the field shows the model value, with a "Not saved" alert and no "Sent"', async () => {
    serverRefuses()
    render(<FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />)
    commit(String(REFUSED_RAW))
    await flush()

    expect(valueInput().value).toBe(String(COMMITTED_RAW))
    const alert = screen.getByTestId('factor-value-not-saved')
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.textContent).toMatch(/^Not saved\./)
    expect(screen.queryByText('Sent to Olumi')).toBeNull()
  })

  it('CONTRAST — an accepted edit keeps the typed value, says "Sent to Olumi", and raises no alert', async () => {
    serverAccepts()
    render(<FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />)
    commit(String(ACCEPTED_RAW))
    await flush()

    expect(valueInput().value).toBe(String(ACCEPTED_RAW))
    expect(screen.getByText('Sent to Olumi')).toBeTruthy()
    expect(screen.queryByTestId('factor-value-not-saved')).toBeNull()
  })

  it('the next edit clears the alert', async () => {
    serverRefuses()
    render(<FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />)
    commit(String(REFUSED_RAW))
    await flush()
    expect(screen.getByTestId('factor-value-not-saved')).toBeTruthy()

    serverAccepts()
    commit(String(ACCEPTED_RAW))
    await flush()
    expect(screen.queryByTestId('factor-value-not-saved')).toBeNull()
    expect(valueInput().value).toBe(String(ACCEPTED_RAW))
  })

  it('a model change while the person is TYPING never rewrites the field', () => {
    render(<FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />)
    const input = valueInput()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '91' } })

    act(() => {
      const n = useCanvasStore.getState().nodes[0]
      useCanvasStore.setState({
        nodes: [{ ...n, data: { ...(n.data as any), observedState: { value: 0.5, raw_value: 60000, cap: CAP, unit: '£' } } }],
      } as any)
    })

    expect(valueInput().value).toBe('91')
  })

  it('CONTRAST — the same model change with the field NOT focused is shown', () => {
    render(<FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />)
    act(() => {
      const n = useCanvasStore.getState().nodes[0]
      useCanvasStore.setState({
        nodes: [{ ...n, data: { ...(n.data as any), observedState: { value: 0.5, raw_value: 60000, cap: CAP, unit: '£' } } }],
      } as any)
    })
    expect(valueInput().value).toBe('60000')
  })

  it('the value field has an accessible name', () => {
    render(<FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByRole('spinbutton', { name: `Value for ${LABEL}` })).toBe(valueInput())
  })
})
