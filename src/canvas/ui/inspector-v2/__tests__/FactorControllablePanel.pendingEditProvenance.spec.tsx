/**
 * A4b — an unconfirmed edit must not be labelled with an origin the data does
 * not carry, and the "not sent" state must not disappear while it is still
 * true.
 *
 * THE DEFECT (AUDIT-SYNTH A4(b)): the user types 0.7 into a factor that was
 * previously "Estimated by Olumi". The local store write moves the number
 * immediately, but the provenance pill in the context group keeps reading
 * `observedState.source` — which the panel deliberately does NOT stamp
 * optimistically (ROADMAP 2.304: the authorship claim is receipt-gated). So
 * for the whole unconfirmed window the pill still says "Estimated by Olumi"
 * over a number the user just typed.
 *
 * Separately, when the send is blocked or fails, the panel's own "Not sent to
 * Olumi" notice (`EditConfirmation` without `hold`) fades after 1500ms while
 * the re-run prompt beside it stays — so after the fade the user sees "re-run"
 * with nothing telling them the edit that would be re-run was never sent.
 *
 * Fix (this file's target, `FactorControllablePanel.tsx`): while an edit is
 * unconfirmed (`valueCommitOutcome` is `sending` or `local_only`), the context
 * pill shows a persistent "Your edit" marker instead of `getExtractionLabel`,
 * and the `local_only` notice does not fade.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module rather than hand-listing its exports.
vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { useCanvasStore } from '../../../store'
import { SEND_BLOCKED } from '../../../conversation/useConversation'

const NODE_ID = 'fac_pricing_level'
const CAP = 1
const COMMITTED_RAW = 0.8
const NEW_RAW = 0.7

const noop = () => {}

function factorNode(): Node {
  return {
    id: NODE_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Pricing Level',
      kind: 'factor',
      factor_type: 'lever',
      observedState: {
        value: COMMITTED_RAW,
        raw_value: COMMITTED_RAW,
        cap: CAP,
        display_value: String(COMMITTED_RAW),
        // The producer's stamp — what the pill shows before any edit, and what
        // it must NOT keep showing once the user has typed a new number.
        source: 'cee_inference',
      },
    },
  } as unknown as Node
}

function seed() {
  useCanvasStore.setState(
    { nodes: [factorNode()], edges: [], results: { status: 'idle', report: null } } as never,
    false,
  )
}

function renderPanel() {
  return render(
    <FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />,
  )
}

function contextGroup(container: HTMLElement) {
  return container.querySelector('[data-panel-group="context"]')
}

/** Commit = type into the input, then blur (Enter blurs, per the panel's onKeyDown). */
function commit(next: string) {
  const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement
  fireEvent.change(input, { target: { value: next } })
  fireEvent.blur(input)
}

describe('A4b — pending edit provenance is not claimed as an Olumi estimate', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    seed()
  })
  afterEach(() => cleanup())

  it('the context pill stops saying "Estimated by Olumi" the instant an edit is in flight', () => {
    // Never resolves — pins the panel in the `sending` state, the window this
    // defect lives in.
    sendSystemEvent.mockReturnValue(new Promise(() => {}))
    const { container } = renderPanel()

    // Precondition: before any edit, the producer's stamp reads through.
    expect(contextGroup(container)?.textContent).toContain('Estimated by Olumi')

    commit(String(NEW_RAW))

    // RED before the fix: the pill still reads `observedState.source`, which
    // the panel never stamps optimistically, so it still says the producer's
    // claim over the user's own just-typed number.
    expect(contextGroup(container)?.textContent).not.toContain('Estimated by Olumi')
    expect(contextGroup(container)?.textContent).toContain('Your edit')
  })

  it('"Not sent to Olumi" does not fade while the edit genuinely has not been sent', async () => {
    sendSystemEvent.mockResolvedValue(SEND_BLOCKED)
    vi.useFakeTimers()
    try {
      const { container } = renderPanel()
      commit(String(NEW_RAW))

      // Flush the resolved promise so the outcome settles to `local_only`.
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(screen.getByText('Not sent to Olumi')).toBeTruthy()

      // RED before the fix: this notice had no `hold` and vanished at 1500ms,
      // even though nothing about "not sent" had changed.
      act(() => { vi.advanceTimersByTime(2000) })
      expect(screen.getByText('Not sent to Olumi')).toBeTruthy()

      // And the pill has not reverted to the producer's claim either.
      expect(contextGroup(container)?.textContent).not.toContain('Estimated by Olumi')
    } finally {
      vi.useRealTimers()
    }
  })
})
