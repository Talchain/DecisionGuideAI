/**
 * receipts fail-closed — doctrine pin (T2)
 *
 * The "Advanced and receipts → Analysis details" grid renders REAL values
 * only; every row fails closed (hides) when its value is absent. This spec
 * pins the doctrine at the component boundary so a future upstream mapper
 * can never resurrect the "Seed 0" / "Stable edges 0" fabrication bug: the
 * component treats null/undefined as "no value → no row", while an honest
 * producer-sent zero still displays.
 *
 * Upstream halves of the same doctrine:
 * - src/v5/__tests__/mapV5AnalysisToReport.test.ts ("receipts fail closed")
 * - src/hooks/__tests__/hydrateAnalysis.spec.ts (seed null fallbacks)
 * - src/canvas/conversation/__tests__/envelopeAnalysisWiring.spec.ts
 *   ("receipts fail closed — envelope seed provenance")
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdvancedSection } from '../AdvancedSection'

// Mock useRiskProfile hook (same as AdvancedSection.spec.tsx)
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

function expand() {
  fireEvent.click(screen.getByText('Advanced and receipts'))
}

describe('receipts fail closed — AdvancedSection Analysis details', () => {
  it('seedUsed null → no Seed row', () => {
    render(<AdvancedSection seedUsed={null} expertMode />)
    expand()

    expect(screen.queryByText('Seed')).not.toBeInTheDocument()
  })

  it('seedUsed undefined → no Seed row', () => {
    render(<AdvancedSection expertMode />)
    expand()

    expect(screen.queryByText('Seed')).not.toBeInTheDocument()
  })

  it('seedUsed 0 is an honest value → Seed row shows 0', () => {
    render(<AdvancedSection seedUsed={0} expertMode />)
    expand()

    expect(screen.getByText('Seed')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('robustEdgeCount undefined → no Stable edges row', () => {
    render(<AdvancedSection expertMode />)
    expand()

    expect(screen.queryByText('Stable edges')).not.toBeInTheDocument()
  })

  it('robustEdgeCount 0 is an honest zero → Stable edges row shows 0', () => {
    render(<AdvancedSection robustEdgeCount={0} expertMode />)
    expand()

    expect(screen.getByText('Stable edges')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('fragileEdgeCount undefined → no Sensitive assumptions row', () => {
    render(<AdvancedSection expertMode />)
    expand()

    expect(screen.queryByText('Sensitive assumptions')).not.toBeInTheDocument()
  })

  it('fragileEdgeCount 0 is an honest zero → Sensitive assumptions row shows 0', () => {
    render(<AdvancedSection fragileEdgeCount={0} expertMode />)
    expand()

    expect(screen.getByText('Sensitive assumptions')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('a receipts grid with NO real values renders no fabricated rows at all', () => {
    render(
      <AdvancedSection
        seedUsed={null}
        stability={null}
        nSamples={null}
        identifiability={null}
        responseHash={null}
        expertMode
      />,
    )
    expand()

    const receipts = screen.getByTestId('analysis-receipts')
    // The dl grid exists but carries no rows — nothing was fabricated.
    expect(receipts.querySelectorAll('dt')).toHaveLength(0)
  })
})
