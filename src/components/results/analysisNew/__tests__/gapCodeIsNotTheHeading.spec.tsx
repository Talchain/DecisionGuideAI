/**
 * A machine code never occupies the term column of "Model gaps the analysis
 * worked around".
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
 * Not "the code is absent". `auditInferenceWarningsNeverBareCode.spec.tsx` rules
 * that the property is `code + sentence`, NEVER `sentence instead of code`, and
 * `humaniseCritique.ts:777` promises the reader the raw code "is listed in the
 * run's audit details" — this group IS those details. So the code stays; what
 * changes is that it stops being the heading.
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

  it('the code is still PRESENT — this is not a deletion', () => {
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
})
