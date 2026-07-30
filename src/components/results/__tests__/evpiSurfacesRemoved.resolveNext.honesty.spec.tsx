/**
 * EVPI display surfaces — the NEW "Resolve next" view must not reopen them.
 *
 * A SIBLING of `evpiSurfacesRemoved.honesty.spec.tsx`, deliberately not an edit
 * to it: that file imports and renders the ARCHIVED `ConfidenceSection` as one
 * of its harnesses, which makes the archived component load-bearing evidence
 * (recon `PHASE0-EVIDENCE-2026-07-28/confidencesection-recon.md`). This file
 * asserts the SAME THREE MATCHERS against the new surface — and now imports them
 * from `./helpers/refutedEvpiClaimMatchers.ts` rather than re-declaring them, so
 * the banned vocabulary has ONE definition. Two copies of an absence assertion's
 * own definition is trap 13 with a delay fuse: narrow one and the other keeps
 * passing.
 *
 * WHY THE NEW SURFACE NEEDS ITS OWN ENTRY IN THIS FAMILY
 * ─────────────────────────────────────────────────────
 * `evpi_percentage_points` is refuted, and the sentence it wore
 * ("Worth 12.3pp if resolved", "resolving could improve confidence by …") is a
 * VALUE-OF-INFORMATION claim. The "Resolve next" view answers the same user
 * question from a DIFFERENT, real estimator (ISL's Strong–Oakley regression
 * EVPPI). That is exactly the circumstance in which the removed copy would come
 * back "under another name" — so the new view is pinned against the identical
 * patterns, with the populated-render positive control in the same spec.
 *
 * ISL's numbers are in the decision's OUTCOME units and slice 1 shows NO
 * magnitude at all, so these assertions should hold trivially. That is the
 * point: they are cheap, and they will fail the day someone adds a figure.
 *
 * CLAIM TYPE: rendered text / DOM presence within jsdom. NOT a visibility
 * claim — jsdom cannot prove layout, and nothing here asserts one.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'
import { V7EvidenceDisclosure } from '../v7/V7EvidenceDisclosure'
import type { V7EvidenceModel } from '../v7/buildV7Lenses'
import { buildVoiRanking } from '../voi/voiRanking'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import {
  REFUTED_CLAIM_CONTROLS,
} from './helpers/refutedEvpiClaimMatchers'
import { v7EvidenceModel } from '../../../__fixtures__/v7EvidenceModel'
import {
  voiRankingFixture,
  openResolveNextExpanded as renderResolveNext,
  openDisclosureHeader,
  switchEvidenceView,
} from '../../../test/helpers/resolveNextView'

/**
 * A POPULATED ranking — the honest-gate state would prove nothing here. Four
 * resolved rows (so the clamp has something to hide), two below-resolution rows,
 * and the PARTIAL disclosure on, from the shared non-degenerate fixture.
 */
function populated(): V7EvidenceModel {
  return v7EvidenceModel({
    resolveNext: voiRankingFixture({ someFactorsUnassessed: true }),
  })
}

describe('Resolve next — the refuted EVPI claim does not come back here', () => {
  it('POSITIVE CONTROL: the harness renders the populated ranking it is scanning', () => {
    // Trap 13. Without this, every assertion below could be passing because the
    // view rendered its honest gate, or nothing at all.
    const text = renderResolveNext(populated())
    expect(screen.getByTestId('v7-evidence-resolve-next')).toBeInTheDocument()
    expect(screen.getAllByTestId('v7-resolve-next-row')).toHaveLength(4)
    expect(screen.getByTestId('v7-resolve-next-below')).toBeInTheDocument()
    expect(screen.getByTestId('v7-resolve-next-partial')).toBeInTheDocument()
    expect(text).toContain('Market receptivity')
    expect(text).toContain('Hiring pace')
  })

  it('POSITIVE CONTROL: each matcher fires on the string it was written to catch', () => {
    // Trap 13, applied to the matchers' NEW HOME: the definitions moved out of
    // this file, so this control also proves the import resolved to real
    // patterns rather than to `undefined` (a bad import would otherwise make
    // every `.not.toMatch` below throw, but an over-broad one would not).
    expect(REFUTED_CLAIM_CONTROLS.length).toBeGreaterThanOrEqual(6)
    for (const [re, original] of REFUTED_CLAIM_CONTROLS) {
      expect(re.test(original), `matcher must see: ${original}`).toBe(true)
    }
  })

  /**
   * ⭐ R-1 — ITERATE THE VOCABULARY, DO NOT NAME PATTERNS.
   *
   * These four assertions used to be three named-pattern checks (`PP_TOKEN`,
   * `RESOLVING_CLAIM`, `WORTH_CLAIM`) plus an INLINE `/ranked by EVPI/i` — a
   * SEVENTH copy of the banned vocabulary, written here because the pattern was
   * not in the table this file imported. Unifying the two tables made the fix
   * available: the DOM projection now carries all six patterns, so sweeping it in
   * a loop applies every one of them and a pattern added anywhere in the
   * vocabulary extends this sweep automatically.
   *
   * The positive control immediately above is what keeps this non-vacuous: each
   * pattern is proven to fire on the string it was written to catch, so a
   * `not.toMatch` here measures a real absence rather than an inert regex.
   */
  it('renders NONE of the banned value-of-information vocabulary', () => {
    const text = renderResolveNext(populated())
    for (const [re, original] of REFUTED_CLAIM_CONTROLS) {
      expect(text, `banned pattern resurfaced (control: ${original})`).not.toMatch(re)
    }
  })

  it('the honest-gate state is equally clean', () => {
    render(<V7EvidenceDisclosure evidence={v7EvidenceModel({ resolveNext: null })} />)
    // Nothing at all to disclose → the whole section is absent, which is itself
    // the honest outcome (never an empty shell).
    expect(screen.queryByTestId('v7-evidence-disclosure')).not.toBeInTheDocument()
  })

  it('the gate renders clean when a sibling view has data', () => {
    render(
      <V7EvidenceDisclosure
        evidence={v7EvidenceModel({
          drivers: [{ factorKey: 'f1', label: 'Price', direction: null, isEstimate: false }],
          resolveNext: null,
        })}
      />,
    )
    openDisclosureHeader()
    switchEvidenceView('resolveNext')
    const text = screen.getByTestId('v7-evidence-resolve-next').textContent ?? ''
    // R-1: the whole vocabulary, iterated. See the note on the populated sweep.
    for (const [re, original] of REFUTED_CLAIM_CONTROLS) {
      expect(text, `banned pattern in the GATE state (control: ${original})`).not.toMatch(re)
    }
    // POSITIVE CONTROL: the gate really did render (not an empty subtree).
    expect(screen.getByTestId('v7-evidence-resolve-next-gate')).toBeInTheDocument()
  })
})

/**
 * END-TO-END, ON A WIRE FIXTURE THAT CARRIES pp VALUES AT EVERY LEVEL.
 *
 * The tests above render a hand-built view model, which proves the COMPONENT
 * shows no figure. This block proves the whole chain does — wire →
 * `mapV5AnalysisToReport` → `buildVoiRanking` → the rendered view — against an
 * enrichment payload deliberately seeded with the refuted quantity in every
 * place a producer could put it:
 *
 *   · `factor_sensitivity[].evpi_percentage_points`  (the original refuted slot)
 *   · `factor_evppi[].evpi_percentage_points`        (a hostile future producer
 *                                                     bolting pp onto the new row)
 *   · `factor_evppi[].evppi` / `noise_floor`         (the real, unit-blocked values)
 *   · `decision_evpi`, `p_win_sensitivity[].delta_pp` (transported, never shown)
 *
 * The transport hops are SUPPOSED to carry all of it — `src/v5/` is a declared
 * non-display directory and the debug bundle depends on the fields surviving.
 * The claim being pinned is that the CAGE IS THE READER: not one of those
 * numbers reaches the DOM.
 */
describe('Resolve next — a pp-bearing wire fixture reaches the DOM with no figure', () => {
  const ENRICHMENT = {
    factor_sensitivity: [
      { factor_id: 'n_market', factor_label: 'Market receptivity', sensitivity: 0.8, direction: 'positive', evpi_percentage_points: 12.3, value_of_information: 0.7 },
      { factor_id: 'n_comp', factor_label: 'Competitor response', sensitivity: 0.5, direction: 'negative', evpi_percentage_points: 10.2 },
    ],
    factor_evppi: [
      { factor_id: 'n_market', evppi: 0.913_2, evppi_raw: 0.914, noise_floor: 0.01, units: 'outcome', method: 'regression_evppi_v1', status: 'resolved', evpi_percentage_points: 12.3 },
      { factor_id: 'n_comp', evppi: 0.44, noise_floor: 0.01, units: 'outcome', method: 'regression_evppi_v1', status: 'resolved', evpi_percentage_points: 10.2 },
      { factor_id: 'n_hiring', evppi: 0.004, noise_floor: 0.01, units: 'outcome', method: 'regression_evppi_v1', status: 'below_resolution', evpi_percentage_points: 6.6 },
    ],
    decision_evpi: 1.75,
    p_win_sensitivity: [{ factor_id: 'n_market', delta_pp: 3.2 }],
    correlation_model: { active: false, suppressed_attributions: [] },
    inference_warnings: [{ code: 'FACTOR_EVPPI_PARTIAL', severity: 'warning' }],
  }

  const LABELS: Record<string, string> = {
    n_market: 'Market receptivity',
    n_comp: 'Competitor response',
    n_hiring: 'Hiring pace',
  }

  function renderFromWire() {
    const block = {
      type: 'analysis_result',
      summary: 'A summary',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 0.6, opt_b: 0.4 },
      enrichment: ENRICHMENT,
    } as unknown as AnalysisResultBlock
    const report = mapV5AnalysisToReport(block) as unknown as Record<string, unknown>
    const resolveNext = buildVoiRanking({
      rows: report.factor_evppi,
      inferenceWarnings: report.inference_warnings,
      resolveLabel: (id) => (LABELS[id] ? { label: LABELS[id], canFocus: true } : null),
    })
    render(
      <V7EvidenceDisclosure
        evidence={{ drivers: [], flipRisks: [], tradeOffs: [], resolveNext, designationsWithheld: false }}
      />,
    )
    openDisclosureHeader()
    switchEvidenceView('resolveNext')
    return { report, rendered: document.body.textContent ?? '' }
  }

  it('POSITIVE CONTROL: transport really did carry every pp value into the report', () => {
    // If the mapper had dropped them, "no pp in the DOM" would be proving that
    // the fixture was empty, not that the reader is a cage.
    const { report, rendered } = renderFromWire()
    expect(JSON.stringify(report)).toContain('evpi_percentage_points')
    expect(JSON.stringify(report)).toContain('12.3')
    expect(report.decision_evpi).toBe(1.75)
    expect(JSON.stringify(report.p_win_sensitivity)).toContain('3.2')
    // …and the view really did render the ranking built from that report.
    expect(rendered).toContain('Market receptivity')
    expect(screen.getAllByTestId('v7-resolve-next-row')).toHaveLength(2)
    expect(screen.getByTestId('v7-resolve-next-below')).toHaveTextContent('Hiring pace')
  })

  it('none of the banned vocabulary reaches the DOM from real wire bytes', () => {
    // R-1: iterated, not named — same reason as the two sweeps above. This is the
    // strongest of the three: the input is captured producer bytes, not a fixture.
    const { rendered } = renderFromWire()
    for (const [re, original] of REFUTED_CLAIM_CONTROLS) {
      expect(rendered, `banned pattern from live bytes (control: ${original})`).not.toMatch(re)
    }
  })

  it('none of the seeded magnitudes reaches the DOM in any form', () => {
    const { rendered } = renderFromWire()
    for (const magnitude of ['12.3', '10.2', '6.6', '0.9132', '0.913', '0.44', '0.004', '1.75', '3.2', '0.01']) {
      expect(rendered, `magnitude ${magnitude} must not render`).not.toContain(magnitude)
    }
  })
})
