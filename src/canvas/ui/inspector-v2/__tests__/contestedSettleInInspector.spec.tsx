/**
 * SETTLING A CONTESTED CONNECTION FROM THE INSPECTOR.
 *
 * `EdgePanel` has rendered `EdgeReviewDisagreement` for contested edges for some time: the
 * user opens a link, is told two drafting passes disagreed about it, and could do nothing
 * about it. Same defect as the pre-analysis list, on the surface where a user inspects ONE
 * edge — which is where they are most likely to want to settle it.
 *
 * WHAT THIS FILE OWNS, AND WHAT IT DOES NOT. The emit path, the fail-closed builder rules and
 * the retire write are `useSettleContestedEdge`'s, and are pinned against the pre-analysis
 * surface in `contestedSectionSettles.spec.tsx`. This file pins what is DIFFERENT here:
 *
 *  · the control appears only on a CONTESTED edge (contrast: an agreed edge gets none);
 *  · the verdict reaches the wire with this edge's from+to identity;
 *  · ⛔ THE SETTLED STATE, which is the real behavioural difference between the two surfaces.
 *    The pre-analysis row RETIRES on settle, so its control unmounts and cannot be clicked
 *    twice. The inspector does NOT close — it stays open on the edge you just settled — so an
 *    unguarded control here WOULD send a second turn. That is pinned directly.
 *  · an edge already settled on a previous turn is not asked again;
 *  · fail-closed: no send available ⇒ a stated reason, never a dead button.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'

type SentEvent = { type: string; payload: Record<string, unknown> }
const sendSystemEvent = vi.fn(async (_e: SentEvent, _o?: Record<string, unknown>) => 'sent')
let conversationContext: { sendSystemEvent: typeof sendSystemEvent } | null = null

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  // ⚠ SPREAD THE ORIGINAL (trap 12): a bare factory replaces the module.
  const actual = await importOriginal<typeof import('../../../conversation/ConversationContext')>()
  return { ...actual, useOptionalConversationContext: () => conversationContext }
})

import { ContestedSettle } from '../shared/ContestedSettle'
import { useCanvasStore } from '../../../store'
import { makeContestedEdge, makeContestedValidation } from '../../../../__fixtures__/contestedEdge'
import { CONTESTED_COPY } from '../../../components/pre-analysis-v3/constants'
import type { Edge } from '@xyflow/react'
import type { EdgeData } from '../../../domain/edges'
import type { ValidationMetadata } from '../../../domain/validation'

const EDGE = 'e_cap_cash'

function seed(validation: ValidationMetadata) {
  useCanvasStore.setState({
    edges: [makeContestedEdge(EDGE, 'f_capital', 'f_cash', validation)] as Edge<EdgeData>[],
  })
  return validation
}

function storedValidation(): ValidationMetadata | undefined {
  const edge = useCanvasStore.getState().edges.find(e => e.id === EDGE)
  return (edge?.data as { validation?: ValidationMetadata } | undefined)?.validation
}

beforeEach(() => {
  sendSystemEvent.mockClear()
  conversationContext = { sendSystemEvent }
})

const btn = (verdict: string) => `inspector-contested-settle-${verdict}-${EDGE}`

describe('inspector — settling a two-pass disagreement', () => {
  it('sends the verdict with this edge\'s from+to identity and the endorsed mean', () => {
    const v = seed(makeContestedValidation())
    render(<ContestedSettle edgeId={EDGE} validation={v} />)

    fireEvent.click(screen.getByTestId(btn('accepted_pass2')))

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const [event] = sendSystemEvent.mock.calls[0]!
    expect(event.type).toBe('edge_adjudication')
    expect(event.payload.from).toBe('f_capital')
    expect(event.payload.to).toBe('f_cash')
    expect(event.payload.verdict).toBe('accepted_pass2')
    expect(event.payload.resolved_strength_mean).toBe(0.35)
    // The shared hook's retire write reaches the store from this surface too.
    expect(storedValidation()?.user_action).toBe('accepted_pass2')
    expect(storedValidation()?.resolved_by).toBe('user')
  })

  it('⛔ sends ONE turn even though the inspector stays open on the settled edge', () => {
    // THE REAL DIFFERENCE FROM THE PRE-ANALYSIS SURFACE. There the row retires and the control
    // unmounts, so a second click cannot land. Here the panel is still on screen, so without
    // the settled state this control would happily send a second turn for one intent.
    const v = seed(makeContestedValidation())
    render(<ContestedSettle edgeId={EDGE} validation={v} />)
    const button = screen.getByTestId(btn('accepted_pass1'))

    fireEvent.click(button)
    fireEvent.click(button)

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    // POSITIVE CONTROL: the acknowledgement replaced the controls, so the single send above is
    // the guard working — not the component having failed to render anything at all.
    expect(screen.getByTestId(`inspector-contested-settled-${EDGE}`)).toHaveTextContent(
      CONTESTED_COPY.settledAck,
    )
    expect(screen.queryByTestId(btn('accepted_pass1'))).toBeNull()
  })

  it('does not ask again about an edge settled on a previous turn', () => {
    const v = seed(makeContestedValidation({ user_action: 'dismissed', resolved_by: 'user' }))
    render(<ContestedSettle edgeId={EDGE} validation={v} />)

    expect(screen.queryByTestId(btn('accepted_pass1'))).toBeNull()
    expect(screen.queryByTestId(btn('dismissed'))).toBeNull()
    expect(screen.getByTestId(`inspector-contested-settled-${EDGE}`)).toBeInTheDocument()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('offers no button and states the reason when no send is available', () => {
    conversationContext = null
    const v = seed(makeContestedValidation())
    render(<ContestedSettle edgeId={EDGE} validation={v} />)

    expect(screen.queryByTestId(btn('accepted_pass1'))).toBeNull()
    expect(screen.queryByTestId(btn('accepted_pass2'))).toBeNull()
    expect(screen.queryByTestId(btn('dismissed'))).toBeNull()
    // POSITIVE CONTROL: the component DID render — the absences above are the affordance being
    // withheld, not a blank render.
    expect(
      screen.getByTestId(`inspector-contested-settle-unavailable-${EDGE}`),
    ).toHaveTextContent(CONTESTED_COPY.settleUnavailable)
  })

  it('offers only the verdicts a pass can honestly support', () => {
    // Fail-closed, through the shared `contestedVerdictOptions`: a pass stating no finite mean
    // cannot be endorsed, and the escape hatch always remains.
    const v = seed(
      makeContestedValidation({
        pass1: { strength_mean: Number.NaN, strength_std: 0.1, exists_probability: 0.7 },
      }),
    )
    render(<ContestedSettle edgeId={EDGE} validation={v} />)

    expect(screen.queryByTestId(btn('accepted_pass1'))).toBeNull()
    expect(screen.getByTestId(btn('accepted_pass2'))).toBeInTheDocument()
    expect(screen.getByTestId(btn('dismissed'))).toBeInTheDocument()
  })
})
