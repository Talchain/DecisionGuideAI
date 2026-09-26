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
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

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
import { genuineDecision } from './analysisNewFixtures'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { attentionNoteForRecommendation } from '../../strengthen/recommendationAttention'

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
  ;(openAskOlumi as unknown as ReturnType<typeof vi.fn>).mockClear()
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
    expect(card).toHaveAttribute('data-method-id', 'consider_opposite')
    expect(card).toHaveAttribute('data-recommendation-id', r.id)
    // …and named, in the catalogue's own title, inside the basis.
    fireEvent.click(screen.getByRole('button', { name: ZONE.moreOptions }))
    fireEvent.click(screen.getByRole('menuitem', { name: ZONE.whyThis }))
    expect(screen.getByTestId('analysis-new-challenge-basis-protocol').textContent).toBe(
      `${METHOD_CATALOGUE.find((m) => m.id === 'consider_opposite')!.title}: ${ZONE.reasoningAid}`,
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

describe('"I disagree" on the promoted finding', () => {
  it('is offered in the card menu and hands the finding to the host, which continues into the conversation', () => {
    const onDisagree = vi.fn()
    const finding = rec({ id: 'strengthen:phase3:blk_x' })
    render(
      <ChallengeCard
        intervention={finding}
        methodId={null}
        onRunIntervention={vi.fn()}
        onRunMethod={vi.fn()}
        onDisagree={onDisagree}
      />,
    )
    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree'))
    expect(onDisagree).toHaveBeenCalledWith(finding)
  })

  it('CONTRAST: without a host handler there is no disagree item', () => {
    render(
      <ChallengeCard intervention={rec({ id: 'strengthen:phase3:blk_y' })} methodId={null} onRunIntervention={vi.fn()} onRunMethod={vi.fn()} />,
    )
    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    expect(screen.queryByTestId('analysis-new-challenge-disagree')).toBeNull()
  })
})

/**
 * "Respond" (prototype `exercise`, P:540/665) — the reader's OWN thinking,
 * sent through the SAME existing ask route the AI icon already uses. It is a
 * SECOND act beside that icon, never a replacement for it (ruling
 * `c5806258826.md` §3: "primary AI act = Olumi AI icon / existing ask
 * route"), and it must not compose a question the producer never sent — the
 * draft is the heading VERBATIM plus the reader's own words, exactly the
 * shape `challengeResponse.ts` builds and this spec pins from the outside.
 */
describe('Respond — the reader\'s own thinking, through the existing ask route', () => {
  it('is offered beside the AI icon, closed at rest, for a grounded intervention', () => {
    renderCard({ intervention: viaVm(FLIP) })
    const trigger = screen.getByTestId('analysis-new-challenge-respond')
    expect(trigger).toHaveTextContent(ZONE.respond)
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

  it('Send is unavailable on empty or whitespace-only text', () => {
    renderCard({ intervention: viaVm(FLIP) })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    expect(screen.getByTestId('analysis-new-challenge-respond-send')).toBeDisabled()
    fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), { target: { value: '   ' } })
    expect(screen.getByTestId('analysis-new-challenge-respond-send')).toBeDisabled()
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-send'))
    expect(openAskOlumi).not.toHaveBeenCalled()
  })

  it('Send carries the heading VERBATIM plus the reader\'s words, and the rec\'s own routing — never inventing a question', () => {
    const r = viaVm(rec({
      id: 'strengthen:flip:edge_resp',
      action: { kind: 'ai-dialogue', label: 'Work through with Olumi', prompt: 'Test it', parameters: { block_id: 'blk_resp' } },
      targetId: 'opt_a',
    }))
    const { onRunIntervention, onRunMethod } = renderCard({ intervention: r })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), {
      target: { value: 'I think the price elasticity is overstated' },
    })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-send'))

    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    expect(openAskOlumi).toHaveBeenCalledWith({
      context: r.whyNow || r.signal,
      draft: `${r.title}\n\nMy thinking: I think the price elasticity is overstated`,
      label: r.action.label,
      targetId: r.targetId,
      parameters: r.action.parameters,
      attentionNote: attentionNoteForRecommendation(r),
    })
    // The AI icon's own route is untouched — Respond is an ADDITIONAL door.
    expect(onRunIntervention).not.toHaveBeenCalled()
    expect(onRunMethod).not.toHaveBeenCalled()
    // The form closes and clears after a successful send.
    expect(screen.queryByTestId('analysis-new-challenge-respond-note')).toBeNull()
  })

  it('Send on a picked method sends the method\'s own routing, heading verbatim', () => {
    const method = METHOD_CATALOGUE.find((m) => m.id === 'pre_mortem')!
    renderCard({ intervention: viaVm(FLIP), methodId: 'pre_mortem' })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), {
      target: { value: 'Worth checking the downside case' },
    })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-send'))

    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    const payload = (openAskOlumi as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload).toEqual(
      expect.objectContaining({
        context: method.description,
        draft: `${method.title}\n\nMy thinking: Worth checking the downside case`,
        label: method.title,
        parameters: { method_id: method.id },
      }),
    )
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
    const payload = (openAskOlumi as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload.draft).toBe(`${b.title}\n\nMy thinking: About B`)
    expect(payload.draft).not.toContain('METHOD A')
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

  it('carries no parameters when the rec holds none — never fabricating a block id', () => {
    const r = viaVm(rec({ id: 'strengthen:flip:edge_noparam' }))
    expect(r.action.parameters, 'PRECONDITION: this fixture must hold no parameters').toBeUndefined()
    renderCard({ intervention: r })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
    fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), { target: { value: 'A note' } })
    fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-send'))
    const payload = (openAskOlumi as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload).not.toHaveProperty('parameters')
  })
})
