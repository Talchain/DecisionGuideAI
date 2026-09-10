/**
 * The numeric edge label explains itself on hover.
 *
 * `w` and `b` are expanded NOWHERE in the product. In the numeric label mode,
 * `getEdgeLabel` returned `tooltip: numericLabel` — byte-identical to the label
 * it decorates — so hovering `w 0.60 • b 85%` repeated the same two letters
 * back at the user. The human arm has always returned `buildWeightTooltip`'s
 * expansion ("Weight: …, Belief: …"); only the numeric arm dead-ended.
 *
 * ⚠ THIS IS THE ONE THING THAT MADE IT URGENT: the numeric mode was, until
 * recently, unreachable — its toggle sat inside a permanently disabled
 * fieldset. Making it reachable is what first puts `w 0.60` in front of a
 * user with no unit or scale anchor anywhere on screen.
 *
 * ⛔ WHAT THIS DOES NOT DO. It does not change a single figure, or which
 * figures are speakable. Both arms already share the same provenance gates; the
 * numeric arm simply now shares the sentence that names them too, from the
 * SAME builder, so the two modes cannot drift into two vocabularies for one
 * datum.
 */
import { describe, it, expect } from 'vitest'
import { getEdgeLabel } from '../edgeLabels'
import type { EdgeValueDisplay, EdgeDirectionDisplay } from '../edgeValueProvenance'

const set = (value: number): EdgeValueDisplay => ({ show: true, value, source: 'user' } as EdgeValueDisplay)
const unset = { show: false, reason: 'absent' } as EdgeValueDisplay
const positive = { show: true, direction: 'positive' } as EdgeDirectionDisplay
const negative = { show: true, direction: 'negative' } as EdgeDirectionDisplay
const noDirection = { show: false, reason: 'absent' } as EdgeDirectionDisplay

describe('the numeric label is explained, not repeated', () => {
  it('does not hand back the label as its own explanation', () => {
    const d = getEdgeLabel(set(0.6), set(0.85), positive, 'numeric')
    expect(d.label).toBe('w 0.60 • b 85%')
    // The precise regression: tooltip === label taught the user nothing.
    expect(d.tooltip).not.toBe(d.label)
  })

  it('expands both letters into the words the human arm already uses', () => {
    const d = getEdgeLabel(set(0.6), set(0.85), positive, 'numeric')
    expect(d.tooltip).toBe('Weight: 0.60, Belief: 85%')
  })

  /**
   * ⭐ BOUND TO THE SHARED BUILDER, PROVEN BY AGREEMENT ACROSS MODES. If the
   * numeric arm ever grows its own copy of this sentence, these diverge and
   * this reds — which is the drift the assertion exists to catch, not a
   * restatement of the line above.
   */
  it('says exactly what the human mode says, for the same edge', () => {
    for (const [s, l, dir] of [
      [set(0.6), set(0.85), positive],
      [set(0.6), set(0.85), negative],
      [set(0.2), unset, positive],
      [unset, set(0.4), noDirection],
      [unset, unset, noDirection],
    ] as const) {
      expect(getEdgeLabel(s, l, dir, 'numeric').tooltip).toBe(getEdgeLabel(s, l, dir, 'human').tooltip)
    }
  })

  /**
   * ⛔ THE HONESTY ARMS. An unset value must reach the tooltip as "not set",
   * never as a number — and the minus sign is a DIRECTION CLAIM, so it may
   * appear only where the direction was actually stated.
   */
  it('carries "not set" through rather than inventing a figure', () => {
    expect(getEdgeLabel(unset, unset, noDirection, 'numeric').tooltip).toBe('Weight: not set, Belief: not set')
  })

  it('signs the weight only for a stated negative', () => {
    expect(getEdgeLabel(set(0.6), set(0.85), negative, 'numeric').tooltip).toBe('Weight: −0.60, Belief: 85%')
    // Stated positive and unstated direction both print the bare magnitude.
    expect(getEdgeLabel(set(0.6), set(0.85), noDirection, 'numeric').tooltip).toBe('Weight: 0.60, Belief: 85%')
  })

  it('leaves the visible label untouched', () => {
    expect(getEdgeLabel(set(0.6), unset, negative, 'numeric').label).toBe('w −0.60')
    expect(getEdgeLabel(unset, unset, noDirection, 'numeric').label).toBe('w not set')
  })
})
