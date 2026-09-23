/**
 * ⭐ A HOLD NAMES AN UNCONFIRMED LINK-STRENGTH EDIT — #1905's signal 5, which
 * hold-names-cause did not know about.
 *
 * ## The gap (found while rebasing hold-names-cause onto #1905)
 *
 * #1905 (`a37686d1`) added a fifth `editDeliveryHold` signal: while the canvas
 * shows a link strength the server has not confirmed (an unanswered
 * `edge_strength_edit`), registration is held (`unconfirmed_edge_on_canvas`,
 * `conversation/pendingEdgeEdit.ts`). On a saved example that holds analysis,
 * and the only sentence was "Analysis is held on a saved example. Re-draft it
 * live to run one." That is the wrong cause, and a re-draft would discard the
 * user's unconfirmed strength. It also left the banner's "Re-draft this live"
 * on screen, against the decision that it is hidden during any edit hold.
 *
 * ## What this pins
 *
 *  1. The sentence names the link, in the existing unconfirmed-value frame
 *     (no new copy): "Olumi couldn't confirm your change to the link from {A}
 *     to {B}, so analysis is waiting until it is settled. Would you like to set
 *     the value again?" No number is stated: the client does not know the
 *     model's, and the link has no projection of the user's.
 *  2. It is a user-edit hold (`isUserEditHold`), so the banner withdraws its
 *     re-draft (swept with every cause in
 *     `StarterProvenanceBanner.editHoldHidesRedraft.spec.tsx`).
 *  3. REACTIVITY: the pending link register is module state. Settling it is
 *     not a store write, and the run chip must follow it.
 *  4. CONTROL: a canvas no longer showing the sent strength holds nothing.
 *
 * Every other surface is swept for this cause by the shared fixture's
 * `HOLD_CAUSES` (`registration/__tests__/helpers/editHoldCauses.ts`).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

import * as held from '../analysisHeldOnInjectedModel'
import { ANALYSIS_HELD_NOTICE } from '../analysisHeldOnInjectedModel'
import { NodeChip } from '../../nodes/shared/NodeChip'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { beginModelEditDelivery, editDeliveryHold } from '../../registration/editDeliveryHold'
import { markEdgeEditInFlight, settleEdgeEdit } from '../../conversation/pendingEdgeEdit'
import {
  LINK_NAME,
  LINK_WEIGHT_BEFORE,
  USER_LINK_MAGNITUDE,
  arrangeHoldCause,
  resetEditHoldRegisters,
  seedHeldCanvas,
} from '../../registration/__tests__/helpers/editHoldCauses'

const linkSentence = (named: string) =>
  `Olumi couldn't confirm your change to ${named}, so analysis is waiting until it is settled. ` +
  'Would you like to set the value again?'

function seedCanonicalRunPath() {
  try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* jsdom quirk */ }
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
}

const state = () => useCanvasStore.getState() as never

function renderRunChip() {
  return render(
    <ToastProvider>
      <NodeChip chipId="decision_run_analysis" actionType="run_analysis" label="Run analysis" message="Run the analysis now" />
    </ToastProvider>,
  )
}
const runChip = () => screen.getByRole('button', { name: 'Run analysis' })

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

describe('PRECONDITION — the state #1905 signal 5 holds on', () => {
  it('held on the saved example, and the hold is the unconfirmed link strength', () => {
    arrangeHoldCause('unconfirmed_link_value')
    expect(held.analysisHeldOn(state())).toBe('starter')
    expect(editDeliveryHold(state())).toBe('unconfirmed_edge_on_canvas')
  })
})

describe('the shared authority names the link', () => {
  it('"your change to the link from {A} to {B}", no re-draft, no number', () => {
    arrangeHoldCause('unconfirmed_link_value')
    const reason = held.heldReason(state())
    expect(reason?.sentence).toBe(linkSentence(LINK_NAME))
    expect(reason?.sentence).not.toMatch(/\d/)
    expect(held.isUserEditHold(reason ?? null)).toBe(true)
  })
})

describe('REACTIVITY — the pending link register moves the surfaces without a store write', () => {
  it('"being saved" on the wire, the link once it settles unconfirmed, the example once the register settles', () => {
    seedHeldCanvas({ linkWeight: USER_LINK_MAGNITUDE })
    const release = beginModelEditDelivery('edge_strength_edit')
    markEdgeEditInFlight('e1', USER_LINK_MAGNITUDE, { weight: LINK_WEIGHT_BEFORE, direction: 'positive' })
    renderRunChip()
    expect(runChip().getAttribute('title')).toMatch(/still being saved/i)

    act(() => release())
    expect(runChip()).toHaveAttribute('title', linkSentence(LINK_NAME))

    // An applied receipt settles the register (`settleEdgeEdit`): module state only.
    act(() => { settleEdgeEdit('e1', USER_LINK_MAGNITUDE) })
    expect(runChip()).toHaveAttribute('title', ANALYSIS_HELD_NOTICE.starter)
  })
})

describe('CONTROL — nothing else moves', () => {
  it('the canvas no longer shows the sent strength: no link hold, the example sentence', () => {
    seedHeldCanvas({ linkWeight: 0.6 })
    markEdgeEditInFlight('e1', USER_LINK_MAGNITUDE, { weight: LINK_WEIGHT_BEFORE, direction: 'positive' })
    expect(editDeliveryHold(state())).toBeNull()
    expect(held.heldReason(state())?.sentence).toBe(ANALYSIS_HELD_NOTICE.starter)
  })
})
