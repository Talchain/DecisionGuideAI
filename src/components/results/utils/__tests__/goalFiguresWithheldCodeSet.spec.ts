/**
 * ⭐ W1 + W2 — THE GOAL FIGURES ARE WITHHELD FOR MORE THAN ONE REASON, AND THE UI READS EVERY ONE (AIQ #72 5893824972;
 * PLoT #422 served `cdf3422`).
 *
 * PLoT now withholds the goal figures on the same carrier for a user-stated link size on the goal's path that was cut
 * to the model's scale, and says so with its own typed warning, `GOAL_FIGURES_USER_EFFECT_CLAMPED`. Before this the
 * UI matched only `GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED`, so a clamp withhold read as a generic absence, and the
 * mapper's fallbacks were free to re-show the figures from other carriers.
 *
 * The clamp message below is the PRODUCER'S OWN expected string (PLoT #422
 * `tests/clamped-user-effect-withhold.route.test.ts`), not a sentence written here.
 */
import { describe, it, expect } from 'vitest'
import {
  GOAL_FIGURES_USER_EFFECT_CLAMPED_CODE,
  GOAL_IDENTITY_NOT_EVALUATED_CODE,
  GOAL_IDENTITY_WITHHELD_FALLBACK,
  readGoalIdentityWithheld,
} from '../goalIdentityWithheld'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

const CLAMP_WORDS =
  "Not shown. Your size for how ‘Pro paying subscribers’ moves ‘MRR’ is bigger than this model's scale can hold, so the run couldn't use it at full size, and the figures that depend on it would be wrong."
const CLAMP = { code: GOAL_FIGURES_USER_EFFECT_CLAMPED_CODE, severity: 'warning', node_ids: ['pro_paying_subscribers', 'mrr'], message: CLAMP_WORDS }

const IDENTITY_WORDS =
  "Not shown. 'MRR' depends on price × subscribers, but this run couldn't calculate it that way, so the figures for each option would be wrong."
const IDENTITY = { code: GOAL_IDENTITY_NOT_EVALUATED_CODE, severity: 'warning', node_ids: ['mrr'], message: IDENTITY_WORDS }

/** The DISCLOSURE PLoT sends when a cut size does NOT carry the goal figures: it withholds nothing. */
const DISCLOSED = {
  code: 'EDGE_STRENGTH_CLAMPED', severity: 'info', node_ids: ['pro_paying_subscribers', 'mrr'],
  message: "Olumi's estimate for ‘Pro paying subscribers’ → ‘MRR’ was capped at the model's limit.",
}

describe('the one reader matches every typed reason for withholding the goal figures', () => {
  it('a cut user size (PLoT #422) is read, in the producer\'s own words', () => {
    expect(readGoalIdentityWithheld({ inference_warnings: [CLAMP] })).toEqual({
      nodeIds: ['pro_paying_subscribers', 'mrr'],
      message: CLAMP_WORDS,
    })
  })

  it('an unevaluated identity (PLoT #416) is read exactly as before', () => {
    expect(readGoalIdentityWithheld({ inference_warnings: [IDENTITY] })).toEqual({ nodeIds: ['mrr'], message: IDENTITY_WORDS })
  })

  it('BOTH reasons: both are said, each in its own words, and every named element is kept', () => {
    const r = readGoalIdentityWithheld({ inference_warnings: [IDENTITY, CLAMP] })
    expect(r?.message).toBe(`${IDENTITY_WORDS} ${CLAMP_WORDS}`)
    expect(r?.nodeIds.sort()).toEqual(['mrr', 'pro_paying_subscribers'])
  })

  it('CONTRAST — the disclosure-only code withholds nothing', () => {
    expect(readGoalIdentityWithheld({ inference_warnings: [DISCLOSED] })).toBeNull()
  })

  it('words that are not display-safe fall back to the cause-neutral sentence, never a partial list', () => {
    const unsafe = { ...CLAMP, message: 'Not shown. pro_paying_subscribers → mrr was clamped.' }
    expect(readGoalIdentityWithheld({ inference_warnings: [unsafe] })?.message).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
    expect(readGoalIdentityWithheld({ inference_warnings: [IDENTITY, unsafe] })?.message).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
  })

  it('W1: the fallback names no cause (not evaluated · not confirmed · a size cut), and asks for nothing', () => {
    expect(GOAL_IDENTITY_WITHHELD_FALLBACK).toBe("Not shown. Olumi can't give each option's figures for this goal from this run.")
    expect(GOAL_IDENTITY_WITHHELD_FALLBACK).not.toMatch(/formula|calculat|confirm|size|scale|cut|depends/i)
  })
})

describe('the mapper withholds on a cut user size as it does on an unevaluated identity', () => {
  function block(warnings: unknown[]) {
    const entry = (id: string, label: string, wp: number, mean: number) => ({
      id, option_id: id, label, option_label: label, status: 'computed',
      win_probability: wp, expected_outcome: mean, confidence_interval: [mean - 1000, mean + 1000],
      outcome: { mean, p10: mean - 2000, p50: mean, p90: mean + 2000 },
      downside: { p10: mean - 2000 },
    })
    return {
      type: 'analysis_result',
      summary: 's',
      leading_option_id: 'raise',
      win_probabilities: { 'Raise the price': 0.7, 'Hold the price': 0.3 },
      enrichment: {
        option_comparison: [entry('raise', 'Raise the price', 0.7, 31000), entry('hold', 'Hold the price', 0.3, 29000)],
        decision_brief: { options: [{ id: 'raise', label: 'Raise the price', win_probability: 0.7 }, { id: 'hold', label: 'Hold the price', win_probability: 0.3 }] },
        robustness: { recommended_option_id: 'raise' },
        inference_warnings: warnings,
      },
    }
  }
  type Row = { win_probability?: number; expected?: number; outcome?: { p50?: number | null } }
  const rows = (warnings: unknown[]) =>
    Object.values((mapV5AnalysisToReport(block(warnings) as unknown as AnalysisResultBlock) as unknown as { option_probabilities: Record<string, Row> }).option_probabilities)

  it('GOAL_FIGURES_USER_EFFECT_CLAMPED: no carrier re-shows a win %, a mean or a centre', () => {
    const r = rows([CLAMP])
    expect(r).toHaveLength(2)
    for (const o of r) {
      expect(o.win_probability).toBeUndefined()
      expect(o.expected).toBeUndefined()
      expect(o.outcome?.p50 ?? null).toBeNull()
    }
  })

  it('CONTROL — with only the disclosure, every figure stays', () => {
    const r = rows([DISCLOSED])
    expect(r.map((o) => o.win_probability).sort()).toEqual([0.3, 0.7])
    expect(r.every((o) => typeof o.expected === 'number')).toBe(true)
  })
})

describe("CEE's own goal-figure withholds are read too (MG #75 5904463351)", () => {
  // The words are MG's quote of CEE #2340's message opening (not the full producer string); the row binds the CODE.
  const PRODUCT_NOT_READ = { code: 'GOAL_FIGURES_PRODUCT_NOT_READ', severity: 'warning', node_ids: ['mrr'], message: 'Not shown. Olumi has not read ‘MRR’ as price × subscribers.' }
  const PLACEHOLDER = { code: 'GOAL_FIGURES_PLACEHOLDER_PATH', severity: 'warning', node_ids: ['mrr'], message: 'Not shown. A placeholder sits on the path to ‘MRR’.' }
  it('RED: an m0-shaped body with the Gate 5 warning shows its own words', () => {
    expect(readGoalIdentityWithheld({ inference_warnings: [PRODUCT_NOT_READ] })?.message).toBe(PRODUCT_NOT_READ.message)
    expect(readGoalIdentityWithheld({ inference_warnings: [PLACEHOLDER] })?.message).toBe(PLACEHOLDER.message)
  })
  it('CONTROL: EDGE_STRENGTH_CLAMPED alone still withholds nothing', () => {
    expect(readGoalIdentityWithheld({ inference_warnings: [DISCLOSED] })).toBeNull()
  })
})
