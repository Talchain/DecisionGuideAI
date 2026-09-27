/**
 * The reader-first gate at its PRODUCTION value: a band pick sends NO `band`.
 *
 * ⛔ WHY THE GATE EXISTS. Every `SystemEventSchema` member is `.strict()`
 * inside a discriminated union. CEE staging pins `@talchain/schemas` 0.59.0,
 * whose `edge_strength_edit` has no `band`, so an event carrying one is
 * rejected at ingress and takes the WHOLE turn with it (422). The contract's own
 * sequencing: publish → CEE re-vendors and deploys a reader → only then does the
 * UI send it. `EDGE_STRENGTH_BAND_ENABLED` is that order, held in one line.
 *
 * ⚠ NOTHING IS MOCKED BUT THE CONVERSATION CARRIER. The gate is read at its real
 * value — so this file goes RED the day someone flips it, which is the moment
 * it must be re-read against CEE's deployed pin.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, cleanup } from '@testing-library/react'

import type { WireSystemEvent } from '../../../conversation/types'

const sendSystemEvent =
  vi.fn<[WireSystemEvent, unknown?], Promise<string>>(() => Promise.resolve('SENT'))

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { EDGE_STRENGTH_BAND_ENABLED } from '../../../conversation/edgeStrengthEdit'

beforeEach(() => {
  cleanup()
  sendSystemEvent.mockClear()
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ],
    edges: [{
      id: 'e1', source: 'fac1', target: 'out1',
      data: {
        weight: 0.35, direction: 'positive', weightSource: 'cee',
        strength_mean: 0.35, effect_direction: 'positive',
      },
    }],
  } as never)
})

describe('band pick with the reader-first gate at its production value', () => {
  it('the gate is OFF', () => {
    expect(EDGE_STRENGTH_BAND_ENABLED).toBe(false)
  })

  it('pressing Strong still sends the edit — magnitude 0.55 — with NO `band` key', () => {
    const { container } = render(<EdgePanel edgeId="e1" techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="strength-band-strong"]')
    expect(btn, 'PRECONDITION: the Strong pill must render').not.toBeNull()
    expect(btn!.disabled, 'PRECONDITION: the Strong pill must be pressable').toBe(false)
    fireEvent.click(btn!)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const evt = sendSystemEvent.mock.calls[0][0]
    expect(evt.type).toBe('edge_strength_edit')
    expect(evt.payload?.magnitude).toBe(0.55)
    expect('band' in (evt.payload ?? {})).toBe(false)
  })
})
