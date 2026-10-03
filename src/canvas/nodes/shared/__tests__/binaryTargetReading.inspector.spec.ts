/**
 * The inspector's "This option sets …" line on a yes/no factor reads as the
 * card does (Paul's test 64c5eccc, 28 Sep 2026: "This option sets on").
 */
import { describe, expect, it } from 'vitest'
import { binaryTargetReading, BINARY_STATE_WORDS } from '../optionChangeRows'
import { optionTargetReading } from '../optionTargetDisplay'

// Served shape: "AI assistant use", observed_state unit "binary adoption", value 0.
const aiUse = { kind: 'factor', label: 'AI assistant use', category: 'controllable', observedState: { unit: 'binary adoption', value: 0, source: 'cee_inference' } }
const price = { kind: 'factor', label: 'Price', observedState: { unit: 'GBP', value: 0.5, raw_value: 49 } }
const row = (target: string, kind = 'olumi') => ({ target, change: `→ ${target}`, targetSource: { kind } }) as never

describe('a yes/no factor target in the card\'s words', () => {
  it('served shape: CEE\'s bare "on" / "off" read "In use" / "Not in use"', () => {
    expect(binaryTargetReading(aiUse, 'on')).toBe(BINARY_STATE_WORDS[1])
    expect(binaryTargetReading(aiUse, 'off')).toBe(BINARY_STATE_WORDS[0])
    expect(optionTargetReading(row('on'), aiUse)).toBe('In use')
  })
  it('the factor\'s own value labels win over the default words', () => {
    const labelled = { ...aiUse, encoding_map: { 0: 'Not adopted', 1: 'Adopted' } }
    expect(binaryTargetReading(labelled, 'on')).toBe('Adopted')
  })
  it('CONTROLS: a phrase of CEE\'s own stays; a non-binary factor is untouched; a person\'s own word is theirs', () => {
    expect(binaryTargetReading(aiUse, 'Adopted across the team')).toBeNull()
    expect(binaryTargetReading(price, 'on')).toBeNull()
    expect(optionTargetReading(row('on', 'you'), aiUse)).toBe('on')
  })
})
