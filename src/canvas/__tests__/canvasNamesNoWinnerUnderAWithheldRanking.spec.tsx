/**
 * ⛔ THE CANVAS NEVER TURNS AN ALTERNATIVE'S NAME INTO A WINNER CLAIM, AND
 * NEVER RANKS OPTIONS WHOSE RANKING THE PRODUCER WITHHELD.
 *
 * AI Quality's read-only audit of served UI `b017e3c2`
 * (`evidence/ai-quality-20260925/ui-audit/UI-WITHHELD-LEADER-AUDIT-b017e3c2.md`,
 * rows L2–L4; #69 5827943157) found three Canvas surfaces with no gate:
 *   L2 `OutcomePanel`: options SORTED by win probability, on a run whose
 *      ranking the producer withheld.
 *   L3 `StyledEdge`: "If wrong → {alt}" on a fragile edge in the lens.
 *   L4 `LensInfoPanel`: "→ {alt}" on each fragile row.
 *
 * The register's ruling (`fragileEdgeCopy.ts`, the orchestrator ruling in its
 * header; ROADMAP 1.267): the alternative's NAME is data and survives a
 * withheld run; the VERB that presupposes a result to flip from is the defect.
 * The canonical withheld form is "the comparison could shift towards {alt}".
 * The canvas factor turning-point track already uses the withheld form ALWAYS
 * (`turningPointCopy.ts`), which is true on a permitted run too, so the edge
 * and lens surfaces follow it and need no verdict read per edge.
 *
 * The outcome inspector's ORDER is a ranking, so it asks the SAME reader the
 * dock and the Reasoning tab ask: `rankingWasWithheld(recommendation)` from
 * `useResultsSectionData`. A withheld run lists options in canvas order.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, renderHook, screen, cleanup } from '@testing-library/react'
import { lensFragileEdgeLabel, lensFragileRowAlternative } from '../../components/results/utils/fragileEdgeCopy'
import { LensInfoPanel } from '../components/LensInfoPanel'
import { OutcomePanel } from '../ui/inspector-v2/panels/OutcomePanel'
import { useCanvasStore } from '../store'
import { mapV5AnalysisToReport } from '../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../../components/results/useResultsSectionData'
import { rankingWasWithheld } from '../../components/results/leaderDesignation'
import served from './fixtures/served-0303ef5-pricing-withheld-run.json'

afterEach(() => {
  cleanup()
  localStorage.removeItem('feature.graphLens')
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as never,
    nodes: [] as never,
    hasCompletedFirstRun: false,
    lens: { ...useCanvasStore.getState().lens, active: 'full' },
  } as never)
})

describe('the fragile-edge alternative is named without a winner verb', () => {
  it('the edge label names the alternative in the withheld form', () => {
    expect(lensFragileEdgeLabel('Plan B')).toBe('The comparison could shift towards Plan B')
    expect(lensFragileEdgeLabel('Plan B')).not.toMatch(/If wrong|→|→/)
  })

  it('no alternative → the existing "Sensitive" word; a blank label is not a name', () => {
    expect(lensFragileEdgeLabel(null)).toBe('Sensitive')
    expect(lensFragileEdgeLabel(undefined)).toBe('Sensitive')
    expect(lensFragileEdgeLabel('   ')).toBe('Sensitive')
  })

  it('the lens row keeps the name, drops the arrow, and titles it with the full sentence', () => {
    expect(lensFragileRowAlternative('Plan B')).toEqual({
      text: 'towards Plan B',
      title: 'The comparison could shift towards Plan B',
    })
  })

  it('LensInfoPanel renders the row that way', () => {
    localStorage.setItem('feature.graphLens', '1')
    useCanvasStore.setState({
      nodes: [
        { id: 'price', data: { label: 'Price' }, position: { x: 0, y: 0 } },
        { id: 'revenue', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
      ] as never,
      results: {
        status: 'complete',
        progress: 100,
        report: {
          robustness: {
            fragile_edges: [
              { from_id: 'price', to_id: 'revenue', switch_probability: 0.85, alternative_winner_label: 'Plan B' },
            ],
          },
        },
      } as never,
      lens: { ...useCanvasStore.getState().lens, active: 'robustness' },
    } as never)
    render(<LensInfoPanel />)
    const panel = screen.getByTestId('lens-info-robustness')
    expect(panel.textContent).toContain('towards Plan B')
    expect(panel.textContent).not.toMatch(/→\s*Plan B/)
    expect(panel.querySelector('[title="The comparison could shift towards Plan B"]')).not.toBeNull()
    // CONTROL: the row itself still renders its measured figure.
    expect(panel.textContent).toContain('85%')
  })
})

/**
 * The REPORT here is served bytes, not an authored shape: the `analysis_result`
 * block of CEE `0303ef5`'s explicit Run on the pricing brief (AI Quality's
 * capture; one UUID zeroed), mapped by the REAL `mapV5AnalysisToReport`, with the
 * served `leader_claim` applied through the REAL store action
 * `resultsWithholdLeaderClaim`. A self-authored `{option_comparison,
 * producer_leader_permission}` report was tried first and built ZERO options in
 * `useResultsSectionData`, so `rankingWasWithheld` read false and the test was
 * about an empty view model. The PRECONDITION lines below pin that away.
 *
 * ⚠ The served pricing graph has no `outcome`-kind node (its terminal is the goal
 * `mrr`), so the outcome node that mounts this inspector is structural. The
 * option ids and labels are the served draft's, in the served order.
 */
describe('the outcome inspector does not rank options whose ranking was withheld', () => {
  const SERVED_ORDER = served.options.map((o) => o.label)
  const BY_SHARE = ['£59 With Next Release', 'Keep £49 Price', '£54 With Next Release']

  function seed(opts: { permitted: boolean; canvasOptions?: typeof served.options }) {
    const report = mapV5AnalysisToReport(served.analysis_result as never, {} as never) as unknown as Record<string, unknown>
    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      nodes: [
        { id: 'out1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'MRR', kind: 'outcome' } },
        ...(opts.canvasOptions ?? served.options).map((o, i) => ({
          id: o.id, type: 'option', position: { x: i * 220, y: 200 }, data: { label: o.label, kind: 'option' },
        })),
      ] as never,
      edges: [] as never,
      results: {
        status: 'complete',
        progress: 100,
        report: opts.permitted
          ? {
              ...report,
              // CONTRAST ONLY: the same served numbers with a producer separation
              // signal and no withhold — the shape a permitted run carries.
              robustness: {
                ...(report.robustness as object),
                near_tie: { is_tie: false, top_option_id: '59_with_next_release', second_option_id: 'keep_49_price', gap: 0.69, threshold: 0.1 },
              },
            }
          : report,
      } as never,
    } as never)
    if (!opts.permitted) {
      useCanvasStore.getState().resultsWithholdLeaderClaim(served.leader_claim.withheld_reason as never)
    }
  }

  function renderedOrder(): string[] {
    render(<OutcomePanel nodeId="out1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    const section = screen.getByTestId('option-comparison-section')
    return [...section.querySelectorAll('button')].map((b) => (b.textContent ?? '').replace(/Current model.*/, '').replace(/\d+%.*$/, '').trim())
  }

  const recommendation = () => renderHook(() => useResultsSectionData()).result.current.recommendation

  it('⭐ the served withheld run lists options in canvas order, not sorted by share', () => {
    seed({ permitted: false })
    // PRECONDITION: the served leader claim is withheld and the hook built all three arms.
    expect(served.leader_claim.permitted).toBe(false)
    expect(recommendation().allOptions.map((o) => o.id)).toEqual(served.options.map((o) => o.id))
    expect(rankingWasWithheld(recommendation())).toBe(true)
    // The served shares would put £59 first; the inspector must not.
    expect(renderedOrder()).toEqual(SERVED_ORDER)
    expect(SERVED_ORDER).not.toEqual(BY_SHARE)
  })

  it('the withheld order is the CANVAS order, not the report order (canvas options reversed)', () => {
    // Review 5828358211: the served `option_comparison` arrives in canvas order
    // already, so the case above cannot tell canvas order from report order.
    const reversed = [...served.options].reverse()
    seed({ permitted: false, canvasOptions: reversed })
    expect(rankingWasWithheld(recommendation())).toBe(true)
    expect(renderedOrder()).toEqual(reversed.map((o) => o.label))
    expect(reversed.map((o) => o.label)).not.toEqual(SERVED_ORDER)
  })

  it('CONTRAST — a permitted run on the same numbers is still sorted by share', () => {
    seed({ permitted: true })
    expect(rankingWasWithheld(recommendation()), 'PRECONDITION: the contrast must be a permitted run').toBe(false)
    expect(renderedOrder()).toEqual(BY_SHARE)
  })
})
