/**
 * TAKEN OUT IS THE USER'S ACT (DL 5932328304; schemas 0.69.0 F1 T6). An option the user marked not feasible or took out
 * reaches the UI as a Run participation entry `excluded_infeasible` / `excluded_removed`. The panel says "Taken out: not
 * feasible" / "Taken out", never "Not analysed" or "not compared", and offers no fix-it step.
 *
 * The fixtures are validated against the PUBLISHED entry schema in-test, so they are the contract's shape, not mine.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionParticipationEntrySchema } from '@talchain/schemas/orchestrator'

import { readOptionParticipation, isUserTakenOut } from '../../../../canvas/state/storedOptionParticipation'
import { deriveNotAnalysedReason, takenOutReasonOf } from '../notAnalysedOptions'
import {
  NOT_ANALYSED_BADGE,
  notAnalysedActionLabel,
  notAnalysedBadge,
  notAnalysedReasonCopy,
} from '../notAnalysedCopy'
import { NotAnalysedOptionCard } from '../../NotAnalysedOptionCard'
import type { OptionResult } from '../../types'

const SERVED = [
  { option_id: 'opt_offsite', state: 'excluded_infeasible' },
  { option_id: 'opt_agency', state: 'excluded_removed' },
  { option_id: 'opt_olumi', state: 'excluded_olumi_proposed' },
] as const

describe('the reader accepts the 0.69.0 states (it used to refuse the whole record)', () => {
  it('PRECONDITION: every fixture entry is valid under the published schema', () => {
    for (const e of SERVED) expect(OptionParticipationEntrySchema.safeParse(e).success).toBe(true)
  })

  it('a record carrying excluded_infeasible / excluded_removed is read, entry by entry', () => {
    const read = readOptionParticipation(SERVED)
    expect(read).not.toBeNull()
    expect(read!.map((e) => [e.optionId, e.state])).toEqual([
      ['opt_offsite', 'excluded_infeasible'],
      ['opt_agency', 'excluded_removed'],
      ['opt_olumi', 'excluded_olumi_proposed'],
    ])
    expect(read!.filter((e) => isUserTakenOut(e.state)).map((e) => e.optionId)).toEqual(['opt_offsite', 'opt_agency'])
  })

  it('⛔ the published refusals still hold: a taken-out entry naming unanalysable options refuses the record; CONTRAST a provisional keep may', () => {
    expect(readOptionParticipation([{ option_id: 'o1', state: 'excluded_infeasible', unanalysable_user_option_ids: ['o2'] }])).toBeNull()
    expect(readOptionParticipation([{ option_id: 'o1', state: 'kept_olumi_provisional', unanalysable_user_option_ids: ['o2'] }])).not.toBeNull()
    expect(readOptionParticipation([{ option_id: 'o1', state: 'excluded_parked' }])).toBeNull()
  })
})

describe('the reason: the user taking it out outranks every other account of the gap', () => {
  const derive = (state: string | null, values: number) =>
    deriveNotAnalysedReason('o1', [], ['o1'], () => values, () => state === 'excluded_olumi_proposed',
      () => takenOutReasonOf(state as never))

  it('infeasible and removed name the user\'s act even when the option has no values', () => {
    expect(derive('excluded_infeasible', 0)).toBe('taken_out_infeasible')
    expect(derive('excluded_removed', 0)).toBe('taken_out_removed')
  })

  it('CONTRAST: with no taken-out fact the old accounts stand', () => {
    expect(derive(null, 0)).toBe('no_interventions')
    expect(derive('excluded_olumi_proposed', 3)).toBe('excluded_olumi_proposed')
  })
})

describe('the words (one wording with the canvas card)', () => {
  it('says "Taken out: not feasible" / "Taken out" on any Run, and never offers a fix-it step', () => {
    for (const current of [true, false]) {
      expect(notAnalysedReasonCopy('taken_out_infeasible', current)).toBe('Taken out: not feasible')
      expect(notAnalysedReasonCopy('taken_out_removed', current)).toBe('Taken out')
    }
    expect(notAnalysedBadge('taken_out_infeasible')).toBe('Taken out: not feasible')
    expect(notAnalysedActionLabel('taken_out_infeasible')).toBeNull()
    expect(notAnalysedActionLabel('taken_out_removed')).toBeNull()
    expect(notAnalysedBadge('no_interventions')).toBe(NOT_ANALYSED_BADGE)
  })
})

describe('the panel card', () => {
  const option = (reason: OptionResult['notAnalysedReason']) =>
    ({ id: 'opt_offsite', label: 'Offsite retreat', notAnalysed: true, notAnalysedReason: reason }) as unknown as OptionResult

  it('a taken-out option shows the label as its badge, with no "Not analysed", no second line and no resolve button', () => {
    render(<NotAnalysedOptionCard option={option('taken_out_infeasible')} />)
    expect(screen.getByTestId('not-analysed-badge-opt_offsite')).toHaveTextContent('Taken out: not feasible')
    expect(screen.queryByText(NOT_ANALYSED_BADGE)).toBeNull()
    expect(screen.queryByTestId('not-analysed-reason-opt_offsite')).toBeNull()
    expect(screen.queryByTestId('not-analysed-resolve-opt_offsite')).toBeNull()
  })

  it('CONTRAST: an option with no values keeps "Not analysed" and its resolve button', () => {
    render(<NotAnalysedOptionCard option={option('no_interventions')} />)
    expect(screen.getByTestId('not-analysed-badge-opt_offsite')).toHaveTextContent(NOT_ANALYSED_BADGE)
    expect(screen.getByTestId('not-analysed-resolve-opt_offsite')).toBeInTheDocument()
  })
})
