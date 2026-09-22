/**
 * ⭐⭐ THE INSPECTOR IS THE ONE INFLUENCE RENDERER THAT DID NOT FAIL CLOSED.
 *
 * Four surfaces render the same influence datum, and the estate's rule is
 * written at each of them: no provenance means no number.
 *
 *   · `FactorNode.tsx:759`  `influencePct != null && influenceProvenance != null`
 *   · `FactorNode.tsx:770`  same conjunct
 *   · `FactorNode.tsx:1086` same conjunct
 *   · `lodMetricLine.ts:279` `influence != null && influenceProvenance != null`,
 *     whose comment states the rule out loud — *"Fail-closed on provenance,
 *     exactly as `FactorNode`'s own influence row does."*
 *   · `NodeInspector.tsx:606` — `displayMetadata.influence !== null` ALONE.
 *
 * One rule, five sites, four of them honouring it. That is the hand-maintained
 * mirror (CLAUDE.md trap 12) with the odd one out on the surface a reader opens
 * deliberately to interrogate a factor.
 *
 * ⛔ AND THE HARM IS NAMED BY THE ESTATE ITSELF. `FactorNode`'s own comment at
 * the gate: *"on the fallback basis the top driver shows 100% BY CONSTRUCTION."*
 * Measured across 970 debug bundles: 747 of 1850 rendered factors (40.4%) carry
 * no value, 90 carry an influence score with no value, and **15 of 399 boards
 * rank a valueless factor as most influential** — `Raw Development Headcount`,
 * `Tech Lead Presence`, `Advisor Network Reach`, each at influence 1.0. The
 * inspector is where that renders as a confident "100%" with a full bar.
 *
 * ⚠ THIS IS NOT THE SAME FIX AS #1628. That one re-keys the RANK BADGE from
 * structural `influence_rank` onto elasticity. This is the raw percentage and
 * its bar, which #1628 does not touch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NodeInspector } from '../NodeInspector'
import { useCanvasStore } from '../../store'

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const BASE = {
  sensitivityRank: null,
  influence: null as number | null,
  influenceProvenance: null as string | null,
  confidence: null,
  inSensitivityAnalysis: true,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: false,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: true,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
}

describe('NodeInspector — an influence percentage needs its basis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCanvasStore.setState({
      nodes: [
        { id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Tech Lead Presence' } },
      ],
      edges: [],
      goalConstraints: [],
      confirmedNodeIds: new Set(),
      touchedNodeIds: new Set(),
      results: { status: 'complete', report: null },
    } as never)
  })
  afterEach(() => cleanup())

  /**
   * ⭐ POSITIVE CONTROL FIRST. Without it, the withholding assertion below
   * passes just as well against an inspector that never renders influence at
   * all — and this file would be testing nothing (trap 13).
   */
  it('⭐ CONTROL: with a basis, the percentage and its bar DO render', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      ...BASE, influence: 0.62, influenceProvenance: 'sensitivity',
    } as never)
    render(<NodeInspector nodeId="fac-1" onClose={() => {}} />)
    expect(screen.getByText('62%'), 'a basis-backed influence was withheld').toBeDefined()
  })

  it('⛔ withholds the percentage when no provenance attests it', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      ...BASE, influence: 1, influenceProvenance: null,
    } as never)
    render(<NodeInspector nodeId="fac-1" onClose={() => {}} />)
    expect(
      screen.queryByText('100%'),
      'the top driver reads 100% BY CONSTRUCTION on the fallback basis — it must not be stated',
    ).toBeNull()
  })

  /**
   * The 15 boards are not all at 1.0 — the gate must key on the BASIS, never on
   * the value. A mid-range number with no attestation is just as unfounded.
   */
  it('⛔ withholds a mid-range percentage too — the gate is the basis, not the magnitude', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      ...BASE, influence: 0.62, influenceProvenance: null,
    } as never)
    render(<NodeInspector nodeId="fac-1" onClose={() => {}} />)
    expect(screen.queryByText('62%')).toBeNull()
  })
})
