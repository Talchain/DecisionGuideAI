/**
 * Canvas option 3 (20 Oct 2026): an option whose CEE target map is empty still shows the targets it names with no
 * value, so the card offers a field to fill rather than a bare "Needs input". CEE's map wins wherever it names a factor.
 */
import { describe, it, expect } from 'vitest'
import { resolveUnsetOptionTargets } from '../optionTargetDisplay'

const option = { interventions: { f_spend: { value: null }, f_leads: { value: null }, f_set: { value: 0.4 } } }

describe('resolveUnsetOptionTargets', () => {
  it('an empty CEE map no longer hides the option\'s own unset targets', () => {
    expect([...resolveUnsetOptionTargets(option, { id: 'opt', interventions: {} }).keys()].sort()).toEqual(['f_leads', 'f_spend'])
  })

  it('CONTRAST: a factor CEE names with a value is not unset, whatever the option holds', () => {
    const unset = resolveUnsetOptionTargets(option, { id: 'opt', interventions: { f_spend: { value: 0.6 } } })
    expect(unset.has('f_spend')).toBe(false)
    expect(unset.has('f_leads')).toBe(true)
    expect(unset.has('f_set')).toBe(false)
  })
})
