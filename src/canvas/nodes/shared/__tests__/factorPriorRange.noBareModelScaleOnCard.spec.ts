/**
 * ⭐⭐ NO BARE INTERNAL MODEL SCALE ON A FACTOR CARD — design audit #3 (26 Sep
 * 2026), contract v3.1 `checks.factor`; ruling "omit, never invent".
 *
 * SERVED (`853feeb7`, 1280×800, all five starters at landing): 14 factor cards
 * read like "Current ARR | Range: 0.27 to 0.8 | no source" — pricing 2, market
 * 4, vendor 2, build 3, headcount 3. Every one of those lines is the starter's
 * own `display_value` ("0.27 to 0.8"), printed verbatim by the prior-range
 * owner's authored-string arm.
 *
 * ⚠ WHY THIS DOES NOT UNDO REVIEW F2 (#2085). F2 kept bare ranges on the card
 * because a range's ORIGIN is unrecorded: the inspector's range editor writes
 * `prior` with no stamp. That holds for a line COMPOSED from `prior`. It does
 * not hold for the producer's `display_value`, which no editor writes — so that
 * one arm is known not to be the person's number, and it is the only arm this
 * omits. The composed arm is pinned below as the contrast.
 *
 * Fixtures are the SHIPPED starter files, loaded through the app's own draft
 * adapter (`applyDraftResult`), and every assertion is bound to a node id.
 */
import { describe, it, expect } from 'vitest'
import pricing from '../../../starters/data/pricing-model.draft.json'
import market from '../../../starters/data/market-entry.draft.json'
import vendor from '../../../starters/data/vendor-selection.draft.json'
import build from '../../../starters/data/build-vs-buy.draft.json'
import headcount from '../../../starters/data/headcount-allocation.draft.json'
import { applyDraftResult } from '../../../utils/applyDraftResult'
import { useCanvasStore } from '../../../store'
import {
  resolveFactorPriorRange,
  resolveFactorPriorRangeEndsOnCard,
  resolveFactorPriorRangeOnCard,
  type FactorPriorRangeInputs,
} from '../factorPriorRange'

/** The 14 cards the audit measured, by starter and node id, with the line each printed. */
const SERVED: Record<string, Record<string, string>> = {
  'pricing-model': {
    fac_market_competition: 'Range: 0.3 to 0.8',
    fac_top_account_concentration: 'Range: 0.2 to 0.6',
  },
  'market-entry': {
    fac_arr: 'Range: 0.27 to 0.8',
    fac_competitive_intensity: 'Range: 0.3 to 0.8',
    fac_market_size: 'Range: 0.3 to 1',
    fac_team_capacity: 'Range: 0.25 to 0.75',
  },
  'vendor-selection': {
    fac_data_team_capacity: 'Range: 0.1 to 0.3',
    fac_migration_effort: 'Range: 0.25 to 0.75',
  },
  'build-vs-buy': {
    fac_billing_complexity: 'Range: 0.4 to 0.9',
    fac_platform_migration: 'Range: 0.4 to 1',
    fac_vendor_cost: 'Range: 0.25 to 0.75',
  },
  'headcount-allocation': {
    fac_eng_attrition: 'Range: 0.3 to 0.9',
    fac_market_demand: 'Range: 0.3 to 0.8',
    fac_quota_attainment: 'Range: 0.25 to 0.75',
  },
}

const STARTERS: Record<string, unknown> = {
  'pricing-model': pricing,
  'market-entry': market,
  'vendor-selection': vendor,
  'build-vs-buy': build,
  'headcount-allocation': headcount,
}

/** The inputs the card passes for a factor with no value line (`valueDisplay: null`). */
function inputsFor(data: Record<string, unknown>): FactorPriorRangeInputs {
  return {
    data,
    nodeCategory: data.category as string | undefined,
    observedState: (data.observedState ?? data.observed_state) as FactorPriorRangeInputs['observedState'],
    valueDisplay: null,
  }
}

function factorData(starter: string): Map<string, Record<string, unknown>> {
  const applied = applyDraftResult(STARTERS[starter] as never, { skipAutosave: true })
  expect(applied.nodeCount, `${starter} loaded`).toBeGreaterThan(0)
  const out = new Map<string, Record<string, unknown>>()
  for (const n of useCanvasStore.getState().nodes) {
    if (n.type === 'factor') out.set(n.id, n.data as Record<string, unknown>)
  }
  return out
}

describe('design audit #3 — the starter cards stop printing the model’s 0–1 range', () => {
  for (const [starter, cards] of Object.entries(SERVED)) {
    it(`${starter}: every served "Range: 0.x to 0.y" card line is omitted; the owner still states it`, () => {
      const facs = factorData(starter)
      for (const [id, servedLine] of Object.entries(cards)) {
        const data = facs.get(id)
        expect(data, `${starter}/${id} is in the adapted model`).toBeDefined()
        // PRECONDITION, bound to the served text: the owner (Model tab,
        // inspector) states exactly the line the audit measured on the card.
        expect(resolveFactorPriorRange(inputsFor(data!)), `${starter}/${id} owner`).toBe(servedLine)
        // THE FIX: the card says nothing — no invented unit, no substitute words.
        expect(resolveFactorPriorRangeOnCard(inputsFor(data!)), `${starter}/${id} card`).toBeNull()
        expect(resolveFactorPriorRangeEndsOnCard(inputsFor(data!)), `${starter}/${id} band`).toBeNull()
      }
    })
  }

  it('POSITIVE CONTROL — the served set is the 14 cards the audit counted, by id', () => {
    expect(Object.values(SERVED).reduce((n, c) => n + Object.keys(c).length, 0)).toBe(14)
  })
})

describe('CONTRAST — what F2 protects is unchanged', () => {
  it('a range COMPOSED from `prior` (no producer string — origin unrecorded) keeps its card line', () => {
    const data = { label: 'Market Receptivity', category: 'external', prior: { range_min: 0.3, range_max: 0.8 } }
    expect(resolveFactorPriorRangeOnCard(inputsFor(data))).toBe('Range: 0.3 to 0.8')
  })

  it('the producer’s string WITH a real unit keeps its card line ("0% to 13%")', () => {
    const data = { label: 'Monthly Churn Rate', category: 'external', prior: { range_min: 0, range_max: 0.13 }, display_value: '0% to 13%' }
    expect(resolveFactorPriorRangeOnCard(inputsFor(data))).toBe('Range: 0% to 13%')
  })

  it('a user-owned value restates the range as replaced, unchanged', () => {
    const data = {
      label: 'Competitive Intensity in Target Market',
      category: 'external',
      prior: { range_min: 0.3, range_max: 0.8 },
      display_value: '0.3 to 0.8',
      observedState: { value: 0.5, source: 'user_override' },
    }
    expect(resolveFactorPriorRangeOnCard(inputsFor(data))).toBe('Your value replaces the range 0.3 to 0.8')
  })
})
