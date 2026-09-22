/**
 * ⭐⭐ THE LIVE FACTOR PANEL STATED AN INFLUENCE WITH NO BASIS.
 *
 * The estate's rule is written at every other renderer of this datum:
 *   · FactorNode.tsx:759,770,1086  influencePct != null && influenceProvenance != null
 *   · lodMetricLine.ts:279         — "Fail-closed on provenance, exactly as
 *                                     FactorNode's own influence row does."
 * `FactorControllablePanel.tsx:584` gated on `influence != null ||
 * sensitivityRank != null` — no basis conjunct, and an OR.
 *
 * ⛔ THE HARM IS NAMED AT FACTORNODE'S OWN GATE: "on the fallback basis the top
 * driver shows 100% BY CONSTRUCTION." Measured across 970 debug bundles: 747 of
 * 1850 rendered factors (40.4%) carry no value, 90 carry an influence score with
 * no value, and 15 of 399 boards rank a VALUELESS factor most influential —
 * each at influence 1.0.
 *
 * ⚠ SCOPED TO THIS PANEL ON PURPOSE. The file's own comment warns that the three
 * factor panels "look identical and are not; treating them as one is what
 * produced this defect." `FactorExternalPanel` and `FactorObservablePanel` are
 * rowed separately rather than swept in.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { useCanvasStore } from '../../../store'

vi.mock('../../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'

const BASE = {
  sensitivityRank: null, influence: null as number | null,
  influenceProvenance: null as string | null, confidence: null,
  inSensitivityAnalysis: true, achievementProbability: null,
  achievementProbabilityIsModelledBasis: false, stabilityPercentage: null,
  winRate: null, isResultsMode: true, predictedOutcome: null,
  valueOfInformation: null, voiRank: null,
}

describe('FactorControllablePanel — influence needs its basis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCanvasStore.setState({
      nodes: [{ id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Tech Lead Presence' } }],
      edges: [], goalConstraints: [], confirmedNodeIds: new Set(), touchedNodeIds: new Set(),
      results: { status: 'complete', report: null },
    } as never)
  })
  afterEach(() => cleanup())

  /** ⭐ CONTROL FIRST — without it the withholding case passes against a panel
   *  that renders no influence at all (trap 13). */
  it('⭐ CONTROL: with a basis, the percentage renders', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      ...BASE, influence: 0.62, influenceProvenance: 'sensitivity',
    } as never)
    render(<FactorControllablePanel nodeId="fac1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(document.body.textContent, 'a basis-backed influence was withheld').toMatch(/62\s*%/)
  })

  it('⛔ withholds the percentage when no provenance attests it', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      ...BASE, influence: 1, influenceProvenance: null,
    } as never)
    render(<FactorControllablePanel nodeId="fac1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(
      document.body.textContent,
      'the top driver reads 100% BY CONSTRUCTION on the fallback basis',
    ).not.toMatch(/100\s*%/)
  })
})
