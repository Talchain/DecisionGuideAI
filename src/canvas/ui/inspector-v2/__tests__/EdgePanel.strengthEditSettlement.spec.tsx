/**
 * ⛔⛔ THE EDIT PATH TOLD THE USER "Updated ✓" WHATEVER THE SERVER DID.
 *
 * `handleConfirmCurrentStrength` in this same panel carries a ⛔⛔ banner
 * recording the wire-witnessed defect: it called `confirmEdit('strength')`
 * unconditionally, which rendered `EditConfirmation` at its defaults —
 * **"Updated" in success green** — and then `InlineRerunPrompt`, *"Re-run to
 * see how this affects the results."* So a person was told their statement was
 * saved and invited to SPEND AN ANALYSIS on a change that did not exist.
 *
 * That was closed for the CONFIRM carrier and left open for the EDIT carrier,
 * because `setStrength` shipped `void Promise.resolve(send).catch(() => {})` —
 * the exact shape `settleSystemEventSend`'s header names as the family defect:
 * *"every settlement collapsed to silence, INCLUDING THE SERVER SAYING NO."*
 *
 * ⭐ THESE TWO CASES ARE A DISCRIMINATING PAIR, NOT TWO EXAMPLES. A single
 * predicate covering both settlements would pass the first and fail the second.
 * `refused`/`blocked` mean the model provably does NOT hold the value — say so,
 * and withhold the re-run. `unverified` means it MAY — so it must NOT claim
 * nothing was recorded, and must NOT withhold the re-run. Two opposite harms
 * cannot share one window (CLAUDE.md trap 22b).
 *
 * ⚠ WHAT THIS SPEC CANNOT SEE, STATED PLAINLY. The mock settles SYNCHRONOUSLY,
 * so no case here observes the TRANSITION from pending to settled — only the
 * two ends of it. The pending case below reaches the right STATE (the mock
 * reports no settlement, which is what the panel holds before the server
 * answers) but not the moment of change. A mock that cannot reach a state is
 * indistinguishable from a state that does not exist, and that is exactly how
 * the pending window survived the first version of this change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { ACTION_LABELS } from '../inspectorStrings'
import type { SystemEventSendSettlement } from '../../../conversation/settleSystemEventSend'

// The settlement the mocked send reports back, set per test.
let settlementToReport: SystemEventSendSettlement | null = null

vi.mock('../useInspectorMutations', async importOriginal => {
  const actual = await importOriginal<typeof import('../useInspectorMutations')>()
  return {
    ...actual,
    // ⭐ SPREAD THE ORIGINAL, OVERRIDE ONE METHOD. A hand-listed mock object
    // would silently drop every mutation added since it was written — the
    // hand-maintained-mirror defect (CLAUDE.md trap 12).
    // ⚠ `edgeId: string`, matching the real signature exactly. Declaring it
    // wider (`string | null`) is not a harmless convenience — it is a
    // different function, and the typecheck ratchet catches it.
    useEdgeMutations: (edgeId: string) => {
      const real = actual.useEdgeMutations(edgeId)
      return {
        ...real,
        setStrength: (
          _mean: number,
          opts?: { onSendSettled?: (s: SystemEventSendSettlement) => void },
        ) => {
          if (settlementToReport !== null) opts?.onSendSettled?.(settlementToReport)
          return 'dispatched' as const
        },
      }
    },
  }
})

function seedAssertableEdge() {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ],
    // `strength_mean` + `effect_direction` are what `serverStatedStrengthOf`
    // needs for the edit to be assertable — without them the band buttons
    // render disabled and this spec would assert about a control nobody can press.
    edges: [{
      id: 'e1', source: 'fac1', target: 'out1',
      data: {
        weight: 0.35, direction: 'positive', weightSource: 'cee',
        strength_mean: 0.35, effect_direction: 'positive',
      },
    }],
  } as never)
}

const panelProps = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

beforeEach(() => {
  settlementToReport = null
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

/**
 * Press a strength band, bound BY IDENTITY — `StrengthBandButtons:95` stamps
 * `data-testid={`strength-band-${label}`}`. Binding by button TEXT would let a
 * different control satisfy the predicate (CLAUDE.md trap 19), and this panel
 * renders more than one set of band buttons: the `awaitingStatedStrength`
 * branch has its own, wired to a different carrier entirely.
 */
function pressAStrengthBand(container: HTMLElement) {
  const bands = container.querySelectorAll('[data-testid^="strength-band-"]')
  // PRECONDITION PINNED IN-TEST: assert the control exists and is pressable
  // before asserting anything about what pressing it says. A disabled fieldset
  // would otherwise make every expectation below pass by testing nothing.
  expect(bands.length, 'PRECONDITION: strength bands must render').toBeGreaterThan(0)
  const btn = bands[0] as HTMLButtonElement
  expect(btn.disabled, 'PRECONDITION: the band must be pressable').toBe(false)
  fireEvent.click(btn)
}

describe('EdgePanel — a strength edit says what actually happened to it', () => {
  it('REFUSED: names it as not recorded, and withholds the re-run invitation', () => {
    seedAssertableEdge()
    settlementToReport = 'refused'
    const { container } = render(<EdgePanel {...panelProps} />)
    pressAStrengthBand(container)

    const feedback = container.querySelector('[data-testid="edge-strength-edit-feedback"]')
    expect(feedback, 'the edit feedback must render at all').toBeTruthy()
    expect(feedback?.getAttribute('data-settlement')).toBe('refused')
    expect(feedback?.textContent).toContain(ACTION_LABELS.strengthEditNotRecorded)
    // The money half: never invite an analysis on a change the model does not hold.
    expect(screen.queryByText(/re-run/i)).toBeNull()
  })

  it('UNVERIFIED: does NOT claim nothing was recorded, and KEEPS the re-run available', () => {
    seedAssertableEdge()
    settlementToReport = 'unverified'
    const { container } = render(<EdgePanel {...panelProps} />)
    pressAStrengthBand(container)

    const feedback = container.querySelector('[data-testid="edge-strength-edit-feedback"]')
    expect(feedback?.getAttribute('data-settlement')).toBe('unverified')
    expect(feedback?.textContent).toContain(ACTION_LABELS.strengthEditUnverified)
    // ⭐ THE DISCRIMINATION: the opposite harm. A predicate widened to swallow
    // `unverified` would pass the case above and fail this line.
    expect(feedback?.textContent).not.toContain(ACTION_LABELS.strengthEditNotRecorded)
  })

  it('⭐ PENDING: the window every edit passes through never claims "Updated", and withholds the re-run', () => {
    seedAssertableEdge()
    // `null` means the mock reports NO settlement — which is exactly the real
    // state between the press and the server's answer, because
    // `settleSystemEventSend` settles a promise and cannot resolve in the same
    // tick. This is the state the first version of this change fell through to
    // `EditConfirmation`'s defaults on, rendering "Updated" in success green
    // with the re-run offered.
    settlementToReport = null
    const { container } = render(<EdgePanel {...panelProps} />)
    pressAStrengthBand(container)

    const feedback = container.querySelector('[data-testid="edge-strength-edit-feedback"]')
    expect(feedback, 'the edit feedback must render at all').toBeTruthy()
    expect(feedback?.getAttribute('data-settlement')).toBe('pending')
    expect(feedback?.textContent).toContain(ACTION_LABELS.strengthEditSending)
    // ⛔ THE TWO CLAIMS THAT MUST NOT APPEAR HERE.
    expect(feedback?.textContent).not.toContain('Updated')
    expect(screen.queryByText(/re-run/i)).toBeNull()
  })

  it('SENT: says the POST left, and still does not claim the model changed', () => {
    seedAssertableEdge()
    settlementToReport = 'sent'
    const { container } = render(<EdgePanel {...panelProps} />)
    pressAStrengthBand(container)

    const feedback = container.querySelector('[data-testid="edge-strength-edit-feedback"]')
    expect(feedback?.getAttribute('data-settlement')).toBe('sent')
    expect(feedback?.textContent).not.toContain(ACTION_LABELS.strengthEditNotRecorded)
    expect(feedback?.textContent).not.toContain(ACTION_LABELS.strengthEditUnverified)
    // ⛔ `'sent'` means a POST left and the server has not answered.
    // `settleSystemEventSend`'s own header: a row rendering "saved" on it is
    // "an optimistic write wearing a receipt".
    expect(feedback?.textContent).not.toContain('Updated')
    expect(feedback?.textContent).toContain(ACTION_LABELS.strengthConfirmSent)
  })
})
