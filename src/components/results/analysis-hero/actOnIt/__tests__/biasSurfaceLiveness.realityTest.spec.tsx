/**
 * §1.5(3) REALITY-TEST — the decision_review bias surface, re-homed.
 *
 * ## What this file is, and why it is not in the file that names it
 *
 * This is the THIRD case of the bias-surface liveness gate (bias-coaching
 * proposal 2026-07-16 §4.3), whose other two cases live in
 * `canvas/components/pre-analysis/__tests__/biasSurfaceLiveness.spec.tsx`.
 * Design amendment §1.5 names exactly three bias-coaching surfaces, one per
 * journey beat, and the gate carries one case per named surface:
 *
 *   §1.5(1) FRAME        — pre-analysis panel bias cards      (in the gate file)
 *   §1.5(2) EXPLORE      — canvas node icons                  (in the gate file)
 *   §1.5(3) REALITY-TEST — decision_review bias cards         — HERE
 *
 * §1.5(3) sits apart because its surface MOVED into a module with a mount
 * allow-list. It used to be `V7BiasSection` (`components/results/v7/`, deleted;
 * preserved at `ca8cb0c1`), which any test could import. Its replacement is the
 * analysis hero's ACT-ON-IT REFLECT ROWS, and `analysis-hero/__tests__/
 * inertness.spec.ts` permits exactly TWO importers of that module outside its
 * own tree (`ResultsBody.tsx` and `routes/HeroGallery.tsx`) — no test carve-out,
 * deliberately. Keeping the case in the gate file would have meant adding this
 * spec to that allow-list, which would weaken a live guard to satisfy a test.
 * So the case moved to where the import is legitimate: inside the module.
 *
 * ⚠ THE CASE WAS NOT WEAKENED BY MOVING, AND THE MOVE IS NOT A HIDING PLACE.
 * The gate file still names §1.5(3), still counts three of three, and carries a
 * STRUCTURAL PIN bound to this file by path: delete this spec, or gut the two
 * assertions that make it worth having, and the GATE goes red pointing here. A
 * relocated case that the original gate cannot see would be exactly the silent
 * removal §4.3 exists to prevent.
 *
 * ## What it binds, and why it binds the whole chain
 *
 * The v7 retirement did not merely move this surface — it LOST part of it.
 * `V7BiasSection` was the only place in the product rendering a finding's
 * `micro_intervention.steps` (the concrete numbered steps) and its "About N min"
 * estimate. The reflect rows that replaced it showed the bias type and
 * description alone, and the drop was at the ADAPTER: the `m2BiasFindings`
 * mapping projected five fields and discarded the rest, so no renderer COULD
 * have shown them.
 *
 * So these cases drive the REAL chain end to end, stubbing nothing:
 *
 *   raw producer finding (`m1_review.bias_findings[]` shape)
 *     → `results/mapM2BiasFindings.ts`      (the adapter that dropped them)
 *     → `confidence.m2BiasFindings[].microIntervention`
 *     → `rankActOnItRows.ts` `reflectRows()`
 *     → `ActOnItSection.tsx`                (the DOM the user reads)
 *
 * A stub at any hop would hide the hop it stubbed — and the adapter hop is
 * precisely where the capability was lost the first time.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'

import { mapM2BiasFindings } from '../../../mapM2BiasFindings'
import { rankActOnItRows } from '../rankActOnItRows'
import { ActOnItSection } from '../ActOnItSection'
import type { ResultsSectionDataReturn } from '../../../useResultsSectionData'

afterEach(cleanup)

/**
 * Drive the real chain from a RAW producer finding to the DOM.
 *
 * `rankActOnItRows` reads only `confidence.m2BiasFindings`, the two fragile-edge
 * fields and `recommendation.allOptions`, so the cast supplies exactly those.
 * TWO options are given deliberately: a single-option model would add a
 * COVERAGE row, and these cases must observe the REFLECT row.
 */
function renderReflectSurface(rawFindings: unknown[]) {
  const data = {
    recommendation: { allOptions: [{ id: 'o1' }, { id: 'o2' }] },
    confidence: { m2BiasFindings: mapM2BiasFindings(rawFindings) },
  } as unknown as ResultsSectionDataReturn
  const rows = rankActOnItRows(data, { readyToBrief: false })
  return render(
    <ActOnItSection rows={rows} hiddenRows={[]} dispatchRowAction={vi.fn()} chatAvailable />,
  )
}

/**
 * The §1.5(3) fixture. Shape unchanged from the `V7BiasSection` era — only the
 * path it arrives by changed (`ceeReviewV1.bias_findings` read from the store,
 * then; PLoT `m1_review.bias_findings` through the adapter, now).
 */
const REVIEW_BIAS_FINDING = {
  id: 'rev-bias-1',
  type: 'SUNK_COST',
  description: 'Past spend is shaping the preference more than the outcome does.',
  micro_intervention: {
    steps: ['List the choice ignoring money already spent.'],
    estimated_minutes: 5,
  },
}

describe('bias-surface liveness gate — §1.5(3) REALITY-TEST (re-homed surface)', () => {
  it('§1.5(3) REALITY-TEST: a decision_review bias finding renders a reflect row', () => {
    renderReflectSurface([REVIEW_BIAS_FINDING])

    // Surface alive: the act-on-it section mounts and carries a REFLECT row,
    // bound by the category-specific testid — never by "some row exists", which
    // a risk or coverage row would also satisfy.
    expect(screen.getByTestId('hero-act-on-it')).toBeTruthy()
    const row = screen.getByTestId('hero-act-on-it-row-reflect')
    expect(within(row).getByTestId('hero-act-on-it-row-title').textContent).toMatch(/sunk.?cost/i)
    expect(within(row).getByTestId('hero-act-on-it-row-reason').textContent).toContain(
      'Past spend is shaping the preference',
    )
  })

  it('§1.5(3) REALITY-TEST: the micro-intervention steps and the effort estimate render', () => {
    // ⭐ THE RE-HOMED HALF, and the reason this case is stronger than the one it
    // replaces. Drop the adapter mapping, the row fields, or the rendering, and
    // this goes RED while the case above stays GREEN — proven by execution with
    // a discriminating mutant pair, so the assertion is bound to these two
    // fields and not to "bias content is present" in general.
    renderReflectSurface([REVIEW_BIAS_FINDING])

    const row = screen.getByTestId('hero-act-on-it-row-reflect')
    const steps = within(row).getByTestId('hero-act-on-it-row-steps')
    expect(within(steps).getByRole('listitem').textContent).toContain(
      'List the choice ignoring money already spent.',
    )
    expect(within(row).getByTestId('hero-act-on-it-row-minutes').textContent).toContain('About 5 min')
  })

  it('§1.5(3) HONEST ABSENCE: a finding with no micro-intervention renders no steps and no estimate', () => {
    // Absent must read as absent: never an empty list, never a fabricated step,
    // never a default duration. The ROW still renders — the finding is real,
    // only the intervention is missing, and suppressing the row would lose the
    // finding to protect the field.
    const { micro_intervention: _dropped, ...withoutIntervention } = REVIEW_BIAS_FINDING
    renderReflectSurface([withoutIntervention])

    const row = screen.getByTestId('hero-act-on-it-row-reflect')
    expect(within(row).getByTestId('hero-act-on-it-row-reason').textContent).toContain(
      'Past spend is shaping the preference',
    )
    expect(within(row).queryByTestId('hero-act-on-it-row-steps')).toBeNull()
    expect(within(row).queryByTestId('hero-act-on-it-row-minutes')).toBeNull()
  })

  it('§1.5(3) REALITY-TEST honest absence: no findings → no reflect row at all', () => {
    const { container } = renderReflectSurface([])
    expect(container.querySelector('[data-testid="hero-act-on-it-row-reflect"]')).toBeNull()
  })
})
