/**
 * The at-rest rule, executed on both sides of every branch. What the CARD
 * renders under it is `nodes/__tests__/OptionNode.compactAtRest.spec.tsx`.
 */
import { describe, expect, it } from 'vitest'
import {
  OPTION_CARD_AT_REST_ROWS,
  OPTION_DELTA_LABEL_MAX_CHARS,
  OPTION_REFERENCE_LINE_MAX_CHARS,
  compactReferenceLine,
  planOptionCardAtRest,
} from '../optionCardAtRest'
import { NODE_ROW_LABEL_MAX_CHARS } from '../../../utils/nodeLayoutConstants'

const base = {
  deltaFactorIds: ['a', 'b', 'c'],
  distinctiveFactorId: 'c' as string | null,
  isDetailed: false,
  pinRequested: false,
}

describe('planOptionCardAtRest', () => {
  it('the locked design keeps TWO rows at rest', () => {
    expect(OPTION_CARD_AT_REST_ROWS).toBe(2)
  })

  it('keeps the differentiator\'s row plus the list\'s next, in LIST order, and counts the rest', () => {
    // First-two would be [a, b]; the differentiator is c, so c is kept and b drops.
    expect(planOptionCardAtRest(base)).toEqual({
      cardRowIds: ['a', 'c'], hiddenCount: 1, compacted: true, previewPinned: false,
    })
  })

  it('falls back to the list\'s own order when the differentiator has no row, or there is none', () => {
    expect(planOptionCardAtRest({ ...base, distinctiveFactorId: 'z' }).cardRowIds).toEqual(['a', 'b'])
    expect(planOptionCardAtRest({ ...base, distinctiveFactorId: null }).cardRowIds).toEqual(['a', 'b'])
  })

  it('a differentiator already in the first two changes nothing', () => {
    expect(planOptionCardAtRest({ ...base, distinctiveFactorId: 'a' }).cardRowIds).toEqual(['a', 'b'])
  })

  it('pins the preview only when asked AND something was compacted', () => {
    expect(planOptionCardAtRest({ ...base, pinRequested: true }).previewPinned).toBe(true)
    expect(planOptionCardAtRest({ ...base, deltaFactorIds: ['a', 'b'], pinRequested: true }))
      .toEqual({ cardRowIds: ['a', 'b'], hiddenCount: 0, compacted: false, previewPinned: false })
  })

  it('a pin request never changes the CARD — the box is the same pinned or not', () => {
    expect(planOptionCardAtRest({ ...base, pinRequested: true }).cardRowIds)
      .toEqual(planOptionCardAtRest(base).cardRowIds)
  })

  it('Detailed keeps every row and never pins', () => {
    expect(planOptionCardAtRest({ ...base, isDetailed: true, pinRequested: true }))
      .toEqual({ cardRowIds: ['a', 'b', 'c'], hiddenCount: 0, compacted: false, previewPinned: false })
  })

  it('nothing to budget renders nothing', () => {
    expect(planOptionCardAtRest({ ...base, deltaFactorIds: [] }))
      .toEqual({ cardRowIds: [], hiddenCount: 0, compacted: false, previewPinned: false })
  })
})

describe('the two character budgets are DERIVED from the row budget, not hand-set', () => {
  it('the label column gets half a row at the worst-case scale', () => {
    expect(OPTION_DELTA_LABEL_MAX_CHARS).toBe(Math.floor(NODE_ROW_LABEL_MAX_CHARS / 2))
    expect(OPTION_DELTA_LABEL_MAX_CHARS).toBeGreaterThan(0)
  })

  it('the reference line gets a whole row of the SMALLER type it is set in', () => {
    // `edgeLabel` (11px) under `nodeLabel` (12px): more characters, never fewer.
    expect(OPTION_REFERENCE_LINE_MAX_CHARS).toBeGreaterThanOrEqual(NODE_ROW_LABEL_MAX_CHARS)
    expect(OPTION_REFERENCE_LINE_MAX_CHARS).toBeLessThan(NODE_ROW_LABEL_MAX_CHARS * 2)
  })
})

describe('compactReferenceLine', () => {
  it('a reference that fits is left alone, and carries no redundant title', () => {
    expect(compactReferenceLine('Status quo')).toEqual({ text: 'Reference: Status quo', title: undefined })
  })

  it('a long reference is cut to ONE line, with the whole sentence in the title', () => {
    const full = 'Keep Per-Seat Pricing (Status Quo)'
    const out = compactReferenceLine(full)
    expect(out.text.startsWith('Reference: ')).toBe(true)
    expect(out.text.length).toBeLessThanOrEqual(OPTION_REFERENCE_LINE_MAX_CHARS)
    expect(out.text.endsWith('…')).toBe(true)
    expect(out.title).toBe(`Reference: ${full}`)
  })
})
