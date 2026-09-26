/**
 * ⭐ THE SAVED-EXAMPLE BANNER DOES NOT OFFER "Re-draft this live" WHILE THE
 * USER'S OWN EDIT IS WHAT ANALYSIS IS WAITING ON.
 *
 * Decision (23 Sep 2026, hold-names-cause on #1905): hide the button whenever
 * the operative hold cause is a user edit. A re-draft REPLACES the model
 * (`handleRedraft`: `resetCanvas()` then a fresh draft), so while an edit is
 * unconfirmed it would discard that change without a word. Its confirm dialog
 * warns about the example and the conversation, not about the edit. The hold
 * sentence beside it already names the edit and the remedy (`heldReason`).
 *
 * What this pins:
 *  1. For EVERY edit hold cause in the shared fixture (in delivery, queued,
 *     unconfirmed value, rename, add, delete, link delete) the button is not
 *     rendered, while the disclosure itself still is.
 *  2. CONTROLS: a plain saved-example hold (no edit anywhere) still offers it,
 *     and so does an acknowledged model with no hold.
 *  3. REACTIVITY: the button comes back once the edit is settled, with no
 *     store write (a proven delete moves module state only).
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../conversation/ConversationContext')>()
  return {
    ...actual,
    // The banner reads the shared composer buffer; its real shape is listed so
    // no field is `undefined` in the component (a factory replaces the module).
    useConversationContext: () => ({ sendMessage: vi.fn(), draft: '', setDraft: vi.fn() }),
  }
})

import { StarterProvenanceBanner } from '../StarterProvenanceBanner'
import { ANALYSIS_HELD_NOTICE } from '../../utils/analysisHeldOnInjectedModel'
import { settleStructuralDeleteAttempt } from '../../conversation/unconfirmedStructuralDelete'
import {
  DELETED_ID,
  HOLD_CAUSES,
  SCENARIO,
  acknowledgeCurrentGraph,
  applyDeleteToStore,
  arrangeHoldCause,
  captureDelete,
  resetEditHoldRegisters,
  seedHeldCanvas,
} from '../../registration/__tests__/helpers/editHoldCauses'

function seedCanonicalRunPath() {
  try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* jsdom quirk */ }
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
}

const redraftButton = () => screen.queryByTestId('starter-redraft')
/**
 * contract v3.1 (DESIGN-GAP #3): the hold line and the re-draft live in the
 * context line's detail, one click away. Opened after every render and ASSERTED
 * open, so a `toBeNull()` on the button below can never pass on a closed detail.
 */
function openDetail() {
  fireEvent.click(screen.getByTestId('starter-provenance-line'))
  expect(screen.getByTestId('starter-provenance-detail')).toBeInTheDocument()
}
const holdLine = () => screen.getByText(/Edit anything on the canvas\./)

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

describe('an edit hold: no "Re-draft this live"', () => {
  it.each(HOLD_CAUSES)('%s: the disclosure stays, the re-draft button does not', (cause) => {
    arrangeHoldCause(cause)
    render(<StarterProvenanceBanner />)
    openDetail()
    expect(screen.getByTestId('starter-provenance-banner')).toBeInTheDocument()
    // The line beside it names the edit, not the example (the shared sentence).
    expect(holdLine().textContent).not.toContain(ANALYSIS_HELD_NOTICE.starter)
    expect(redraftButton(), `${cause}: the banner offers a re-draft over an unconfirmed edit`).toBeNull()
  })
})

describe('CONTROLS — the button stays wherever no user edit is the cause', () => {
  it('a plain saved-example hold (no edit anywhere): "Re-draft this live" is offered', () => {
    render(<StarterProvenanceBanner />)
    openDetail()
    expect(holdLine()).toHaveTextContent(ANALYSIS_HELD_NOTICE.starter)
    expect(redraftButton()).toBeInTheDocument()
    expect(redraftButton()).toHaveTextContent('Re-draft this live')
  })

  it('an acknowledged model with no hold: "Re-draft this live" is offered', () => {
    acknowledgeCurrentGraph()
    render(<StarterProvenanceBanner />)
    openDetail()
    expect(holdLine().textContent).toBe('Edit anything on the canvas.')
    expect(redraftButton()).toBeInTheDocument()
  })
})

describe('REACTIVITY — the button follows the hold cause without a store write', () => {
  it('hidden while a delete is unconfirmed, back once a delete of it is proven', () => {
    const intent = captureDelete([DELETED_ID])
    applyDeleteToStore(intent)
    settleStructuralDeleteAttempt(intent, SCENARIO, 'unconfirmed')
    render(<StarterProvenanceBanner />)
    openDetail()
    expect(redraftButton()).toBeNull()

    act(() => settleStructuralDeleteAttempt(intent, SCENARIO, 'proven'))
    expect(redraftButton()).toBeInTheDocument()
    expect(holdLine()).toHaveTextContent(ANALYSIS_HELD_NOTICE.starter)
  })
})
