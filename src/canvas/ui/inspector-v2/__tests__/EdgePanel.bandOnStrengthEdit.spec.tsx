/**
 * The band pill → `edge_strength_edit.band`, end to end through the panel the
 * deployment mounts (`EdgePanel`), the real `useEdgeMutations.setStrength`, the
 * real builder, and the app's own adapter + the 0.60.0 contract validator.
 *
 * ⚠ THE READER-FIRST GATE IS FORCED ON IN THIS FILE, AND ONLY HERE. Its
 * production value is `false` (pinned in `edgeStrengthEditBand.spec.ts` and
 * `setStrengthBandGateOff.spec.tsx`) until CEE deploys a 0.60.0 reader. These
 * rows describe what the panel sends ONCE ARMED, so a flip needs no new test.
 *
 * ⚠ BOUND BY IDENTITY: the pill is found by its own `data-testid`, the event by
 * the ONE `sendSystemEvent` call, and the band asserted by value. The typed β
 * row sends the SAME magnitude as the Strong pill, so the pair discriminates
 * "a pick names its band" from "a number is turned into a band".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'

import type { WireSystemEvent } from '../../../conversation/types'

const sendSystemEvent =
  vi.fn<[WireSystemEvent, unknown?], Promise<string>>(() => Promise.resolve('SENT'))

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

vi.mock('../../../conversation/edgeStrengthEdit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../conversation/edgeStrengthEdit')>()
  return { ...actual, EDGE_STRENGTH_BAND_ENABLED: true }
})

import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { buildV5Payload } from '../../../../v5/buildPayload'

function seed(mean: number) {
  const direction = mean < 0 ? 'negative' : 'positive'
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ],
    edges: [{
      id: 'e1', source: 'fac1', target: 'out1',
      data: {
        weight: Math.abs(mean), direction, weightSource: 'cee',
        strength_mean: mean, effect_direction: direction,
      },
    }],
  } as never)
}

/** The ONE dispatched event — asserted to be exactly one, then read. */
function theDispatchedEvent(): WireSystemEvent {
  expect(sendSystemEvent, 'expected exactly one send').toHaveBeenCalledTimes(1)
  const evt = sendSystemEvent.mock.calls[0][0]
  expect(evt.type).toBe('edge_strength_edit')
  return evt
}

/** App adapter, then the vendored contract's own validator (root superRefine included). */
function parsesUnderContract(evt: WireSystemEvent) {
  const built = buildV5Payload({
    turnId: '11111111-1111-4111-8111-111111111111',
    scenarioId: '22222222-2222-4222-8222-222222222222',
    stage: 'analyse',
    turnClass: 'system_event',
    mode: 'system',
    systemEvent: evt,
  } as unknown as Parameters<typeof buildV5Payload>[0])
  expect(built.ok, `app adapter refused: ${JSON.stringify(built)}`).toBe(true)
  const payload = (built as { ok: true; payload: { event: Record<string, unknown> } }).payload
  const parsed = OrchestratorTurnPayloadSchema.safeParse(payload)
  expect(parsed.success, `0.60.0 contract refused: ${JSON.stringify(parsed)}`).toBe(true)
  return payload.event
}

function pressBand(container: HTMLElement, testId: string) {
  const btn = container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
  expect(btn, `PRECONDITION: ${testId} must render`).not.toBeNull()
  expect(btn!.disabled, `PRECONDITION: ${testId} must be pressable`).toBe(false)
  fireEvent.click(btn!)
}

beforeEach(() => {
  cleanup()
  sendSystemEvent.mockClear()
})

describe('EdgePanel — a band pick sends the band it picked', () => {
  it('RED: pressing Strong sends band "strong" with magnitude 0.55', () => {
    seed(0.35)
    const { container } = render(<EdgePanel edgeId="e1" techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)
    pressBand(container, 'strength-band-strong')
    const evt = theDispatchedEvent()
    expect(evt.payload?.band).toBe('strong')
    expect(evt.payload?.magnitude).toBe(0.55)
    expect(evt.payload?.direction_intent).toBe('preserve')
    expect(parsesUnderContract(evt).band).toBe('strong')
  })

  it('pressing Very strong on a NEGATIVE link sends band "very_strong", magnitude 0.85, direction preserved', () => {
    seed(-0.35)
    const { container } = render(<EdgePanel edgeId="e1" techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)
    pressBand(container, 'strength-band-very-strong')
    const evt = theDispatchedEvent()
    expect(evt.payload?.band).toBe('very_strong')
    expect(evt.payload?.magnitude).toBe(0.85)
    expect(evt.payload?.direction_intent).toBe('preserve')
    expect(parsesUnderContract(evt).band).toBe('very_strong')
  })

  it('pressing Slight sends the contract word "slight" (never CEE’s internal "weak")', () => {
    seed(0.35)
    const { container } = render(<EdgePanel edgeId="e1" techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)
    pressBand(container, 'strength-band-slight')
    const evt = theDispatchedEvent()
    expect(evt.payload?.band).toBe('slight')
    expect(evt.payload?.magnitude).toBe(0.1)
    expect(parsesUnderContract(evt).band).toBe('slight')
  })
})

describe('EdgePanel — a typed number sends NO band, even at a band midpoint', () => {
  it('typing 0.55 into β sends magnitude 0.55 with no `band` key', () => {
    seed(0.35)
    render(<EdgePanel edgeId="e1" techMode={true} onClose={vi.fn()} onNavigate={vi.fn()} />)
    const betaLabel = screen.getByText('β =')
    const input = betaLabel.parentElement?.querySelector<HTMLInputElement>('input[type="number"]')
    expect(input, 'PRECONDITION: the β field must render').toBeTruthy()
    fireEvent.change(input!, { target: { value: '0.55' } })
    const evt = theDispatchedEvent()
    expect(evt.payload?.magnitude).toBe(0.55)
    expect('band' in (evt.payload ?? {})).toBe(false)
    expect('band' in parsesUnderContract(evt)).toBe(false)
  })
})
