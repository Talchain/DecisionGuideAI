/**
 * RESIDUAL COMPARATIVE SURFACES — the analysis_run event readers
 * (ROADMAP 1.239, residual 5). DELETE, not gate.
 *
 * `renderTimeline` printed "Analysis complete - {winner} performs best at N%"
 * from `details.winner` / `details.probability`, with no reference to the
 * verdict at all. The probe scored it SILENT everywhere — including on the two
 * PERMITTED runs, where a leader genuinely existed and every other leader
 * surface fired. A surface that stays silent on the runs that entitle it is
 * not gated; it is unreachable.
 *
 * WHY DELETE RATHER THAN GATE. Complete writer manifest for `analysis_run`
 * event details, derived at UI ae77248a over all of `src/` excluding tests
 * (`appendEvent(`, `storeAnalysis(`, `persistAnalysisSuccess`), plus the RPC
 * itself:
 *
 *   1. src/canvas/hooks/useV2Run.ts            → { option_count, analysis_status }
 *   2. src/canvas/conversation/useConversation.ts
 *                                              → { option_count, analysis_status, source }
 *   3. supabase/.../store_analysis_and_log      → passes p_details straight
 *                                                through; adds no keys.
 *
 * The only other `appendEvent` callers in the tree write `direct_edit`. So
 * `winner`, `probability` and `robustness` have NO writer: the branch reads
 * keys nothing produces, which is why it is silent on permitted runs.
 *
 * CLAIM TYPE, stated precisely: this is a NO-WRITER claim about the current
 * build, not a claim that no historical row in the database carries a
 * `winner`. Rows written by earlier builds are outside what the repo can
 * prove, and they are exactly why the reader must stop rendering the clause
 * rather than merely have its writer left alone.
 *
 * And a gate is not available even if one were wanted: neither this surface
 * nor the scenario list has a results report — let alone a
 * `DecisionVerdict` — in scope when rendering a past run's activity line.
 * A gate on a key with no writer would be dead code that reads as a
 * guarantee: the guarantee-theatre class this programme keeps finding.
 *
 * The lifecycle FACT ("this run completed", and its robustness grade) is not
 * comparative and stays.
 */
import { describe, expect, it } from 'vitest'
import { renderTimeline } from '../renderTimeline'
import type { ScenarioEvent } from '../../../types/scenario'

const event = (details: Record<string, unknown>): ScenarioEvent =>
  ({
    event_id: 'evt-1',
    event_type: 'analysis_run',
    timestamp: '2026-07-27T10:00:00.000Z',
    details,
  }) as unknown as ScenarioEvent

const headlineFor = (details: Record<string, unknown>): string =>
  renderTimeline([event(details)])[0].headline

describe('renderTimeline analysis_run — no leader designation (ROADMAP 1.239)', () => {
  it('a details.winner present on the row designates nothing', () => {
    const headline = headlineFor({ winner: 'Option A', probability: 72, robustness: 'robust' })
    expect(headline).not.toMatch(/Option A/)
    expect(headline).not.toMatch(/performs best/i)
  })

  it('the entry still renders — the absence assertions are not vacuous', () => {
    // Trap 13 positive control.
    const entries = renderTimeline([event({ winner: 'Option A', probability: 72 })])
    expect(entries).toHaveLength(1)
    expect(entries[0].headline.length).toBeGreaterThan(0)
  })

  it('the run-level robustness grade survives — it is not comparative', () => {
    // Over-suppression control: robustness describes the RUN, not an ordering
    // between options, so deleting it would trade one honesty failure for a
    // disclosure failure.
    expect(headlineFor({ winner: 'Option A', probability: 72, robustness: 'robust' }))
      .toBe('Analysis complete (robust)')
  })

  it('no robustness ⇒ the plain lifecycle line', () => {
    expect(headlineFor({})).toBe('Analysis run')
  })
})

/**
 * ABSORBED FROM `renderTimeline.nullProb.spec.ts`, which this change deletes.
 *
 * That suite existed to stop one specific thing: a run that produced no
 * probability reading as a clean success, because the success line was
 * "{winner} performs best at N%". Its contract was
 *
 *   "a run that 'happened' but produced no probability must not read as a
 *    clean success"
 *
 * and every assertion in it was written against the probability-bearing line.
 * With that line deleted the guard has nothing left to guard, and its three
 * PASSING cases ("renders Analysis complete ... 74%", "... 0%") pinned exactly
 * the copy this row removes — so they are fixed at the source rather than
 * quarantined or baselined.
 *
 * The contract itself is kept, and strengthened: no shape of `details` makes
 * this line read as a success FOR AN OPTION, whether the probability is
 * finite, null, NaN or absent. Deleting the file without these cases would
 * have retired a real invariant on the coat-tails of a copy change.
 */
describe('renderTimeline analysis_run — the null-probability contract, restated', () => {
  it('null probability: no success claim', () => {
    expect(headlineFor({ winner: 'Option A', probability: null })).toBe('Analysis run')
  })

  it('NaN probability: no success claim', () => {
    expect(headlineFor({ winner: 'Option A', probability: NaN })).toBe('Analysis run')
  })

  it('finite-zero probability: no success claim either — and no bare "0%"', () => {
    const headline = headlineFor({ winner: 'Option A', probability: 0 })
    expect(headline).toBe('Analysis run')
    expect(headline).not.toMatch(/0%/)
  })

  it('a healthy 74%: still no option is named or ranked', () => {
    const headline = headlineFor({ winner: 'Option A', probability: 74 })
    expect(headline).not.toMatch(/Option A|74%|performs best/i)
  })
})
