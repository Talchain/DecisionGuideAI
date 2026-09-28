/**
 * A yes/no factor is known by what the PRODUCER says, across the unit class,
 * not one served spelling.
 *
 * #2260 / #2267 caught Paul's first export ("AI assistant use", unit "binary
 * adoption"). A fresh draft of the same brief on 0d334f7a (28 Sep 2026)
 * produced "AI assistant availability", unit "0-1 availability", value 0. The
 * option sets 1 and CEE's `display_value` is "on", so the card still read
 * "AI assistant a… → on est." A 0–1 unit alone is also a proportion's, so it is
 * a switch only when CEE's own word for the value is a switch word.
 */
import { describe, expect, it } from 'vitest'
import { buildOptionChangeRow, binaryTargetReading, BINARY_STATE_WORDS } from '../optionChangeRows'

type Shape = { unit: string; from: number; to: number; word: string; binary: boolean; why: string }
const SHAPES: Shape[] = [
  { unit: 'binary adoption', from: 0, to: 1, word: 'on', binary: true, why: "Paul's export 64c5eccc" },
  { unit: '0-1 availability', from: 0, to: 1, word: 'on', binary: true, why: 'served draft on 0d334f7a' },
  { unit: '0–1 availability', from: 0, to: 1, word: 'on', binary: true, why: 'en dash' },
  { unit: '0 - 1 adoption', from: 0, to: 1, word: 'yes', binary: true, why: 'spaced' },
  { unit: '0/1', from: 1, to: 0, word: 'off', binary: true, why: 'slash, switched off' },
  { unit: '0-1 availability', from: 0, to: 1, word: '1', binary: false, why: 'a bare digit on a 0–1 unit is a proportion as easily as a switch' },
  { unit: '0-1 scale', from: 0.3, to: 0.6, word: '0.6', binary: false, why: 'a proportion' },
  { unit: '0-1 share', from: 0, to: 1, word: '100%', binary: false, why: "CEE's word is not a switch word" },
  { unit: '0-10 score', from: 0, to: 1, word: 'on', binary: false, why: '0-10 is not 0-1' },
  { unit: '0-1.5 ratio', from: 0, to: 1, word: 'on', binary: false, why: '0-1.5 is not 0-1' },
  { unit: 'hours/week', from: 0, to: 1, word: 'on', binary: false, why: 'not a 0–1 unit' },
  { unit: '10-100 users', from: 0, to: 1, word: 'on', binary: false, why: 'not a 0–1 unit' },
]

describe('the yes/no reading covers the unit class, and only where CEE said a switch word', () => {
  it.each(SHAPES)('card row · $unit, "$word" ($why)', ({ unit, from, to, word, binary }) => {
    const row = buildOptionChangeRow({
      factorId: 'f', target: { value: to, displayValue: word, source: 'cee_hypothesis' },
      factor: { label: 'AI assistant availability', unit, observedValue: from },
      baselineOptionTarget: null,
    })
    const words = `${BINARY_STATE_WORDS[from as 0 | 1]} → ${BINARY_STATE_WORDS[to as 0 | 1]}`
    if (binary) expect(row.change).toBe(words)
    else expect(row.change).not.toContain('In use')
  })

  it.each(SHAPES)('inspector · $unit, "$word" ($why)', ({ unit, from, word, binary }) => {
    const data = { kind: 'factor', label: 'AI assistant availability', observedState: { unit, value: from } }
    const got = binaryTargetReading(data, word)
    if (binary) expect(got).toBe(BINARY_STATE_WORDS[/^(on|yes|true|1)$/i.test(word) ? 1 : 0])
    else expect(got).toBeNull()
  })
})
