/**
 * CalibrateDrillIn range guard — journey-walk 2026-08-03 gap #3 (ROADMAP
 * 2.159/S1/S3 class), the witnessed shape at the bytes.
 *
 * THE WITNESSED DEFECT (journey-walk-2026-08-03.md §1b, UI 43fd19e1): the
 * guided "Best next step" configure path offered "Your estimate for Content
 * Marketing Investment" on a factor recorded WITHOUT a unit, without a cap,
 * with a normalised model-scale value (0, painted "Low (0)"). Typing
 * `£60,000` was accepted silently; commitValue wrote raw_value=60000 AND
 * value=60000 (normaliseRawFactorValue returns the raw number verbatim when
 * cap is absent), the canvas painted "6000000%" on three option nodes, the
 * sidebar claimed "checked by you", and the server never received any of it.
 * The NL path refused the same edit honestly ("recorded without a unit …
 * I haven't changed anything") — the direct editor enforced nothing.
 *
 * THE GUARD: when the factor's own declared shape is normalised-scale-only —
 * no cap, no unit, no raw-value display anchor, but an existing model-scale
 * `value` in [0,1] — the committed number IS a model-scale value, so an entry
 * outside [0,1] is refused at entry with an honest hint. Validation uses ONLY
 * what the node data genuinely carries (observedState value/raw_value/unit/
 * cap) — 2.193: no structured bound crosses the wire, so no server contract
 * is invented.
 *
 * RED-first at pristine 43fd19e1: the walk-shape test commits 60000 and shows
 * no hint, so it fails.
 *
 * GUARD-NOT-OVERFIRING controls pin the two neighbouring behaviours the
 * repo's own tests already rely on (calibrateDrillInParse.spec.tsx): an EMPTY
 * factor (no observedState at all) still accepts a magnitude verbatim, and a
 * cap-bearing factor still normalises raw/cap.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { CalibrateDrillIn } from '../CalibrateDrillIn'
import type { EstimateRowModel } from '../../types'
import { useCanvasStore } from '../../../../store'
import { getObservedState } from '../../../../utils/observedStateHelpers'

/** The walk's row shape: capless, unitless, value-bearing, editable. */
const walkRow: EstimateRowModel = {
  nodeId: 'fac_content_marketing',
  label: 'Content Marketing Investment',
  rankLabel: 'top',
  weight: 1,
  reviewed: false,
  aiSourced: true,
  attribution: { kind: 'olumi' },
  displayText: 'Low (0)',
  rawPrefill: null,
  cap: null,
  canEditValue: true,
  needsValue: false,
}

/** Seed the walk's node shape: normalised value 0, no raw_value, no unit, no cap. */
function seedWalkNode(): void {
  useCanvasStore.setState({
    nodes: [
      {
        id: 'fac_content_marketing',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          kind: 'factor',
          label: 'Content Marketing Investment',
          observedState: {
            value: 0,
            display_value: 'Low (0)',
            source: 'cee_inference',
            extractionType: 'inferred',
          },
        },
      } as Node,
    ],
    edges: [],
  })
}

function typeAndSave(text: string, row: EstimateRowModel = walkRow): void {
  fireEvent.change(screen.getByLabelText(`Your estimate for ${row.label}`), {
    target: { value: text },
  })
  fireEvent.click(screen.getByLabelText(`Save estimate for ${row.label}`))
}

describe('CalibrateDrillIn — normalised-scale-only factors refuse magnitude entries (walk gap #3)', () => {
  beforeEach(() => {
    cleanup()
    seedWalkNode()
  })

  it('the witnessed entry "£60,000" is refused: nothing committed, honest hint shown', () => {
    render(<CalibrateDrillIn row={walkRow} onDone={vi.fn()} />)
    typeAndSave('£60,000')
    const os = getObservedState(
      useCanvasStore.getState().nodes.find(n => n.id === 'fac_content_marketing')?.data,
    )
    // The 6000000% chain starts here: neither field may move.
    expect(os.raw_value).toBeUndefined()
    expect(os.value).toBe(0)
    expect(os.source).toBe('cee_inference')
    const hint = screen.getByRole('status')
    // Honest, factual, actionable: names the factor's own recorded shape.
    expect(hint.textContent).toMatch(/without a unit/i)
    expect(hint.textContent).toMatch(/between 0 and 1/i)
  })

  it('"60%" is refused the same way (the NL path already refuses % on this factor)', () => {
    render(<CalibrateDrillIn row={walkRow} onDone={vi.fn()} />)
    typeAndSave('60%')
    const os = getObservedState(
      useCanvasStore.getState().nodes.find(n => n.id === 'fac_content_marketing')?.data,
    )
    expect(os.raw_value).toBeUndefined()
    expect(os.value).toBe(0)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('an in-range entry "0.6" commits (the guard refuses magnitudes, not the editor)', () => {
    const onDone = vi.fn()
    render(<CalibrateDrillIn row={walkRow} onDone={onDone} />)
    typeAndSave('0.6')
    const os = getObservedState(
      useCanvasStore.getState().nodes.find(n => n.id === 'fac_content_marketing')?.data,
    )
    expect(os.raw_value).toBe(0.6)
    expect(os.value).toBe(0.6)
    // ROADMAP 2.304 slice 1 — the `user_override` stamp is now RECEIPT-gated.
    // This spec renders the drill-in with NO ConversationProvider, so no turn
    // is dispatched and no receipt can arrive; the pre-edit provenance
    // therefore stands. That is the fix, not a regression: the stamp is a claim
    // about what the engine holds, and nothing here has told the engine
    // anything. The receipt-gated stamp is pinned in
    // `calibrateDrillInReceipt.spec.tsx`, which drives the real dispatcher.
    expect(os.source).toBe('cee_inference')
    expect(onDone).toHaveBeenCalled()
  })

  it('boundary values 0 and 1 commit; a negative entry is refused', () => {
    render(<CalibrateDrillIn row={walkRow} onDone={vi.fn()} />)
    typeAndSave('1')
    expect(
      getObservedState(
        useCanvasStore.getState().nodes.find(n => n.id === 'fac_content_marketing')?.data,
      ).raw_value,
    ).toBe(1)

    cleanup()
    seedWalkNode()
    render(<CalibrateDrillIn row={walkRow} onDone={vi.fn()} />)
    typeAndSave('-0.2')
    const os = getObservedState(
      useCanvasStore.getState().nodes.find(n => n.id === 'fac_content_marketing')?.data,
    )
    expect(os.raw_value).toBeUndefined()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('control: an EMPTY factor (no observedState) still accepts a magnitude verbatim — the parse-spec contract is untouched', () => {
    useCanvasStore.setState({
      nodes: [
        {
          id: 'f-empty',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { kind: 'factor', label: 'Incremental ARR' },
        } as Node,
      ],
      edges: [],
    })
    const emptyRow: EstimateRowModel = {
      ...walkRow,
      nodeId: 'f-empty',
      label: 'Incremental ARR',
      displayText: null,
      needsValue: true,
    }
    render(<CalibrateDrillIn row={emptyRow} onDone={vi.fn()} />)
    typeAndSave('£60,000', emptyRow)
    expect(
      getObservedState(useCanvasStore.getState().nodes.find(n => n.id === 'f-empty')?.data)
        .raw_value,
    ).toBe(60000)
  })

  it('control: a cap-bearing factor still normalises raw/cap ("£60,000" on cap 150000 → 0.4)', () => {
    useCanvasStore.setState({
      nodes: [
        {
          id: 'f-cap',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            kind: 'factor',
            label: 'Growth Budget Spend',
            observedState: { value: 0.2, cap: 150000, source: 'cee_inference' },
          },
        } as Node,
      ],
      edges: [],
    })
    const capRow: EstimateRowModel = {
      ...walkRow,
      nodeId: 'f-cap',
      label: 'Growth Budget Spend',
      cap: 150000,
    }
    render(<CalibrateDrillIn row={capRow} onDone={vi.fn()} />)
    typeAndSave('£60,000', capRow)
    const os = getObservedState(
      useCanvasStore.getState().nodes.find(n => n.id === 'f-cap')?.data,
    )
    expect(os.raw_value).toBe(60000)
    expect(os.value).toBeCloseTo(0.4)
  })
})
