import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  AdvancedSection,
  translateFreshnessReason,
  FRESHNESS_RECEIPT_D1_MODE,
  RiskAppetiteFilter,
} from '../AdvancedSection'

// Mock useRiskProfile hook
vi.mock('../../../canvas/hooks/useRiskProfile', () => ({
  useRiskProfile: () => ({
    profile: null,
    loading: false,
    selectPreset: vi.fn(),
  }),
  RISK_PRESETS: {
    risk_averse: { label: 'Risk Averse', description: 'Prefer certainty', icon: '', score: 0.2 },
    neutral: { label: 'Neutral', description: 'Balance risk', icon: '', score: 0.5 },
    risk_seeking: { label: 'Risk Seeking', description: 'Accept higher risk', icon: '', score: 0.8 },
  },
}))

describe('AdvancedSection', () => {
  it('renders accordion with "Advanced and receipts" title', () => {
    render(<AdvancedSection />)

    expect(screen.getByText('Advanced and receipts')).toBeInTheDocument()
  })

  it('renders risk profile preset buttons', () => {
    render(<AdvancedSection />)

    // Expand accordion first
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByRole('radio', { name: /Risk Averse/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Neutral/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Risk Seeking/i })).toBeInTheDocument()
  })

  // Brief 5 Phase 2 (Task 6): disambiguate label + helper copy so users don't
  // confuse this persistent-profile control with the local display-filter in
  // ResultsBody's "Your options" card. Paul-approved copy frozen in
  // docs/brief-5-preflight-findings.md.
  it('risk-profile control uses Paul-frozen label + helper copy', () => {
    const { container } = render(<AdvancedSection />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    const control = container.querySelector('[data-testid="risk-profile-control"]')
    expect(control).toBeTruthy()
    // Label (heading replaces "Risk tolerance")
    expect(control).toHaveTextContent('Risk profile')
    // Helper copy — semantic distinction from display-filter control
    expect(control).toHaveTextContent(
      /Persistent profile:\s*used when analysis is rerun\./,
    )
    // Radiogroup aria-label tracks the visible label
    expect(control?.querySelector('[role="radiogroup"]')).toHaveAttribute(
      'aria-label',
      'Risk profile',
    )
  })

  // ── B1 receipts: Result-stability row keyed on the display-safe verdict ──
  // (premise 1) — NEVER the deprecated recommendation_stability. The mapping
  // is the shared ROBUSTNESS-VERDICT-CONTRACT (derivePostFooterStatus).
  it('renders "Stable result" for a robust display verdict', () => {
    render(<AdvancedSection robustnessVerdict="robust" />)
    fireEvent.click(screen.getByText('Advanced and receipts'))
    const row = screen.getByTestId('receipt-result-stability')
    expect(row).toHaveTextContent('Result stability')
    expect(row).toHaveTextContent('Stable result')
  })

  it('renders "Sensitive to assumptions" for moderate and fragile verdicts', () => {
    const { rerender } = render(<AdvancedSection robustnessVerdict="moderate" />)
    fireEvent.click(screen.getByText('Advanced and receipts'))
    expect(screen.getByTestId('receipt-result-stability')).toHaveTextContent('Sensitive to assumptions')
    rerender(<AdvancedSection robustnessVerdict="fragile" />)
    expect(screen.getByTestId('receipt-result-stability')).toHaveTextContent('Sensitive to assumptions')
  })

  it('renders "Robustness not assessed" for the producer not_assessed verdict', () => {
    render(<AdvancedSection robustnessVerdict="not_assessed" />)
    fireEvent.click(screen.getByText('Advanced and receipts'))
    expect(screen.getByTestId('receipt-result-stability')).toHaveTextContent('Robustness not assessed')
  })

  // Fail-closed doctrine: an ABSENT verdict renders NO row (never a
  // "Robustness unknown" placeholder row — no row beats an empty-value row).
  it('renders NO Result-stability row when the verdict is missing (fail-closed)', () => {
    render(<AdvancedSection />)
    fireEvent.click(screen.getByText('Advanced and receipts'))
    expect(screen.queryByTestId('receipt-result-stability')).not.toBeInTheDocument()
    expect(screen.queryByText('Result stability')).not.toBeInTheDocument()
    expect(screen.queryByText('Robustness unknown')).not.toBeInTheDocument()
  })

  // NEGATIVE PIN (premise 1): AdvancedSection renders NO
  // recommendation_stability-sourced value. The fixture's 0.4375 (== the
  // leader's win probability, the deprecated stability's exact value) must
  // never surface as a percentage. Mutation: re-add the old Stability % row →
  // this goes RED.
  it('renders NO recommendation_stability-sourced value (negative pin)', () => {
    render(<AdvancedSection stability={0.4375} robustnessVerdict="robust" nSamples={1000} />)
    fireEvent.click(screen.getByText('Advanced and receipts'))
    // The deprecated stability % (44% / 43%) must not appear anywhere.
    expect(screen.queryByText('44%')).not.toBeInTheDocument()
    expect(screen.queryByText('43%')).not.toBeInTheDocument()
    // Nor the old "Stability" dt label.
    expect(screen.queryByText('Stability')).not.toBeInTheDocument()
    // The honest verdict row is what shows instead.
    expect(screen.getByTestId('receipt-result-stability')).toHaveTextContent('Stable result')
  })

  it('renders convergence sample count', () => {
    render(<AdvancedSection nSamples={10000} expertMode />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByText('Simulation quality')).toBeInTheDocument()
    expect(screen.getByText('10,000 simulations')).toBeInTheDocument()
  })

  it('renders fragile and stable edge counts', () => {
    render(<AdvancedSection fragileEdgeCount={3} robustEdgeCount={12} expertMode />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByText('Sensitive assumptions')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Stable edges')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders graph size with node and edge counts', () => {
    render(<AdvancedSection nodeCount={15} edgeCount={22} expertMode />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByText('Graph size')).toBeInTheDocument()
    expect(screen.getByText('15 nodes, 22 edges')).toBeInTheDocument()
  })

  it('renders identifiability tag', () => {
    render(<AdvancedSection identifiability="identifiable" expertMode />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByText('Identifiability')).toBeInTheDocument()
    expect(screen.getByText('Identifiable')).toBeInTheDocument()
  })

  it('formats underscored identifiability tag', () => {
    render(<AdvancedSection identifiability="not_identifiable" expertMode />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByText('Not identifiable')).toBeInTheDocument()
  })

  it('renders seed value', () => {
    render(<AdvancedSection seedUsed={42} expertMode />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByText('Seed')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders truncated hash with copy button', () => {
    render(<AdvancedSection responseHash="abc123def456ghi789" expertMode />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByText('Hash')).toBeInTheDocument()
    expect(screen.getByText('abc123def456…')).toBeInTheDocument()
    expect(screen.getByLabelText('Copy hash to clipboard')).toBeInTheDocument()
  })

  // Brief 5 Phase 1 (Task 4): DS v5 icon-only interactive — both aria-label AND tooltip.
  it('copy-hash button has both aria-label and native title (DS v5 a11y parity)', () => {
    render(<AdvancedSection responseHash="abc123def456ghi789" expertMode />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    const copyBtn = screen.getByLabelText('Copy hash to clipboard')
    expect(copyBtn).toHaveAttribute('aria-label', 'Copy hash to clipboard')
    expect(copyBtn).toHaveAttribute('title', 'Copy hash to clipboard')
  })

  // Parity rebuild 2026-07-13: receipts are for EVERYONE per the prototype
  // ('Result hash — 8ce04678…' is a first-class receipt row). This REVERSES
  // the Brief 5 Phase 1 Task 4 expert-mode gate — deliberate, called out in
  // the lane report for veto. The hash stays truncated with a copy control.
  it('renders the truncated hash WITHOUT expertMode (receipts for everyone)', () => {
    render(<AdvancedSection responseHash="abc123def456ghi789" />)
    fireEvent.click(screen.getByText('Advanced and receipts'))
    expect(screen.getByTestId('advanced-hash-row')).toBeInTheDocument()
    expect(screen.getByText('abc123def456…')).toBeInTheDocument()
  })

  it('renders the hash row when the accordion auto-expands via inferenceWarnings', () => {
    render(
      <AdvancedSection
        responseHash="9b1634d2abcdef"
        inferenceWarnings={[{ code: 'weak_evidence', message: 'Low evidence on 3 factors' }]}
      />,
    )
    expect(screen.getByTestId('advanced-hash-row')).toBeInTheDocument()
  })

  // P0-3 fold (external review 2026-07-14): the Advanced accordion humanises
  // inference-warning copy by `code` via the shared view model — it must NEVER
  // render the raw producer `message`, which carries internal identifiers.
  // Against the pre-fix source (which rendered `<span>{w.message}</span>`) the
  // internal-token assertions below fail; they pass once humanised.
  it('humanises inference-warning copy by code and never leaks the raw producer message (internal identifiers)', () => {
    const rawMessage = 'constraint_fac_customer_churn_max observed_state.value intercept=0'
    render(
      <AdvancedSection
        inferenceWarnings={[{ code: 'CONSTRAINT_NODE_DEFAULT_BASE', message: rawMessage }]}
      />,
    )
    const region = screen.getByTestId('trust-inference-warnings')
    expect(region).toBeInTheDocument()
    // No internal identifiers/implementation terminology leak into the UI…
    expect(region.textContent ?? '').not.toContain('observed_state')
    expect(region.textContent ?? '').not.toContain('intercept=0')
    expect(region.textContent ?? '').not.toContain('constraint_fac_customer_churn_max')
    // …and some user-safe humanised copy is present.
    expect((region.textContent ?? '').trim().length).toBeGreaterThan(0)
  })

  // Brief 5.2 Task 8c: Gauge icon on the Risk profile heading was shipped
  // in Brief 5.1 Task 6. Lock it via a regression test so future icon-dict
  // refactors don't quietly drop it.
  it('Risk profile heading renders the Gauge icon (Brief 5.1 Task 6 / Brief 5.2 Task 8c)', () => {
    const { container } = render(<AdvancedSection />)
    fireEvent.click(screen.getByText('Advanced and receipts'))
    const heading = container.querySelector('[data-testid="risk-profile-control"] h4')
    expect(heading).toBeTruthy()
    // Heading contains an SVG (the Lucide Gauge). aria-hidden so it does not
    // duplicate the visible "Risk profile" label for screen readers.
    const icon = heading!.querySelector('svg')
    expect(icon).toBeTruthy()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('hides detail rows when values are not provided', () => {
    render(<AdvancedSection expertMode />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.queryByText('Stability')).not.toBeInTheDocument()
    expect(screen.queryByText('Simulation quality')).not.toBeInTheDocument()
    expect(screen.queryByText('Hash')).not.toBeInTheDocument()
  })

  it('renders analysis details in default (non-expert) mode — receipts are for everyone', () => {
    render(<AdvancedSection robustnessVerdict="robust" nSamples={5000} />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByText('Analysis details')).toBeInTheDocument()
    expect(screen.getByText('Result stability')).toBeInTheDocument()
    expect(screen.getByText('5,000 simulations')).toBeInTheDocument()
  })

  it('renders all analysis details together', () => {
    render(
      <AdvancedSection
        robustnessVerdict="robust"
        nSamples={5000}
        fragileEdgeCount={2}
        robustEdgeCount={8}
        nodeCount={10}
        edgeCount={18}
        identifiability="identifiable"
        seedUsed={99}
        responseHash="hash1234567890abcdef"
        expertMode
      />
    )
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByTestId('receipt-result-stability')).toHaveTextContent('Stable result')
    expect(screen.getByText('5,000 simulations')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('10 nodes, 18 edges')).toBeInTheDocument()
    expect(screen.getByText('Identifiable')).toBeInTheDocument()
    expect(screen.getByText('99')).toBeInTheDocument()
    expect(screen.getByText('hash12345678…')).toBeInTheDocument()
  })

  // ── B1 receipts: Simulations row path-conditional honesty (premise 2) ────
  describe('Simulations row — path-conditional honesty', () => {
    it('omits the Simulations row when nSamples is null (V5-path fail-closed)', () => {
      // On a pure V5 turn `meta` is stripped upstream so nSamples is null.
      render(<AdvancedSection nSamples={null} robustnessVerdict="robust" />)
      fireEvent.click(screen.getByText('Advanced and receipts'))
      expect(screen.queryByText('Simulation quality')).not.toBeInTheDocument()
      expect(screen.queryByText(/simulations$/)).not.toBeInTheDocument()
    })

    it('shows the count only when the run carries it (V2 path)', () => {
      render(<AdvancedSection nSamples={1000} robustnessVerdict="robust" />)
      fireEvent.click(screen.getByText('Advanced and receipts'))
      expect(screen.getByText('Simulation quality')).toBeInTheDocument()
      expect(screen.getByText('1,000 simulations')).toBeInTheDocument()
    })
  })

  // ── B1 receipts: Freshness receipt row — D1 both branches (premise 3) ────
  describe('Freshness receipt row (D1 ask #16)', () => {
    it('translates ONLY known reason codes; unknown/absent fail closed to null', () => {
      expect(translateFreshnessReason('graph_hash_match')).toBe('Graph hash match')
      expect(translateFreshnessReason('graph_hash_mismatch')).toBe('Model changed since this analysis')
      // Unknown wire strings are NEVER echoed — they fail closed.
      expect(translateFreshnessReason('some_unmapped_internal_code')).toBeNull()
      expect(translateFreshnessReason(undefined)).toBeNull()
      expect(translateFreshnessReason(null)).toBeNull()
      expect(translateFreshnessReason('')).toBeNull()
    })

    it('mounted branch is the fail-closed default: the row is omitted even with a known reason', () => {
      // The un-ruled D1 default: FRESHNESS_RECEIPT_D1_MODE === 'omit'. Flipping
      // that single constant to 'translate' activates the row (no rebuild, no
      // runtime flag) — asserted here so a drift of the default is caught.
      expect(FRESHNESS_RECEIPT_D1_MODE).toBe('omit')
      render(<AdvancedSection freshnessReason="graph_hash_match" robustnessVerdict="robust" />)
      fireEvent.click(screen.getByText('Advanced and receipts'))
      expect(screen.queryByTestId('receipt-freshness')).not.toBeInTheDocument()
      expect(screen.queryByText('Graph hash match')).not.toBeInTheDocument()
    })
  })

  // ── B1 receipts: local hash labelled local (premise 4) ───────────────────
  describe('Result hash provenance labelling', () => {
    it('labels a producer hash "Hash" (no local suffix)', () => {
      render(<AdvancedSection responseHash="abc123def456ghi789" responseHashIsLocal={false} />)
      fireEvent.click(screen.getByText('Advanced and receipts'))
      const row = screen.getByTestId('advanced-hash-row')
      expect(row).toHaveTextContent('Hash')
      expect(row).not.toHaveTextContent('local')
    })

    it('labels a device-derived hash "Hash (local)" so it is not read as engine identity', () => {
      render(<AdvancedSection responseHash="abc123def456ghi789" responseHashIsLocal />)
      fireEvent.click(screen.getByText('Advanced and receipts'))
      expect(screen.getByText('Hash (local)')).toBeInTheDocument()
    })
  })

  // ── B1 receipts: Seed row stays absent when there is no real seed ────────
  // (premise 5, assert-only). T2 (#326) fails the V5 path closed to null; this
  // pins the fail-closed absence at the display layer.
  it('omits the Seed row when seedUsed is null (fail-closed, no fabricated 0)', () => {
    render(<AdvancedSection seedUsed={null} robustnessVerdict="robust" />)
    fireEvent.click(screen.getByText('Advanced and receipts'))
    expect(screen.queryByText('Seed')).not.toBeInTheDocument()
  })

  // ── V7 L6 row 12: receipt labels name the real wire meta field ──────────
  it('names the real wire fields on the Seed and Simulation rows (row 12)', () => {
    render(<AdvancedSection nSamples={1000} seedUsed={42} />)
    fireEvent.click(screen.getByText('Advanced and receipts'))
    expect(screen.getByText('Seed')).toHaveAttribute('title', 'meta.seed')
    expect(screen.getByText('Simulation quality')).toHaveAttribute('title', 'meta.n_samples')
  })
})

// ── F10 ──────────────────────────────────────────────────────────────────
// This sentence has existed since AdvancedSection was written and NO CALL
// SITE PASSED ITS PROPS — `ResultsBody` omitted both. The one honest
// disclosure the product had about its own defaults was dead in the tree
// while five other surfaces printed the defaults themselves. These tests
// pin the rendering contract; `ResultsBody` now supplies the counts,
// derived from the same `isDefaultedConfidence` flag the Drivers panel's
// "Default estimate" pill uses.
describe('AdvancedSection — the default-estimate disclosure (F10)', () => {
  // NOTE: deliberately NO `trustLevel` / `trustReason`. The sentence used to
  // live inside a paragraph gated on those two props, which no call site
  // supplies — so a test that passed `trustLevel` would have gone green while
  // the product showed nothing.
  function renderExpanded(props: Record<string, unknown>) {
    render(<AdvancedSection {...props} />)
    fireEvent.click(screen.getByText('Advanced and receipts'))
  }

  it('POSITIVE CONTROL: states the count when the props arrive', () => {
    renderExpanded({ defaultEstimateCount: 3, totalFactorCount: 7 })
    expect(
      screen.getByText(/3 of 7 factors use default confidence values\./),
    ).toBeInTheDocument()
  })

  it('says nothing when NO factor uses a default (never "0 of 7")', () => {
    renderExpanded({ defaultEstimateCount: 0, totalFactorCount: 7 })
    expect(screen.queryByText(/default confidence values/)).not.toBeInTheDocument()
  })

  it('says nothing when the counts are absent (never fabricates a zero)', () => {
    renderExpanded({})
    expect(screen.queryByText(/default confidence values/)).not.toBeInTheDocument()
  })
})

// ── ROADMAP 1.243 item 4 — the lens label ────────────────────────────────────
//
// ⛔ THE ADJUDICATION BELOW WAS FALSE AT THE BYTES, AND IS WITHDRAWN
//    (ROADMAP 2.237, 2026-08-01).
//
// It read: "LEAVE the label, do NOT relabel. 'Rank by outcome:' takes no option
// as its object — it names the SORT KEY of a display filter."
//
// **There is no lens sort key.** `sortOptionsForDisplay` takes no lens argument;
// the list is ordered by `winProbability`, truncated by that order, and stamped
// with ordinals from it. The lens reaches the cards only as a CROWN on one card.
// So the adjudication cleared the label by asserting a mechanism that does not
// exist — and because it was written as a settled verdict, it is exactly the
// sentence nobody re-checked. (CLAUDE.md trap 14: an honest label can be
// overwritten by a false one; the most rhetorically useful sentence in an
// argument is the one nobody checks.)
//
// The label is now "Highlight by outcome:", which names what the control does.
// The reasoning below about the DISCLAIMER being load-bearing is untouched and
// still correct — it is the only part of this block that survived checking.
//
// But that verdict RESTS ON the disclaimer beneath it (Paul's ruling
// 2026-07-12), and the disclaimer had ZERO test references at a79683e4 — the
// one sentence that makes the label honest could have been dropped in a tidy-up
// with nothing going red. Pinned here, so the reasoning that leaves the label
// alone is enforced rather than merely asserted. If this sentence ever goes,
// the label needs re-adjudicating, and now it will say so.
describe('RiskAppetiteFilter — the lens disclaimer is load-bearing (1.243 item 4)', () => {
  /**
   * F3: the sentence names what the lens leaves UNCHANGED, and that depends on
   * whether the run has a goal ranking at all — on a no-target run there is
   * none, so naming one would assert something the panel is simultaneously
   * offering to unlock. Both arms are asserted here; pinning only one would
   * let the gate be deleted in either direction without a red.
   */
  it('no goal numbers: the lens sentence names the comparative ranking, not a goal one', () => {
    render(<RiskAppetiteFilter value="neutral" onChange={vi.fn()} />)
    // Positive control: the component mounted, so the assertion below is not
    // passing against an empty render.
    expect(screen.getByText('Highlight by outcome:')).toBeInTheDocument()
    expect(
      screen.getByText(
        'A view lens over the outcome range. The comparative ranking above is unchanged.',
      ),
    ).toBeInTheDocument()
  })

  it('goal numbers present: the lens sentence names the goal ranking', () => {
    render(<RiskAppetiteFilter value="neutral" onChange={vi.fn()} hasGoalNumbers />)
    expect(
      screen.getByText('A view lens over the outcome range. The goal ranking above is unchanged.'),
    ).toBeInTheDocument()
  })
})
