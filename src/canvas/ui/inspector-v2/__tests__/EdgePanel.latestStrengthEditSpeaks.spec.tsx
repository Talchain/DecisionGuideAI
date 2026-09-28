/**
 * ONLY THE LATEST STRENGTH EDIT SPEAKS, AND ITS ANSWER PUTS THE PANEL BACK WITH
 * THE CANVAS (canvas audit edit-values F1).
 *
 * WITNESSED on served `d87eeb94` (skeptic timeline, build-vs-buy e-17, two band
 * clicks 340 ms apart): "Sending to Olumi…" → "Waiting for the current turn to
 * finish" → "Sent to Olumi" — the FIRST click's answer, arriving after the
 * second's — while the model had refused the second. The panel ended on "Very
 * strong 0.85 ± 0.15" with the canvas link at "Moderate boost".
 *
 * The carrier is mocked at `setStrength` so each press's settlement callback is
 * captured and fired IN THE ORDER THE WIRE PRODUCED — the axis the synchronous
 * mock in `EdgePanel.strengthEditSettlement.spec.tsx` cannot reach.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { ACTION_LABELS } from '../inspectorStrings'
import type { SystemEventSendSettlement } from '../../../conversation/settleSystemEventSend'

type Settle = (s: SystemEventSendSettlement) => void
const presses: Array<{ mean: number; settle: Settle }> = []

vi.mock('../useInspectorMutations', async importOriginal => {
  const actual = await importOriginal<typeof import('../useInspectorMutations')>()
  return {
    ...actual,
    useEdgeMutations: (edgeId: string) => {
      const real = actual.useEdgeMutations(edgeId)
      return {
        ...real,
        setStrength: (mean: number, opts: { onSendSettled: Settle }) => {
          presses.push({ mean, settle: opts.onSendSettled })
          return 'dispatched' as const
        },
      }
    },
  }
})

const SERVER_MEAN = 0.62

function seedEdge(weight = SERVER_MEAN) {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'fac_vendor', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Vendor Solution Adoption' } },
      { id: 'risk_lockin', type: 'risk', position: { x: 100, y: 0 }, data: { label: 'Vendor Lock-In' } },
    ],
    edges: [{
      id: 'e-17', source: 'fac_vendor', target: 'risk_lockin',
      data: {
        weight, direction: 'positive', weightSource: 'cee',
        strength_mean: SERVER_MEAN, effect_direction: 'positive',
      },
    }],
    analysisFreshness: { freshness: 'stale', computedAt: 1 },
  } as never)
}

const panelProps = { edgeId: 'e-17', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

const band = (c: HTMLElement, id: string) => {
  const el = c.querySelector<HTMLButtonElement>(`[data-testid="strength-band-${id}"]`)
  expect(el, `PRECONDITION: band ${id} renders`).not.toBeNull()
  expect(el!.disabled, `PRECONDITION: band ${id} is pressable`).toBe(false)
  return el!
}
const pressed = (c: HTMLElement) =>
  [...c.querySelectorAll('[data-testid^="strength-band-"]')]
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.getAttribute('data-testid'))
const feedback = (c: HTMLElement) => c.querySelector('[data-testid="edge-strength-edit-feedback"]')

beforeEach(() => {
  presses.length = 0
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('EdgePanel — the latest strength edit is the one the panel speaks for', () => {
  it('a LATE answer to the superseded first press does not overwrite the second press\'s state', async () => {
    seedEdge()
    const { container } = render(<EdgePanel {...panelProps} />)
    fireEvent.click(band(container, 'moderate'))
    fireEvent.click(band(container, 'very-strong'))
    expect(presses.map((p) => p.mean), 'precondition: two presses reached the carrier').toEqual([0.3, 0.85])

    // The wire's order: the second press is queued first, THEN the first send's answer lands.
    await act(async () => { presses[1].settle('queued') })
    await act(async () => { presses[0].settle('sent') })

    expect(feedback(container)?.getAttribute('data-settlement'), 'still the second press\'s state').toBe('queued')
    expect(feedback(container)?.textContent).not.toContain(ACTION_LABELS.strengthConfirmSent)

    // …and the second press's own answer does speak.
    await act(async () => { presses[1].settle('sent') })
    expect(feedback(container)?.getAttribute('data-settlement')).toBe('sent')
  })

  it('a queued press the model did not take puts the bands back on what the canvas link holds', async () => {
    seedEdge()
    const { container } = render(<EdgePanel {...panelProps} />)
    fireEvent.click(band(container, 'moderate'))
    fireEvent.click(band(container, 'very-strong'))
    expect(pressed(container), 'precondition: the panel shows the press').toEqual(['strength-band-very-strong'])

    // The first receipt reconciled the link to the server's 0.3; the queued 0.85
    // is then answered without a proof either way.
    await act(async () => { presses[1].settle('queued') })
    await act(async () => {
      useCanvasStore.getState().updateEdge('e-17', {
        data: { ...(useCanvasStore.getState().edges[0].data as object), weight: 0.3 },
      } as never)
    })
    await act(async () => { presses[0].settle('sent') })
    await act(async () => { presses[1].settle('unverified') })

    expect(feedback(container)?.getAttribute('data-settlement')).toBe('unverified')
    expect(pressed(container), 'the panel agrees with the canvas link').toEqual(['strength-band-moderate'])
  })

  it('CONTRAST: a queued press that LANDED keeps the pressed band (no resync on "sent")', async () => {
    seedEdge()
    const { container } = render(<EdgePanel {...panelProps} />)
    fireEvent.click(band(container, 'moderate'))
    fireEvent.click(band(container, 'very-strong'))
    await act(async () => { presses[1].settle('queued') })
    await act(async () => { presses[0].settle('sent') })
    await act(async () => { presses[1].settle('sent') })
    expect(pressed(container)).toEqual(['strength-band-very-strong'])
  })

  it('a PROVEN refusal (the store reverted) puts the bands back too', async () => {
    seedEdge()
    const { container } = render(<EdgePanel {...panelProps} />)
    fireEvent.click(band(container, 'very-strong'))
    // `resolveEdgeEditSettlement` reverted the link before the panel heard 'refused'.
    await act(async () => {
      useCanvasStore.getState().updateEdge('e-17', {
        data: { ...(useCanvasStore.getState().edges[0].data as object), weight: SERVER_MEAN },
      } as never)
    })
    await act(async () => { presses[0].settle('refused') })
    expect(feedback(container)?.getAttribute('data-settlement')).toBe('refused')
    expect(pressed(container)).toEqual(['strength-band-strong'])
  })
})
