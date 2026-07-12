/**
 * Wave F-A (Analysis-tab rebuild) — shared display selector, STRICTLY
 * ADDITIVE (DEV-PLAN-2026-07-12 §3 Wave F-A).
 *
 * Brief §6.4/§12.4: option order comes from ONE approved selector and
 * numbering is STABLE across graph, Analysis and AI references. Today's
 * numbering is rank-derived (index over sortOptionsForDisplay), so option
 * #2 becomes #1 after a rerun flips ranks — identity-anchored ordinals fix
 * that: assigned once per option id (first appearance), never reassigned,
 * never reused.
 */
import { describe, it, expect } from 'vitest'

import {
  assignStableOptionNumbers,
  selectDisplayOptions,
} from '../analysisDisplaySelector'
import { sortOptionsForDisplay } from '../../utils/optionDisplayOrder'
import type { OptionResult } from '../../types'

const opt = (id: string, over: Partial<OptionResult> = {}): OptionResult =>
  ({
    id,
    label: `Option ${id}`,
    expected: 0,
    ...over,
  }) as OptionResult

describe('assignStableOptionNumbers', () => {
  it('assigns 1..N in first-appearance order on first sight', () => {
    expect(assignStableOptionNumbers({}, ['a', 'b', 'c'])).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('keeps existing ordinals verbatim on re-registration in a different order', () => {
    const first = assignStableOptionNumbers({}, ['a', 'b', 'c'])
    const rerun = assignStableOptionNumbers(first, ['c', 'a', 'b'])
    expect(rerun).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('appends new options with the next ordinal', () => {
    const first = assignStableOptionNumbers({}, ['a', 'b'])
    const withNew = assignStableOptionNumbers(first, ['b', 'a', 'd'])
    expect(withNew).toEqual({ a: 1, b: 2, d: 3 })
  })

  it('never reuses a removed option ordinal', () => {
    const first = assignStableOptionNumbers({}, ['a', 'b', 'c'])
    // b gone; e is new — e must take 4, not b's 2.
    const next = assignStableOptionNumbers(first, ['a', 'c', 'e'])
    expect(next.a).toBe(1)
    expect(next.c).toBe(3)
    expect(next.e).toBe(4)
    // b's assignment is retained (history), not recycled.
    expect(next.b).toBe(2)
  })

  it('is pure — never mutates the previous map', () => {
    const prev = { a: 1 }
    assignStableOptionNumbers(prev, ['a', 'b'])
    expect(prev).toEqual({ a: 1 })
  })
})

describe('selectDisplayOptions', () => {
  const options = [
    opt('slow', { winProbability: 0.1, expected: 5 }),
    opt('lead', { winProbability: 0.6, expected: 20 }),
    opt('mid', { winProbability: 0.3, expected: 10 }),
  ]

  it('emits rows in EXACTLY the shared sortOptionsForDisplay order', () => {
    const numbering = assignStableOptionNumbers({}, options.map((o) => o.id))
    const rows = selectDisplayOptions(options, numbering)
    expect(rows.map((r) => r.option.id)).toEqual(
      sortOptionsForDisplay(options).map((o) => o.id),
    )
  })

  it('carries displayIndex (rank, 1-based) AND stableNumber (identity ordinal) distinctly', () => {
    const numbering = assignStableOptionNumbers({}, ['slow', 'lead', 'mid'])
    const rows = selectDisplayOptions(options, numbering)
    // lead wins on winProbability → displayIndex 1, but its stableNumber is 2
    // (second in first-appearance order).
    expect(rows[0].option.id).toBe('lead')
    expect(rows[0].displayIndex).toBe(1)
    expect(rows[0].stableNumber).toBe(2)
    expect(rows[1]).toMatchObject({ displayIndex: 2, stableNumber: 3 }) // mid
    expect(rows[2]).toMatchObject({ displayIndex: 3, stableNumber: 1 }) // slow
  })

  it('stableNumber survives a rank flip across reruns (the §6.4 property)', () => {
    let numbering = assignStableOptionNumbers({}, ['slow', 'lead', 'mid'])
    const before = selectDisplayOptions(options, numbering)
    const flipped = [
      opt('slow', { winProbability: 0.7, expected: 5 }),
      opt('lead', { winProbability: 0.2, expected: 20 }),
      opt('mid', { winProbability: 0.1, expected: 10 }),
    ]
    numbering = assignStableOptionNumbers(numbering, flipped.map((o) => o.id))
    const after = selectDisplayOptions(flipped, numbering)
    const num = (rows: typeof after, id: string) =>
      rows.find((r) => r.option.id === id)!.stableNumber
    for (const id of ['slow', 'lead', 'mid']) {
      expect(num(after, id)).toBe(num(before, id))
    }
    // While displayIndex re-ranks as designed.
    expect(after[0].option.id).toBe('slow')
    expect(after[0].displayIndex).toBe(1)
  })

  it('falls back to displayIndex when an id is missing from the numbering map (fail-open display)', () => {
    const rows = selectDisplayOptions(options, {})
    expect(rows.map((r) => r.stableNumber)).toEqual([1, 2, 3])
  })
})
