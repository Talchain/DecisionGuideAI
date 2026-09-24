/**
 * The model-wide review queue: two existing sources, one list, kinds READ from
 * the fields that say them and never guessed.
 *
 * The recommendations come from the REAL engine (`buildRecommendations`) fed
 * through the REAL view-model builder, so a renamed trigger id or a moved
 * field goes red here rather than silently falling to the neutral kind.
 */
import { describe, expect, it } from 'vitest'

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildModelStrip } from '../buildModelStrip'
import { buildStrengthenInputsForAnalysisNew } from '../buildStrengthenInputsForAnalysisNew'
import {
  buildReviewQueue,
  REVIEW_KIND_LABEL,
  REVIEW_TOOL_COPY,
  reviewItemAskPayload,
  reviewItemEditPayload,
  reviewKindFor,
  reviewValueProvenance,
  WHOLE_FRAMING_ASK,
  type ReviewQueueItem,
} from '../buildReviewQueue'
import type { AskOlumiPayload } from '../../coaching/askOlumiStore'
import { buildRecommendations } from '../../strengthen/buildRecommendations'
import type { Recommendation, StrengthenInputs } from '../../strengthen/strengthenTypes'
import { REVIEW_BRIEF_ASK } from '../../decision-overview/actionsCatalogue'
import { UNCONFIRMED_ESTIMATE_LABEL } from '../../../../canvas/domain/vocabulary'
import { genuineDecision } from './analysisNewFixtures'

const SHOWN = { show: true, value: 0.2, isDefaulted: false, isProvisional: false } as const
const HIDDEN = { show: false, hiddenReason: 'absent' } as const

/** Engine inputs that fire every UI trigger that can co-exist on one run. */
function firingInputs(overrides: Partial<StrengthenInputs> = {}): StrengthenInputs {
  const base = buildStrengthenInputsForAnalysisNew({
    data: genuineDecision(),
    guidanceItems: [],
    biasSignals: null,
    currentStage: null,
    analysisIdentityIsCurrent: true,
  })
  return {
    ...base,
    goalThreshold: null,
    hasStatedGoalTarget: false,
    analysisComplete: true,
    analysisIdentityIsCurrent: true,
    hasLeadingOption: true,
    flipThresholds: null,
    materialParametersAwaitingUserIds: ['f_a'],
    fragileEdges: [{ edgeId: 'e_ab', factorLabel: 'Price', switchProbability: 0.4 }],
    factors: [
      { factorId: 'f_a', label: 'Price', influence: 0.9, confidenceDisplay: SHOWN, canFocus: true },
      { factorId: 'f_b', label: 'Churn', influence: 0.3, confidenceDisplay: HIDDEN, canFocus: true },
      {
        factorId: 'f_c',
        label: 'Hiring cost',
        influence: 0.1,
        confidenceDisplay: HIDDEN,
        canFocus: true,
        worthInvestigating: true,
      },
    ],
    robustness: { status: 'computed', level: 'low' },
    biasFindingTypes: ['narrow_framing'],
    phase3Items: [
      { id: 'blk_assume', title: 'A load-bearing assumption', body: 'Churn is assumed flat.', signalCode: 'ASSUMPTION_CHECK', targetIds: ['f_b'], priorityRank: 60 },
      { id: 'blk_gap', title: 'An evidence gap', body: 'Nothing supports the hiring cost.', signalCode: 'EVIDENCE_GAP', targetIds: ['f_c'], priorityRank: 61 },
      { id: 'blk_pm', title: 'Pre-mortem', body: 'Imagine this failed.', signalCode: 'PRE_MORTEM', targetIds: [], priorityRank: 62 },
      { id: 'blk_cal', title: 'Outside view', body: 'Compare with similar cases.', signalCode: 'CALIBRATION_PROMPT', targetIds: ['e_cd'], priorityRank: 63 },
    ],
    ...overrides,
  }
}

/** Engine → view model → the field the tab mounts from. */
function interventionsFrom(inputs: StrengthenInputs): Recommendation[] {
  const vm = buildAnalysisNewViewModel({
    data: genuineDecision(),
    recommendations: buildRecommendations(inputs),
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_x',
  })
  return vm.strengthen.interventions
}

const byKey = (items: ReviewQueueItem[], key: string): ReviewQueueItem => {
  const found = items.find((i) => i.key === key)
  if (!found) throw new Error(`no item ${key}; have ${items.map((i) => i.key).join(', ')}`)
  return found
}

describe('kinds are read from the engine\'s own fields', () => {
  const interventions = interventionsFrom(firingInputs())
  const queue = buildReviewQueue({ interventions, nodes: [], edgeIds: ['e_ab', 'e_cd'] })

  it('PRECONDITION: the engine fired every trigger this spec names', () => {
    expect(interventions.map((r) => r.id).sort()).toEqual(
      [
        'strengthen:broaden',
        'strengthen:flip:e_ab',
        'strengthen:lehi:f_a',
        'strengthen:next-input:f_a',
        'strengthen:phase3:blk_assume',
        'strengthen:phase3:blk_cal',
        'strengthen:phase3:blk_gap',
        'strengthen:phase3:blk_pm',
        'strengthen:robustness',
        'strengthen:success-measure',
        'strengthen:voi:f_c',
      ].sort(),
    )
    // Nothing added, nothing lost, engine order kept.
    expect(queue.map((i) => i.key)).toEqual(interventions.map((r) => r.id))
  })

  it.each([
    ['strengthen:success-measure', 'framing', 'id-family'],
    ['strengthen:next-input:f_a', 'value', 'id-family'],
    ['strengthen:lehi:f_a', 'evidence', 'id-family'],
    ['strengthen:flip:e_ab', 'relationship', 'id-family'],
    ['strengthen:broaden', 'alternatives', 'id-family'],
    ['strengthen:phase3:blk_assume', 'assumption', 'signal-code'],
    ['strengthen:phase3:blk_gap', 'evidence', 'signal-code'],
    ['strengthen:phase3:blk_cal', 'relationship', 'edge-target'],
    // ⚠ The neutral arm: nothing in these says a kind.
    ['strengthen:voi:f_c', 'unclassified', 'none'],
    ['strengthen:robustness', 'unclassified', 'none'],
    ['strengthen:phase3:blk_pm', 'unclassified', 'none'],
  ])('%s → %s (%s)', (key, kind, basis) => {
    const item = byKey(queue, key)
    expect(item.kind).toBe(kind)
    expect(item.kindBasis).toBe(basis)
  })

  it('CONTRAST: the same edge-targeted card is neutral when the target is not a known edge', () => {
    const noEdges = buildReviewQueue({ interventions, nodes: [] })
    expect(byKey(noEdges, 'strengthen:phase3:blk_cal').kind).toBe('unclassified')
    // …while a kind said by the id family does not depend on the edge list.
    expect(byKey(noEdges, 'strengthen:flip:e_ab').kind).toBe('relationship')
  })

  it('commit reads as neutral too', () => {
    const commit = interventionsFrom(
      firingInputs({ robustness: { status: 'computed', level: 'high' }, stabilityLicensed: true }),
    )
    const item = byKey(buildReviewQueue({ interventions: commit, nodes: [] }), 'strengthen:commit')
    expect(item.kind).toBe('unclassified')
  })

  it('LOW_OPTION_COUNT is read off the code, and a bare broaden help type still says alternatives', () => {
    const recs = interventionsFrom(
      firingInputs({
        biasFindingTypes: [],
        phase3Items: [{ id: 'blk_low', title: 'Few options', body: 'Only two routes.', signalCode: 'LOW_OPTION_COUNT', targetIds: [], priorityRank: 60 }],
      }),
    )
    expect(byKey(buildReviewQueue({ interventions: recs, nodes: [] }), 'strengthen:phase3:blk_low')).toMatchObject({
      kind: 'alternatives',
      kindBasis: 'signal-code',
    })
    expect(
      reviewKindFor({ id: 'strengthen:phase3:x', helpType: 'broaden', targetId: null }, new Set()),
    ).toEqual({ kind: 'alternatives', basis: 'help-type' })
    // CONTRAST: every other help type alone says nothing.
    for (const helpType of ['clarify', 'challenge', 'evaluate', 'commit'] as const) {
      expect(reviewKindFor({ id: 'strengthen:phase3:x', helpType, targetId: null }, new Set()).kind).toBe(
        'unclassified',
      )
    }
  })

  it('a shared stem is not a family: "strengthen:flipper" is not a flip', () => {
    expect(reviewKindFor({ id: 'strengthen:flipper', helpType: 'clarify', targetId: null }, new Set()).kind).toBe(
      'unclassified',
    )
  })

  it('every kind has a label, and the neutral one names no kind', () => {
    expect(REVIEW_KIND_LABEL.unclassified).toBe('Reasoning')
    expect(Object.keys(REVIEW_KIND_LABEL).sort()).toEqual(
      ['alternatives', 'assumption', 'evidence', 'framing', 'relationship', 'unclassified', 'value'],
    )
  })

  it('the reason is whyNow verbatim, else signal verbatim', () => {
    const rec = interventions.find((r) => r.id === 'strengthen:flip:e_ab') as Recommendation
    expect(byKey(queue, rec.id).reason).toBe(rec.whyNow)
    const bare = buildReviewQueue({ interventions: [{ ...rec, whyNow: '' }], nodes: [] })
    expect(bare[0]?.reason).toBe(rec.signal)
  })
})

// ── The verify worklist, and the dedupe ───────────────────────────────────────

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Grow margin' } },
  { id: 'f1', type: 'factor', data: { label: 'Vendor cost', observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' } } },
  { id: 'f2', type: 'factor', data: { label: 'Team size', observedState: { value: 0.3, source: 'user_override' } } },
  { id: 'f3', type: 'factor', data: { label: 'Competitive pressure' } },
  { id: 'f4', type: 'factor', data: { label: 'Lead time', observedState: { value: 0.7 } } },
  { id: 'f5', type: 'factor', data: { label: 'Brief figure', observedState: { value: 0.5, source: 'brief_extraction' } } },
]

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'clarify',
    title: 'Give Vendor cost a value of your own',
    signal: 'The comparison is waiting on it.',
    whyNow: 'Setting it is necessary for a comparison you own.',
    tryThis: null,
    sourceLine: 'Source: the inputs Olumi reports this comparison is waiting on.',
    action: { kind: 'canvas-focus', label: 'Show me this factor' },
    targetId: 'f1',
    priority: 5,
    ...over,
  }) as Recommendation

describe('the factors come from the strip\'s own verify worklist', () => {
  it('the same members, in the same order, as the strip counts', () => {
    const queue = buildReviewQueue({ interventions: [], nodes: NODES })
    const strip = buildModelStrip(NODES)
    const stripVerify = (strip.rows.find((r) => r.kind === 'factor')?.nodes ?? []).filter((n) => n.needsCheck)
    expect(queue.map((i) => i.targetId)).toEqual(stripVerify.map((n) => n.id))
    expect(queue.length).toBe(strip.needsCheckTotal)
    // The members this fixture was built to discriminate.
    expect(queue.map((i) => i.targetId)).toEqual(['f1', 'f4'])
    expect(queue[0]).toMatchObject({
      key: 'factor:f1',
      name: 'Vendor cost',
      kind: 'value',
      kindBasis: 'verify-list',
      reason: UNCONFIRMED_ESTIMATE_LABEL,
      recommendation: null,
    })
  })

  it('an intervention and a factor about one node are ONE item, keeping the intervention\'s reason', () => {
    const r = rec({ id: 'strengthen:next-input:f1' })
    const queue = buildReviewQueue({ interventions: [r], nodes: NODES })
    expect(queue.map((i) => i.key)).toEqual(['strengthen:next-input:f1', 'factor:f4'])
    const merged = queue[0] as ReviewQueueItem
    expect(merged.reason).toBe(r.whyNow)
    expect(merged.factor).toMatchObject({ nodeId: 'f1', needsCheck: true })
    expect(merged.factor?.valueText).toBe(
      buildModelStrip(NODES).rows.find((row) => row.kind === 'factor')?.nodes[0]?.valueText,
    )
  })

  it('CONTRAST: without the intervention the factor stands alone', () => {
    const queue = buildReviewQueue({ interventions: [], nodes: NODES })
    expect(queue.some((i) => i.key === 'factor:f1')).toBe(true)
  })

  it('two findings about one node stay two items', () => {
    const queue = buildReviewQueue({
      interventions: [rec({ id: 'strengthen:next-input:f1' }), rec({ id: 'strengthen:lehi:f1', whyNow: 'A single figure hides uncertainty.' })],
      nodes: NODES,
    })
    expect(queue.filter((i) => i.targetId === 'f1').map((i) => i.key)).toEqual([
      'strengthen:next-input:f1',
      'strengthen:lehi:f1',
    ])
  })

  it('excludeId leaves the promoted card out, and its factor comes back as a factor item', () => {
    const promoted = rec({ id: 'strengthen:next-input:f1' })
    const other = rec({ id: 'strengthen:robustness', targetId: null })
    const queue = buildReviewQueue({ interventions: [promoted, other], excludeId: promoted.id, nodes: NODES })
    expect(queue.map((i) => i.key)).toEqual(['strengthen:robustness', 'factor:f1', 'factor:f4'])
    // CONTRAST: with nothing excluded the card is there and the factor folds into it.
    expect(buildReviewQueue({ interventions: [promoted, other], nodes: NODES }).map((i) => i.key)).toEqual([
      'strengthen:next-input:f1',
      'strengthen:robustness',
      'factor:f4',
    ])
  })

  it('an intervention about a user-owned factor carries its value but offers nothing to confirm', () => {
    const queue = buildReviewQueue({ interventions: [rec({ id: 'strengthen:lehi:f2', targetId: 'f2' })], nodes: NODES })
    expect(queue[0]?.factor).toMatchObject({ nodeId: 'f2', needsCheck: false })
  })
})

describe('provenance words', () => {
  const factorOf = (id: string) => {
    const queue = buildReviewQueue({ interventions: [rec({ id: `strengthen:lehi:${id}`, targetId: id })], nodes: NODES })
    return queue[0]?.factor ?? null
  }

  it.each([
    ['f1', REVIEW_TOOL_COPY.olumiEstimate],
    ['f2', REVIEW_TOOL_COPY.yourValue],
    ['f5', 'From brief'],
  ])('%s → %s', (id, word) => {
    expect(reviewValueProvenance(factorOf(id))).toBe(word)
  })

  it('a confirmed value is the reader\'s', () => {
    const nodes = [{ id: 'fc', type: 'factor', data: { label: 'X', observedState: { value: 0.2, source: 'user_confirmed' } } }]
    const f = buildReviewQueue({ interventions: [rec({ id: 'strengthen:lehi:fc', targetId: 'fc' })], nodes })[0]?.factor ?? null
    expect(reviewValueProvenance(f)).toBe(REVIEW_TOOL_COPY.yourValue)
  })

  it('⚠ an ABSENT source claims no author — the reason line carries the true part', () => {
    const f4 = factorOf('f4')
    expect(f4?.hasValue).toBe(true)
    expect(reviewValueProvenance(f4)).toBeNull()
    const item = buildReviewQueue({ interventions: [], nodes: NODES }).find((i) => i.key === 'factor:f4')
    expect(item?.reason).toBe(UNCONFIRMED_ESTIMATE_LABEL)
  })

  it('an unknown literal and a missing value say nothing', () => {
    const nodes = [{ id: 'fu', type: 'factor', data: { label: 'X', observedState: { value: 0.2, source: 'from_the_moon' } } }]
    const f = buildReviewQueue({ interventions: [rec({ id: 'strengthen:lehi:fu', targetId: 'fu' })], nodes })[0]?.factor ?? null
    expect(reviewValueProvenance(f)).toBeNull()
    expect(reviewValueProvenance(factorOf('f3'))).toBeNull()
  })
})

describe('ask payloads', () => {
  const phase3 = interventionsFrom(firingInputs()).find((r) => r.id === 'strengthen:phase3:blk_assume') as Recommendation

  it('the whole-framing ask is the estate\'s existing shared payload', () => {
    expect(WHOLE_FRAMING_ASK).toEqual({ ...REVIEW_BRIEF_ASK, source: 'chip' })
  })

  it('a finding carries its block_id and its attention note, as the tab\'s intervention route does', () => {
    const item = buildReviewQueue({ interventions: [phase3], nodes: [] })[0] as ReviewQueueItem
    const ask = reviewItemAskPayload(item)
    expect(ask.parameters).toEqual({ block_id: 'blk_assume' })
    expect(ask.context).toBe(phase3.whyNow)
    expect(ask.label).toBe(phase3.action.label)
    expect(ask.targetId).toBe('f_b')
    expect(ask.attentionNote).not.toBeNull()
    // "Add evidence or context" / "Edit this belief" send through the item
    // editor, which carries the same finding identity.
    const addContext = reviewItemEditPayload(item, { evidence: 'Signed contract, March' }) as AskOlumiPayload
    expect(addContext.parameters).toEqual({ block_id: 'blk_assume' })
    expect(addContext.label).toBe(REVIEW_TOOL_COPY.addContext)
    expect(addContext.targetId).toBe('f_b')
    expect(addContext.attentionNote).toEqual(ask.attentionNote)
    const edited = reviewItemEditPayload(item, { belief: 'It will not hold' }) as AskOlumiPayload
    expect(edited.label).toBe(REVIEW_TOOL_COPY.editBelief)
  })

  it('CONTRAST: a verify-list factor has no producer record, so it invents no parameters', () => {
    const item = buildReviewQueue({ interventions: [], nodes: NODES })[0] as ReviewQueueItem
    const ask = reviewItemAskPayload(item)
    expect(ask.parameters).toBeUndefined()
    expect(ask.targetId).toBe('f1')
    expect(ask.draft).toBe(REVIEW_TOOL_COPY.askFactorDraft('Vendor cost'))
    expect(reviewItemEditPayload(item, { evidence: 'A quote' })?.parameters).toBeUndefined()
  })

  it('the item editor sends nothing when every field is blank', () => {
    const item = buildReviewQueue({ interventions: [phase3], nodes: [] })[0] as ReviewQueueItem
    expect(reviewItemEditPayload(item, {})).toBeNull()
    expect(reviewItemEditPayload(item, { belief: '  ', evidence: '\n', source: ' ' })).toBeNull()
    // CONTRAST: a source alone is something to discuss.
    expect(reviewItemEditPayload(item, { source: 'Board minutes' })?.draft).toBe(
      [
        REVIEW_TOOL_COPY.editReviewing(phase3.title),
        REVIEW_TOOL_COPY.editSource('Board minutes'),
        REVIEW_TOOL_COPY.editClosing,
      ].join('\n'),
    )
  })
})
