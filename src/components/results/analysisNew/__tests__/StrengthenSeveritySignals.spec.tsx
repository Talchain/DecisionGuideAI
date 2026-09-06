/**
 * Analysis (New) — the severity chip and the node-kind mark are TWO SIGNALS,
 * NOT ONE, and this file exists because they were read as one.
 *
 * ⚠⚠ THE DEFECT THIS PREVENTS IS A DELETION, NOT A BUG. An audit read the mark
 * in the title row and the severity chip beneath it as a duplicate pair — "the
 * design replaced the chip with a mark, and the code added the mark without
 * removing the chip" — and would have deleted the chip. That would have removed
 * the card's ONLY severity signal, because the mark never carried severity:
 *
 *   - the MARK  is `markKindForTarget(rec.targetId)` — which KIND OF NODE this
 *     finding is about (`option | factor | risk | outcome`), resolved off the
 *     canvas, sharing one visual vocabulary with `ModelStrip` and the canvas.
 *   - the CHIP  is `rec.category` — the producer's four-value SEVERITY
 *     (`must_fix | should_fix | could_fix | technique`).
 *
 * Two facts, two sources, one card. The design commit that introduced the mark
 * (#995) says so in as many words: the marks say "what KIND of thing something
 * was and nothing else: not clickable, no state, NO SEVERITY".
 *
 * ⭐ SO THE GUARD IS SYMMETRIC, and the symmetry is the point. It is not enough
 * to assert both elements exist — two elements can both exist and still be
 * driven by one fact. These pin that severity CANNOT reach the mark and node
 * kind CANNOT reach the chip, which is the claim "they are two signals" stated
 * so that it can fail. This is CLAUDE.md trap 21: when two things look like an
 * inconsistency to reconcile, write down the question each one answers, and
 * name them apart rather than aligning them.
 *
 * ⚠ EACH INVARIANCE CASE PINS ITS OWN PRECONDITION IN-TEST (trap 13b). An
 * invariance assertion passes trivially if the two fixtures did not actually
 * differ in the input being varied — so each case asserts that the OTHER
 * element did change. Without that, a fixture that silently stopped varying
 * severity would leave a green test proving nothing.
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { useCanvasStore } from '../../../../canvas/store'
import type { Recommendation } from '../../strengthen/strengthenTypes'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

const REC_ID = 'strengthen:phase3:sev'

/**
 * The real store, seeded — not a mock. `markKindForTarget` reads
 * `useCanvasStore.getState().nodes` and classifies through the canvas's own
 * `resolveNodeTypeLiteral`, so seeding exercises the resolution the product
 * runs. A hand-mocked kind would assert the fixture, not the code.
 */
const seedNodes = (nodes: Array<{ id: string; type: string }>) => {
  useCanvasStore.setState({ nodes: nodes as never })
}

beforeEach(() => {
  cleanup()
  seedNodes([])
})

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Run a premortem on this plan',
    signal: 'One factor carries most of the influence.',
    whyNow: 'The conclusion rests almost entirely on it.',
    tryThis: 'Imagine it is six months on and this failed. Write down why.',
    sourceLine: 'From the influence concentration check.',
    action: { kind: 'ai-dialogue', label: 'Work through a premortem', prompt: 'Run a premortem' },
    targetId: 'n_risk',
    priority: 1,
    ...over,
  }) as Recommendation

const renderOpen = (ui: React.ReactElement) => {
  const result = render(ui)
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
  return result
}

/**
 * ⚠ BOUND BY IDENTITY, NEVER BY A VALUE PREDICATE. Every read below starts from
 * the item carrying THIS recommendation's own id and descends to the element by
 * its own stable attribute. Finding "the svg on the card" or "the element whose
 * text is 'Must fix'" would let a different element satisfy the assertion — the
 * failure mode where a test passes on the wrong object.
 */
const item = (id: string = REC_ID): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`[data-recommendation-id="${id}"]`)
  if (!el) throw new Error(`no item rendered for recommendation id ${id}`)
  return el
}
const markOf = (id: string = REC_ID) => item(id).querySelector<SVGElement>('svg[data-mark-kind]')
const chipOf = (id: string = REC_ID) =>
  item(id).querySelector<HTMLElement>('[data-testid="analysis-new-strengthen-severity"]')

describe('the severity chip and the node-kind mark are two signals, not one', () => {
  /**
   * The anti-deletion guard proper. If the chip is removed as a duplicate of
   * the mark, THIS is what REDs — and it names the severity it lost.
   */
  it('renders the producer’s severity, from `category` and from nothing else', () => {
    seedNodes([{ id: 'n_risk', type: 'risk' }])
    renderOpen(
      <StrengthenTheReasoning interventions={[rec({ id: REC_ID, category: 'must_fix' })]} />,
    )

    const chip = chipOf()
    expect(chip, 'the severity chip is not rendered').not.toBeNull()
    expect(chip).toHaveAttribute('data-category', 'must_fix')
    expect(chip).toHaveTextContent('Must fix')
  })

  /**
   * The other object. Deleting the MARK REDs this and leaves the case above
   * green — which is what makes the two assertions a discriminating pair rather
   * than one assertion written twice.
   */
  it('renders the node-kind mark for the node this finding is about', () => {
    seedNodes([{ id: 'n_risk', type: 'risk' }])
    renderOpen(
      <StrengthenTheReasoning interventions={[rec({ id: REC_ID, category: 'must_fix' })]} />,
    )

    const mark = markOf()
    expect(mark, 'the node-kind mark is not rendered').not.toBeNull()
    expect(mark).toHaveAttribute('data-mark-kind', 'risk')
  })

  /**
   * ⭐ QUESTION 2, PINNED. The mark is always filled, and the fill is REFUSED
   * deliberately — `buildModelStrip.ts` re-adjudicated it at this tip: a fill
   * "must be right for EVERY node in the row or it teaches a false reading of
   * all of them", and the axis it is reserved for is PROVENANCE, not severity.
   * Severity is a property of the RECOMMENDATION; the mark's vocabulary is
   * shared with the canvas, where it denotes a NODE. Letting severity tint the
   * mark would make one shape mean two different things on two surfaces —
   * `nodeMarks.tsx`'s own header calls that "worse than no shape at all".
   *
   * Compared as MARKUP, so any severity-driven fill, colour, opacity or extra
   * attribute REDs, not only the ones imagined today.
   */
  it('severity does not reach the mark — the same node renders the same mark at every severity', () => {
    seedNodes([{ id: 'n_risk', type: 'risk' }])

    renderOpen(
      <StrengthenTheReasoning interventions={[rec({ id: REC_ID, category: 'must_fix' })]} />,
    )
    const mustFixMark = markOf()?.outerHTML
    const mustFixChip = chipOf()?.outerHTML
    cleanup()

    renderOpen(
      <StrengthenTheReasoning interventions={[rec({ id: REC_ID, category: 'could_fix' })]} />,
    )
    const couldFixMark = markOf()?.outerHTML
    const couldFixChip = chipOf()?.outerHTML

    // PRECONDITION: the two renders really did differ in severity. Without this
    // the invariance below passes even if `category` stopped reaching anything.
    expect(mustFixChip, 'precondition: no chip in the first render').toBeTruthy()
    expect(couldFixChip, 'precondition: no chip in the second render').toBeTruthy()
    expect(
      mustFixChip,
      'precondition failed: the severity chip did not change, so this case varied nothing',
    ).not.toBe(couldFixChip)

    expect(mustFixMark, 'no mark in the first render').toBeTruthy()
    expect(couldFixMark, 'the mark changed with severity — the mark must carry kind, not severity')
      .toBe(mustFixMark)
  })

  /**
   * The mirror, and it is not decorative. A chip that took its treatment from
   * the node kind would make severity unreadable across cards — the same
   * failure as above, pointing the other way.
   */
  it('node kind does not reach the severity chip — the same severity reads the same on any node', () => {
    seedNodes([
      { id: 'n_risk', type: 'risk' },
      { id: 'n_factor', type: 'factor' },
    ])

    renderOpen(
      <StrengthenTheReasoning
        interventions={[rec({ id: REC_ID, category: 'must_fix', targetId: 'n_risk' })]}
      />,
    )
    const riskChip = chipOf()?.outerHTML
    const riskMark = markOf()?.outerHTML
    cleanup()

    renderOpen(
      <StrengthenTheReasoning
        interventions={[rec({ id: REC_ID, category: 'must_fix', targetId: 'n_factor' })]}
      />,
    )
    const factorChip = chipOf()?.outerHTML
    const factorMark = markOf()?.outerHTML

    // PRECONDITION: the node kind really did vary between the two renders.
    expect(riskMark, 'precondition: no mark in the first render').toBeTruthy()
    expect(factorMark, 'precondition: no mark in the second render').toBeTruthy()
    expect(
      riskMark,
      'precondition failed: the mark did not change, so this case varied nothing',
    ).not.toBe(factorMark)

    expect(riskChip, 'no chip in the first render').toBeTruthy()
    expect(factorChip, 'the severity chip changed with node kind — it must carry severity only')
      .toBe(riskChip)
  })

  /**
   * The honest absence, and it is the reason the chip cannot be inferred from
   * anything else on the card. `category` is set only on phase-3 guidance recs;
   * the UI's own deterministic triggers were never categorised by the producer
   * and must not be given a synthesised severity. A card with a mark and no
   * chip is therefore a NORMAL state — not evidence that the chip is redundant.
   */
  it('renders no severity chip when the producer sent no category, while the mark still renders', () => {
    seedNodes([{ id: 'n_risk', type: 'risk' }])
    renderOpen(<StrengthenTheReasoning interventions={[rec({ id: REC_ID })]} />)

    expect(chipOf()).toBeNull()
    expect(markOf(), 'the mark is independent of severity and must survive its absence').toHaveAttribute(
      'data-mark-kind',
      'risk',
    )
  })
})
