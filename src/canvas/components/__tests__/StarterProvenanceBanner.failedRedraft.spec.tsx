/**
 * A FAILED live re-draft must not cost the user their saved example.
 *
 * THE DEFECT THIS PINS. `handleRedraft` called `resetCanvas()` — which
 * destroys the example — and then fired `sendMessage(...)` without awaiting
 * it. By the time the turn could fail, the example was already gone, and
 * recovery was left entirely to the composer restoring the brief TEXT.
 *
 * Why that is the majority case rather than an edge case: ruling D-73
 * pre-drafted these starters precisely BECAUSE live drafting on these briefs
 * fails 43–64% of the time (Fisher p=0.0297; the component cites 36–57%
 * success from STARTER-BRIEF-VALIDATION-2026-07-24.md). So the escape hatch
 * left a first-time tester with LESS than they started with, more often than
 * not.
 *
 * ⚠ THE SUBTLETY THAT DECIDES THE SHAPE OF THE FIX — and of this file.
 * A failed USER turn does not reject. `sendTurn` catches the dispatch error,
 * renders the transport-honest failure bubble and returns normally;
 * `systemSendFailure` is set for `mode === 'system'` ONLY ("User turns never
 * set it", useConversation.ts). So `sendMessage` RESOLVES on failure, and a
 * `.catch()` would be a safety net that can never fire. These tests therefore
 * simulate failure the way it actually presents — a resolving `sendMessage`
 * that produces no graph — NOT a rejecting one. A spec written against a
 * rejection would pass against a `.catch()` that is dead in production.
 *
 * WHAT THIS FILE PINS:
 *   1. The example is RESTORED when the re-draft returns no model — RED before.
 *   2. It is restored INTACT: same nodes, and the starter provenance stamp
 *      still on them (a restore that dropped the stamp would silently turn a
 *      saved example into something the run gate treats as a real model).
 *   3. NEGATIVE CONTROL / fail-safe: when the re-draft SUCCEEDS, the fresh
 *      graph is left alone. Without this, assertion 1 is satisfiable by a
 *      restore that always runs and clobbers every successful re-draft.
 *   4. The snapshot is armed AFTER `resetCanvas`, because `resetCanvas` itself
 *      nulls `draftChatPreDraftSnapshot`. Arming it before is the one ordering
 *      that silently produces no restore at all.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMessageMock = vi.fn()
vi.mock('../../conversation/ConversationContext', () => ({
  useConversationContext: () => ({ sendMessage: sendMessageMock }),
}))

const showToast = vi.fn()
vi.mock('../../ToastContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useShowToastSafe: () => showToast }
})

import { StarterProvenanceBanner } from '../StarterProvenanceBanner'
import { useCanvasStore } from '../../store'
import { STARTERS } from '../../starters/loadStarter'

const MARKET = STARTERS.find((s) => s.id === 'market-entry')!

function seedStarterGraph(count = 3) {
  useCanvasStore.setState({
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: `n${i}`, starterId: 'market-entry', starterTitle: MARKET.title },
    })) as never,
    edges: [{ id: 'e0', source: 'n0', target: 'n1' }] as never,
  })
}

describe('a failed starter re-draft restores the example (ROADMAP 2.102)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Not held in a typed local: `ReturnType<typeof vi.spyOn>` widens to
    // MockInstance<unknown[], unknown>, which window.confirm's signature does
    // not satisfy (TS2322). `restoreAllMocks` in afterEach undoes the spy
    // without needing the handle.
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    seedStarterGraph()
    // NOTE: `resetCanvas` is deliberately NOT mocked here (unlike the sibling
    // spec). The whole defect lives in what the REAL reset destroys, so a
    // no-op reset would make every assertion below vacuous.
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('puts the saved example back when the live draft returns no model', async () => {
    // Failure as it actually presents: the turn resolves, no graph arrives.
    sendMessageMock.mockImplementation(async () => undefined)
    const user = userEvent.setup()
    render(<StarterProvenanceBanner />)

    await user.click(screen.getByTestId('starter-redraft'))

    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledTimes(1))
    // THE assertion that was RED: the canvas was left empty and the example
    // was gone for good.
    await waitFor(() => expect(useCanvasStore.getState().nodes).toHaveLength(3))
  })

  it('restores it INTACT — the starter provenance stamp survives', async () => {
    sendMessageMock.mockImplementation(async () => undefined)
    const user = userEvent.setup()
    render(<StarterProvenanceBanner />)

    await user.click(screen.getByTestId('starter-redraft'))

    await waitFor(() => expect(useCanvasStore.getState().nodes).toHaveLength(3))
    const restored = useCanvasStore.getState().nodes
    // Without the stamp the run gate stops treating it as a saved example and
    // the disclosure banner stops rendering — a silent honesty regression.
    expect(restored.every((n) => (n.data as Record<string, unknown>)?.starterId === 'market-entry')).toBe(true)
    expect(useCanvasStore.getState().edges).toHaveLength(1)
  })

  it('tells the user their example came back, rather than restoring silently', async () => {
    sendMessageMock.mockImplementation(async () => undefined)
    const user = userEvent.setup()
    render(<StarterProvenanceBanner />)

    await user.click(screen.getByTestId('starter-redraft'))

    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1))
    expect(showToast.mock.calls[0][0]).toMatch(/saved example has been put back/i)
  })

  it('NEGATIVE CONTROL: a SUCCESSFUL re-draft is left alone, never clobbered', async () => {
    // The turn lands a fresh graph, exactly as a real draft response would.
    sendMessageMock.mockImplementation(async () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'fresh1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'fresh1' } },
          { id: 'fresh2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'fresh2' } },
        ] as never,
        edges: [] as never,
      })
      return undefined
    })
    const user = userEvent.setup()
    render(<StarterProvenanceBanner />)

    await user.click(screen.getByTestId('starter-redraft'))

    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledTimes(1))
    const after = useCanvasStore.getState().nodes
    expect(after).toHaveLength(2)
    expect(after.map((n) => n.id)).toEqual(['fresh1', 'fresh2'])
    // No "we put it back" claim over a re-draft that worked.
    expect(showToast).not.toHaveBeenCalled()
  })

  it('arms the restore AFTER resetCanvas — the ordering resetCanvas would otherwise erase', async () => {
    // resetCanvas sets `draftChatPreDraftSnapshot: null`. If the snapshot were
    // taken before it, this would be null at send time and no restore could
    // happen. Observing it non-null while the turn is in flight is what proves
    // the ordering, independently of the outcome assertions above.
    let snapshotDuringSend: unknown = 'not-observed'
    sendMessageMock.mockImplementation(async () => {
      snapshotDuringSend = useCanvasStore.getState().draftChatPreDraftSnapshot
      return undefined
    })
    const user = userEvent.setup()
    render(<StarterProvenanceBanner />)

    await user.click(screen.getByTestId('starter-redraft'))

    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledTimes(1))
    expect(snapshotDuringSend).not.toBeNull()
    expect((snapshotDuringSend as { nodes: unknown[] }).nodes).toHaveLength(3)
  })
})
