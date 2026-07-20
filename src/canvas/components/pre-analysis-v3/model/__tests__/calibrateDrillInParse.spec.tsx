/**
 * CalibrateDrillIn numeric parse — the drill-in must not FABRICATE a value.
 *
 * The drill-in writes through commitValue into node observedState, so whatever
 * it parses reaches the ANALYSIS, not merely a label. The digit-strip parser it
 * shipped with (`draft.replace(/[^0-9.,-]/g,'').replace(/,/g,'')`) was
 * byte-identical to the `parseDisplayNumber` deleted from HeroSection in #396:
 * it dropped the "k" multiplier and FUSED unrelated numbers together, so
 *   "£500k"                    → 500      (1000x too small)
 *   "£500k within 12 months"   → 50012    (a number the user never typed)
 * Both then flowed into observedState.raw_value and out to PLoT.
 *
 * These are the #396 dress-rehearsal strings, re-run against the sibling field
 * the original sweep missed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { CalibrateDrillIn } from '../CalibrateDrillIn'
import type { EstimateRowModel } from '../../types'
import { useCanvasStore } from '../../../../store'
import { getObservedState } from '../../../../utils/observedStateHelpers'

const row: EstimateRowModel = {
  nodeId: 'f1',
  label: 'Incremental ARR',
  rankLabel: 'top',
  weight: 1,
  reviewed: false,
  aiSourced: true,
  attribution: { kind: 'olumi' },
  displayText: null,
  rawPrefill: null,
  // cap null → commitValue stores raw_value verbatim, so the assertions below
  // read the parser's output directly with no normalisation in the way.
  cap: null,
  canEditValue: true,
  needsValue: true,
}

function seedNode(): void {
  useCanvasStore.setState({
    nodes: [
      {
        id: 'f1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { kind: 'factor', label: 'Incremental ARR' },
      } as Node,
    ],
    edges: [],
  })
}

/**
 * Type `text` into the drill-in and press Save. Returns the committed raw_value.
 * Unmounts + reseeds first so several inputs can be exercised in one `it`.
 */
function saveAndReadRawValue(text: string): unknown {
  cleanup()
  seedNode()
  render(<CalibrateDrillIn row={row} onDone={vi.fn()} />)
  fireEvent.change(screen.getByLabelText(`Your estimate for ${row.label}`), {
    target: { value: text },
  })
  fireEvent.click(screen.getByLabelText(`Save estimate for ${row.label}`))
  const node = useCanvasStore.getState().nodes.find(n => n.id === 'f1')
  return getObservedState(node?.data).raw_value
}

describe('CalibrateDrillIn — no fabricated numbers reach observedState', () => {
  beforeEach(() => {
    seedNode()
  })

  it('"£500k" commits 500000, not 500 (the multiplier must survive)', () => {
    expect(saveAndReadRawValue('£500k')).toBe(500000)
  })

  it('"£500k within 12 months" commits 500000 — never 50012', () => {
    const committed = saveAndReadRawValue('£500k within 12 months')
    // The precise defect: digits concatenated across unrelated tokens.
    expect(committed).not.toBe(50012)
    expect(committed).toBe(500000)
  })

  it('"$1.2m in year one" commits 1200000, not 121', () => {
    const committed = saveAndReadRawValue('$1.2m in year one')
    expect(committed).not.toBe(121)
    expect(committed).toBe(1200000)
  })

  it('an ambiguous range ("grow from 200 to 400") commits NOTHING and hints', () => {
    render(<CalibrateDrillIn row={row} onDone={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(`Your estimate for ${row.label}`), {
      target: { value: 'grow from 200 to 400' },
    })
    fireEvent.click(screen.getByLabelText(`Save estimate for ${row.label}`))
    // Fail closed: two competing candidates must not silently pick one.
    const node = useCanvasStore.getState().nodes.find(n => n.id === 'f1')
    expect(getObservedState(node?.data).raw_value).toBeUndefined()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('bare numbers and percentages are unchanged by the swap', () => {
    expect(saveAndReadRawValue('30')).toBe(30)
    expect(saveAndReadRawValue('15%')).toBe(15)
    expect(saveAndReadRawValue('1,250')).toBe(1250)
    expect(saveAndReadRawValue('-4.5')).toBe(-4.5)
  })

  it('unparseable text still hints and commits nothing (no silent no-op)', () => {
    render(<CalibrateDrillIn row={row} onDone={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(`Your estimate for ${row.label}`), {
      target: { value: 'quite a lot' },
    })
    fireEvent.click(screen.getByLabelText(`Save estimate for ${row.label}`))
    const node = useCanvasStore.getState().nodes.find(n => n.id === 'f1')
    expect(getObservedState(node?.data).raw_value).toBeUndefined()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('a cap normalises the PARSED value, not the digit-stripped one', () => {
    render(<CalibrateDrillIn row={{ ...row, cap: 1000000 }} onDone={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(`Your estimate for ${row.label}`), {
      target: { value: '£500k' },
    })
    fireEvent.click(screen.getByLabelText(`Save estimate for ${row.label}`))
    const os = getObservedState(useCanvasStore.getState().nodes.find(n => n.id === 'f1')?.data)
    expect(os.raw_value).toBe(500000)
    expect(os.value).toBe(0.5)
  })
})
