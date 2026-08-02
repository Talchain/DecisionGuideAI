/**
 * V7SignalRow — flip-risk honesty (ROADMAP 2.276).
 *
 * Both cases below are the WITNESSED staging run 3 (`r3-turn-2.json`, UI
 * `a27cadf7`): six flip thresholds, ALL `structurally_invariant`, and a
 * fragile-edge array whose head — after the `marginal_switch_probability`
 * sort applied upstream in `useResultsSectionData` — is the row with
 * `switch_probability: 0.1485` and `from_label: 'Hybrid Delivery Approach'`.
 *
 * That produced the on-screen "15% flip risk · Hybrid Delivery Approach"
 * while the hero, two elements away, said "Top flip risk: Vendor Platform Fit".
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V7SignalRow } from '../V7SignalRow'

/** Head of the upstream-sorted array on the witnessed turn. */
const WITNESSED_FRAGILE_EDGES = [
  {
    edge_id: 'fac_hybrid_indicator->risk_deadline_miss',
    from_id: 'fac_hybrid_indicator',
    from_label: 'Hybrid Delivery Approach',
    to_label: 'Deadline Miss Risk',
    switch_probability: 0.1485,
  },
  {
    edge_id: 'fac_vendor_fit->risk_vendor_lock',
    from_id: 'fac_vendor_fit',
    from_label: 'Vendor Platform Fit',
    to_label: 'Vendor Lock-In and Fit Gap',
    switch_probability: 0.314,
  },
]

const ALL_INVARIANT_THRESHOLDS = [
  { node_id: 'fac_build_indicator', flip_value: null, flip_reason: 'structurally_invariant' },
  { node_id: 'fac_buy_indicator', flip_value: null, flip_reason: 'structurally_invariant' },
  { node_id: 'fac_eng_productivity', flip_value: null, flip_reason: 'structurally_invariant' },
  { node_id: 'fac_hybrid_indicator', flip_value: null, flip_reason: 'structurally_invariant' },
  { node_id: 'fac_req_change_rate', flip_value: null, flip_reason: 'structurally_invariant' },
  { node_id: 'fac_vendor_fit', flip_value: null, flip_reason: 'structurally_invariant' },
]

describe('V7SignalRow — flip-risk chip honesty', () => {
  it('renders NO flip-risk chip when every producer flip threshold is non-flipping', () => {
    render(
      <V7SignalRow
        fragileEdges={WITNESSED_FRAGILE_EDGES}
        flipThresholds={ALL_INVARIANT_THRESHOLDS}
        topDrivers={[]}
      />,
    )
    expect(screen.queryByTestId('v7-signal-flip-risk')).toBeNull()
  })

  it('prints no percentage at all on a zero-flip turn', () => {
    const { container } = render(
      <V7SignalRow
        fragileEdges={WITNESSED_FRAGILE_EDGES}
        flipThresholds={ALL_INVARIANT_THRESHOLDS}
        topDrivers={[]}
      />,
    )
    // The witnessed "15%" must not survive anywhere in the row.
    expect(container.textContent ?? '').not.toMatch(/%/)
    expect(container.textContent ?? '').not.toContain('Hybrid Delivery Approach')
  })

  it('ranks by the SAME metric it displays — never the positional head', () => {
    // No flip thresholds → legacy ranking, but by switch_probability (the
    // number the chip prints), not by the upstream marginal sort order.
    render(<V7SignalRow fragileEdges={WITNESSED_FRAGILE_EDGES} topDrivers={[]} />)
    const chip = screen.getByTestId('v7-signal-flip-risk')
    // 0.314 (Vendor Platform Fit) outranks the positional head's 0.1485.
    expect(chip.textContent).toContain('Vendor Platform Fit')
    expect(chip.textContent).toContain('31%')
    expect(chip.textContent).not.toContain('15%')
  })

  it('names only a factor the producer says flips, when flips are real', () => {
    render(
      <V7SignalRow
        fragileEdges={[
          // Highest switch probability on the turn, but it does not flip.
          { from_id: 'fac_vendor_fit', from_label: 'Vendor Platform Fit', to_label: 'x', switch_probability: 0.52 },
          // Lower, but the only factor the producer says flips.
          { from_id: 'fac_buy_indicator', from_label: 'Vendor Platform Purchase', to_label: 'y', switch_probability: 0.31 },
        ]}
        flipThresholds={[
          { node_id: 'fac_vendor_fit', flip_value: null, flip_reason: 'structurally_invariant' },
          { node_id: 'fac_buy_indicator', flip_value: 0.4, flip_reason: 'found' },
        ]}
        topDrivers={[]}
      />,
    )
    const chip = screen.getByTestId('v7-signal-flip-risk')
    expect(chip.textContent).toContain('Vendor Platform Purchase')
    expect(chip.textContent).not.toContain('Vendor Platform Fit')
  })

  it('the witnessed "15%" row was below the UI-SEM-013 floor all along', () => {
    // 0.1485 is not > 0.15. The pre-fix chip applied NO floor, which is how a
    // sub-threshold fragile edge came to be announced as the top flip risk.
    render(
      <V7SignalRow
        fragileEdges={[WITNESSED_FRAGILE_EDGES[0]]}
        topDrivers={[]}
      />,
    )
    expect(screen.queryByTestId('v7-signal-flip-risk')).toBeNull()
  })
})
