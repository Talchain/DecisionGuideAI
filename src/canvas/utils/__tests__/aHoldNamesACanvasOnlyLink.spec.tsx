/**
 * ⭐ A HOLD CAUSED BY A LINK THE USER DREW AND NEVER SENT SAYS SO — and does
 * not blame the saved example or offer a re-draft (canvas audit
 * edit-structure/F2, 27 Sep 2026).
 *
 * Served on pricing-model (skeptic-F2, Context A): at landing the bar read
 * "Analysis available". Dragging Bottom-Up Adoption Friction → Net Revenue
 * Retention (two existing cards) drew a link with no strength; it stood down
 * (`structuralAddStandDown: 'strength_not_stated'`), nothing was sent, and the
 * bar became "Analysis is held on a saved example. Re-draft it live to run
 * one." with an ENABLED "Re-draft this live" that would replace the model and
 * the user's edits. Setting the link's strength released the hold — so the
 * canvas-only link WAS the cause.
 *
 * What this pins:
 *  1. The sentence names the link and the move ("Set its strength …"), never
 *     the saved example, never "Re-draft", never "couldn't confirm" (nothing
 *     was sent, so the unconfirmed-strength sentence would be untrue too).
 *  2. It is a user-edit hold, so the banner withdraws "Re-draft this live".
 *  3. CONTRASTS: the same unacknowledged canvas WITHOUT the marker (a link the
 *     server simply has not acknowledged) keeps the saved-example sentence; and
 *     a canvas whose BASE was never acknowledged keeps it too, because setting
 *     the strength would not release that hold.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../conversation/ConversationContext')>()
  return {
    ...actual,
    useConversationContext: () => ({ sendMessage: vi.fn(), draft: '', setDraft: vi.fn() }),
  }
})

import * as held from '../analysisHeldOnInjectedModel'
import { ANALYSIS_HELD_NOTICE } from '../analysisHeldOnInjectedModel'
import { classifyBlockedReason } from '../composeBlockedReason'
import { StarterProvenanceBanner } from '../../components/StarterProvenanceBanner'
import { editDeliveryHold } from '../../registration/editDeliveryHold'
import { useCanvasStore } from '../../store'
import {
  GOAL_LABEL,
  acknowledgeCurrentGraph,
  resetEditHoldRegisters,
  seedHeldCanvas,
} from '../../registration/__tests__/helpers/editHoldCauses'

const DRAWN_FROM = 'fac_partner_churn'
const DRAWN_FROM_LABEL = 'Partner churn'
const LINK_NAME = `the link from ${DRAWN_FROM_LABEL} to ${GOAL_LABEL}`

const SENTENCE =
  `Analysis is waiting on ${LINK_NAME}: it is on your canvas only. Set its strength to send it to the model.`

/** Exactly what `addEdge` leaves for a drawn link: the default weight, no provenance, the receipt. */
function drawnLink(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e_drawn',
    source: DRAWN_FROM,
    target: 'goal_1',
    type: 'styled',
    data: { weight: 0.3, direction: 'positive', structuralAddStandDown: 'strength_not_stated', ...overrides },
  }
}

function seedCanonicalRunPath() {
  try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* jsdom quirk */ }
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
}

const state = () => useCanvasStore.getState() as never

/** The saved example plus one more card, ACKNOWLEDGED — then the user draws a link from that card. */
function arrangeAcknowledgedThenDrawn(link = drawnLink()) {
  const s = useCanvasStore.getState()
  useCanvasStore.setState({
    nodes: [
      ...s.nodes,
      {
        id: DRAWN_FROM,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { kind: 'factor', label: DRAWN_FROM_LABEL, starterId: 'market-entry' },
      },
    ] as never,
  } as never)
  acknowledgeCurrentGraph()
  useCanvasStore.setState({ edges: [...useCanvasStore.getState().edges, link] as never } as never)
}

beforeEach(() => {
  seedCanonicalRunPath()
  resetEditHoldRegisters()
  seedHeldCanvas()
})

afterEach(() => {
  cleanup()
  resetEditHoldRegisters()
  vi.unstubAllEnvs()
  try { localStorage.removeItem('feature.v5CanonicalAnalysis') } catch { /* jsdom quirk */ }
})

describe('PRECONDITIONS — the served state', () => {
  it('the acknowledged canvas holds nothing; the drawn link alone makes it held, with no edit in delivery', () => {
    const s = useCanvasStore.getState()
    useCanvasStore.setState({
      nodes: [...s.nodes, { id: DRAWN_FROM, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: DRAWN_FROM_LABEL } }] as never,
    } as never)
    acknowledgeCurrentGraph()
    expect(held.analysisHeldOn(state())).toBeNull()

    useCanvasStore.setState({ edges: [...useCanvasStore.getState().edges, drawnLink()] as never } as never)
    expect(held.analysisHeldOn(state())).toBe('starter')
    // No edit is on its way to the server: this is why the old code fell through.
    expect(editDeliveryHold(state())).toBeNull()
  })
})

describe('the hold names the canvas-only link', () => {
  it('names the link and the move; not the saved example, not a re-draft, not "couldn\'t confirm"', () => {
    arrangeAcknowledgedThenDrawn()
    const reason = held.heldReason(state())
    expect(reason?.kind).toBe('canvas_only_link')
    expect(reason?.sentence).toBe(SENTENCE)
    expect(reason?.sentence).not.toBe(ANALYSIS_HELD_NOTICE.starter)
    expect(reason?.sentence).not.toMatch(/re-draft/i)
    expect(reason?.sentence).not.toMatch(/couldn't confirm/i)
    expect(reason?.sentence).not.toMatch(/\bsaved\b/i)
    expect(reason?.sentence).not.toMatch(/—/)
    expect(held.isUserEditHold(reason ?? null)).toBe(true)
  })

  it('two canvas-only links: counted, not named', () => {
    arrangeAcknowledgedThenDrawn()
    useCanvasStore.setState({
      edges: [...useCanvasStore.getState().edges, { ...drawnLink(), id: 'e_drawn_2', source: 'fac_adoption', target: DRAWN_FROM }] as never,
    } as never)
    const reason = held.heldReason(state())
    expect(reason?.kind).toBe('canvas_only_link')
    expect(reason?.sentence).toBe(
      'Analysis is waiting on 2 links you drew: they are on your canvas only. Set their strength to send them to the model.',
    )
  })

  it('every frame is registered composed copy, so the footer vet never rewrites it as foreign text', () => {
    arrangeAcknowledgedThenDrawn()
    expect(classifyBlockedReason(held.heldReason(state())!.sentence)).not.toBe('foreign')
    expect(classifyBlockedReason(held.ANALYSIS_HELD_ON_EDIT_COPY.canvasOnlyLink(null))).not.toBe('foreign')
    expect(classifyBlockedReason(held.ANALYSIS_HELD_ON_EDIT_COPY.canvasOnlyLink(null, 5))).not.toBe('foreign')
  })

  it('the banner withdraws "Re-draft this live" and shows the link sentence', () => {
    arrangeAcknowledgedThenDrawn()
    render(<StarterProvenanceBanner />)
    fireEvent.click(screen.getByTestId('starter-provenance-line'))
    expect(screen.getByTestId('starter-provenance-detail')).toBeInTheDocument()
    expect(screen.queryByTestId('starter-redraft')).toBeNull()
    expect(screen.getByText(/Edit anything on the canvas\./).textContent).toContain(SENTENCE)
  })
})

describe('CONTRASTS — the saved-example sentence stays where it is true', () => {
  it('the same link WITHOUT the stand-down receipt (not a never-sent link): the saved-example sentence', () => {
    const { structuralAddStandDown: _drop, ...plainData } = drawnLink().data
    arrangeAcknowledgedThenDrawn({ ...drawnLink(), data: plainData } as never)
    expect(held.analysisHeldOn(state())).toBe('starter')
    const reason = held.heldReason(state())
    expect(reason?.kind).toBe('starter')
    expect(reason?.sentence).toBe(ANALYSIS_HELD_NOTICE.starter)
  })

  it('a base the server never acknowledged: setting the strength would not release it, so the example is named', () => {
    useCanvasStore.setState({ edges: [...useCanvasStore.getState().edges, drawnLink()] as never } as never)
    const s = useCanvasStore.getState()
    useCanvasStore.setState({
      nodes: [...s.nodes, { id: DRAWN_FROM, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: DRAWN_FROM_LABEL } }] as never,
    } as never)
    // No acknowledgement at all.
    const reason = held.heldReason(state())
    expect(reason?.kind).toBe('starter')
    expect(reason?.sentence).toBe(ANALYSIS_HELD_NOTICE.starter)
  })

  it('the banner still offers "Re-draft this live" on a plain saved-example hold', () => {
    render(<StarterProvenanceBanner />)
    fireEvent.click(screen.getByTestId('starter-provenance-line'))
    expect(screen.getByTestId('starter-redraft')).toBeInTheDocument()
  })
})
