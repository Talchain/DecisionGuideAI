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
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EstimateRow } from '../EstimateRow'
import { CalibrateDrillIn } from '../CalibrateDrillIn'
import type { EstimateRowModel } from '../../types'
import { useCanvasStore } from '../../../../store'
import { isReviewedByUser } from '../../../pre-analysis/utils/isReviewedByUser'
import { isConfirmationWithdrawn } from '../../../../utils/hydrateProvenance'

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

describe('2.638 S2 (b) · the confirmation is reversible from the drill-in', () => {
  it('a confirmed row offers "Undo confirmation"', () => {
    render(<CalibrateDrillIn row={base} onDone={vi.fn()} />)
    const btn = screen.getByTestId('pre-analysis-v3-unconfirm')
    expect(btn).toHaveTextContent('Undo confirmation')
    expect(btn).toHaveAccessibleName('Undo your confirmation of Pricing level')
  })

  it('the copy discloses STATUS, never an effect on the analysis', () => {
    render(<CalibrateDrillIn row={base} onDone={vi.fn()} />)
    const note = screen.getByTestId('pre-analysis-v3-confirmation-note')
    // The one sentence the design allows: who stands behind the number, and an
    // explicit denial that confirming moved the maths.
    expect(note).toHaveTextContent(
      'Confirming records that you stand behind this number. It does not change the analysis.',
    )
  })

  it('clicking it clears the claim on THIS node and leaves the number alone', () => {
    render(<CalibrateDrillIn row={base} onDone={vi.fn()} />)
    fireEvent.click(screen.getByTestId('pre-analysis-v3-unconfirm'))

    const node = useCanvasStore.getState().nodes.find((n: any) => n.id === NODE_ID) as any
    expect(isConfirmationWithdrawn(node.data)).toBe(true)
    expect(isReviewedByUser(node)).toBe(false)
    expect(node.data.observedState.value).toBe(0.7)
    expect(node.data.observedState.raw_value).toBe(70)
  })

  it('an EDITED row is NOT offered an undo — the prior number was never retained', () => {
    render(<CalibrateDrillIn row={{ ...base, provenanceKind: 'edited' }} onDone={vi.fn()} />)
    expect(screen.queryByTestId('pre-analysis-v3-unconfirm')).toBeNull()
  })

  it('an UNREVIEWED row is not offered an undo either', () => {
    render(
      <CalibrateDrillIn
        row={{ ...base, reviewed: false, provenanceKind: 'ai' }}
        onDone={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('pre-analysis-v3-unconfirm')).toBeNull()
    // …and the surface that CAN make the claim is still there.
    expect(screen.getByTestId('pre-analysis-v3-confirm-as-is')).toBeInTheDocument()
  })

  /** Identity binding (trap 19): the withdrawal must hit the named node only. */
  it('leaves a sibling confirmed factor untouched', () => {
    const store = useCanvasStore.getState()
    const sibling = {
      id: 'fac_other',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Other',
        kind: 'factor',
        observedState: { value: 0.7, raw_value: 70, cap: 100, source: 'user_confirmed' },
        observed_state: { value: 0.7, raw_value: 70, cap: 100, source: 'user_confirmed' },
      },
    }
    useCanvasStore.setState({ nodes: [...(store.nodes as any[]), sibling] as never } as never)

    render(<CalibrateDrillIn row={base} onDone={vi.fn()} />)
    fireEvent.click(screen.getByTestId('pre-analysis-v3-unconfirm'))

    const other = useCanvasStore.getState().nodes.find((n: any) => n.id === 'fac_other') as any
    expect(isConfirmationWithdrawn(other.data)).toBe(false)
    expect(isReviewedByUser(other)).toBe(true)
  })
})
