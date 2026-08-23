/**
 * ROADMAP 2.638 S2 — the un-confirm affordance, on the surface that accepted
 * the confirmation.
 *
 * TWO CLAIMS, and they are different:
 *   (a) the row DISCLOSES which act it is recording — "confirmed by you" (the
 *       user kept Olumi's number) is not "edited by you" (the user supplied
 *       one). The consent witness saw the two collapsed (ROADMAP 2.663).
 *   (b) the confirmation is REVERSIBLE from the same drill-in that made it
 *       (Ruling 1: reversible per value), and the reversal touches no number.
 *
 * SCOPE, derived rather than assumed. Un-confirm is offered for a CONFIRMED
 * value only. A confirm-as-is writes no number (`commit(..., {writeValue:
 * false})`), so withdrawing it restores the pre-confirmation state EXACTLY,
 * with nothing to snapshot. An EDITED value is different: the pre-edit number
 * is captured only for the in-flight refusal path (`captureOptimisticFactorEdit`
 * → `revertOptimisticFactorEdit`) and is not retained past the receipt, so an
 * "undo" there would promise a restoration the store cannot perform. The honest
 * affordance for an edited value is the Edit control that is already on the row.
 *
 * The drill-in is the DEPLOYED-MOUNTED host: `preAnalysisV3` is `"1"` on
 * staging (netlify.toml), OutputsDock mounts `PreAnalysisPanelV3` on that arm,
 * and `YourDecisionSection` renders `CalibrateDrillIn` for the expanded row.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { EstimateRow } from '../EstimateRow'
import { CalibrateDrillIn } from '../CalibrateDrillIn'
import type { EstimateRowModel } from '../../types'
import { useCanvasStore } from '../../../../store'

const NODE_ID = 'fac_pricing_level'

const base: EstimateRowModel = {
  nodeId: NODE_ID,
  label: 'Pricing level',
  rankLabel: 'top',
  weight: 1,
  reviewed: true,
  aiSourced: false,
  provenanceKind: 'confirmed',
  attribution: { kind: 'person', displayName: 'You' },
  displayText: '70%',
  rawPrefill: 70,
  cap: 100,
  canEditValue: true,
  needsValue: false,
}

function seedConfirmedNode(): void {
  useCanvasStore.setState({
    nodes: [
      {
        id: NODE_ID,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          label: 'Pricing level',
          kind: 'factor',
          provenance: 'user_set',
          observedState: { value: 0.7, raw_value: 70, cap: 100, source: 'user_confirmed', extractionType: 'explicit' },
          observed_state: { value: 0.7, raw_value: 70, cap: 100, source: 'user_confirmed', extractionType: 'explicit' },
        },
      },
    ] as never,
    edges: [] as never,
  } as never)
}

beforeEach(() => {
  cleanup()
  seedConfirmedNode()
})

describe('2.638 S2 (a) · the row says WHICH act it recorded', () => {
  it('a CONFIRMED row reads "confirmed by you"', () => {
    render(<EstimateRow row={base} expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByText('confirmed by you')).toBeInTheDocument()
    expect(screen.queryByText('edited by you')).toBeNull()
  })

  it('an EDITED row reads "edited by you" — a different claim, same reviewed state', () => {
    render(<EstimateRow row={{ ...base, provenanceKind: 'edited' }} expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByText('edited by you')).toBeInTheDocument()
    expect(screen.queryByText('confirmed by you')).toBeNull()
  })

  it('a reviewed row of UNKNOWN provenance keeps the generic copy — never a guessed act', () => {
    const noKind: EstimateRowModel = { ...base }
    delete noKind.provenanceKind
    render(<EstimateRow row={noKind} expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByText('checked by you')).toBeInTheDocument()
  })
})

describe('confirmation controls fail closed without canonical authority', () => {
  it.each([
    base,
    { ...base, provenanceKind: 'edited' as const },
    { ...base, reviewed: false, provenanceKind: 'ai' as const },
  ])('mounts no confirm, unconfirm or confirmation-effect copy for $provenanceKind rows', row => {
    render(<CalibrateDrillIn row={row} onDone={vi.fn()} />)
    expect(screen.queryByTestId('pre-analysis-v3-confirm-as-is')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pre-analysis-v3-unconfirm')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pre-analysis-v3-confirmation-note')).not.toBeInTheDocument()
  })

  it('does not change the existing confirmed value merely by mounting the drill-in', () => {
    render(<CalibrateDrillIn row={base} onDone={vi.fn()} />)
    const node = useCanvasStore.getState().nodes.find(n => n.id === NODE_ID) as any
    expect(node.data.observedState).toMatchObject({ value: 0.7, raw_value: 70, source: 'user_confirmed' })
  })
})
