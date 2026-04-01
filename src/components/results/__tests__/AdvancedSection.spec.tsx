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
  it('renders accordion with "Advanced" title', () => {
    render(<AdvancedSection />)

    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })

  it('renders risk tolerance preset buttons', () => {
    render(<AdvancedSection />)

    // Expand accordion first
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByRole('radio', { name: /Risk Averse/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Neutral/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Risk Seeking/i })).toBeInTheDocument()
  })

  it('renders stability percentage when provided', () => {
    render(<AdvancedSection stability={0.85} expertMode />)
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Stability')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('renders convergence sample count', () => {
    render(<AdvancedSection nSamples={10000} expertMode />)
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Simulation quality')).toBeInTheDocument()
    expect(screen.getByText('10,000 simulations')).toBeInTheDocument()
  })

  it('renders fragile and stable edge counts', () => {
    render(<AdvancedSection fragileEdgeCount={3} robustEdgeCount={12} expertMode />)
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Sensitive assumptions')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Stable edges')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders graph size with node and edge counts', () => {
    render(<AdvancedSection nodeCount={15} edgeCount={22} expertMode />)
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Graph size')).toBeInTheDocument()
    expect(screen.getByText('15 nodes, 22 edges')).toBeInTheDocument()
  })

  it('renders identifiability tag', () => {
    render(<AdvancedSection identifiability="identifiable" expertMode />)
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Identifiability')).toBeInTheDocument()
    expect(screen.getByText('Identifiable')).toBeInTheDocument()
  })

  it('formats underscored identifiability tag', () => {
    render(<AdvancedSection identifiability="not_identifiable" expertMode />)
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Not identifiable')).toBeInTheDocument()
  })

  it('renders seed value', () => {
    render(<AdvancedSection seedUsed={42} expertMode />)
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Seed')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders truncated hash with copy button', () => {
    render(<AdvancedSection responseHash="abc123def456ghi789" expertMode />)
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Hash')).toBeInTheDocument()
    expect(screen.getByText('abc123def456…')).toBeInTheDocument()
    expect(screen.getByLabelText('Copy hash to clipboard')).toBeInTheDocument()
  })

  it('hides detail rows when values are not provided', () => {
    render(<AdvancedSection expertMode />)
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.queryByText('Stability')).not.toBeInTheDocument()
    expect(screen.queryByText('Simulation quality')).not.toBeInTheDocument()
    expect(screen.queryByText('Hash')).not.toBeInTheDocument()
  })

  it('hides analysis details section in default (non-expert) mode', () => {
    render(<AdvancedSection stability={0.85} nSamples={5000} />)
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.queryByText('Analysis details')).not.toBeInTheDocument()
    expect(screen.queryByText('Stability')).not.toBeInTheDocument()
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
    fireEvent.click(screen.getByText('Advanced'))

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
