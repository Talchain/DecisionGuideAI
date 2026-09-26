/**
 * ⭐⭐ A STATED VALUE REPLACES THE RANGE — so the range may not be shown as live.
 *
 * The defect, derived at the bytes (lane notes
 * `output/canvas-review-20260922/lanes/external-factors.md`, re-read at PLoT
 * `staging` 5039cca4 for this change):
 *
 *   · An external factor carrying a drafted `prior` can receive a user point
 *     value today (Model tab editor, unflagged). CEE stamps
 *     `observed_state.source = 'user_override'` and leaves `prior` untouched.
 *   · PLoT `buildParameterUncertaintiesV3` skips the prior pass for any factor
 *     whose `observed_state.value !== undefined` — "a stated value always wins,
 *     whatever the category" — and sends a Normal around the value instead.
 *     ISL never reads `node.prior`.
 *
 * So the card read the user's value AND `Range: 0.3 to 0.8`, a range the
 * analysis no longer uses. This file pins the owner's answer for that state,
 * and — equally — that every state WITHOUT a user-owned value renders exactly
 * as it did (the regression twin of each case).
 *
 * ⚠ THE PREDICATE IS THE ESTATE'S, NOT THIS FILE'S: `classifyValueProvenance`
 * (`domain/valueProvenance.ts`) `.userOwned`, the same test `ModelOutline`
 * applies for its "yours" bucket. A model-authored value (`cee_inference`) and
 * a colleague's panel answer (`panel_elicited`) are NOT user-owned, so they are
 * pinned UNCHANGED here — that scope is the brief's, and the wider question
 * (PLoT's skip is source-agnostic) is reported, not decided, by this change.
 */
import { describe, it, expect } from 'vitest'
import { resolveFactorPriorRange } from '../factorPriorRange'
import { resolveLodMetricLine } from '../lodMetricLine'

const PRIOR = { distribution: 'uniform', range_min: 0.3, range_max: 0.8 }
const REPLACED = 'Your value replaces the range 0.3 to 0.8'
const LIVE = 'Range: 0.3 to 0.8'

function external(observed: Record<string, unknown> | undefined, extra: Record<string, unknown> = {}) {
  return {
    label: 'Market demand',
    category: 'external',
    prior: PRIOR,
    ...(observed === undefined ? {} : { observedState: observed }),
    ...extra,
  } as Record<string, unknown>
}

function resolve(data: Record<string, unknown>, valueDisplay: string | null) {
  const obs = (data.observedState ?? data.observed_state) as { unit?: string | null; cap?: number | null } | undefined
  return resolveFactorPriorRange({
    data,
    nodeCategory: data.category as string,
    observedState: obs,
    valueDisplay,
  })
}

describe('resolveFactorPriorRange — a user-owned value replaces the drafted range', () => {
  it('user_override value + prior: the line says the range is REPLACED, never "Range:"', () => {
    const line = resolve(external({ value: 0.55, source: 'user_override' }), '0.55')
    expect(line).toBe(REPLACED)
    expect(line).not.toMatch(/^Range:/)
  })

  it('TWIN — no observed state at all: exactly today\'s live range line', () => {
    expect(resolve(external(undefined), null)).toBe(LIVE)
  })

  it('reads the wire spelling too (`observed_state`), because real graphs carry both', () => {
    const data = {
      label: 'Market demand',
      category: 'external',
      prior: PRIOR,
      observed_state: { value: 0.55, source: 'user_override' },
    } as Record<string, unknown>
    expect(resolve(data, '0.55')).toBe(REPLACED)
  })

  it('a CONFIRMED value is user-owned too, so it also replaces the range', () => {
    expect(resolve(external({ value: 0.55, source: 'user_confirmed' }), '0.55')).toBe(REPLACED)
  })

  it('TWIN — a MODEL-authored value (cee_inference) is not user-owned: unchanged', () => {
    expect(resolve(external({ value: 0.55, source: 'cee_inference' }), '0.55')).toBe(LIVE)
  })

  it('TWIN — a colleague\'s panel answer is not user-owned: unchanged', () => {
    expect(resolve(external({ value: 0.55, source: 'panel_elicited' }), '0.55')).toBe(LIVE)
  })

  it('TWIN — a user stamp with NO number is not a stated value: unchanged', () => {
    expect(resolve(external({ source: 'user_override' }), null)).toBe(LIVE)
  })

  it('the calibrated arm keeps its units inside the replacement line', () => {
    const data = external({ value: 0.55, raw_value: 55000, unit: '£', cap: 100000, source: 'user_override' })
    expect(resolve(data, '£55,000')).toBe('Your value replaces the range £30,000 to £80,000')
  })

  it('TWIN — the calibrated arm without a user value is unchanged', () => {
    const data = external({ unit: '£', cap: 100000 })
    expect(resolve(data, null)).toBe('Range: £30,000 to £80,000')
  })

  it('⛔ never quotes CEE\'s display_value as "the range" once the user has set a point', () => {
    // CEE rewrites `display_value` FROM THE POINT on a value edit
    // (`set-factor-value.ts:696`), so on the valueless-caller arm the authored
    // string is the user's own number. Preferring it here would print
    // "replaces the range 0.55" — the value named as the thing it replaced.
    const data = external({ value: 0.55, source: 'user_override' }, { display_value: '0.55' })
    expect(resolve(data, null)).toBe(REPLACED)
  })

  it('TWIN — with no user value the authored display_value still wins, byte-for-byte', () => {
    const data = external(undefined, { display_value: '30% to 80%' })
    expect(resolve(data, null)).toBe('Range: 30% to 80%')
  })

  it('an ignorance prior still prints nothing, user value or not', () => {
    const data = {
      label: 'Market demand',
      category: 'external',
      prior: { distribution: 'uniform', range_min: 0, range_max: 1, prior_is_unquantified: true },
      observedState: { value: 0.55, source: 'user_override' },
    } as Record<string, unknown>
    expect(resolve(data, '0.55')).toBeNull()
  })
})

describe('the reduced (LOD) line — reads the same owner, never shows a live range beside a user value', () => {
  const metadata = {
    sensitivityRank: null,
    influence: null,
    influenceProvenance: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  } as never

  it('user value present: the line states the value, not a range', () => {
    const line = resolveLodMetricLine({
      nodeType: 'factor',
      data: external({ value: 0.55, source: 'user_override' }),
      label: 'Market demand',
      displayMetadata: metadata,
    })
    expect(line).not.toBeNull()
    expect(line).not.toContain('Range:')
    expect(line).not.toContain('replaces')
  })

  it('TWIN — no value: the reduced line is the live range, in the reader\'s unit', () => {
    // ⭐ v3.1 #20 (26 Sep, WS4): the reduced line reads the CARD's form, which
    // omits a bare 0–1 pair — so the twin carries its unit, and the bare shape
    // is pinned silent beside it (the owner above still states LIVE).
    const line = resolveLodMetricLine({
      nodeType: 'factor',
      data: external({ unit: '%' }),
      label: 'Market demand',
      displayMetadata: metadata,
    })
    expect(line).toBe('Range: 30% to 80%')
    expect(resolveLodMetricLine({
      nodeType: 'factor',
      data: external(undefined),
      label: 'Market demand',
      displayMetadata: metadata,
    })).toBeNull()
  })
})
