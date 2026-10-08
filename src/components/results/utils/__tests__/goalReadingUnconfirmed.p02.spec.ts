/**
 * GOAL-REACH build 2, DGAI half (P02, brief inflight/accel/briefs/P02-GR2-dgai.md; Science §(e) item 5): while CEE's
 * goal-chance licence carries `reading_label` (the goal is Olumi's UNCONFIRMED reading), no surface may show a bare
 * per-option goal figure. The EXISTING withhold class (`GOAL_FIGURES_WITHHELD_CODES` → mapper stamp →
 * `selectGoalProbability`) carries it: CEE's typed `GOAL_FIGURES_READING_UNCONFIRMED`, or, fail-closed, a withhold
 * synthesised from the label itself when the code is missing.
 * Licence record: served T1b f440be4a (fixture below) + a `reading_label` per P45's contract (Paul graph 632b92b9 shape).
 */
import { describe, it, expect } from 'vitest'
import served from '../../analysis-hero/__tests__/fixtures/served-t1b-f440be4a-goal-chance-records.json'
import {
  GOAL_FIGURES_WITHHELD_CODES, GOAL_IDENTITY_WITHHELD_FALLBACK, readGoalFigureWithholds, readGoalIdentityWithheld, withheldClaimsFor,
} from '../goalIdentityWithheld'
import { readGoalChanceLicence } from '../goalChanceLicence'
import { goalChanceOptionLines } from '../../analysis-hero/goalChanceCopy'

type W = Record<string, unknown>
const LICENSED = (served as { inference_warnings: W[] }).inference_warnings.find((w) => w.code === 'GOAL_CHANCE_LICENSED')!
const OPTION_IDS = Object.keys(LICENSED.pct_by_option as Record<string, number>)
const READING_LABEL = {
  v: 1, source: 'olumi_reading',
  goal: { id: 'mrr', label: 'MRR' },
  factors: [{ id: 'pro_plan_price', label: 'Pro plan price' }, { id: 'pro_paying_subscribers', label: 'Pro paying subscribers' }],
  addends: [{ id: 'mrr_lost_to_price_driven_churn', label: 'MRR lost to price-driven churn', sign: 'less' }],
}
const holder = (licence: W, ...extra: W[]) => ({ inference_warnings: [licence, ...extra] })
const READING_CODE = 'GOAL_FIGURES_READING_UNCONFIRMED'
const PRODUCER_WORDS = "Not shown. This figure rests on Olumi's reading of MRR."

describe('P02 GR2: a goal figure under an unconfirmed reading is withheld everywhere', () => {
  it('CONTROL: the served licence WITHOUT reading_label withholds nothing (figures show as today)', () => {
    expect(readGoalFigureWithholds(holder(LICENSED))).toEqual([])
    expect(readGoalIdentityWithheld(holder(LICENSED))).toBeNull()
  })

  it('RED: the licence carries reading_label and CEE sent no withhold code → every option’s goal figures are withheld (fail closed)', () => {
    const withholds = readGoalFigureWithholds(holder({ ...LICENSED, reading_label: READING_LABEL }))
    expect(withholds.length).toBe(1)
    for (const id of OPTION_IDS) {
      const claims = withheldClaimsFor(withholds, id)
      expect(claims.has('goal_probability')).toBe(true)
      expect(claims.has('joint_probability')).toBe(true)
    }
    expect(readGoalIdentityWithheld(holder({ ...LICENSED, reading_label: READING_LABEL }))?.message).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
  })

  it('RED: a MALFORMED reading_label (one factor) still withholds: a label that cannot be read never yields a bare figure', () => {
    const bad = { ...READING_LABEL, factors: [READING_LABEL.factors[0]] }
    const withholds = readGoalFigureWithholds(holder({ ...LICENSED, reading_label: bad }))
    expect(OPTION_IDS.every((id) => withheldClaimsFor(withholds, id).has('goal_probability'))).toBe(true)
  })

  it('RED: CEE’s typed GOAL_FIGURES_READING_UNCONFIRMED is one of the withhold codes, and its own words are said', () => {
    expect(GOAL_FIGURES_WITHHELD_CODES).toContain(READING_CODE)
    const code = { code: READING_CODE, option_ids: OPTION_IDS, withheld_claims: ['goal_probability', 'joint_probability'], message: PRODUCER_WORDS }
    const h = holder({ ...LICENSED, reading_label: READING_LABEL }, code)
    expect(readGoalFigureWithholds(h).map((w) => w.code)).toEqual([READING_CODE, READING_CODE])
    expect(readGoalIdentityWithheld(h)?.message).toBe(PRODUCER_WORDS)
  })

  it('the typed reading withhold also applies when the licence has no reading_label', () => {
    const h = holder(LICENSED, { code: READING_CODE, option_ids: OPTION_IDS,
      withheld_claims: ['goal_probability', 'joint_probability'], message: PRODUCER_WORDS })
    const withholds = readGoalFigureWithholds(h)
    expect(withholds).toHaveLength(1)
    for (const id of OPTION_IDS) {
      expect([...withheldClaimsFor(withholds, id)]).toEqual(['goal_probability', 'joint_probability'])
    }
    expect(readGoalIdentityWithheld(h)?.message).toBe(PRODUCER_WORDS)
  })

  // The licence path (hero, DecisionMatrix, chat card) says the RULED words (DL + Science 8 Oct): the reading in the SAME sentence.
  const LABELS: Record<string, string> = { raise_prices_by_10: 'Raise prices by 10%', launch_starter_tier: 'Launch a starter tier', keep_pricing_as_it_is: 'Keep pricing as it is' }
  const labelOf = (id: string) => LABELS[id] ?? null
  const CLAUSE = ', in this model, if ‘MRR’ = ‘Pro plan price’ × ‘Pro paying subscribers’, less ‘MRR lost to price-driven churn’ (Olumi’s reading).'

  it('RED: every licensed figure line carries the reading in the same sentence, in the ruled words', () => {
    const licence = readGoalChanceLicence([{ ...LICENSED, reading_label: READING_LABEL }])
    expect(licence).not.toBeNull()
    const lines = goalChanceOptionLines(licence!, labelOf)
    expect(lines).not.toBeNull()
    const figureLines = lines!.filter((l) => /\d+%/.test(l))
    expect(figureLines.length).toBe(OPTION_IDS.length)
    for (const line of figureLines) {
      expect(line).toMatch(/^‘[^’]+’: (?:about|less than|more than) \d+% chance of meeting your goal/)
      expect(line.endsWith(CLAUSE)).toBe(true)
    }
  })

  it('CONTROL: the same licence without reading_label says no reading clause', () => {
    const lines = goalChanceOptionLines(readGoalChanceLicence([LICENSED])!, labelOf) ?? []
    expect(lines.some((l) => l.includes('Olumi’s reading'))).toBe(false)
  })

  it('RED: a malformed reading_label prints no figure line on the licence path (fail closed)', () => {
    const licence = readGoalChanceLicence([{ ...LICENSED, reading_label: { ...READING_LABEL, factors: [] } }])
    const lines = licence === null ? null : goalChanceOptionLines(licence, labelOf)
    expect((lines ?? []).some((l) => /\d+%/.test(l))).toBe(false)
  })
})
