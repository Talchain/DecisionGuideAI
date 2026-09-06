/**
 * A machine code never reaches the visible text of "Model gaps the analysis
 * worked around" — not as the term column, and not appended to the sentence.
 *
 * ── THE WITNESSED DEFECT (Paul, deployed `a9c2e050`, 5 Sep 2026) ────────────
 * The group rendered as a two-column list whose `<dt>` was the producer's code:
 *
 *     EDGE_E_VALUE_NON_FINITE_DROPPED   Part of this analysis was limited
 *     ROOT_NODE_DEFAULT_VALUE           A starting factor has no current value…
 *     ROOT_NODE_DEFAULT_VALUE           A starting factor has no current value…
 *
 * The term column is a heading. A SCREAMING_SNAKE identifier at the head of each
 * row is the clearest possible signal that the reader is looking at plumbing,
 * on the one surface whose job is to make a chain of reasoning trustworthy.
 *
 * ── WHAT THIS DOES *NOT* ASSERT, AND WHY ───────────────────────────────────
 * Not "the code is absent from the DOM". It stays as the `sr-only` `<dt>` (so
 * the `<dl>` keeps a term for its `<dd>`) and as `data-gap-code` (so support and
 * tests keep a handle), and a test below pins that in the opposite direction.
 * What changes is that a reader never SEES it.
 *
 * ⚠⚠ AN EARLIER VERSION OF THIS HEADER SAID THE CODE MUST STAY ON SCREEN,
 * CITING `auditInferenceWarningsNeverBareCode.spec.tsx` FOR "the property is
 * `code + sentence`, NEVER `sentence instead of code`". That generalised a
 * ruling scoped to ONE surface (review S1). That spec's own first line is "The
 * Model card's audit trail never renders a machine code ALONE", and the rule it
 * enforces — `humaniseCritique.ts`'s words — is that a machine code is right for
 * an AUDIT TRAIL and wrong for a CAVEAT STRIP. The Model tab is the audit trail,
 * and it is where `humaniseCritique.ts:777` sends the reader; it lists the code
 * regardless of what this panel does, so nothing here falsifies that promise.
 * `AdvancedSection.tsx:383-398` renders these IDENTICAL entries, through the
 * same `selectHumanisedInferenceWarningsOutsideStrip` call, as a bare sentence
 * with no code — so `sentence instead of code` already ships on the sibling
 * Analysis tab for exactly this content.
 *
 * Not "duplicates collapse" either. `deeperAnalysisEvidence.spec.tsx:200` forbids
 * that, and its reason is the point: the producer repeats a code when it raises
 * the same condition about two DIFFERENT nodes. Two rows are two findings.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { DeeperAnalysis } from '../sections/DeeperAnalysis'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, manyFragileEdges } from './analysisNewFixtures'

/** The real builder, on the real capture, exactly as the tab body mounts it. */
const deeperOf = (data: ReturnType<typeof makeData>) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_x',
  }).deeper

/** A shape matching what the builder emits for this group. */
const GAP_ROWS = [
  { label: 'ROOT_NODE_DEFAULT_VALUE', value: 'A starting factor has no current value recorded.', statement: true },
  { label: 'ROOT_NODE_DEFAULT_VALUE', value: 'A starting factor has no current value recorded.', statement: true },
  { label: 'EDGE_E_VALUE_NON_FINITE_DROPPED', value: 'Part of this analysis was limited.', statement: true },
]

/** A genuine term/definition group, used as the contrast control. */
const RUN_ROWS = [
  { label: 'Simulations', value: '2000' },
  { label: 'Seed', value: '7' },
]

const CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/

function renderGroups(groups: Array<{ title: string; rows: typeof RUN_ROWS | typeof GAP_ROWS }>) {
  cleanup()
  render(<DeeperAnalysis deeper={{ groups, critiques: [], caveats: [] } as never} />)
  fireEvent.click(screen.getByTestId('analysis-new-deeper-toggle'))
}

describe('a gap code is content, not a heading', () => {
  it('CONTROL: the probe can SEE a code in a term column when one is there', () => {
    // Without this, every assertion below could pass by the query finding
    // nothing at all. Feeding the gap rows through the ordinary term/definition
    // path must put a code in a visible term — proving the detector works.
    renderGroups([{ title: 'Model gaps the analysis worked around', rows: GAP_ROWS.map(r => ({ label: r.label, value: r.value })) as never }])
    const visibleTerms = Array.from(screen.getAllByRole('term')).filter(n => !n.className.includes('sr-only'))
    expect(visibleTerms.some(n => CODE.test((n.textContent ?? '').trim()))).toBe(true)
  })

  it('no VISIBLE term is a machine code', () => {
    renderGroups([
      { title: 'This run', rows: RUN_ROWS },
      { title: 'Model gaps the analysis worked around', rows: GAP_ROWS as never },
    ])
    const offenders = Array.from(screen.getAllByRole('term'))
      .filter(n => !n.className.includes('sr-only'))
      .map(n => (n.textContent ?? '').trim())
      .filter(t => CODE.test(t))
    expect(offenders, `machine codes rendered as headings: ${offenders.join(', ')}`).toEqual([])
  })

  it('the code is still in the DOM — this is not a deletion', () => {
    // Not a claim that it is VISIBLE — `no gap row shows a machine code in its
    // VISIBLE text` below rules the opposite way on that, and the two together
    // are the property: present for support and assistive tech, absent from
    // what a reader sees.
    renderGroups([{ title: 'Model gaps the analysis worked around', rows: GAP_ROWS as never }])
    expect(screen.getAllByTestId('analysis-new-deeper')[0]).toHaveTextContent('ROOT_NODE_DEFAULT_VALUE')
  })

  it('every gap row keeps its own identity — two nodes are two rows', () => {
    // Pins the property `deeperAnalysisEvidence.spec.tsx:200` states: the
    // producer repeats a code for two different nodes, so collapsing them would
    // turn two findings into one.
    renderGroups([{ title: 'Model gaps the analysis worked around', rows: GAP_ROWS as never }])
    const terms = Array.from(screen.getAllByRole('term')).map(n => (n.textContent ?? '').trim())
    expect(terms.filter(t => t === 'ROOT_NODE_DEFAULT_VALUE')).toHaveLength(2)
  })

  it('DISCRIMINATOR: a real term/definition group keeps its visible headings', () => {
    // The flag is opt-in per row. If it ever became a blanket rule, the six
    // genuine term/definition groups would lose their term column and this REDs.
    renderGroups([{ title: 'This run', rows: RUN_ROWS }])
    const visible = Array.from(screen.getAllByRole('term')).filter(n => !n.className.includes('sr-only'))
    expect(visible.map(n => (n.textContent ?? '').trim())).toEqual(['Simulations', 'Seed'])
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ⚠⚠ THE TESTS ABOVE RENDER HAND-BUILT ROWS, SO THEY CANNOT SEE A BUILDER
  // REGRESSION — measured, not assumed: removing `statement: true` from
  // `buildAnalysisNewViewModel` left all five GREEN while putting the code back
  // in the heading, which is the exact defect this file exists to prevent.
  // A guard that tests the renderer is not a guard on the wiring.
  // ══════════════════════════════════════════════════════════════════════════

  it('THE WIRING: the builder marks every gap row as a statement', () => {
    const group = deeperOf(manyFragileEdges()).groups.find(
      (g) => g.title === 'Model gaps the analysis worked around',
    )
    expect(group, 'fixture must produce the gap group').toBeTruthy()
    expect(group!.rows.length, 'fixture must carry gap rows').toBeGreaterThan(0)
    const notStatements = group!.rows.filter((r) => !(r as { statement?: boolean }).statement)
    expect(
      notStatements.map((r) => r.label),
      'a gap row without `statement` renders its code as the heading',
    ).toEqual([])
  })

  it('THE WIRING, end to end: no visible term is a code when rendered from the builder', () => {
    cleanup()
    render(<DeeperAnalysis deeper={deeperOf(manyFragileEdges())} />)
    fireEvent.click(screen.getByTestId('analysis-new-deeper-toggle'))
    const offenders = Array.from(screen.getAllByRole('term'))
      .filter((n) => !n.className.includes('sr-only'))
      .map((n) => (n.textContent ?? '').trim())
      .filter((t) => CODE.test(t))
    expect(offenders, `machine codes rendered as headings: ${offenders.join(', ')}`).toEqual([])
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ⭐ THE CODE LEAVES THE VISIBLE SURFACE ENTIRELY (review S1).
  //
  // The first version of this change moved the code out of the `<dt>` and
  // printed it de-emphasised after the sentence, on the grounds that the
  // estate's ratified shape is `code + sentence`. That generalised a ruling
  // scoped to ONE surface. `auditInferenceWarningsNeverBareCode.spec.tsx`'s own
  // first line is "The Model card's audit trail never renders a machine code
  // ALONE", and `humaniseCritique.ts`'s fallback states the rule it belongs to:
  // "a machine code is correct content for an AUDIT TRAIL and wrong content for
  // a CAVEAT STRIP". This group is the caveat surface, not the audit trail.
  //
  // The disconfirming case was live in the repo the whole time:
  // `AdvancedSection.tsx:383-398` renders the IDENTICAL entries — the same
  // `selectHumanisedInferenceWarningsOutsideStrip` call — as a bare sentence
  // with no code at all. Keeping a second, code-bearing rendering of the same
  // content would have made this panel the only surface printing
  // SCREAMING_SNAKE to a reader.
  // ══════════════════════════════════════════════════════════════════════════

  /** A machine code appearing ANYWHERE inside a run of text, not just alone. */
  const CODE_ANYWHERE = /[A-Z][A-Z0-9]*(_[A-Z0-9]+)+/

  const gapCells = () =>
    Array.from(document.querySelectorAll('dd[data-gap-code]')) as HTMLElement[]

  it('CONTROL: the visible-text probe can SEE a code inside a gap row when one is there', () => {
    // Points the SAME detector at a row whose sentence carries a code. Without
    // this, "no code in the visible text" could pass because the probe reads
    // nothing at all.
    renderGroups([
      {
        title: 'Model gaps the analysis worked around',
        rows: [{ label: 'ROOT_NODE_DEFAULT_VALUE', value: 'A planted sentence carrying ROOT_NODE_DEFAULT_VALUE inline.', statement: true }] as never,
      },
    ])
    const cells = gapCells()
    expect(cells.length, 'probe must find the gap rows at all').toBeGreaterThan(0)
    expect(cells.some((n) => CODE_ANYWHERE.test(n.textContent ?? ''))).toBe(true)
  })

  it('no gap row shows a machine code in its VISIBLE text', () => {
    renderGroups([{ title: 'Model gaps the analysis worked around', rows: GAP_ROWS as never }])
    const cells = gapCells()
    expect(cells.length, 'fixture must produce gap rows').toBe(GAP_ROWS.length)
    const offenders = cells
      .map((n) => (n.textContent ?? '').trim())
      .filter((t) => CODE_ANYWHERE.test(t))
    expect(offenders, `machine codes visible to the reader: ${offenders.join(' | ')}`).toEqual([])
  })

  it('the code is still ADDRESSABLE — support and tests keep their handle', () => {
    // The opposite direction of the test above: removing it from the visible
    // text must not remove it from the DOM. `humaniseCritique`'s fallback
    // promises the reader the raw code "is listed in the run's audit details",
    // and support needs to quote it.
    renderGroups([{ title: 'Model gaps the analysis worked around', rows: GAP_ROWS as never }])
    expect(gapCells().map((n) => n.getAttribute('data-gap-code'))).toEqual(
      GAP_ROWS.map((r) => r.label),
    )
  })

  it('TWIN: a gap with no template still renders a useful sentence, not an empty row', () => {
    // `EDGE_E_VALUE_NON_FINITE_DROPPED` has no template, so it lands on
    // humaniseCritique's generic fallback. Dropping the code must not leave
    // that row with nothing to say — the failure mode a code-deletion invites.
    // Derived from the real capture, not from an invented fixture.
    cleanup()
    render(<DeeperAnalysis deeper={deeperOf(manyFragileEdges())} />)
    fireEvent.click(screen.getByTestId('analysis-new-deeper-toggle'))
    const cells = gapCells()
    expect(cells.length, 'capture must produce gap rows').toBeGreaterThan(0)
    const untemplated = cells.find(
      (n) => n.getAttribute('data-gap-code') === 'EDGE_E_VALUE_NON_FINITE_DROPPED',
    )
    expect(untemplated, 'capture must carry the untemplated code').toBeTruthy()
    const text = (untemplated!.textContent ?? '').trim()
    expect(text.length, 'an untemplated gap must still say something').toBeGreaterThan(20)
    expect(CODE_ANYWHERE.test(text)).toBe(false)
  })
})
