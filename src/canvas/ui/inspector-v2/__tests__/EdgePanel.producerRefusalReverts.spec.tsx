/**
 * ⭐ F1 — A BAND THE MODEL REFUSED NEVER STAYS ON THE PILL (red team #87 6006627551; DL ruling, cut 5).
 *
 * CEE (#2624, served d40fd7b1) refuses a strength move on a link that holds the user's own figure with a 200 and its
 * own words — "This link holds your figure: ‘…’. Change the figure, or say ‘replace my figure with …’." — and writes
 * nothing. Before this, the pill kept the clicked band and the panel said "Olumi may not have recorded this": a band
 * that did not apply, on display.
 *
 * The proof (never "a 200 without a graph", audit 31880193): the reply answers at the SAME analysis hash the canvas
 * sent from (`lastServerGraphHash`) while the send MOVED the server-stated strength. Pinned through the mounted
 * `InspectorRouter` and the REAL settlement (`settleSystemEventSend` → `resolveEdgeEditSettlement` → revert). The
 * carrier double does exactly what `useConversation` does with the reply (source-pinned below).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'

import type { WireSystemEvent } from '../../../conversation/types'
import type { OptimisticEdgeEdit } from '../../../conversation/ownOptimisticWrite'
import {
  __resetPendingEdgeEditsForTest,
  edgeEditAnsweredUnmoved,
  markEdgeEditInFlight,
  noteEdgeEditNotApplied,
} from '../../../conversation/pendingEdgeEdit'

const CEE_SAID = 'This link holds your figure: ‘Each lost customer removes £300 a month’. Change the figure, or say ‘replace my figure with moderate’.'
let replyHash: string | undefined
const sendSystemEvent = vi.fn(async (_event: WireSystemEvent, opts?: { optimisticEdgeEdit?: OptimisticEdgeEdit }) => {
  // What `useConversation` does with a non-error reply to its own edge edit, before the send settles.
  const own = opts?.optimisticEdgeEdit
  if (own && edgeEditAnsweredUnmoved(own, replyHash)) noteEdgeEditNotApplied(own, CEE_SAID)
  return undefined
})

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})
vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

const BASE = 'h-base-31f5adf8'
function seed(lastServerGraphHash: string | null = BASE) {
  useCanvasStore.setState({
    nodes: [
      { id: 'n_churn', type: 'factor', data: { label: 'Customer churn' }, position: { x: 0, y: 0 } },
      { id: 'n_mrr', type: 'goal', data: { label: 'MRR' }, position: { x: 0, y: 0 } },
    ] as never[],
    edges: [{
      id: 'e1', source: 'n_churn', target: 'n_mrr',
      data: { weight: 0.62, direction: 'positive', weightSource: 'cee', serverStrength: { mean: 0.62, effect_direction: 'positive' } },
    }] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    lastServerGraphHash,
    _internal: {},
  } as never)
}
const weight = () => (useCanvasStore.getState().edges.find((e) => e.id === 'e1')?.data as Record<string, unknown>).weight
const feedback = () => screen.getByTestId('edge-strength-edit-feedback')

async function clickModerate() {
  const { container } = render(<InspectorRouter nodeId={null} edgeId="e1" onClose={() => {}} />)
  const band = await waitFor(() => {
    const el = container.querySelector<HTMLButtonElement>('[data-testid="strength-band-moderate"]')
    expect(el, 'PRECONDITION: the moderate band renders').not.toBeNull()
    return el!
  })
  fireEvent.click(band)
  await waitFor(() => expect(sendSystemEvent).toHaveBeenCalledTimes(1))
  return container
}

beforeEach(() => {
  cleanup()
  sendSystemEvent.mockClear()
  __resetPendingEdgeEditsForTest()
  replyHash = undefined
})

describe('F1 — the pill shows only what the model holds', () => {
  it('RED: CEE answers the move at the SAME hash → the pill returns to the model’s band and the panel says CEE’s words', async () => {
    seed()
    replyHash = BASE
    await clickModerate()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(weight()).toBe(0.62)
    expect(feedback().textContent).toContain(CEE_SAID)
  })

  it('CONTROL: a reply at a NEW hash proves nothing about a no-write — the number is kept and the line says it cannot confirm', async () => {
    seed()
    replyHash = 'h-new-9a1c'
    await clickModerate()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'unverified'))
    expect(weight()).not.toBe(0.62)
    expect(feedback().textContent).not.toContain(CEE_SAID)
  })

  it('CONTROL: no base hash held (CEE never stamped one) → no claim, today’s rule', async () => {
    seed(null)
    replyHash = BASE
    await clickModerate()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'unverified'))
    expect(weight()).not.toBe(0.62)
  })
})

describe('edgeEditAnsweredUnmoved — the proof, and only the proof', () => {
  const before = { weight: 0.62, direction: 'positive', serverStrength: { mean: 0.62, effect_direction: 'positive' } }
  const inFlight = (sentMagnitude: number, sentDirection?: 'positive' | 'negative') => {
    __resetPendingEdgeEditsForTest()
    markEdgeEditInFlight('e1', sentMagnitude, before, sentDirection)
  }
  it('a MOVE answered at the sent hash → proven not applied', () => {
    inFlight(0.3)
    expect(edgeEditAnsweredUnmoved({ edgeId: 'e1', sentMagnitude: 0.3, baseGraphHash: BASE }, BASE)).toBe(true)
  })
  it('a direction FLIP (same |mean|) answered at the sent hash → proven not applied', () => {
    inFlight(0.62, 'negative')
    expect(edgeEditAnsweredUnmoved({ edgeId: 'e1', sentMagnitude: 0.62, sentDirection: 'negative', baseGraphHash: BASE }, BASE)).toBe(true)
  })
  it.each([
    ['a different reply hash', 0.3, BASE, 'h-new'],
    ['no reply hash', 0.3, BASE, undefined],
    ['no base hash', 0.3, null, BASE],
    ['an empty base hash', 0.3, '', ''],
    ['a send that moved nothing (sent = server-stated)', 0.62, BASE, BASE],
  ] as const)('no claim on %s', (_n, sent, base, reply) => {
    inFlight(sent)
    expect(edgeEditAnsweredUnmoved({ edgeId: 'e1', sentMagnitude: sent, baseGraphHash: base }, reply)).toBe(false)
  })
  it('no claim for an edit that is not the in-flight one', () => {
    inFlight(0.3)
    expect(edgeEditAnsweredUnmoved({ edgeId: 'e1', sentMagnitude: 0.85, baseGraphHash: BASE }, BASE)).toBe(false)
  })
})

describe('the wiring the double stands in for (source pin)', () => {
  it('useConversation notes a proven refusal of its own edge edit from the reply’s graph_hash, and the send carries the base', () => {
    const conv = readFileSync('src/canvas/conversation/useConversation.ts', 'utf8')
    expect(conv).toMatch(/systemEvent\?\.type === 'edge_strength_edit' &&\s*target\.kind !== 'typed_error' &&\s*activeV5TurnIdRef\.current === turnClientId &&\s*edgeEditAnsweredUnmoved\(ownEdgeEdit, target\.response\.graph_hash\)/)
    expect(conv).toMatch(/noteEdgeEditNotApplied\(ownEdgeEdit,/)
    const mut = readFileSync('src/canvas/ui/inspector-v2/useInspectorMutations.ts', 'utf8')
    expect(mut.match(/baseGraphHash: useCanvasStore\.getState\(\)\.lastServerGraphHash/g)?.length).toBe(2)
  })
})
