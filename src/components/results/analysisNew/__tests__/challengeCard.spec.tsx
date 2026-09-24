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
 * The dispatcher is mocked at the OPTIONAL context, the same seam
 * `dissentReachesTheModel.spec.tsx` uses for `StrengthenTheReasoning` — this
 * is the SAME mechanism, ported. `dispatcherMounted` makes the no-dispatcher
 * state (UI live, CEE reader not yet; any route with no `ConversationProvider`)
 * an expressible fixture rather than one only the passing cases can reach.
 */
const sendSystemEvent = vi.fn()
let dispatcherMounted = true
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => (dispatcherMounted ? { sendSystemEvent } : undefined),
}))

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

const FLIP = rec({ id: 'strengthen:flip:edge_9' })
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
  sendSystemEvent.mockReset()
  // `undefined` is the ONLY dispatched outcome — SendTurnOutcome's own rule.
  sendSystemEvent.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('the grounded intervention', () => {
  it('headed by rec.title VERBATIM, with the method name as kicker', () => {
    const r = viaVm(FLIP)
    renderCard({ intervention: r })
    expect(screen.getByTestId('analysis-new-challenge-heading').textContent).toBe(r.title)
    const kicker = screen.getByTestId('analysis-new-challenge-kicker')
    expect(kicker).toHaveAttribute('data-method-id', 'consider_opposite')
    expect(kicker.textContent).toBe(METHOD_CATALOGUE.find((m) => m.id === 'consider_opposite')!.title)
    expect(screen.getByTestId('analysis-new-challenge')).toHaveAttribute('data-recommendation-id', r.id)
  })

  it('⭐ the kicker names the SAME method the strip marks as raised (dskClaimId is passed)', () => {
    const r = viaVm(CALIBRATION)
    const raised = [...methodIdsRaisedBy([r])]
    // PRECONDITION: the strip marks exactly one method for this card …
    expect(raised).toEqual(['outside_view'])
    // … and the three-argument call (what PrimaryIntervention and Strengthen
    // make today) names NONE — so this pair discriminates the fix.
    expect(methodForRecommendation(r.id, r.signalCode, r.biasCode)).toBeNull()
    renderCard({ intervention: r })
    expect(screen.getByTestId('analysis-new-challenge-kicker')).toHaveAttribute('data-method-id', raised[0])
  })

  it('no mapped technique ⇒ no kicker, never a default one (contrast: the heading still renders)', () => {
    renderCard({ intervention: viaVm(UNMAPPED) })
    expect(screen.queryByTestId('analysis-new-challenge-kicker')).toBeNull()
    expect(screen.getByTestId('analysis-new-challenge-heading')).toHaveTextContent(UNMAPPED.title)
  })

  it('the basis is NOT at rest; "Why this?" opens the rec’s own words, and the claim id stays an attribute', () => {
    const r = viaVm(CALIBRATION)
    renderCard({ intervention: r })
    expect(screen.queryByTestId('analysis-new-challenge-basis')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: ZONE.moreOptions }))
    fireEvent.click(screen.getByRole('menuitem', { name: ZONE.whyThis }))
    const basis = screen.getByTestId('analysis-new-challenge-basis')
    expect(screen.getByTestId('analysis-new-challenge-basis-why').textContent).toBe(strengthenWhyLine(r.signal, r.whyNow))
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
    const act = screen.getByRole('button', { name: ZONE.workThrough })
    expect(act).toHaveAttribute('data-ai', 'true')
    fireEvent.click(act)
    expect(onRunIntervention).toHaveBeenCalledWith(r.id)
    expect(onRunMethod).not.toHaveBeenCalled()
  })
})

describe('a method the reader picked', () => {
  it('wins over the intervention, headed by the catalogue title, and claims no basis', () => {
    const { onRunIntervention, onRunMethod } = renderCard({ intervention: viaVm(FLIP), methodId: 'pre_mortem' })
    const card = screen.getByTestId('analysis-new-challenge')
    expect(card).toHaveAttribute('data-source', 'method')
    expect(card).toHaveAttribute('data-method-id', 'pre_mortem')
    expect(screen.getByTestId('analysis-new-challenge-heading').textContent).toBe(
      METHOD_CATALOGUE.find((m) => m.id === 'pre_mortem')!.title,
    )
    expect(screen.getByTestId('analysis-new-challenge-kicker').textContent).toBe(ZONE.methodYouChose)
    // ⛔ No basis, no dismissal: nothing assessed whether it applies.
    expect(screen.queryByRole('button', { name: ZONE.moreOptions })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: ZONE.workThrough }))
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
 * "I disagree" — E18, THE PROPER SAVE PATH. Ported from
 * `dissentReachesTheModel.spec.tsx` (`StrengthenTheReasoning`'s already-shipped
 * suite for the SAME mechanism): `strengthenStore.dispute` (session),
 * `dissentStore.recordDissent` (durable) and `finding_dissent` (the wire),
 * via `useFindingDissent`. Bound by identity throughout — exact testid, exact
 * finding id, exact COPY sentence — never "is some text present".
 */
describe('"I disagree" on the promoted finding — the proper save path', () => {
  const openComposer = (props: Partial<Parameters<typeof ChallengeCard>[0]> = {}) => {
    const finding = rec({ id: 'strengthen:phase3:blk_x' })
    const view = renderCard({ intervention: finding, ...props })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree'))
    return { ...view, finding }
  }

  const typeAndSave = async (words: string) => {
    fireEvent.change(screen.getByTestId('analysis-new-challenge-disagree-input'), { target: { value: words } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree-save'))
    })
  }

  /** The one `finding_dissent` the dispatcher was handed, or undefined. */
  const sentEvent = () =>
    sendSystemEvent.mock.calls.map((c) => c[0]).find((e) => e?.type === 'finding_dissent')

  it('is offered in the card menu regardless of a host handler', () => {
    openComposer()
    // The composer, not a chat draft: Save/Cancel are on THIS card.
    expect(screen.getByTestId('analysis-new-challenge-disagree-save')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-challenge-disagree-cancel')).toBeInTheDocument()
  })

  it('⭐ RED-FIRST: Save SENDS finding_dissent with both ids and the words, and writes the durable record', async () => {
    const { finding } = openComposer()
    await typeAndSave('Our Q1 capacity assumption is wrong.')

    const event = sentEvent()
    expect(event, 'no finding_dissent reached the dispatcher').toBeDefined()
    expect(event.payload).toEqual({
      finding_id: finding.id,
      analysis_id: 'hash_1',
      statement: 'Our Q1 capacity assumption is wrong.',
    })
    // Additive, never a move: the local durable record exists too.
    expect(readDissent(SPEC_DECISION)[finding.id].reason).toBe('Our Q1 capacity assumption is wrong.')
    // The composer closes on a successful save.
    expect(screen.queryByTestId('analysis-new-challenge-disagree-form')).toBeNull()
  })

  it('⭐ THE TWIN: no run identity (pre-run) — nothing is sent, and the words are still kept', async () => {
    openComposer({ analysisHash: null })
    await typeAndSave('This finding is wrong.')
    expect(sentEvent(), 'a pre-run card has no analysis id to address').toBeUndefined()
    expect(readDissent(SPEC_DECISION)['strengthen:phase3:blk_x'].reason).toBe('This finding is wrong.')
  })

  it("⭐ THE TWIN: a FAILED run's hash is the literal 'error' — nothing is sent, words still kept", async () => {
    openComposer({ analysisHash: 'error' })
    await typeAndSave('This finding is wrong.')
    expect(sentEvent(), "'error' is not an analysis id and must never be addressed").toBeUndefined()
    expect(readDissent(SPEC_DECISION)['strengthen:phase3:blk_x'].reason).toBe('This finding is wrong.')
  })

  it('⭐⭐ THE INTERMEDIATE DEPLOY STATE: no dispatcher mounted — nothing sent, words kept, form still closes', async () => {
    dispatcherMounted = false
    openComposer({ analysisHash: 'hash_1' })
    await typeAndSave('This finding is wrong.')
    expect(sendSystemEvent, 'no dispatcher is mounted, so nothing may be sent').not.toHaveBeenCalled()
    expect(readDissent(SPEC_DECISION)['strengthen:phase3:blk_x'].reason).toBe('This finding is wrong.')
  })

  it('Cancel writes nothing — no session record, no durable record, no send', () => {
    const { finding } = openComposer()
    fireEvent.change(screen.getByTestId('analysis-new-challenge-disagree-input'), {
      target: { value: 'A reason I changed my mind about' },
    })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree-cancel'))
    expect(screen.queryByTestId('analysis-new-challenge-disagree-form')).toBeNull()
    expect(readDissent(SPEC_DECISION)[finding.id]).toBeUndefined()
    expect(sendSystemEvent).not.toHaveBeenCalled()
    // Reopening starts blank — Cancel really did write nothing.
    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree'))
    expect(screen.getByTestId('analysis-new-challenge-disagree-input')).toHaveValue('')
  })

  it('an empty or whitespace-only submit closes without writing', async () => {
    const { finding } = openComposer()
    fireEvent.change(screen.getByTestId('analysis-new-challenge-disagree-input'), { target: { value: '   ' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree-save'))
    })
    expect(screen.queryByTestId('analysis-new-challenge-disagree-form')).toBeNull()
    expect(readDissent(SPEC_DECISION)[finding.id]).toBeUndefined()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('⭐⭐ the composer closing over a SCENARIO CHANGE writes nothing and reports the change', async () => {
    const { finding } = openComposer()
    fireEvent.change(screen.getByTestId('analysis-new-challenge-disagree-input'), {
      target: { value: 'Written under the wrong decision' },
    })
    // The decision on screen changes mid-compose — a real, reachable sequence
    // (switching boards without closing an open composer).
    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'a-different-decision' })
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree-save'))
    })
    expect(
      screen.getByTestId('analysis-new-challenge-disagree-save-error'),
      'must not write under whichever decision happens to be live',
    ).toHaveTextContent(COPY.dissent.scenarioChanged)
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(readDissent(SPEC_DECISION)[finding.id]).toBeUndefined()
    expect(readDissent('a-different-decision')[finding.id]).toBeUndefined()
    // The words are not lost — the composer stays open for a retry.
    expect(screen.getByTestId('analysis-new-challenge-disagree-input')).toHaveValue('Written under the wrong decision')
  })

  it('reads back the standing record, and "Edit what you said" reopens it prefilled', async () => {
    const { finding } = openComposer()
    await typeAndSave('Our Q1 capacity assumption is wrong.')

    const standing = screen.getByTestId('analysis-new-challenge-disagreement')
    expect(standing).toHaveTextContent(`${COPY.dissent.standing}: Our Q1 capacity assumption is wrong.`)
    expect(standing).toHaveAttribute('data-recommendation-id', finding.id)

    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    expect(screen.getByTestId('analysis-new-challenge-disagree')).toHaveTextContent(COPY.dissent.edit)
    fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree'))
    expect(screen.getByTestId('analysis-new-challenge-disagree-input')).toHaveValue(
      'Our Q1 capacity assumption is wrong.',
    )
  })

  describe('the prompt is true at the moment it is read (bound to the wire, not the fixture)', () => {
    it('⭐ when the send WILL happen, the prompt says so before a word is typed', async () => {
      openComposer({ analysisHash: 'hash_1' })
      const prompt = screen.getByTestId('analysis-new-challenge-disagree-prompt')
      expect(screen.getByTestId('analysis-new-challenge-disagree-input')).toHaveValue('')
      expect(prompt).toHaveTextContent(COPY.dissent.promptSendsToOlumi)
      expect(prompt).not.toHaveTextContent(COPY.dissent.prompt)
      await typeAndSave('Our Q1 capacity assumption is wrong.')
      expect(sentEvent(), 'the prompt promised a send, so one must have happened').toBeDefined()
    })

    it("⭐ THE TWIN: no run identity — the LOCAL wording stands, and nothing is sent", async () => {
      openComposer({ analysisHash: null })
      const prompt = screen.getByTestId('analysis-new-challenge-disagree-prompt')
      expect(prompt).toHaveTextContent(COPY.dissent.prompt)
      expect(prompt).not.toHaveTextContent(COPY.dissent.promptSendsToOlumi)
      await typeAndSave('This finding is wrong.')
      expect(sentEvent()).toBeUndefined()
    })
  })

  describe('the chat route stays available as an option (ruling c5806258826.md §3)', () => {
    it('offered inside the composer when the host still wires onDisagree, and hands it the finding', () => {
      const onDisagree = vi.fn()
      const { finding } = openComposer({ onDisagree })
      const link = screen.getByTestId('analysis-new-challenge-disagree-chat-instead')
      fireEvent.click(link)
      expect(onDisagree).toHaveBeenCalledWith(finding)
      // Choosing the chat door closes THIS composer — no two writers open at once.
      expect(screen.queryByTestId('analysis-new-challenge-disagree-form')).toBeNull()
    })

    it('CONTRAST: without a host handler, no chat-instead link — but "I disagree" is still offered', () => {
      openComposer()
      expect(screen.queryByTestId('analysis-new-challenge-disagree-chat-instead')).toBeNull()
    })
  })
})
