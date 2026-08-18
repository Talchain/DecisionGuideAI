/**
 * THE RE-DRAFT'S FAILURE PROMISE, PINNED — the composer half.
 *
 * ── WHAT WAS BROKEN, AND HOW IT WAS MEASURED ──────────────────────────────
 * `Re-draft this live` raises a confirm that says, of the failure case: *"the
 * saved example is put back **and your brief comes back in the composer** so
 * you can retry"*, and its toast repeated the claim. `handleRedraft` put the
 * example back (`undoDraft`) and **never touched the composer**.
 *
 * Driven as a fresh guest on the deployed build `9ff14c19`, 18 Aug 2026: 91 s
 * after the click the canvas was restored to its 20 nodes, the saved-example
 * banner was back, and `textarea.value === ""`. The product's own prescribed
 * remedy for the disabled Analyse button therefore left the user in the
 * identical blocked state, having told them twice that their brief was waiting
 * for them.
 *
 * ── ⚠ TWO CLAIMS THE SAME MEASUREMENT REFUTED — DO NOT "FIX" THEM ─────────
 * The 18 Aug affordance sweep recorded that the re-draft sent no brief and
 * produced no user turn. Both are false, and a lane that believes them will
 * rebuild working machinery:
 *
 *   - THE BRIEF IS SENT, VERBATIM. Wire-witnessed with a `fetch` interceptor:
 *     `POST https://cee-staging.onrender.com/proxy/v5/turn/stream`, HTTP 200,
 *     `message` = the full 385-character vendor-selection brief,
 *     `source: "composer"`, `stage: "frame"`.
 *   - THE USER'S TURN IS RENDERED. It is in the Olumi dock tab, above CEE's
 *     reply. The sweep was reading the first-use hero, which by design has NO
 *     transcript (`OutputsDock.tsx` — *"the floating hero (FirstUseComposer) —
 *     which has NO transcript"*).
 *
 * The re-draft's ONE broken promise was the composer, and that is all this
 * file pins.
 *
 * ── WHY FAILURE IS SIMULATED AS A RESOLVING SEND ──────────────────────────
 * Inherited from `StarterProvenanceBanner.failedRedraft.spec.tsx`, and it is
 * load-bearing: a failed USER turn does NOT reject. `sendTurn` catches the
 * dispatch error, renders the transport-honest bubble and returns normally, so
 * `sendMessage` RESOLVES on failure. A spec written against a rejection would
 * pass against a `.catch()` that can never fire in production.
 *
 * ── THE OPPOSITE-DIRECTION TWIN ───────────────────────────────────────────
 * A restore that always runs would clobber text the user typed while the draft
 * was in flight — trading a broken promise for destroyed input. So every case
 * here has its twin: empty composer ⇒ brief restored and the toast says so;
 * NON-empty composer ⇒ the user's text survives untouched and the toast says
 * THAT instead. The two toast sentences are chosen from the same boolean that
 * performs the write, so they cannot disagree with what happened.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMessageMock = vi.fn()
const setDraftMock = vi.fn()
// The composer buffer this suite is about. Held in a mutable local so a case
// can present a NON-empty composer, which is the opposite-direction twin.
let draftValue = ''
vi.mock('../../conversation/ConversationContext', () => ({
  useConversationContext: () => ({
    sendMessage: sendMessageMock,
    draft: draftValue,
    setDraft: setDraftMock,
  }),
}))

const showToast = vi.fn()
vi.mock('../../ToastContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useShowToastSafe: () => showToast }
})

import { StarterProvenanceBanner } from '../StarterProvenanceBanner'
import { useCanvasStore } from '../../store'
import { STARTERS } from '../../starters/loadStarter'

const VENDOR = STARTERS.find((s) => s.id === 'vendor-selection')!

function seedStarterGraph(count = 3) {
  useCanvasStore.setState({
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: `n${i}`, starterId: 'vendor-selection', starterTitle: VENDOR.title },
    })) as never,
    edges: [{ id: 'e0', source: 'n0', target: 'n1' }] as never,
  })
}

describe('a failed starter re-draft returns the brief to the composer (affordance sweep A13)', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    draftValue = ''
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true) as never
    seedStarterGraph()
    // `resetCanvas` is deliberately NOT mocked: the defect lives in what the
    // real reset destroys, and a no-op reset makes the restore vacuous.
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes the starter brief into the shared composer when the live draft returns no model', async () => {
    sendMessageMock.mockImplementation(async () => undefined)
    const user = userEvent.setup()
    render(<StarterProvenanceBanner />)

    await user.click(screen.getByTestId('starter-redraft'))
    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledTimes(1))

    // THE assertion that was RED: nothing ever wrote to the composer.
    //
    // Bound by IDENTITY, not by a value predicate: the expectation is the
    // manifest's OWN brief for the starter whose stamp is on the seeded nodes,
    // so a restore that wrote some other starter's brief (or any non-empty
    // placeholder) fails here rather than passing on the wrong object.
    await waitFor(() => expect(setDraftMock).toHaveBeenCalledWith(VENDOR.brief))
    expect(setDraftMock).toHaveBeenCalledTimes(1)
  })

  it('says in the toast that the brief is in the composer — and only when it put it there', async () => {
    sendMessageMock.mockImplementation(async () => undefined)
    const user = userEvent.setup()
    render(<StarterProvenanceBanner />)

    await user.click(screen.getByTestId('starter-redraft'))
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1))

    const [message, level] = showToast.mock.calls[0]
    expect(level).toBe('warning')
    expect(message).toContain('Your brief is in the composer')
    // The claim and the write must come from the same decision.
    expect(setDraftMock).toHaveBeenCalledWith(VENDOR.brief)
  })

  it('OPPOSITE-DIRECTION TWIN: text the user typed while the draft was in flight is never clobbered', async () => {
    draftValue = 'my own half-typed question about the CDP shortlist'
    sendMessageMock.mockImplementation(async () => undefined)
    const user = userEvent.setup()
    render(<StarterProvenanceBanner />)

    await user.click(screen.getByTestId('starter-redraft'))
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1))

    // The user's input outranks the brief — the same fail-safe the canvas
    // restore already applies to a graph that landed mid-flight.
    expect(setDraftMock).not.toHaveBeenCalled()
    // …and the toast must NOT then claim the brief is waiting, which is the
    // whole point of choosing the sentence from the boolean that wrote.
    const [message] = showToast.mock.calls[0]
    expect(message).not.toContain('Your brief is in the composer')
    expect(message).toContain('What you had typed is still in the composer')
  })

  it('NEGATIVE CONTROL: a SUCCESSFUL re-draft touches neither the composer nor the toast', async () => {
    // A graph lands, exactly as a successful live draft would leave it.
    sendMessageMock.mockImplementation(async () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'fresh', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'fresh' } },
        ] as never,
        edges: [] as never,
      })
    })
    const user = userEvent.setup()
    render(<StarterProvenanceBanner />)

    await user.click(screen.getByTestId('starter-redraft'))
    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledTimes(1))

    // Without this case, the first assertion is satisfiable by a restore that
    // always runs and overwrites the composer on every successful re-draft.
    expect(setDraftMock).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('the confirm dialog discloses that an unsaved conversation is cleared', async () => {
    sendMessageMock.mockImplementation(async () => undefined)
    const user = userEvent.setup()
    render(<StarterProvenanceBanner />)

    await user.click(screen.getByTestId('starter-redraft'))

    // `resetCanvas` calls `clearTranscript(scenarioIdBeingReset)` for a
    // decision that is not a saved record, so the re-draft destroys the
    // conversation — and this dialog used to say nothing about it. The
    // sentence is conditional because the code is: a SAVED record's transcript
    // is deliberately left alone, so an unconditional warning would be its own
    // false claim.
    const text = String(confirmSpy.mock.calls[0][0])
    expect(text).toContain('If this decision isn’t saved, it also clears the conversation so far.')
  })
})
