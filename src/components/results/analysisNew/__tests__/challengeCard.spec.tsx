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
