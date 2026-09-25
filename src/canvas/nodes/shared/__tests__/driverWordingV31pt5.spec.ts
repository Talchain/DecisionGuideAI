/**
 * ⭐ DESIGN-GAP ROW 39 — THE DRIVER WORDING IS CONTRACT v3.1 POINT 5:
 *
 *   "“Driver N of M ranked in this run”, where M is the number of factors the
 *    run ranked. … Stale form: “Last run · Driver N of M ranked”."
 *
 * ⚠ THE WORDS AND THE NUMBER MOVE TOGETHER. "ranked in this run" is a claim
 * about M: printing it over the ANALYSED count (`influenceSetSize`, the served
 * M under ED #63 5806207128) would say six factors were ranked when three were.
 * So M is the RANKED count (`rankedSetSize` / `influenceRankedCount`) at every
 * surface that prints the rank: the card's driver line and cue
 * (`driverRankFor`), the reduced line (`lodMetricLine`, fed by the same), and
 * the "Worth reviewing" reason (`nodeAttention`).
 *
 * DISCRIMINATING FIXTURE: six analysed, three ranked — the two candidate Ms
 * differ, so a wording-only change (M still 6) fails here.
 */
import { describe, expect, it } from 'vitest'
import { DRIVER_LINE_COPY } from '../metricVocabulary'
import { driverRankFor } from '../../../hooks/useInfluenceRank'
import { influenceRankReadout } from '../../../../components/results/influenceScaleCopy'
import { deriveAttentionPlan } from '../nodeAttention'
import { resolveLodMetricLine } from '../lodMetricLine'
import type { NodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'

const ANALYSED = 6
const RANKED = 3

describe('row 39 — "Driver N of M ranked in this run" (v3.1 pt 5)', () => {
  it('the words: current and stale forms, verbatim', () => {
    expect(DRIVER_LINE_COPY.rank(1, RANKED)).toBe('Driver 1 of 3 ranked in this run')
    expect(DRIVER_LINE_COPY.rank(1, RANKED, true)).toBe('Driver 1 of 3 ranked')
  })

  it('the card\'s M is the RANKED count, not the analysed set (current run)', () => {
    const readout = influenceRankReadout(1, ANALYSED)
    expect(readout, 'precondition: the rank is licensed').not.toBeNull()
    expect(driverRankFor(readout, 1, ANALYSED, false, RANKED)).toEqual({ rank: 1, setSize: RANKED })
  })

  it('the card\'s M is the RANKED count on a known-changed model too', () => {
    expect(driverRankFor(null, 2, ANALYSED, true, RANKED)).toEqual({ rank: 2, setSize: RANKED })
  })

  it('CONTRAST — the publication guard is unchanged: a rank beyond the ranked count states nothing', () => {
    expect(driverRankFor(influenceRankReadout(4, ANALYSED), 4, ANALYSED, false, RANKED)).toBeNull()
  })

  it('the "Worth reviewing" reason prints the same N of M, ranked', () => {
    const plan = deriveAttentionPlan({
      nodes: [{ id: 'f1', label: 'Price', unconfirmedEstimate: false }],
      run: {
        ranks: new Map([['f1', { sensitivityRank: 1, voiRank: null, influenceSetSize: ANALYSED, rankedSetSize: RANKED }]]),
        turningPoints: new Map(),
        fragileEdgeSources: new Set(),
        reviewBiasFindings: [],
      },
      ceeBiasFindings: [],
      resolveBiasTitle: () => null,
    })
    const label = plan.reasonsByNode.get('f1')?.find((r) => r.kind === 'top_driver')?.label ?? ''
    expect(label.startsWith('Driver 1 of 3 ranked in this run: ')).toBe(true)
    expect(label).not.toContain('of 6')
  })

  it('the reduced line: current and stale forms', () => {
    const displayMetadata = {
      sensitivityRank: null, influence: 0.62, influenceProvenance: 'influence_score', confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null, stabilityPercentage: null, winRate: null,
      predictedOutcome: null, valueOfInformation: null, voiRank: null, isResultsMode: false,
    } as unknown as NodeDisplayMetadata
    const line = (fromLastRun: boolean) => resolveLodMetricLine({
      nodeType: 'factor', data: { label: 'Team capacity' }, label: 'Team capacity', displayMetadata,
      facts: { driverRank: { rank: 2, setSize: RANKED }, influenceFromLastRun: fromLastRun },
    })
    expect(line(false)).toBe('Driver 2 of 3 ranked in this run')
    expect(line(true)).toBe('Last run · Driver 2 of 3 ranked')
  })
})
