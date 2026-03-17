/**
 * CausalClaimsSection — component rendering tests.
 * Phase 2A: Causal claims in edge inspector.
 *
 * Tests actual DOM rendering, expand/collapse, and empty state.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CausalClaimsSection } from '../panels/EdgePanel'

vi.mock('../../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))
vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    () => null,
    { getState: () => ({ currentScenarioId: null, currentStage: null }) },
  ),
}))

describe('CausalClaimsSection — component rendering', () => {
  it('renders empty state when no claims', () => {
    render(<CausalClaimsSection edgeId="edge-1" edgeData={{}} />)
    expect(screen.getByText('No scientific claims attached to this relationship.')).toBeTruthy()
  })

  it('renders claims with type pill and statement', () => {
    render(
      <CausalClaimsSection
        edgeId="edge-1"
        edgeData={{
          causal_claims: [
            { claim_type: 'empirical', statement: 'Evidence from RCT', source: 'Jones 2024' },
          ],
        }}
      />,
    )
    expect(screen.getByText('Empirical')).toBeTruthy()
    expect(screen.getByText('Evidence from RCT')).toBeTruthy()
    expect(screen.getByText('Jones 2024')).toBeTruthy()
  })

  it('shows max 3 claims with expand button', () => {
    render(
      <CausalClaimsSection
        edgeId="edge-1"
        edgeData={{
          causal_claims: [
            { claim_type: 'empirical', statement: 'Claim 1' },
            { claim_type: 'theoretical', statement: 'Claim 2' },
            { claim_type: 'mechanistic', statement: 'Claim 3' },
            { claim_type: 'definitional', statement: 'Claim 4' },
          ],
        }}
      />,
    )
    // First 3 visible
    expect(screen.getByText('Claim 1')).toBeTruthy()
    expect(screen.getByText('Claim 2')).toBeTruthy()
    expect(screen.getByText('Claim 3')).toBeTruthy()
    // 4th hidden
    expect(screen.queryByText('Claim 4')).toBeNull()
    // Expand button present
    expect(screen.getByText('and 1 more')).toBeTruthy()
  })

  it('expands to show all claims on click', () => {
    render(
      <CausalClaimsSection
        edgeId="edge-1"
        edgeData={{
          causal_claims: [
            { claim_type: 'a', statement: 'Claim 1' },
            { claim_type: 'b', statement: 'Claim 2' },
            { claim_type: 'c', statement: 'Claim 3' },
            { claim_type: 'd', statement: 'Claim 4' },
          ],
        }}
      />,
    )
    fireEvent.click(screen.getByText('and 1 more'))
    // All 4 now visible
    expect(screen.getByText('Claim 4')).toBeTruthy()
    // Collapse button present
    expect(screen.getByText('Show fewer')).toBeTruthy()
  })

  it('collapses back to max 3 on "Show fewer"', () => {
    render(
      <CausalClaimsSection
        edgeId="edge-1"
        edgeData={{
          causal_claims: [
            { claim_type: 'a', statement: 'Claim 1' },
            { claim_type: 'b', statement: 'Claim 2' },
            { claim_type: 'c', statement: 'Claim 3' },
            { claim_type: 'd', statement: 'Claim 4' },
          ],
        }}
      />,
    )
    fireEvent.click(screen.getByText('and 1 more'))
    fireEvent.click(screen.getByText('Show fewer'))
    expect(screen.queryByText('Claim 4')).toBeNull()
    expect(screen.getByText('and 1 more')).toBeTruthy()
  })

  it('does not show source when absent', () => {
    render(
      <CausalClaimsSection
        edgeId="edge-1"
        edgeData={{
          causal_claims: [
            { claim_type: 'empirical', statement: 'No source claim' },
          ],
        }}
      />,
    )
    expect(screen.getByText('No source claim')).toBeTruthy()
    // Only 2 text elements in the claim card: type pill + statement (no source)
    const card = screen.getByText('No source claim').closest('div')
    expect(card?.querySelectorAll('p').length).toBe(1) // only statement paragraph
  })
})
