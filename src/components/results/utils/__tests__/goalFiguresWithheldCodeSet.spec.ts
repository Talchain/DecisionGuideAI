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
  readGoalWithheldReasonFor,
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

  it('identical options (CEE #2574 gate 1 v2) are read, in the producer\'s own words', () => {
    // CEE's own expected string (identical-arms.test.ts BASELINE_LINE), "Not shown." + the disclosure.
    const words = "Not shown. Hire Two came out identical to Carry On: in this model it doesn't change the outcome. The comparison is held back until it differs: edit its value, or remove it."
    const identical = { code: 'GOAL_FIGURES_OPTIONS_IDENTICAL', severity: 'warning', option_ids: ['carry_on', 'hire_two'], message: words }
    expect(readGoalIdentityWithheld({ inference_warnings: [identical] })).toEqual({ nodeIds: [], message: words })
    expect(readGoalIdentityWithheld({ inference_warnings: [{ ...identical, code: 'GOAL_FIGURES_OPTIONS_IDENTICAL_X' }] })).toBeNull()
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

describe('readGoalWithheldReasonFor: option-bound reasons', () => {
  const placeholder = { code: 'GOAL_FIGURES_PLACEHOLDER_PATH', option_ids: ['shop'], message: '  The shop link needs a size.  ' }
  const target = { code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', option_ids: ['app'], message: 'Not shown. The app link needs a size.' }
  const read = (warnings: unknown[], id = 'shop') => readGoalWithheldReasonFor({ inference_warnings: warnings }, id)

  it('binds different scopes before applying the target-over-placeholder rule', () => {
    expect(read([placeholder, target])).toBe('The shop link needs a size.')
    expect(read([placeholder, target], 'app')).toBe('The app link needs a size.')
  })

  it('never uses an excluded warning, even with an own per-option entry', () => {
    expect(read([{ ...target, per_option: { shop: { message: 'Not shown. Wrong option.' } } }])).toBeNull()
  })

  it('uses an own target per-option message before the general reasons', () => {
    expect(read([placeholder, { ...target, option_ids: ['shop'], per_option: {
      shop: { message: 'Not shown. Its own link needs a size.' },
    } }])).toBe('Its own link needs a size.')
  })

  it.each(['inherited', 'wrong prefix', 'wrong code'] as const)('ignores a %s per-option entry', kind => {
    const entry = { message: 'Not shown. Wrong words.' }
    const per_option = kind === 'inherited' ? Object.create({ shop: entry })
      : { shop: kind === 'wrong prefix' ? { message: 'Not shown yet.' } : entry }
    expect(read([{ ...target, option_ids: ['shop'], per_option,
      ...(kind === 'wrong code' ? { code: 'GOAL_FIGURES_PLACEHOLDER_PATH' } : {}),
    }])).toBe('The app link needs a size.')
  })

  it('supersedes only the same option\'s placeholder and retains distinct independent reasons', () => {
    const ownTarget = { ...target, option_ids: ['shop'] }
    const independent = { ...IDENTITY, option_ids: ['shop'] }
    expect(read([{ ...placeholder, message: 'unsafe_id' }, ownTarget, independent, ownTarget, independent]))
      .toBe(`The app link needs a size. ${IDENTITY_WORDS.slice('Not shown.'.length).trim()}`)
  })

  it.each([undefined, null, [], ['shop', 7], 'app'])('uses B3 fail-closed scope for %j', option_ids => {
    expect(read([{ ...target, option_ids }])).toBe('The app link needs a size.')
  })

  it.each([undefined, null, {}, { inference_warnings: [] }])('returns null without a covering warning in %j', holder => {
    expect(readGoalWithheldReasonFor(holder, 'shop')).toBeNull()
  })

  it('ignores unknown codes and another option\'s unsafe reason', () => {
    expect(read([{ ...placeholder, code: 'GOAL_FIGURES_UNKNOWN' }, target])).toBeNull()
    expect(read([placeholder, { ...target, message: 'unsafe_id' }])).toBe('The shop link needs a size.')
  })

  it.each([undefined, '', 'Not shown.', 'Not shown. unsafe_id', '<link>', '{link}', '[link]', 'x'.repeat(401)])(
    'returns null for an unsafe/missing chosen message %j', message => {
      expect(read([{ ...placeholder, message }])).toBeNull()
      expect(read([placeholder, { ...IDENTITY, option_ids: ['shop'], message }])).toBeNull()
    },
  )

  it('rejects an unsafe own per-option reason', () => {
    expect(read([{ ...target, option_ids: ['shop'], per_option: { shop: { message: 'Not shown. unsafe_id' } } }])).toBeNull()
  })

  it('accepts the 400-character boundary after trimming and strips each leading prefix', () => {
    expect(read([{ ...placeholder, message: ` ${'x'.repeat(400)} ` }])).toBe('x'.repeat(400))
    expect(read([{ ...placeholder, message: ' Not shown. Shop reason. ' }, { ...IDENTITY, message: ' Not shown. Formula reason. ' }]))
      .toBe('Shop reason. Formula reason.')
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

describe('CEE #2371 — an exploratory run withholds the goal figures under GOAL_FIGURES_TARGET_NOT_TESTABLE', () => {
  // The producer's message shape (MG SUCCESSOR #75 5914733634 / 5915202903): "Not shown. " + the DR sentence, on Paul's
  // funding graph ending in its one question.
  const WORDS =
    "Not shown. Olumi can compare your options, but can't yet test them against your target (at least £1,200,000), because it needs today's level of securing funding and the model doesn't yet say how Investment firm meetings turns into securing funding. What is securing funding today?"
  const TARGET_NOT_TESTABLE = { code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', severity: 'warning', node_ids: ['securing_funding'], message: WORDS }
  it('⭐ is read as a withhold, in the producer\'s own words (the question included)', () => {
    expect(readGoalIdentityWithheld({ inference_warnings: [TARGET_NOT_TESTABLE] })).toEqual({ nodeIds: ['securing_funding'], message: WORDS })
  })
  it('CONTROL: an unknown GOAL_FIGURES_* code is still not a withhold (the set is closed)', () => {
    expect(readGoalIdentityWithheld({ inference_warnings: [{ ...TARGET_NOT_TESTABLE, code: 'GOAL_FIGURES_SOMETHING_ELSE' }] })).toBeNull()
  })
})
