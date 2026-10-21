/**
 * Served 7804a698 (21 Oct): an option put back into the comparison committed, but the card kept "Taken out". CEE's core
 * receipt omits `option_status` on an option in the comparison (absent = feasible), and the overlay kept the stale value.
 */
import { describe, expect, it } from 'vitest'
import { overlayNode } from '../mergeAppliedGraph'
import { optionStatusToggleEvent, optionTakenOut } from '../../domain/optionStatus'

const takenOut = { id: 'carry_on', type: 'option', position: { x: 10, y: 20 }, data: { kind: 'option', label: 'Carrying on as now', option_status: 'removed', analysis_participation: 'retained_excluded' } }

describe('an option put back into the comparison', () => {
  it('⭐ the receipt that omits its status clears "Taken out"; layout kept', () => {
    const next = overlayNode(takenOut, { id: 'carry_on', kind: 'option', label: 'Carrying on as now' })
    expect(optionTakenOut(next.data)).toBeNull()
    expect(next.data.analysis_participation).toBeUndefined()
    expect(next.position).toEqual({ x: 10, y: 20 })
    // The inspector's chip reads from the same data: its next press takes the option out again ("Take out of comparison").
    expect(optionStatusToggleEvent('carry_on', next.data, 'h')?.payload).toMatchObject({ expected_status: 'feasible', status: 'removed' })
  })

  it('a receipt that carries the status keeps it; a factor\'s omitted keys are kept as before', () => {
    expect(optionTakenOut(overlayNode(takenOut, { id: 'carry_on', kind: 'option', label: 'Carrying on as now', option_status: 'removed', analysis_participation: 'retained_excluded' }).data)).toBe('removed')
    const factor = { id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'F', analysis_participation: 'retained_excluded' } }
    expect(overlayNode(factor, { id: 'f', kind: 'factor', label: 'F' }).data.analysis_participation).toBe('retained_excluded')
  })
})
