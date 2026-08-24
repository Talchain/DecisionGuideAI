/**
 * EVPI display surfaces — the "Resolve next" view must not reopen them.
 *
 * A SIBLING of `results/__tests__/evpiSurfacesRemoved.honesty.spec.tsx`,
 * deliberately not an edit to it: that file imports and renders the ARCHIVED
 * `ConfidenceSection` as one of its harnesses, which makes the archived
 * component load-bearing evidence (recon
 * `PHASE0-EVIDENCE-2026-07-28/confidencesection-recon.md`). This file asserts
 * the SAME MATCHERS against the new surface — and imports them from
 * `results/__tests__/helpers/refutedEvpiClaimMatchers.ts` rather than
 * re-declaring them, so the banned vocabulary has ONE definition. Two copies of
 * an absence assertion's own definition is trap 13 with a delay fuse: narrow one
 * and the other keeps passing.
 *
 * ⚠ WHY IT LIVES IN `analysis-hero/__tests__/` AND NOT BESIDE ITS SIBLING.
 * `analysis-hero/__tests__/inertness.spec.ts` is a MOUNT GUARD: nothing outside
 * the module may import the analysis hero, except `ResultsBody` and the fixture
 * gallery route. Re-pointing this file at the hero disclosure therefore had to
 * MOVE it under the module rather than add an allow-list entry — an entry would
 * weaken the guard for every future importer, which is exactly the drift the
 * guard exists to stop. Its sibling stays where it is; the family is split by
 * host, and this comment is the pointer between the halves.
 *
 * ⭐ RE-POINTED BY THE V7 RETIREMENT — declared here, because silently moving a
 * guard is how a guard stops biting (CLAUDE.md 13b).
 *
 * WHAT CHANGED: every case below used to render `V7EvidenceDisclosure`, the
 * Resolve-next host on the temporary "Alt view" comparison tab. That component
 * and that tab are DELETED. Resolve next now has exactly one host —
 * `HeroEvidenceDisclosure`, inside the analysis cockpit on the DEFAULT Analysis
 * tab (Paul's ruling of 14 Aug 2026; mount path pinned in
 * `analysis-hero/__tests__/HeroEvidenceDisclosure.resolveNextOnAnalysisTab.spec.tsx`
 * §0). The CLAIMS are unchanged; only the host they are measured on has moved,
 * and it has moved onto the surface a post-run user actually loads. That half is
 * STRICTLY STRONGER.
 *
 * WHAT WAS DROPPED, AND WHY IT IS NOT RECONSTRUCTED: the old host rendered its
 * chips unconditionally and showed a GATE SENTENCE for a null ranking, so this
 * file had two cases about that sentence. This host removes the chip entirely
 * instead (a chip whose only destination is "not produced for this run" is a
 * dead end), so there is no gate sentence to sweep. The honest equivalent — the
 * absent ranking makes NO claim by any route — is asserted below against this
 * host's actual behaviour, and the chip-absence rule itself is pinned in the
 * hero spec named above (§2.2).
 *
 * WHY THE NEW SURFACE NEEDS ITS OWN ENTRY IN THIS FAMILY
 * ─────────────────────────────────────────────────────
 * `evpi_percentage_points` is refuted, and the sentence it wore
 * ("Worth 12.3pp if resolved", "resolving could improve confidence by …") is a
 * VALUE-OF-INFORMATION claim. The "Resolve next" view answers the same user
 * question from a DIFFERENT, real estimator (ISL's Strong–Oakley regression
 * EVPPI). That is exactly the circumstance in which the removed copy would come
 * back "under another name" — so the view is pinned against the identical
 * patterns, with the populated-render positive control in the same spec.
 *
 * ISL's numbers are in the decision's OUTCOME units and the view shows NO
 * magnitude at all, so these assertions should hold trivially. That is the
 * point: they are cheap, and they will fail the day someone adds a figure.
 *
 * CLAIM TYPE: rendered text / DOM presence within jsdom. NOT a visibility
 * claim — jsdom cannot prove layout, and nothing here asserts one.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'
import { HeroEvidenceDisclosure } from '../HeroEvidenceDisclosure'
import type { HeroEvidenceModel } from '../heroTypes'
import { buildVoiRanking, type VoiRanking } from '../../voi/voiRanking'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import {
  REFUTED_CLAIM_CONTROLS,
} from '../../__tests__/helpers/refutedEvpiClaimMatchers'

/**
 * ONE partial-over-defaults builder for this host's evidence model. Every field
 * on `HeroEvidenceModel` is REQUIRED by design (see the type's own comments: an
 * optional field every fixture omits is a hole with a green suite over it), so
 * the defaults are stated once here rather than in each case.
 *
 * `resolveNext: null` is the HONEST-GATE verdict, not an empty ranking — the
 * distinction is documented on the field declaration in `heroTypes.ts`.
 */
function heroEvidenceModel(partial: Partial<HeroEvidenceModel> = {}): HeroEvidenceModel {
  return {
    drivers: partial.drivers ?? [],
    flipRisks: partial.flipRisks ?? [],
    fragileEdgeRefs: partial.fragileEdgeRefs ?? [],
    tradeOffs: partial.tradeOffs ?? null,
    resolveNext: partial.resolveNext ?? null,
    designationsWithheld: partial.designationsWithheld ?? false,
    decisionVoi: partial.decisionVoi ?? 'not_computed',
    attributionSuppression: partial.attributionSuppression ?? 'not_attested',
    assumedStrength:
      partial.assumedStrength ?? { selected: null, refusalReason: 'no_fragile_edges', assumedFragileCount: 0 },
  }
}

/**
 * A NON-DEGENERATE ranking. ROADMAP 2.141 probe limit (i): the live rank-order
 * probe was VACUOUS because the run returned two zero-EVPPI factors, so any
 * order passed. This carries FOUR resolved rows with three DISTINCT producer
 * positions and a TIE PAIR at ranks 2-3, plus TWO below-resolution rows.
 */
function voiRankingFixture(partial: Partial<VoiRanking> = {}): VoiRanking {
  const row = (factorId: string, label: string, canFocus = true) => ({ factorId, label, canFocus })
  return {
    resolved: partial.resolved ?? [
      row('n_market', 'Market receptivity'),
      row('n_comp', 'Competitor response'),
      row('n_comp_eu', 'Competitor response (Europe)'),
      row('n_reg', 'Regulatory timeline'),
    ],
    belowResolution: partial.belowResolution ?? [
      row('n_hiring', 'Hiring pace'),
      row('n_brand', 'Brand halo'),
    ],
    someFactorsUnassessed: partial.someFactorsUnassessed ?? false,
  }
}

/** Open the disclosure header. */
function openDisclosureHeader(): void {
  // ⚠ `fireEvent`, NOT `node.click()`. The raw DOM call escapes React's `act()`,
  // so the disclosure never re-renders and every assertion afterwards reads a
  // COLLAPSED section — a false green that looks exactly like a real one.
  fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
}

/**
 * Select the Resolve next view on an already-open disclosure.
 *
 * ⚠ THE CHIP STRIP IS CONDITIONAL ON THIS HOST (`views.length > 1`): when
 * Resolve next is the run's ONLY evidence, the single remaining view is
 * auto-selected and there is no chip to click. Clicking unconditionally would
 * make every case below fail for a reason that has nothing to do with the claim.
 * The view's own presence is asserted afterwards, so a silent selection failure
 * cannot be mistaken for a clean sweep.
 */
function switchToResolveNext(): void {
  const chip = screen.queryByTestId('hero-evidence-tab-resolveNext')
  if (chip) fireEvent.click(chip)
}

/**
 * Render the disclosure, open it, switch to Resolve next, and return the VIEW's
 * own text.
 *
 * ⚠ THE HAYSTACK IS THE VIEW SUBTREE, scoped to the element the claim is about
 * (CLAUDE.md trap 16: a sweep proves what it was pointed at). This host renders
 * every resolved row — there is no clamp — so the view's text IS its whole
 * content and nothing is hidden from the sweep.
 */
function renderResolveNext(evidence: HeroEvidenceModel): string {
  render(<HeroEvidenceDisclosure evidence={evidence} />)
  openDisclosureHeader()
  switchToResolveNext()
  return screen.getByTestId('hero-evidence-resolve-next').textContent ?? ''
}

/**
 * A POPULATED ranking — the honest-gate state would prove nothing here. Four
 * resolved rows, two below-resolution rows, and the PARTIAL disclosure on.
 */
function populated(): HeroEvidenceModel {
  return heroEvidenceModel({
    resolveNext: voiRankingFixture({ someFactorsUnassessed: true }),
  })
}

describe('Resolve next — the refuted EVPI claim does not come back here', () => {
  it('POSITIVE CONTROL: the harness renders the populated ranking it is scanning', () => {
    // Trap 13. Without this, every assertion below could be passing because the
    // view rendered its empty state, or nothing at all.
    const text = renderResolveNext(populated())
    expect(screen.getByTestId('hero-evidence-resolve-next')).toBeInTheDocument()
    expect(screen.getAllByTestId('hero-resolve-next-row')).toHaveLength(4)
    expect(screen.getByTestId('hero-resolve-next-below')).toBeInTheDocument()
    expect(screen.getByTestId('hero-resolve-next-partial')).toBeInTheDocument()
    expect(text).toContain('Market receptivity')
    expect(text).toContain('Hiring pace')
  })

  it('POSITIVE CONTROL: each matcher fires on the string it was written to catch', () => {
    // Trap 13, applied to the matchers' HOME: the definitions live in a shared
    // module, so this control also proves the import resolved to real patterns
    // rather than to `undefined` (a bad import would otherwise make every
    // `.not.toMatch` below throw, but an over-broad one would not).
    expect(REFUTED_CLAIM_CONTROLS.length).toBeGreaterThanOrEqual(6)
    for (const [re, original] of REFUTED_CLAIM_CONTROLS) {
      expect(re.test(original), `matcher must see: ${original}`).toBe(true)
    }
  })

  /**
   * ⭐ R-1 — ITERATE THE VOCABULARY, DO NOT NAME PATTERNS.
   *
   * These assertions used to be three named-pattern checks (`PP_TOKEN`,
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
    render(<HeroEvidenceDisclosure evidence={heroEvidenceModel({ resolveNext: null })} />)
    // Nothing at all to disclose → the whole section is absent, which is itself
    // the honest outcome (never an empty shell).
    expect(screen.queryByTestId('hero-evidence-disclosure')).not.toBeInTheDocument()
  })

  it('an ABSENT ranking makes no claim by any route, even when a sibling view has data', () => {
    // The old host rendered a chip plus a gate SENTENCE here; this host removes
    // the chip, so the honest claim to pin is that no value-of-information
    // vocabulary reaches the user by any route on a run with no ranking.
    render(
      <HeroEvidenceDisclosure
        evidence={heroEvidenceModel({
          drivers: [
            { rank: 1, label: 'Price', targetId: null, isEstimate: 'undetermined', direction: null, influence: null },
          ],
          resolveNext: null,
        })}
      />,
    )
    openDisclosureHeader()
    // POSITIVE CONTROL: the disclosure genuinely opened and painted the sibling
    // view, so the absences below are absences from a real render.
    expect(screen.getByTestId('hero-evidence-drivers')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-evidence-tab-resolveNext')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-evidence-resolve-next')).not.toBeInTheDocument()
    // R-1: the whole vocabulary, iterated. See the note on the populated sweep.
    const text = screen.getByTestId('hero-evidence-disclosure').textContent ?? ''
    for (const [re, original] of REFUTED_CLAIM_CONTROLS) {
      expect(text, `banned pattern in the GATE state (control: ${original})`).not.toMatch(re)
    }
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
    render(<HeroEvidenceDisclosure evidence={heroEvidenceModel({ resolveNext })} />)
    openDisclosureHeader()
    switchToResolveNext()
    // PRECONDITION, pinned in-test (trap 13b): the view really is on screen, so
    // the absence sweeps below are absences from a rendered ranking rather than
    // from a disclosure that never opened.
    expect(screen.getByTestId('hero-evidence-resolve-next')).toBeInTheDocument()
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
    expect(screen.getAllByTestId('hero-resolve-next-row')).toHaveLength(2)
    expect(screen.getByTestId('hero-resolve-next-below')).toHaveTextContent('Hiring pace')
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
