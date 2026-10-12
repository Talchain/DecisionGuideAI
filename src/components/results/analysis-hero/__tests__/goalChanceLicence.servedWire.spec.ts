/**
 * ⭐ SERVED-WIRE ROW (Science 393023 correction, 7 Oct: every science PR carries one row built from a SERVED capture,
 * keys untouched — a self-authored record let CEE #2702 pass CI while inert on the wire). Lives in the hero's own
 * directory: `inertness.spec.ts` forbids importing the hero from anywhere else.
 *
 * `fixtures/served-t1b-f440be4a-goal-chance-records.json` is the T1b Run's `GOAL_CHANCE_LICENSED` and
 * `GOAL_HORIZON_NOT_TESTED` records copied VERBATIM (jq) from CEE's served capture `served-w3-f440be4a-t1b-7ab6c1af`.
 * Only the canvas node labels below are supplied here (the capture carries no graph); option labels are the served ones.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { goalChanceOptionLines } from '../goalChanceCopy'
import { gateWordsOf } from './helpers/gateWords'

type Json = Record<string, any>
const SERVED = JSON.parse(readFileSync(join(process.cwd(), 'src/components/results/analysis-hero/__tests__/fixtures/served-t1b-f440be4a-goal-chance-records.json'), 'utf8')) as Json
const OPTION_LABEL = Object.fromEntries((SERVED.option_comparison as Json[]).map((o) => [o.option_id, o.option_label]))

// #2747 re-scope 2 (U2): the UI no longer words a driver (CEE's `main_driver.detail` is said verbatim), so these rows pin
// the served record's read and its per-option lines; the driver sentences that followed them went with the wording.
describe('served T1b goal-chance records → the hero’s per-option lines (ruling 4 words)', () => {
  it('the served record is read, with a driver claim for each option CEE named one for, and each option says its chance in this model', () => {
    const licence = readGoalChanceLicence(SERVED.inference_warnings)
    expect(licence, 'the served record is well-formed for the reader').not.toBeNull()
    expect(licence!.form).toBe('each')
    expect(licence!.pctByOption).toEqual({ raise_prices_by_10: 46, launch_starter_tier: 52, keep_pricing_as_it_is: 0 })
    expect(Object.keys(licence!.driverByOption ?? {})).toEqual(['raise_prices_by_10', 'launch_starter_tier'])
    expect(goalChanceOptionLines(licence!, (id) => OPTION_LABEL[id] ?? null, gateWordsOf(licence!))).toEqual([
      '‘Raise prices by 10%’: about 46% chance of meeting your goal, in this model.',
      '‘Launch starter tier’: about 52% chance of meeting your goal, in this model.',
      '‘Keep pricing as it is’: less than 1% chance of meeting your goal, in this model.',
    ])
  })

  it('pre-S1 served record: no horizon keys on the licence, so no deadline clause yet (CEE #2702 adds them)', () => {
    expect(SERVED.inference_warnings.map((w: Json) => w.code)).toContain('GOAL_HORIZON_NOT_TESTED')
    expect(readGoalChanceLicence(SERVED.inference_warnings)!.horizonLine ?? null).toBeNull()
  })
})
