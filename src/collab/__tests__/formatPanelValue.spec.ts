/**
 * COLLAB — how a panel answer is written, and the one property that matters.
 *
 * ⭐⭐ THE LOAD-BEARING TEST IN THIS FILE IS THE COLLISION ONE, and it is here
 * because the obvious implementation fails it. `Math.round(v * 100)` — which is
 * what `formatElicitedChance` does, correctly, for its own job — maps 0.85 and
 * 0.851 to the SAME string. On the reveal that would print two participants'
 * genuinely different answers identically, directly beneath a sentence reading
 * "2 people answered, with 2 different answers between them".
 *
 * That is the same contradiction the divergence sentence was just repaired for,
 * reintroduced one line down and strictly harder to catch: there the count was
 * wrong, here the numbers would be invisible. So the property is asserted
 * DIRECTLY — distinct inputs must produce distinct outputs — rather than left
 * to be inferred from a handful of examples.
 */

import { describe, expect, it } from 'vitest'

import { formatPanelValue } from '../formatPanelValue'

describe('a chance is written as a percentage', () => {
  it.each([
    [0, '0%'],
    [0.2, '20%'],
    [0.35, '35%'],
    [0.85, '85%'],
    [1, '100%'],
  ])('%s → %s', (value, expected) => {
    expect(formatPanelValue(value)).toBe(expected)
  })

  it('⚠ carries no float noise from the × 100', () => {
    // ⭐ THE EXAMPLES ARE MEASURED, NOT ASSUMED — this test's first version
    // claimed `0.85 * 100 !== 85` and was WRONG (it is exactly 85), which the
    // run caught. These three genuinely are not exact in IEEE 754, and they are
    // ordinary elicited values, not exotica.
    expect(0.07 * 100).toBe(7.000000000000001)
    expect(0.29 * 100).toBe(28.999999999999996)
    expect(0.57 * 100).toBe(56.99999999999999)
    // Which would render as "7.000000000000001%" beside a colleague's name.
    expect(formatPanelValue(0.07)).toBe('7%')
    expect(formatPanelValue(0.29)).toBe('29%')
    expect(formatPanelValue(0.57)).toBe('57%')
  })
})

describe('⭐ DISTINCT ANSWERS MUST STAY DISTINCT STRINGS', () => {
  it('0.85 and 0.851 do NOT collapse to the same text', () => {
    // A rounding formatter returns "85%" for both. That would put two different
    // answers on screen as one number under a sentence counting them as two.
    expect(formatPanelValue(0.85)).not.toBe(formatPanelValue(0.851))
    expect(formatPanelValue(0.851)).toBe('85.1%')
  })

  it('no two distinct values in a realistic corpus share a rendering', () => {
    const values = [
      0, 0.01, 0.05, 0.07, 0.1, 0.15, 0.2, 0.25, 0.3, 0.33, 0.333, 0.35, 0.4, 0.45,
      0.5, 0.55, 0.6, 0.65, 0.666, 0.7, 0.75, 0.8, 0.85, 0.851, 0.9, 0.95, 0.99, 1,
    ]
    const rendered = values.map(formatPanelValue)
    // The property, stated as a property: the map is injective over this set.
    expect(new Set(rendered).size).toBe(values.length)
  })
})

describe('what is NOT claimed', () => {
  it('a value outside [0,1] is not a chance and keeps its own spelling', () => {
    // The reveal carries no `unit` (only the packet does), so this module
    // cannot know that 18 means months. A percent sign here would be a unit
    // claim nothing on the wire supports.
    expect(formatPanelValue(18)).toBe('18')
    expect(formatPanelValue(1.4)).toBe('1.4')
    expect(formatPanelValue(-0.5)).toBe('-0.5')
  })

  it('⚠ null renders as NOTHING, never as the word "null"', () => {
    // The pristine sites disagreed: JSX `{r.value}` rendered nothing while the
    // apply confirmation's template literal rendered "Grace's null is being
    // applied to …" into a sentence a facilitator reads.
    expect(formatPanelValue(null)).toBe('')
    expect(formatPanelValue(null)).not.toContain('null')
  })

  it('a non-finite number is not dressed up as a percentage', () => {
    expect(formatPanelValue(Number.NaN)).toBe('NaN')
    expect(formatPanelValue(Number.POSITIVE_INFINITY)).toBe('Infinity')
  })
})
