/**
 * Reasoning V2 — "Challenge the thinking": ONE intervention, the producer's
 * words verbatim, a picked method that claims nothing, and a dismissal that is
 * the Strengthen lifecycle's own.
 *
 * The interventions reach the card the way the body hands them over: through
 * `buildAnalysisNewViewModel` (`vm.strengthen.interventions`), never as a bare
 * literal passed straight to the component. The strengthen store is the REAL
 * store, so the dismissal is asserted on the record it writes rather than on a
 * mock agreeing with itself.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { ChallengeCard } from '../sections/ChallengeCard'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { methodForRecommendation, methodIdsRaisedBy } from '../recommendationMethod'
import { strengthenWhyLine, ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { CHALLENGE_ZONE_COPY as ZONE } from '../challengeZoneCopy'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { useStrengthenStore, recordKey } from '../../../../canvas/stores/strengthenStore'
import { useCanvasStore } from '../../../../canvas/store'
import { readDissent } from '../../../../canvas/stores/dissentStore'
import { genuineDecision } from './analysisNewFixtures'

/**
 * The conversation dispatcher, mocked at the OPTIONAL context — the seam
 * `dissentReachesTheModel.spec.tsx` uses for the same mechanism on
 * `StrengthenTheReasoning`. `dispatcherMounted = false` is the "no live
 * conversation" state (any route without a `ConversationProvider`).
 */
const sendSystemEvent = vi.fn()
let dispatcherMounted = true
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => (dispatcherMounted ? { sendSystemEvent } : null),
}))

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
import { openAskOlumi } from '../../coaching/askOlumiStore'
vi.mock('../../../../canvas/conversation/askAi', () => ({ askAi: vi.fn(() => 'sent') }))
import { askAi } from '../../../../canvas/conversation/askAi'

const SPEC_DECISION = 'challenge-card-decision'

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Test the assumption about Price elasticity',
    signal: 'A small change in this link changes which option comes out ahead.',
    whyNow: 'A small change in this link changes which option comes out ahead.',
    tryThis: null,
    sourceLine: 'From the run’s fragile relationships.',
    action: { kind: 'ai-dialogue', label: 'Work through with Olumi', prompt: 'Test it' },
    targetId: null,
    priority: 1,
    ...over,
  }) as Recommendation

/** The recommendation as the body receives it: out of the view model. */
const viaVm = (r: Recommendation): Recommendation => {
  const vm = buildAnalysisNewViewModel({
    data: genuineDecision(),
    recommendations: [r],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
  const out = vm.strengthen.interventions.find((i) => i.id === r.id)
  if (!out) throw new Error('PRECONDITION: the view model dropped the recommendation')
  return out
}

const FLIP = rec({ id: 'strengthen:broaden' })
/** A producer calibration card whose technique is named ONLY by its claim id. */
const CALIBRATION = rec({
  id: 'strengthen:phase3:blk_42',
  title: 'Check this estimate against similar past cases',
  signal: 'This estimate has no reference class behind it.',
  whyNow: 'The comparison rests on it.',
  signalCode: 'CALIBRATION_PROMPT',
  dskClaimId: 'DSK-T-002',
})
const UNMAPPED = rec({ id: 'strengthen:lehi:f_price', title: 'Give Price a realistic range' })

const renderCard = (props: Partial<Parameters<typeof ChallengeCard>[0]> = {}) => {
  const onRunIntervention = vi.fn()
  const onRunMethod = vi.fn()
  const r = render(
    <ChallengeCard
      intervention={null}
      methodId={null}
      onRunIntervention={onRunIntervention}
      onRunMethod={onRunMethod}
      analysisHash="hash_1"
      {...props}
    />,
  )
  return { ...r, onRunIntervention, onRunMethod }
}

beforeEach(() => {
  useStrengthenStore.getState()._reset()
  useCanvasStore.setState({ currentScenarioId: SPEC_DECISION })
  localStorage.clear()
  dispatcherMounted = true
  // `undefined` is the only dispatched outcome (SendTurnOutcome's own rule).
  sendSystemEvent.mockReset().mockResolvedValue(undefined)
  ;(openAskOlumi as unknown as ReturnType<typeof vi.fn>).mockClear(); vi.mocked(askAi).mockReset().mockReturnValue('sent')
})
afterEach(cleanup)

describe('the grounded intervention', () => {
  /**
   * ⭐ RE-POINTED, V2 prototype (design audit B7, 25 Sep 2026): the prototype
   * shows ONLY the question under the title — no kicker. The technique the
   * finding names now rides by IDENTITY on the card (`data-method-id`) and in
   * the basis's protocol line, and the method strip marks it active. What
   * these three cases pinned is unchanged: which method, resolved with the
   * claim id, and never a default one.
   */
  it('headed by rec.title VERBATIM; the technique is carried by identity, not a kicker', () => {
    const r = viaVm(FLIP)
    renderCard({ intervention: r })
    expect(screen.getByTestId('analysis-new-challenge-heading').textContent).toBe(r.title)
    expect(screen.queryByTestId('analysis-new-challenge-kicker')).toBeNull()
    const card = screen.getByTestId('analysis-new-challenge')
    expect(card).toHaveAttribute('data-method-id', 'different_option')
    expect(card).toHaveAttribute('data-recommendation-id', r.id)
    // …and named, in the catalogue's own title, inside the basis.
    fireEvent.click(screen.getByRole('button', { name: ZONE.moreOptions }))
    fireEvent.click(screen.getByRole('menuitem', { name: ZONE.whyThis }))
    expect(screen.getByTestId('analysis-new-challenge-basis-protocol').textContent).toBe(
      `${METHOD_CATALOGUE.find((m) => m.id === 'different_option')!.title}: ${ZONE.reasoningAid}`,
    )
  })

  it('⭐ the card names the SAME method the strip marks as raised (dskClaimId is passed)', () => {
    const r = viaVm(CALIBRATION)
    const raised = [...methodIdsRaisedBy([r])]
    // PRECONDITION: the strip marks exactly one method for this card …
    expect(raised).toEqual(['outside_view'])
    // … and the three-argument call (what PrimaryIntervention and Strengthen
    // make today) names NONE — so this pair discriminates the fix.
    expect(methodForRecommendation(r.id, r.signalCode, r.biasCode)).toBeNull()
    renderCard({ intervention: r })
    expect(screen.getByTestId('analysis-new-challenge')).toHaveAttribute('data-method-id', raised[0])
  })

  it('no mapped technique ⇒ no method named, never a default one (contrast: the heading still renders)', () => {
    renderCard({ intervention: viaVm(UNMAPPED) })
    expect(screen.queryByTestId('analysis-new-challenge-kicker')).toBeNull()
    expect(screen.getByTestId('analysis-new-challenge')).not.toHaveAttribute('data-method-id')
    expect(screen.getByTestId('analysis-new-challenge-heading')).toHaveTextContent(UNMAPPED.title)
  })

  it('the rec’s own words are AT REST (slice D-4); "Why this?" opens the source, and the claim id stays an attribute', () => {
    const r = viaVm(CALIBRATION)
    renderCard({ intervention: r })
    expect(screen.queryByTestId('analysis-new-challenge-basis')).toBeNull()
    expect(screen.getByTestId('analysis-new-challenge-body').textContent).toBe(strengthenWhyLine(r.signal, r.whyNow))
    fireEvent.click(screen.getByRole('button', { name: ZONE.moreOptions }))
    fireEvent.click(screen.getByRole('menuitem', { name: ZONE.whyThis }))
    const basis = screen.getByTestId('analysis-new-challenge-basis')
    // Said once: the basis does not repeat the why-line.
    expect(screen.queryByTestId('analysis-new-challenge-basis-why')).toBeNull()
    expect(screen.getByTestId('analysis-new-challenge-basis-source').textContent).toBe(r.sourceLine)
    expect(screen.getByTestId('analysis-new-challenge-basis-grounded').textContent).toBe(COPY.strengthen.groundedChip)
    expect(basis).toHaveAttribute('data-dsk-claim-id', 'DSK-T-002')
    expect(basis.textContent).not.toContain('DSK-T-002')
  })

  it('Escape closes the overflow and returns focus to its trigger', () => {
    renderCard({ intervention: viaVm(FLIP) })
    const trigger = screen.getByRole('button', { name: ZONE.moreOptions })
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('the AI act runs the existing intervention route with the rec’s id', () => {
    const r = viaVm(FLIP)
    const { onRunIntervention, onRunMethod } = renderCard({ intervention: r })
    // V2: a finding that names a method is "Ask Olumi to guide this method".
    const act = screen.getByRole('button', { name: ZONE.guideMethod })
    expect(act).toHaveAttribute('data-ai', 'true')
    fireEvent.click(act)
    expect(onRunIntervention).toHaveBeenCalledWith(r.id)
    expect(onRunMethod).not.toHaveBeenCalled()
  })
})

describe('a method the reader picked', () => {
  /**
   * ⭐ RE-POINTED, V2 prototype (design audit B7): the "Method you chose" kicker
   * is gone (not a prototype string), and a picked method now has the
   * prototype's ⋯ and basis. What stays pinned is the reason the old case
   * existed: nothing assessed whether the method APPLIES here, so its basis
   * says only what the method is — the catalogue's own description and the
   * "reasoning aid" line — and carries none of a finding's grounding.
   */
  it('wins over the intervention, headed by the catalogue title; its basis says what the method is, never that it applies', () => {
    const m = METHOD_CATALOGUE.find((x) => x.id === 'pre_mortem')!
    const { onRunIntervention, onRunMethod } = renderCard({ intervention: viaVm(FLIP), methodId: 'pre_mortem' })
    const card = screen.getByTestId('analysis-new-challenge')
    expect(card).toHaveAttribute('data-source', 'method')
    expect(card).toHaveAttribute('data-method-id', 'pre_mortem')
    expect(screen.getByTestId('analysis-new-challenge-heading').textContent).toBe(m.title)
    expect(screen.queryByTestId('analysis-new-challenge-kicker')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: ZONE.moreOptions }))
    fireEvent.click(screen.getByRole('menuitem', { name: ZONE.whyThis }))
    expect(screen.getByTestId('analysis-new-challenge-basis-why').textContent).toBe(m.description)
    expect(screen.getByTestId('analysis-new-challenge-basis-protocol').textContent).toBe(`${m.title}: ${ZONE.reasoningAid}`)
    // ⛔ CONTRAST with the finding: no source line, no grounded chip.
    expect(screen.queryByTestId('analysis-new-challenge-basis-source')).toBeNull()
    expect(screen.queryByTestId('analysis-new-challenge-basis-grounded')).toBeNull()
    // ⛔ And no dismissal of its own: without a host to hand the pick back to,
    // "Not useful right now" is not offered, and the Strengthen store is never touched.
    fireEvent.click(screen.getByRole('button', { name: ZONE.moreOptions }))
    expect(screen.queryByTestId('analysis-new-challenge-not-useful')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: ZONE.guideMethod }))
    expect(onRunMethod).toHaveBeenCalledWith('pre_mortem')
    expect(onRunIntervention).not.toHaveBeenCalled()
  })

  it('CONTRAST: an id the catalogue does not hold falls back to the intervention', () => {
    renderCard({ intervention: viaVm(FLIP), methodId: 'not_a_method' })
    expect(screen.getByTestId('analysis-new-challenge')).toHaveAttribute('data-source', 'intervention')
  })

  it('nothing picked and nothing raised ⇒ nothing rendered', () => {
    const { container } = renderCard()
    expect(container).toBeEmptyDOMElement()
  })
})

describe('"Not useful right now" is the Strengthen lifecycle dismissal', () => {
  const statusOf = (id: string) => useStrengthenStore.getState().records[recordKey(SPEC_DECISION, id)]?.status

  it('seeds, then dismisses under THIS decision; Undo restores it', () => {
    const r = viaVm(FLIP)
    // PRECONDITION: the store holds no record, so a bare `dismiss` would no-op.
    expect(statusOf(r.id)).toBeUndefined()
    useStrengthenStore.getState().dismiss(recordKey(SPEC_DECISION, r.id))
    expect(statusOf(r.id), 'CONTRAST: dismiss alone writes nothing').toBeUndefined()

    renderCard({ intervention: r })
    fireEvent.click(screen.getByRole('button', { name: ZONE.moreOptions }))
    fireEvent.click(screen.getByRole('menuitem', { name: ZONE.notUseful }))
    expect(statusOf(r.id)).toBe('dismissed')
    expect(useStrengthenStore.getState().records[recordKey(SPEC_DECISION, r.id)]?.analysisHash).toBe('hash_1')

    const notice = screen.getByTestId('analysis-new-challenge-dismissed-notice')
    expect(notice).toHaveTextContent(`${STRENGTHEN_COPY.dismissedNotice}: ${r.title}`)
    const undoButton = screen.getByRole('button', { name: STRENGTHEN_COPY.undo })
    expect(undoButton, 'focus lands on the undo, not the body').toHaveFocus()
    fireEvent.click(undoButton)
    expect(statusOf(r.id)).not.toBe('dismissed')
    expect(screen.queryByTestId('analysis-new-challenge-dismissed-notice')).toBeNull()
  })

  it('the undo survives the card moving on to nothing', () => {
    const r = viaVm(FLIP)
    const { rerender, onRunIntervention, onRunMethod } = renderCard({ intervention: r })
    fireEvent.click(screen.getByRole('button', { name: ZONE.moreOptions }))
    fireEvent.click(screen.getByRole('menuitem', { name: ZONE.notUseful }))
    // The body's pick moves on once the view model filters the dismissed id.
    rerender(
      <ChallengeCard intervention={null} methodId={null} onRunIntervention={onRunIntervention} onRunMethod={onRunMethod} />,
    )
    expect(screen.queryByTestId('analysis-new-challenge')).toBeNull()
    expect(screen.getByTestId('analysis-new-challenge-dismissed-notice')).toBeInTheDocument()
  })
})

/**
 * "I disagree" RECORDS the objection (DL 14 Oct 2026, "preserve meaningful
 * dissent"): the ⋯ menu opens an inline composer; Save writes the session
 * record, the DURABLE record (`dissentStore`) and — only with a run identity
 * and a live conversation — one `finding_dissent`. Everything is bound by the
 * finding's id, never by "some text is present".
 */
describe('"I disagree" on the promoted finding records the objection', () => {
  const FINDING_ID = 'strengthen:phase3:blk_x'
  const WORDS = 'Our Q1 capacity assumption is wrong: we hired two people in September.'
  const finding = () => rec({ id: FINDING_ID })
  const dissentEvents = () =>
    sendSystemEvent.mock.calls.map((c) => c[0]).filter((e) => e?.type === 'finding_dissent')

  const openComposer = () => {
    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree'))
  }
  const typeAndSave = async (words: string) => {
    fireEvent.change(screen.getByTestId('analysis-new-challenge-disagree-note'), { target: { value: words } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree-save'))
    })
  }

  it('⭐ RED-FIRST: ⋯ → I disagree → type → Save writes the durable record by finding id, shows the receipt, survives a remount, and sends finding_dissent ONCE', async () => {
    const onDisagree = vi.fn()
    const { unmount } = renderCard({ intervention: finding(), onDisagree })
    openComposer()
    // Opening the composer is not the chat route.
    expect(onDisagree).not.toHaveBeenCalled()
    expect(vi.mocked(openAskOlumi)).not.toHaveBeenCalled()
    expect(screen.getByLabelText(ZONE.disagreeLabel)).toBe(screen.getByTestId('analysis-new-challenge-disagree-note'))
    await typeAndSave(WORDS)

    // The durable record, by identity.
    expect(readDissent(SPEC_DECISION)[FINDING_ID]?.reason).toBe(WORDS)
    expect(readDissent(SPEC_DECISION)[FINDING_ID]?.analysisHash).toBe('hash_1')
    // The session record, by identity.
    const history = useStrengthenStore.getState().records[recordKey(SPEC_DECISION, FINDING_ID)]?.history ?? []
    expect(history.filter((e) => e.event === 'disputed').map((e) => e.disputeReason)).toEqual([WORDS])
    // The wire: exactly one, addressed by both ids, carrying the words.
    expect(dissentEvents()).toEqual([
      { type: 'finding_dissent', payload: { finding_id: FINDING_ID, analysis_id: 'hash_1', statement: WORDS } },
    ])
    // The receipt, on THIS finding.
    expect(screen.queryByTestId('analysis-new-challenge-disagree-form')).toBeNull()
    const receipt = screen.getByTestId('analysis-new-challenge-disagree-receipt')
    expect(receipt).toHaveAttribute('data-recommendation-id', FINDING_ID)
    expect(receipt).toHaveTextContent(ZONE.disagreeRecorded)
    expect(screen.getByTestId('analysis-new-challenge-disagree-words').textContent).toBe(WORDS)
    // The chat route is still there, from the receipt, with the finding.
    fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree-discuss'))
    expect(onDisagree).toHaveBeenCalledTimes(1)
    expect(onDisagree).toHaveBeenCalledWith(expect.objectContaining({ id: FINDING_ID }))

    // Reload: a fresh mount reads the objection back from the durable store.
    unmount()
    useStrengthenStore.getState()._reset()
    renderCard({ intervention: finding() })
    expect(screen.getByTestId('analysis-new-challenge-disagree-receipt')).toHaveAttribute('data-recommendation-id', FINDING_ID)
    expect(screen.getByTestId('analysis-new-challenge-disagree-words').textContent).toBe(WORDS)
    // Still exactly one send — a read-back sends nothing.
    expect(dissentEvents()).toHaveLength(1)
  })

  it('CONTRAST: the receipt is per finding — a different finding on the same decision shows none', async () => {
    renderCard({ intervention: finding() })
    openComposer()
    await typeAndSave(WORDS)
    cleanup()
    renderCard({ intervention: rec({ id: 'strengthen:phase3:blk_other' }) })
    expect(screen.queryByTestId('analysis-new-challenge-disagree-receipt')).toBeNull()
  })

  it('no live conversation: the objection is recorded, nothing is sent', async () => {
    dispatcherMounted = false
    renderCard({ intervention: finding() })
    openComposer()
    expect(screen.getByTestId('analysis-new-challenge-disagree-disclosure')).toHaveTextContent(COPY.dissent.prompt)
    await typeAndSave(WORDS)
    expect(readDissent(SPEC_DECISION)[FINDING_ID]?.reason).toBe(WORDS)
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(screen.getByTestId('analysis-new-challenge-disagree-receipt')).toHaveTextContent(ZONE.disagreeRecorded)
  })

  it('no run identity (pre-run): the objection is recorded, nothing is sent', async () => {
    renderCard({ intervention: finding(), analysisHash: null })
    openComposer()
    expect(screen.getByTestId('analysis-new-challenge-disagree-disclosure')).toHaveTextContent(COPY.dissent.prompt)
    await typeAndSave(WORDS)
    expect(readDissent(SPEC_DECISION)[FINDING_ID]?.reason).toBe(WORDS)
    expect(dissentEvents()).toEqual([])
  })

  it('the disclosure says the words travel when the send WILL happen', () => {
    renderCard({ intervention: finding() })
    openComposer()
    expect(screen.getByTestId('analysis-new-challenge-disagree-disclosure')).toHaveTextContent(COPY.dissent.promptSendsToOlumi)
  })

  it('empty or whitespace-only text: Save is disabled and nothing is written', () => {
    renderCard({ intervention: finding() })
    openComposer()
    const save = screen.getByTestId('analysis-new-challenge-disagree-save')
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByTestId('analysis-new-challenge-disagree-note'), { target: { value: '   ' } })
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(readDissent(SPEC_DECISION)[FINDING_ID]).toBeUndefined()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('Cancel writes nothing and shows no receipt', () => {
    renderCard({ intervention: finding() })
    openComposer()
    fireEvent.change(screen.getByTestId('analysis-new-challenge-disagree-note'), { target: { value: WORDS } })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree-cancel'))
    expect(screen.queryByTestId('analysis-new-challenge-disagree-form')).toBeNull()
    expect(screen.queryByTestId('analysis-new-challenge-disagree-receipt')).toBeNull()
    expect(readDissent(SPEC_DECISION)[FINDING_ID]).toBeUndefined()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('⭐ a FAILED durable write says so: no "recorded" receipt, no send, the words stay for a retry', async () => {
    renderCard({ intervention: finding() })
    openComposer()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      await typeAndSave(WORDS)
    } finally {
      setItem.mockRestore()
    }
    expect(screen.getByTestId('analysis-new-challenge-disagree-error')).toHaveTextContent(COPY.dissent.notSaved)
    expect(screen.queryByTestId('analysis-new-challenge-disagree-receipt')).toBeNull()
    expect(screen.queryByText(ZONE.disagreeRecorded)).toBeNull()
    expect(screen.getByTestId('analysis-new-challenge-disagree-note')).toHaveValue(WORDS)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('a decision switched mid-compose writes nothing under either decision and reports the change', async () => {
    renderCard({ intervention: finding() })
    openComposer()
    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'a-different-decision' })
    })
    await typeAndSave(WORDS)
    expect(screen.getByTestId('analysis-new-challenge-disagree-error')).toHaveTextContent(COPY.dissent.scenarioChanged)
    expect(readDissent(SPEC_DECISION)[FINDING_ID]).toBeUndefined()
    expect(readDissent('a-different-decision')[FINDING_ID]).toBeUndefined()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('reopening "I disagree" on a recorded objection prefills the saved words', async () => {
    renderCard({ intervention: finding() })
    openComposer()
    await typeAndSave(WORDS)
    openComposer()
    expect(screen.getByTestId('analysis-new-challenge-disagree-note')).toHaveValue(WORDS)
  })

  it('without a host chat route, "I disagree" still records; the receipt offers no discuss link', async () => {
    renderCard({ intervention: finding() })
    openComposer()
    await typeAndSave(WORDS)
    expect(readDissent(SPEC_DECISION)[FINDING_ID]?.reason).toBe(WORDS)
    expect(screen.queryByTestId('analysis-new-challenge-disagree-discuss')).toBeNull()
  })

  it('CONTRAST: a picked method (not a grounded finding) offers no "I disagree"', () => {
    renderCard({ intervention: null, methodId: METHOD_CATALOGUE[0].id })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    expect(screen.queryByTestId('analysis-new-challenge-disagree')).toBeNull()
  })
})

/**
 * "Respond" (prototype `exercise`, P:540/665) — the reader's OWN thinking,
 * sent through the SAME existing ask route the AI icon already uses. It is a
 * SECOND act beside that icon, never a replacement for it (ruling
 * `c5806258826.md` §3: "primary AI act = Olumi AI icon / existing ask
 * route"), and it must not compose a question the producer never sent.
 * T1H-3 (14 Oct): the message is the reader's exact words ALONE — chipless
 * composer, so CEE credits them to the user. The card heading (Olumi's copy)
 * and typed parameters (which force a chip; no CEE reader consumed them) no
 * longer travel; the target still does, through typed binding. Busy sends
 * retain the response.
 */
describe('Respond — the reader\'s own thinking, through the existing ask route', () => {
  it('is offered beside the AI icon, closed at rest, for a grounded intervention', () => {
    renderCard({ intervention: viaVm(FLIP) })
    const trigger = screen.getByTestId('analysis-new-challenge-respond')
    // Paul 14 Oct 2026: an icon (✎) named "Respond", no visible words.
    expect(trigger).toHaveAttribute('aria-label', ZONE.respond)
    expect(trigger.textContent).toBe('')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('analysis-new-challenge-respond-note')).toBeNull()
  })

  it('is offered for a method the reader picked too', () => {
    renderCard({ intervention: viaVm(FLIP), methodId: 'pre_mortem' })
    expect(screen.getByTestId('analysis-new-challenge-respond')).toBeInTheDocument()
  })

  it('opens an inline note field, Cancel writes nothing and closes it', () => {
    renderCard({ intervention: viaVm(FLIP) })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    const note = screen.getByTestId('analysis-new-challenge-respond-note')
    expect(note).toHaveAttribute('placeholder', ZONE.respondPlaceholder)
    fireEvent.change(note, { target: { value: 'My own read on this' } })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-cancel'))
    expect(screen.queryByTestId('analysis-new-challenge-respond-note')).toBeNull()
    expect(openAskOlumi).not.toHaveBeenCalled()
    // Reopening starts blank — Cancel really did write nothing, not just hide it.
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    expect(screen.getByTestId('analysis-new-challenge-respond-note')).toHaveValue('')
  })

  it('busy sends retain the exact response for retry', () => {
    renderCard({ intervention: viaVm(FLIP), testId: 'cc' })
    fireEvent.click(screen.getByTestId('cc-respond'))
    const text = '  My words stay here.  '
    fireEvent.change(screen.getByTestId('cc-respond-note'), { target: { value: text } })
    vi.mocked(askAi).mockReturnValue('busy')
    fireEvent.click(screen.getByTestId('cc-respond-send'))
    expect(askAi).toHaveBeenCalledWith(expect.objectContaining({ userWords: text }))
    expect(screen.getByTestId('cc-respond-note')).toHaveValue(text)
  })

  it('Send is unavailable on empty or whitespace-only text', () => {
    renderCard({ intervention: viaVm(FLIP) })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    expect(screen.getByTestId('analysis-new-challenge-respond-send')).toBeDisabled()
    fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), { target: { value: '   ' } })
    expect(screen.getByTestId('analysis-new-challenge-respond-send')).toBeDisabled()
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-send'))
    expect(openAskOlumi).not.toHaveBeenCalled()
  })

  it('Send carries the reader\'s exact words and the bound target', () => {
    const r = viaVm(rec({
      id: 'strengthen:flip:edge_resp',
      action: { kind: 'ai-dialogue', label: 'Work through with Olumi', prompt: 'Test it', parameters: { block_id: 'blk_resp', method_id: 'pre_mortem' } },
      targetId: 'opt_a',
    }))
    const { onRunIntervention, onRunMethod } = renderCard({ intervention: r })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), {
      target: { value: 'I think the price elasticity is overstated' },
    })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-send'))

    expect(askAi).toHaveBeenCalledTimes(1)
    expect(askAi).toHaveBeenCalledWith({ userWords: 'I think the price elasticity is overstated', nodeIds: ['opt_a'], edgeIds: [] })
    // The AI icon's own route is untouched — Respond is an ADDITIONAL door.
    expect(onRunIntervention).not.toHaveBeenCalled()
    expect(onRunMethod).not.toHaveBeenCalled()
    // The form closes and clears after a successful send.
    expect(screen.queryByTestId('analysis-new-challenge-respond-note')).toBeNull()
  })

  it('Send on a picked method sends the reader\'s own words', () => {
    renderCard({ intervention: viaVm(FLIP), methodId: 'pre_mortem' })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), {
      target: { value: 'Worth checking the downside case' },
    })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-send'))

    expect(askAi).toHaveBeenCalledTimes(1)
    const payload = (askAi as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload).toEqual({ userWords: 'Worth checking the downside case' })
  })

  /**
   * ⛔ REVIEW 5819068969 (BLOCKING): the note was keyed only by the open state,
   * so it outlived a pick-change — reopening Respond on the next item showed the
   * old words and Send put them under the NEW heading.
   */
  it('⭐ a note written for one item never reaches another after the pick changes', () => {
    const a = METHOD_CATALOGUE.find((m) => m.id === 'pre_mortem')!
    const b = METHOD_CATALOGUE.find((m) => m.id !== 'pre_mortem')!
    const { rerender, onRunIntervention, onRunMethod } = renderCard({ intervention: viaVm(FLIP), methodId: a.id })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), {
      target: { value: 'CONCERN ABOUT METHOD A ONLY' },
    })

    // The pick moves on WITHOUT a Cancel.
    rerender(
      <ChallengeCard
        intervention={viaVm(FLIP)}
        methodId={b.id}
        onRunIntervention={onRunIntervention}
        onRunMethod={onRunMethod}
        analysisHash="hash_1"
      />,
    )
    expect(screen.getByTestId('analysis-new-challenge-heading')).toHaveTextContent(b.title)
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    expect(screen.getByTestId('analysis-new-challenge-respond-note')).toHaveValue('')
    expect(screen.getByTestId('analysis-new-challenge-respond-send')).toBeDisabled()

    fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), { target: { value: 'About B' } })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-send'))
    const payload = (askAi as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload).toEqual({ userWords: 'About B' })
    expect(payload.userWords).not.toContain('METHOD A')
  })

  it('opening focuses the note; Escape closes it, writes nothing, and returns focus to Respond', () => {
    renderCard({ intervention: viaVm(FLIP) })
    const trigger = screen.getByTestId('analysis-new-challenge-respond')
    fireEvent.click(trigger)
    const note = screen.getByTestId('analysis-new-challenge-respond-note')
    expect(note).toHaveFocus()
    fireEvent.change(note, { target: { value: 'half a thought' } })
    fireEvent.keyDown(note, { key: 'Escape' })
    expect(screen.queryByTestId('analysis-new-challenge-respond-form')).toBeNull()
    expect(openAskOlumi).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()
    // Reopening starts clean.
    fireEvent.click(trigger)
    expect(screen.getByTestId('analysis-new-challenge-respond-note')).toHaveValue('')
  })

  it('carries no parameters when the rec holds none — never fabricating a block id (T1H-3: none ever, the words go alone)', () => {
    const r = viaVm(rec({ id: 'strengthen:flip:edge_noparam' }))
    expect(r.action.parameters, 'PRECONDITION: this fixture must hold no parameters').toBeUndefined()
    renderCard({ intervention: r })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), { target: { value: 'A note' } })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-send'))
    const payload = (askAi as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload).toEqual({ userWords: 'A note', nodeIds: [], edgeIds: [] })
  })
})
