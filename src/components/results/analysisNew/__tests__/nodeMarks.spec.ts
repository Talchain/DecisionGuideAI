/**
 * The shared node-kind mark vocabulary.
 *
 * Two things are pinned, and they fail in opposite directions: that the
 * vocabulary is COMPLETE (a kind without a shape would render a blank), and
 * that resolution is HONEST (a target it cannot classify must return null
 * rather than a plausible-looking wrong shape).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

import { MARK_KINDS, MARK_SHAPE_KEYS, MARK_COLOUR, markKindForTarget } from '../nodeMarks'

const nodes: Array<{ id: string; type?: string; data?: unknown }> = []

vi.mock('../../../../canvas/store', () => ({
  useCanvasStore: { getState: () => ({ nodes }) },
}))

beforeEach(() => {
  nodes.length = 0
})

describe('the vocabulary is complete in both halves', () => {
  it('every drawn kind has a shape', () => {
    expect([...MARK_SHAPE_KEYS].sort()).toEqual([...MARK_KINDS].sort())
  })

  it('every drawn kind has a colour, and none is empty', () => {
    for (const kind of MARK_KINDS) {
      expect(MARK_COLOUR[kind], `${kind} has no colour`).toBeTruthy()
    }
  })

  /**
   * ⭐ The colours come from the canvas and must stay DISTINCT. Two kinds
   * resolving to one class would make the mark unable to discriminate — the
   * vocabulary would still be "complete" and would say nothing.
   */
  it('the colours discriminate between kinds', () => {
    const used = MARK_KINDS.map((k) => MARK_COLOUR[k])
    expect(new Set(used).size).toBe(MARK_KINDS.length)
  })
})

describe('resolution refuses to guess', () => {
  it('resolves a node this panel draws', () => {
    nodes.push({ id: 'r1', type: 'risk' })
    expect(markKindForTarget('r1')).toBe('risk')
  })

  it('returns null for no target at all', () => {
    expect(markKindForTarget(undefined)).toBeNull()
    expect(markKindForTarget(null)).toBeNull()
    expect(markKindForTarget('')).toBeNull()
  })

  /**
   * `focusModelTarget` accepts edge ids as well as node ids, so a
   * recommendation can point at a RELATIONSHIP. A relationship has no node
   * kind, and inventing one would put a shape on screen that means something
   * the card is not about.
   */
  it('returns null when the target is not a node on the canvas', () => {
    nodes.push({ id: 'n1', type: 'factor' })
    expect(markKindForTarget('e_n1->n2')).toBeNull()
  })

  it('returns null for a node kind this panel does not draw', () => {
    nodes.push({ id: 'g1', type: 'goal' })
    nodes.push({ id: 'd1', type: 'decision' })
    expect(markKindForTarget('g1')).toBeNull()
    expect(markKindForTarget('d1')).toBeNull()
  })

  it('returns null for an unrecognised type rather than falling through', () => {
    nodes.push({ id: 'x1', type: 'sticky-note' })
    expect(markKindForTarget('x1')).toBeNull()
  })
})
