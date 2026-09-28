/**
 * A yes/no factor is known by what the PRODUCER says, across the unit class,
 * not one served spelling.
 *
 * Paul's first export spelled the unit "binary adoption" (#2260 / #2267). Three
 * fresh drafts of the same brief (28 Sep 2026, 0d334f7a and 00c6244c) spelled
 * it "0-1 availability", "binary" and "adoption indicator", and every one had
 * CEE's `display_value` "on" for the option's target. #2274 covered 0–1 units
 * only; draft 3's "adoption indicator" still read "AI assistant d… → on est."
 * So CEE's switch word decides, not the unit's spelling. The card still needs
 * both ends at 0 or 1, so a count or a proportion is never re-worded.
 */
import { describe, expect, it } from 'vitest'
import { buildOptionChangeRow, binaryTargetReading, BINARY_STATE_WORDS } from '../optionChangeRows'

type Shape = { unit: string; from: number; to: number; word: string; binary: boolean; why: string }
const SHAPES: Shape[] = [
  { unit: 'binary adoption', from: 0, to: 1, word: 'on', binary: true, why: "Paul's export 64c5eccc" },
  { unit: '0-1 availability', from: 0, to: 1, word: 'on', binary: true, why: 'served draft on 0d334f7a' },
  { unit: 'binary', from: 0, to: 1, word: 'on', binary: true, why: 'served draft 1 on 00c6244c' },
  { unit: 'adoption indicator', from: 0, to: 1, word: 'on', binary: true, why: 'served draft 3 on 00c6244c' },
  { unit: '0 - 1 adoption', from: 0, to: 1, word: 'yes', binary: true, why: 'spaced, yes' },
  { unit: 'flag', from: 1, to: 0, word: 'off', binary: true, why: 'switched off' },
  { unit: '0-1 availability', from: 0, to: 1, word: '1', binary: false, why: 'a bare digit is not a switch word' },
  { unit: '0-1 scale', from: 0.3, to: 0.6, word: '0.6', binary: false, why: 'a proportion' },
  { unit: '0-1 share', from: 0, to: 1, word: '100%', binary: false, why: "CEE's word is not a switch word" },
  { unit: 'hours/week', from: 0, to: 20, word: '20 hours/week', binary: false, why: 'a count' },
  { unit: 'engineers', from: 0, to: 1, word: '1 engineer', binary: false, why: 'a count at 0 → 1' },
  { unit: 'USD/year', from: 0, to: 1, word: '$10k/year', binary: false, why: 'money at a normalised 1' },
]


describe('the yes/no reading follows CEE\'s switch word, whatever the unit is spelled', () => {
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

  it('inspector CONTROL: a switch word on a factor whose own value is 0.5 is not a switch', () => {
    const data = { kind: 'factor', label: 'Price', observedState: { unit: 'GBP', value: 0.5, raw_value: 49 } }
    expect(binaryTargetReading(data, 'on')).toBeNull()
  })

  it.each(SHAPES)('inspector · $unit, "$word" ($why)', ({ unit, from, word, binary }) => {
    const data = { kind: 'factor', label: 'AI assistant availability', observedState: { unit, value: from } }
    const got = binaryTargetReading(data, word)
    if (binary) expect(got).toBe(BINARY_STATE_WORDS[/^(on|yes|true|1)$/i.test(word) ? 1 : 0])
    else expect(got).toBeNull()
  })
})
