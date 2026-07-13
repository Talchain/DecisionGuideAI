import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdvancedSection } from '../AdvancedSection'

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

  it('renders stability percentage when provided', () => {
    render(<AdvancedSection stability={0.85} expertMode />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByText('Stability')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
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
    render(<AdvancedSection stability={0.85} nSamples={5000} />)
    fireEvent.click(screen.getByText('Advanced and receipts'))

    expect(screen.getByText('Analysis details')).toBeInTheDocument()
    expect(screen.getByText('Stability')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('renders all analysis details together', () => {
    render(
      <AdvancedSection
        stability={0.72}
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

    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getByText('5,000 simulations')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('10 nodes, 18 edges')).toBeInTheDocument()
    expect(screen.getByText('Identifiable')).toBeInTheDocument()
    expect(screen.getByText('99')).toBeInTheDocument()
    expect(screen.getByText('hash12345678…')).toBeInTheDocument()
  })
})
