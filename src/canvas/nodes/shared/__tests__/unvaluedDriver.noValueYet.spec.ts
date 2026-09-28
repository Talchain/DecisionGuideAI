/**
 * ⭐ PJ-B3 — A RANKED FACTOR THE RUN HELD NO VALUE FOR SAYS "no value yet"
 * (Canvas owner, 28 Sep 2026; R&C #72 5866297058).
 *
 * THE DEFECT (DL run `pj-20260928T075802Z/C01`): `factor_sensitivity` ranks
 * "Monthly churn" #2 with no `value_source` and no `observed_state` value. The
 * coaching card says it "has no value yet … that ranking comes from how the
 * model is built, not from your figures"; the canvas card printed a bare
 * "Driver 2 of M".
 *
 * THE FIXTURE IS SERVED, WITH ONE DOCUMENTED CHANGE. `served-pj-c-213830Z`
 * is journey C as served (CEE #2154's own fixture, copied verbatim): #1 "Pro
 * paying subscribers" AND #2 "Monthly churn" carry no `value_source`; the four
 * option levers carry one. C01 (08:27Z) is the same journey after #2154 with
 * #1 VALUED (R&C: "The hero takes #1 here (valued)"), so `c01Shaped` gives #1
 * the `value_source: 'brief_extraction'` it would carry and changes nothing
 * else: ONE ranked row without `value_source`, the others with one.
 *
 * WHAT THIS PINS (the typed fact and the words — rendering is
 * `FactorNode.noValueYet.servedC01.spec.tsx`):
 *   1. the fact, through the product's own path — `mapV5AnalysisToReport` →
 *      `selectDriverPolicyFeed` → `runHoldsNoValueFor` — bound by factor id;
 *      and the RANK is untouched (`rankFactor` still ranks Monthly churn #2);
 *   2. controls: all rows valued → nothing; NO row carries `value_source`
 *      (older payloads) → nothing, because the rule needs a contrast;
 *   3. the in-slot caption at the landing bound: the LONGEST of the owner's
 *      forms (written out HERE, not read from the product) that fits the
 *      shared measure, every one ending "no value yet";
 *   4. the "Worth reviewing" reason and the reduced (far-zoom) line carry the
 *      same words.
 */
import { describe, expect, it } from 'vitest'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { selectDriverPolicyFeed } from '../../../../components/results/useResultsSectionData'
import type { ResultsReport } from '../../../../components/results/types'
import { MAX_BADGED_RANK } from '../../../../components/results/driverDisplayModel'
import { MAX_LABEL_COUNTER_SCALE } from '../../../utils/zoomLegibility'
import { runHoldsNoValueFor } from '../unvaluedDriver'
import { rankFactor } from '../rankFactor'
import { restingDriverCaption, restingUnvaluedDriverCaption } from '../driverCaptionFit'
import { deriveAttentionPlan } from '../nodeAttention'
import { resolveLodMetricLineDetail } from '../lodMetricLine'
import { FACTOR_SLOT_MEASURE_PX, captionWidthPx } from '../../__tests__/__helpers__/driverCaptionFit'
import servedC from '../../__tests__/fixtures/served-pj-c-213830Z.unvalued-drivers.json'

type Row = { factor_id: string; value_source?: string; importance_rank?: number }
type Block = { enrichment: { factor_sensitivity: Row[] } }

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const served = (): Block => clone(servedC.analysis_block) as unknown as Block

/** C01: #1 valued (the one change), #2 "Monthly churn" still without a `value_source`. */
function c01Shaped(): Block {
  const block = served()
  const top = block.enrichment.factor_sensitivity.find((r) => r.factor_id === 'pro_paying_subscribers')!
  top.value_source = 'brief_extraction'
  return block
}
function allValued(): Block {
  const block = served()
  for (const r of block.enrichment.factor_sensitivity) r.value_source ??= 'cee_inference'
  return block
}
function noneCarry(): Block {
  const block = served()
  for (const r of block.enrichment.factor_sensitivity) delete r.value_source
  return block
}

const feedOf = (block: Block) =>
  selectDriverPolicyFeed(mapV5AnalysisToReport(block as never) as unknown as ResultsReport)

const FACTORS = servedC.draft.nodes.map((n) => n.id)
const unvalued = (block: Block) => {
  const feed = feedOf(block)
  return FACTORS.filter((id) => runHoldsNoValueFor(feed, id))
}

describe('the typed fact — a row with no value_source while other rows carry one — reaches the canvas feed', () => {
  it('wire premise (served): Monthly churn is ranked #2 by PLoT and carries no value_source; the option levers carry one', () => {
    const rows = served().enrichment.factor_sensitivity
    const churn = rows.find((r) => r.factor_id === 'monthly_churn')!
    expect(churn.importance_rank).toBe(2)
    expect(churn.value_source).toBeUndefined()
    expect(rows.filter((r) => typeof r.value_source === 'string').map((r) => r.factor_id).sort())
      .toEqual(['advertising_investment_share', 'incremental_growth_spend', 'new_feature_release_intensity', 'pro_plan_price'])
    // And its graph node holds no value (CEE #2154's second fact, true here too).
    expect(servedC.draft.nodes.find((n) => n.id === 'monthly_churn')!.observed_state).toBeNull()
  })

  it('C01-shaped: exactly Monthly churn is unvalued — by id, through mapV5AnalysisToReport and the shared feed', () => {
    expect(unvalued(c01Shaped())).toEqual(['monthly_churn'])
  })

  it('served C (both top rows lack one): both ranked factors are unvalued, the valued levers are not', () => {
    expect(unvalued(served()).sort()).toEqual(['monthly_churn', 'pro_paying_subscribers'])
  })

  it('THE RANK STAYS: Monthly churn is still Driver 2 of 2 on the canvas, with or without its value', () => {
    for (const block of [c01Shaped(), allValued()]) {
      const feed = feedOf(block)
      const r = rankFactor(feed.policyRows, feed.displayModel, 'monthly_churn')
      expect(r.sensitivityRank).toBe(2)
      expect(r.rankedSetSize).toBe(2)
    }
  })

  it('a factor the run did not analyse is never "unvalued"', () => {
    expect(runHoldsNoValueFor(feedOf(c01Shaped()), 'fac_not_in_run')).toBe(false)
  })

  it('CONTROL: every row valued → no factor is unvalued', () => {
    expect(unvalued(allValued())).toEqual([])
  })

  it('CONTROL: NO row carries value_source (older payloads) → nothing, because the rule needs a contrast', () => {
    const feed = feedOf(noneCarry())
    // Positive control: the rows ARE in the feed, so the silence is the rule's.
    expect(feed.policyRows.map((r) => r.key)).toContain('monthly_churn')
    expect(unvalued(noneCarry())).toEqual([])
  })
})

type Case = { rank: { rank: number; setSize: number }; stale: boolean }
const ALL_CASES: ReadonlyArray<Case> = (() => {
  const out: Case[] = []
  for (let m = 1; m <= MAX_BADGED_RANK; m++) {
    for (let r = 1; r <= m; r++) out.push({ rank: { rank: r, setSize: m }, stale: false }, { rank: { rank: r, setSize: m }, stale: true })
  }
  return out
})()
const label = ({ rank: { rank, setSize }, stale }: Case) => `${stale ? 'stale' : 'fresh'} ${rank} of ${setSize}`

/** The owner's forms, longest first, written out HERE so the product cannot pass by changing its own list. */
const ownerForms = ({ rank: { rank: n, setSize: m }, stale }: Case): string[] =>
  stale
    ? [`Last run · Driver ${n} of ${m} · no value yet`, 'Last run · no value yet']
    : [`Driver ${n} of ${m} ranked · no value yet`, `Driver ${n} of ${m} · no value yet`, `Driver ${n} · no value yet`, 'no value yet']

const fitsAtLanding = (text: string) => captionWidthPx(text, MAX_LABEL_COUNTER_SCALE) <= FACTOR_SLOT_MEASURE_PX

describe('the in-slot caption: the longest owner form that fits at the landing bound, and "no value yet" is always in it', () => {
  it.each(ALL_CASES.map((c) => [label(c), c] as const))('%s', (_, c) => {
    const caption = restingUnvaluedDriverCaption(c.rank, c.stale)
    const expected = ownerForms(c).find(fitsAtLanding)
    expect(expected, 'some owner form fits').toBeDefined()
    expect(caption).toBe(expected)
    expect(captionWidthPx(caption, MAX_LABEL_COUNTER_SCALE)).toBeLessThanOrEqual(FACTOR_SLOT_MEASURE_PX)
    expect(caption.endsWith('no value yet')).toBe(true)
    if (c.stale) expect(caption.startsWith('Last run · ')).toBe(true)
  })

  it('at 1.64 against 220px: fresh keeps "Driver N" (the rank stays), stale keeps "Last run"', () => {
    expect(restingUnvaluedDriverCaption({ rank: 2, setSize: 2 })).toBe('Driver 2 · no value yet')
    expect(restingUnvaluedDriverCaption({ rank: 1, setSize: 1 })).toBe('Driver 1 of 1 · no value yet')
    expect(restingUnvaluedDriverCaption({ rank: 2, setSize: 3 }, true)).toBe('Last run · no value yet')
  })

  it('CONTROL: the choice follows the width — at 100% the same rule picks each list’s longest form', () => {
    for (const c of ALL_CASES) expect(restingUnvaluedDriverCaption(c.rank, c.stale, 1), label(c)).toBe(ownerForms(c)[0])
  })

  it('CONTROL: the rank-less last resort is chosen only when no rank form fits (a narrower bound)', () => {
    // At ×2.1 even "Driver 3 · no value yet" (114px at 100%) overflows 220px; the rank words go, the words stay.
    expect(fitsAtLanding('Driver 3 · no value yet')).toBe(true)
    expect(captionWidthPx('Driver 3 · no value yet', 2.1)).toBeGreaterThan(FACTOR_SLOT_MEASURE_PX)
    expect(restingUnvaluedDriverCaption({ rank: 3, setSize: 3 }, false, 2.1)).toBe('no value yet')
  })

  it('CONTROL: a valued rank is untouched — the existing ladder, no "no value yet"', () => {
    expect(restingDriverCaption({ rank: 2, setSize: 2 })).toBe('Driver 2 of 2 ranked')
    for (const c of ALL_CASES) expect(restingDriverCaption(c.rank, c.stale)).not.toContain('no value yet')
  })
})

describe('the other graph surfaces that state the rank carry the same words', () => {
  const planFor = (noValueInRun: boolean | undefined) =>
    deriveAttentionPlan({
      nodes: [{ id: 'monthly_churn', label: 'Monthly churn', unconfirmedEstimate: false }],
      run: {
        ranks: new Map([['monthly_churn', { sensitivityRank: 2, voiRank: null, influenceSetSize: 6, rankedSetSize: 2, noValueInRun }]]),
        turningPoints: new Map(),
        fragileEdgeSources: new Set(),
        reviewBiasFindings: [],
      },
      ceeBiasFindings: [],
      resolveBiasTitle: () => null,
    } as never)

  it('"Worth reviewing": the owner’s sentence and the ask for the value, not "How sure are you of its value?"', () => {
    const labels = planFor(true).reasonsByNode.get('monthly_churn')!.map((r) => r.label)
    expect(labels).toEqual([
      'Driver 2 of 2 ranked in this run — ranked by how the model is built; this factor has no value yet. What is its value today?',
    ])
  })

  it('CONTROL: a valued (or unstated) rank keeps its reason unchanged', () => {
    for (const flag of [false, undefined]) {
      expect(planFor(flag).reasonsByNode.get('monthly_churn')!.map((r) => r.label)).toEqual([
        'Driver 2 of 2 ranked in this run: the comparison responds strongly to it. How sure are you of its value?',
      ])
    }
  })

  const lodLine = (driverNoValueYet: boolean, influenceFromLastRun = false) =>
    resolveLodMetricLineDetail({
      nodeType: 'factor',
      data: { label: 'Monthly churn', kind: 'factor', category: 'observable' },
      label: 'Monthly churn',
      displayMetadata: { influence: 0.5, influenceProvenance: 'influence_score' } as never,
      facts: { driverRank: { rank: 2, setSize: 2 }, driverNoValueYet, influenceFromLastRun },
    }).text

  it('the far-zoom reduced line states the card’s resting caption, fitted, so its ellipsis cannot eat "no value yet"', () => {
    expect(lodLine(true)).toBe('Driver 2 · no value yet')
    expect(lodLine(true, true)).toBe('Last run · no value yet')
  })

  it('CONTROL: a valued rank’s reduced line is unchanged', () => {
    expect(lodLine(false)).toBe('Driver 2 of 2 ranked in this run')
    expect(lodLine(false, true)).toBe('Last run · Driver 2 of 2 ranked')
  })
})
