/**
 * B7 — "CHALLENGE THE THINKING" AGAINST THE V2 PROTOTYPE (design audit 25 Sep
 * 2026, `Olumi_Reasoning_Prototype_V2.html` sha256 817be21a…, `challengeHTML`
 * and the `question-options` popover).
 *
 * The prototype, element by element, and what each is bound to here:
 *   · the title carries ⓘ "Why this method here?", which opens the method-basis
 *     disclosure: the basis, then "<Protocol>: a reasoning aid, not a
 *     prediction or diagnosis.";
 *   · under it, ONLY the question — no kicker ("Method you chose" is not a
 *     prototype string, nor is a method name above the question);
 *   · ✎ Respond, ✦ "Ask Olumi to guide this method", ⋯ "Question options";
 *   · the ⋯ menu: ⓘ "Why this question?", 🕐 "Not useful right now", a
 *     separator, then the methods, each with its icon, the current one marked;
 *   · the Respond form's label is the method's EXERCISE, and its send is
 *     "Send to Olumi" beside a round ➤ button.
 *
 * ⚠ WHAT IS NOT INVENTED. The prototype's questions, bases and exercises are
 * written about ITS example model. No producer field carries a per-method
 * question for a live model, so the question stays the producer's `title`
 * verbatim (or the catalogue title for a picked method); the basis is the
 * finding's own why-line (or the catalogue description for a picked method);
 * the exercise is the finding's own `tryThis` when the producer sent one, and
 * the neutral "Your thinking" otherwise. Nothing here composes a sentence
 * about the reader's model.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { ChallengeCard } from '../sections/ChallengeCard'
import { methodsInMenuOrder } from '../sections/MethodStrip'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { strengthenWhyLine } from '../analysisNewCopy'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanvasStore } from '../../../../canvas/store'
import { genuineDecision } from './analysisNewFixtures'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
import { openAskOlumi } from '../../coaching/askOlumiStore'

const TID = 'analysis-new-challenge'
const TITLE = 'Challenge the thinking'
const TITLE_TID = 'analysis-new-zone-also'
const method = (id: string) => METHOD_CATALOGUE.find((m) => m.id === id)!

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Test the assumption about Price elasticity',
    signal: 'A small change in this link changes which option comes out ahead.',
    whyNow: 'The ranking rests on it.',
    tryThis: null,
    sourceLine: 'From the run’s fragile relationships.',
    action: { kind: 'ai-dialogue', label: 'Work through with Olumi', prompt: 'Test it' },
    targetId: null,
    priority: 1,
    ...over,
  }) as Recommendation

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

/** Maps to `consider_opposite` by its id prefix. */
const FLIP = rec({ id: 'strengthen:flip:edge_9' })
/** Maps to `outside_view` ONLY through its claim id. */
const CALIBRATION = rec({
  id: 'strengthen:phase3:blk_42',
  title: 'Check this estimate against similar past cases',
  signalCode: 'CALIBRATION_PROMPT',
  dskClaimId: 'DSK-T-002',
})
/** Maps to no technique. */
const UNMAPPED = rec({ id: 'strengthen:lehi:f_price', title: 'Give Price a realistic range' })

const draw = (props: Partial<Parameters<typeof ChallengeCard>[0]> = {}) => {
  const handlers = {
    onRunIntervention: vi.fn(),
    onRunMethod: vi.fn(),
    onSelectMethod: vi.fn(),
    onSetAsideMethod: vi.fn(),
  }
  const r = render(
    <ChallengeCard
      intervention={null}
      methodId={null}
      title={TITLE}
      titleTestId={TITLE_TID}
      analysisHash="hash_proto"
      {...handlers}
      {...props}
    />,
  )
  return { ...r, ...handlers }
}

beforeEach(() => {
  useStrengthenStore.getState()._reset()
  useCanvasStore.setState({ currentScenarioId: 'challenge-proto' })
  ;(openAskOlumi as unknown as ReturnType<typeof vi.fn>).mockClear()
})
afterEach(cleanup)

describe('the title and its ⓘ "Why this method here?"', () => {
  it('the title stays an h3 named exactly "Challenge the thinking"; the ⓘ is its sibling, not inside it', () => {
    draw({ intervention: viaVm(FLIP) })
    const h3 = screen.getByTestId(TITLE_TID)
    expect(h3.tagName).toBe('H3')
    expect(screen.getByRole('heading', { name: TITLE })).toBe(h3)
    const info = screen.getByRole('button', { name: 'Why this method here?' })
    expect(h3.contains(info)).toBe(false)
    // …but on the title's own row, beside it.
    expect(h3.parentElement?.contains(info)).toBe(true)
    expect(info).toHaveAttribute('aria-expanded', 'false')
  })

  it('⭐ opens the method basis: the finding\'s own why-line, then "<method>: a reasoning aid, not a prediction or diagnosis."', () => {
    const r = viaVm(FLIP)
    draw({ intervention: r })
    expect(screen.queryByTestId(`${TID}-basis`)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Why this method here?' }))
    expect(screen.getByRole('button', { name: 'Why this method here?' })).toHaveAttribute('aria-expanded', 'true')
    const items = within(screen.getByTestId(`${TID}-basis`)).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      strengthenWhyLine(r.signal, r.whyNow),
      `${method('consider_opposite').title}: a reasoning aid, not a prediction or diagnosis.`,
    ])
  })

  it('the protocol line names the method found by CLAIM ID (dskClaimId is passed) — outside view, not nothing', () => {
    draw({ intervention: viaVm(CALIBRATION) })
    fireEvent.click(screen.getByRole('button', { name: 'Why this method here?' }))
    expect(screen.getByTestId(`${TID}-basis-protocol`).textContent).toBe(
      `${method('outside_view').title}: a reasoning aid, not a prediction or diagnosis.`,
    )
  })

  it('⛔ CONTRAST — a finding with no technique gets its why-line and NO protocol line', () => {
    draw({ intervention: viaVm(UNMAPPED) })
    // A finding that names no technique asks "Why this question?" — there is
    // no method to explain (#2066 review note).
    expect(screen.queryByRole('button', { name: 'Why this method here?' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Why this question?' }))
    expect(screen.getByTestId(`${TID}-basis-why`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-basis-protocol`)).toBeNull()
  })

  it('a picked method\'s basis is the catalogue\'s own description plus its protocol line', () => {
    const m = method('pre_mortem')
    draw({ intervention: viaVm(FLIP), methodId: m.id })
    fireEvent.click(screen.getByRole('button', { name: 'Why this method here?' }))
    const items = within(screen.getByTestId(`${TID}-basis`)).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      m.description,
      `${m.title}: a reasoning aid, not a prediction or diagnosis.`,
    ])
  })

  it('with nothing to show, the title still renders, with no ⓘ (and without a title prop, nothing renders)', () => {
    draw()
    expect(screen.getByTestId(TITLE_TID)).toHaveTextContent(TITLE)
    expect(screen.queryByRole('button', { name: 'Why this method here?' })).toBeNull()
  })
})

describe('only the question at rest — no kicker', () => {
  it.each([
    ['a finding with a technique', { intervention: FLIP, methodId: null }],
    ['a picked method', { intervention: FLIP, methodId: 'pre_mortem' }],
  ])('%s: no kicker, no "Method you chose"', (_l, p) => {
    draw({ intervention: viaVm(p.intervention), methodId: p.methodId })
    expect(screen.queryByTestId(`${TID}-kicker`)).toBeNull()
    expect(document.body.textContent).not.toContain('Method you chose')
    // CONTRAST: the question itself is still there.
    expect(screen.getByTestId(`${TID}-heading`).textContent).not.toBe('')
  })

  it('the finding\'s technique is carried by IDENTITY on the card, not as words above it', () => {
    draw({ intervention: viaVm(FLIP) })
    expect(screen.getByTestId(TID)).toHaveAttribute('data-method-id', 'consider_opposite')
    cleanup()
    draw({ intervention: viaVm(UNMAPPED) })
    expect(screen.getByTestId(TID)).not.toHaveAttribute('data-method-id')
  })

  it('⭐ picking the SAME method the finding names shows the finding — its question is that method\'s question', () => {
    draw({ intervention: viaVm(FLIP), methodId: 'consider_opposite' })
    expect(screen.getByTestId(TID)).toHaveAttribute('data-source', 'intervention')
    expect(screen.getByTestId(`${TID}-heading`).textContent).toBe(FLIP.title)
    cleanup()
    // CONTRAST: a different pick shows that method.
    draw({ intervention: viaVm(FLIP), methodId: 'reframe_problem' })
    expect(screen.getByTestId(TID)).toHaveAttribute('data-source', 'method')
  })
})

describe('the footer acts', () => {
  it('✦ is "Ask Olumi to guide this method" when a method is attached; CONTRAST: the unmapped finding keeps "Work through this with Olumi"', () => {
    draw({ intervention: viaVm(FLIP) })
    expect(screen.getByTestId(`${TID}-work-through`)).toHaveAttribute('aria-label', 'Ask Olumi to guide this method')
    cleanup()
    draw({ intervention: viaVm(FLIP), methodId: 'outside_view' })
    expect(screen.getByTestId(`${TID}-work-through`)).toHaveAttribute('aria-label', 'Ask Olumi to guide this method')
    cleanup()
    draw({ intervention: viaVm(UNMAPPED) })
    expect(screen.getByTestId(`${TID}-work-through`)).toHaveAttribute('aria-label', 'Work through this with Olumi')
  })

  it('⋯ is "Question options", and a picked method has one too', () => {
    draw({ intervention: viaVm(FLIP), methodId: 'pre_mortem' })
    expect(screen.getByTestId(`${TID}-more`)).toHaveAttribute('aria-label', 'Question options')
  })
})

describe('the ⋯ "Question options" menu', () => {
  const rows = () =>
    Array.from(screen.getByTestId(`${TID}-menu`).children).map((el) =>
      el.getAttribute('role') === 'separator' ? 'sep' : (el.textContent ?? ''),
    )

  it('⭐ Why this question? · Not useful right now · [I disagree] · separator · every method, each with an icon', () => {
    draw({ intervention: viaVm(FLIP), onDisagree: vi.fn() })
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    expect(rows()).toEqual([
      'Why this question?',
      'Not useful right now',
      'I disagree',
      'sep',
      // The same prototype order the strip's ⋯ uses.
      ...methodsInMenuOrder().map((m) => m.title),
    ])
    expect(methodsInMenuOrder().map((m) => m.id).slice(0, 5)).toEqual([
      'different_option',
      'reframe_problem',
      'consider_opposite',
      'outside_view',
      'pre_mortem',
    ])
    for (const el of within(screen.getByTestId(`${TID}-menu`)).getAllByRole('menuitem'))
      expect(el.querySelectorAll('svg'), `${el.textContent} has no icon`).toHaveLength(1)
  })

  it('marks the current method (the finding\'s technique) and a method row selects through the host', () => {
    const { onSelectMethod } = draw({ intervention: viaVm(FLIP) })
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    expect(screen.getByTestId(`${TID}-menu-method-consider_opposite`)).toHaveAttribute('aria-current', 'true')
    expect(screen.getByTestId(`${TID}-menu-method-outside_view`)).not.toHaveAttribute('aria-current')
    fireEvent.click(screen.getByTestId(`${TID}-menu-method-outside_view`))
    expect(onSelectMethod).toHaveBeenCalledWith('outside_view')
    expect(screen.queryByTestId(`${TID}-menu`)).toBeNull()
  })

  it('"Why this question?" opens the same basis the ⓘ opens', () => {
    draw({ intervention: viaVm(FLIP) })
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Why this question?' }))
    expect(screen.getByTestId(`${TID}-basis`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Why this method here?' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('on a picked method, "Not useful right now" sets the pick aside through the host — never the Strengthen store', () => {
    const { onSetAsideMethod } = draw({ intervention: viaVm(FLIP), methodId: 'pre_mortem' })
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Not useful right now' }))
    expect(onSetAsideMethod).toHaveBeenCalledTimes(1)
    expect(Object.keys(useStrengthenStore.getState().records)).toEqual([])
  })
})

describe('the Respond form', () => {
  it('⭐ the label is the finding\'s own exercise (`tryThis`) when the producer sent one', () => {
    const tryThis = 'Ask what evidence would move it, and who disagrees with the current figure.'
    const r = viaVm(rec({ id: 'strengthen:flip:edge_try', tryThis }))
    expect(r.tryThis, 'PRECONDITION: the view model kept the exercise').toBe(tryThis)
    draw({ intervention: r })
    fireEvent.click(screen.getByTestId(`${TID}-respond`))
    expect(screen.getByLabelText(tryThis)).toBe(screen.getByTestId(`${TID}-respond-note`))
  })

  it('⛔ CONTRAST — no exercise on the wire ⇒ the neutral "Your thinking", never a composed one', () => {
    draw({ intervention: viaVm(FLIP) })
    fireEvent.click(screen.getByTestId(`${TID}-respond`))
    expect(screen.getByLabelText('Your thinking')).toBe(screen.getByTestId(`${TID}-respond-note`))
  })

  it('sends with "Send to Olumi" and the ➤ arrow; Cancel is a text button', () => {
    draw({ intervention: viaVm(FLIP) })
    fireEvent.click(screen.getByTestId(`${TID}-respond`))
    const send = screen.getByTestId(`${TID}-respond-send`)
    expect(send).toHaveAttribute('aria-label', 'Send to Olumi')
    expect(send.querySelector('svg')?.getAttribute('class') ?? '').toContain('lucide-arrow-up')
    expect(screen.getByTestId(`${TID}-respond-form`)).toHaveTextContent('Send to Olumi')
    expect(screen.getByTestId(`${TID}-respond-cancel`)).toHaveTextContent('Cancel')
  })
})
