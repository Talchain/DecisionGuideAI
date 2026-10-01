/**
 * ⭐ OLUMI'S FIGURE, ACCEPTED, READS AS OLUMI'S — ACCEPTED, NEVER THE USER'S OWN (52f8cd; AIQ words #75 5921018606;
 * DL CR on CEE #2412 5921764485: branch on the adoption fact the writer stores, never on the bare literal).
 *
 * `user_assumption` has two writers: the user marking a figure as their own assumption (bare), and CEE's approved
 * adoption of Olumi's proposed figure, which since #2412 also records the approval as `observed_state.reviewed_by_user`
 * (`intent: 'confirm'`) and stamps the node `ai_inferred`. Only that pair is Olumi's figure, accepted — the same rule as
 * CEE's `isAcceptedOlumiEstimate`. The bare literal is still the user's assumption.
 *
 * The ADOPTED pair below is the shape #2412's writer stores (`values-only-adoption-is-an-assumption.test.ts` pins it on
 * the real writer); it is constructed here, so a served capture after #2412 merges is owed (52f8cd, served witness).
 * The LEGACY rows are a served read: the pre-#2412 adoption, `user_assumption` with no review beside node `user_set`.
 * Canvas node data carries the same object under `observedState` (`conversation/utils/applyPatch.ts:86`).
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import served from './fixtures/served-accepted-olumi-estimate-c708fca5.json'
import {
  VALUE_PROVENANCE_LABEL,
  classifyObservedValueProvenance,
  classifyValueProvenance,
} from '../valueProvenance'
import { factorValueSourceMark } from '../../nodes/shared/valueSourceMark'
import { resolveProvenanceMarks } from '../../nodes/shared/NodeProvenanceMark'
import { render, screen, cleanup } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { afterEach } from 'vitest'
import { toModelRows } from '../../model-tab-v2/adapters'
import { ModelDetailRegion } from '../../model-tab-v2/ModelDetailRegion'
import type { ModelRowDetail } from '../../model-tab-v2/types'
import { ModelRowView } from '../../model-tab-v2/ModelRowView'
import { buildEstimateRows } from '../../components/pre-analysis-v3/selectors/buildEstimateRows'
import type { RankingResult } from '../../components/pre-analysis-v3/types'
import { provenanceToPill } from '../../components/pre-analysis/provenanceUtils'
import { factorValueSourceLabel, getInputGroupLabel, getProvenanceLabel } from '../../ui/inspector-v2/inspectorStrings'
import { userValueReplacesPrior } from '../../nodes/shared/factorPriorRange'
import { hasObservedData } from '../../utils/observedStateHelpers'
import { mapSourceToDisplay } from '../../components/model-tab/utils'
import { REVIEW_TOOL_COPY, reviewValueProvenance } from '../../../components/results/analysisNew/buildReviewQueue'
import { isAcceptedOlumiFigure } from '../valueProvenance'
import { buildModelStrip } from '../../../components/results/analysisNew/buildModelStrip'
import { unsetBucketOf } from '../../model-tab-v2/ModelOutline'

const ACCEPTED = 'Olumi’s estimate · you accepted it'
const AT = '2026-09-30T23:00:00.000Z'
type Observed = Record<string, unknown>
const factorData = (observedState: Observed, provenance: string) => ({ label: 'Warm introductions', provenance, observedState })

/** The approved adoption as #2412 stores it. */
const ADOPTED: Observed = { unit: 'introductions/week', value: 0.04, raw_value: 2, source: 'user_assumption', reviewed_by_user: { intent: 'confirm', at: AT } }
/** The DL's negative: the brief's own figure, marked as the user's assumption — no review. */
const BRIEF_MARKED: Observed = { unit: 'introductions/week', value: 0.04, raw_value: 2, source: 'user_assumption' }

describe('the adopted pair (#2412): Olumi’s figure, accepted', () => {
  it('RED: the one reader says ACCEPTED, not user-owned', () => {
    expect(classifyObservedValueProvenance(ADOPTED)).toEqual({ kind: 'accepted', userOwned: false })
    expect(VALUE_PROVENANCE_LABEL.accepted).toBe(ACCEPTED)
  })

  it('RED: the card’s value mark is Olumi’s token with AIQ’s words — never "you", never "not yet confirmed"', () => {
    const mark = factorValueSourceMark(factorData(ADOPTED, 'ai_inferred'))
    expect(mark).toEqual({ kind: 'olumi', label: ACCEPTED })
  })

  it('RED: the header says exactly what it says over Olumi\u2019s unaccepted figure — no first-person or second mark', () => {
    const OLUMIS: Observed = { unit: 'introductions/week', value: 0.04, raw_value: 2, source: 'cee_inference', extractionType: 'inferred' }
    const header = resolveProvenanceMarks('factor', factorData(ADOPTED, 'ai_inferred'))
    expect(header).toEqual(resolveProvenanceMarks('factor', factorData(OLUMIS, 'ai_inferred')))
    expect(JSON.stringify(header)).not.toMatch(/"(human|assumption|edited|confirmed)"/)
  })
})

describe('NEGATIVE (DL 5921764485): the brief’s own figure, marked as the user’s assumption, stays THEIRS', () => {
  it('the bare literal is the user’s assumption, on the reader and the card', () => {
    expect(classifyObservedValueProvenance(BRIEF_MARKED)).toEqual({ kind: 'assumption', userOwned: true })
    expect(factorValueSourceMark(factorData(BRIEF_MARKED, 'user_set'))).toEqual({ kind: 'you', label: 'Your assumption' })
  })

  it('a link-pairing quote (`confirm_pairing`) is not the acceptance of a figure', () => {
    const pairing = { ...BRIEF_MARKED, reviewed_by_user: { intent: 'confirm_pairing', quote: 'q' } }
    expect(classifyObservedValueProvenance(pairing)).toEqual({ kind: 'assumption', userOwned: true })
  })

  it('a review on any OTHER literal is left to that literal’s class (a typed figure stays the user’s; Olumi’s stays Olumi’s)', () => {
    expect(classifyObservedValueProvenance({ source: 'user_override', reviewed_by_user: { intent: 'confirm', at: AT } }))
      .toEqual(classifyValueProvenance('user_override'))
    expect(classifyObservedValueProvenance({ source: 'cee_inference', reviewed_by_user: { intent: 'confirm', at: AT } }))
      .toEqual(classifyValueProvenance('cee_inference'))
  })

  it('the pair differs ONLY in the review (a reader keyed on the literal or the value gives one answer)', () => {
    const { reviewed_by_user: _r, ...withoutReview } = ADOPTED
    expect(withoutReview).toEqual(BRIEF_MARKED)
  })

  it('an unknown source stays unknown, and a non-record reads as nothing', () => {
    expect(classifyObservedValueProvenance({ source: 'something_new', reviewed_by_user: { intent: 'confirm', at: AT } })).toBeNull()
    expect(classifyObservedValueProvenance(undefined)).toBeNull()
    expect(classifyObservedValueProvenance('user_assumption')).toBeNull()
  })
})

describe('LEGACY (served CEE 5479e15e, guest c708fca5): the pre-#2412 adoption carries no review', () => {
  type ServedNode = { id: string; label: string; provenance?: string; observed_state?: Observed }
  const node = (id: string) => (served.nodes as ServedNode[]).find((n) => n.id === id)!

  it('precondition: the capture is the pre-#2412 shape (user_assumption beside node user_set, no review)', () => {
    const adopted = node('warm_introductions')
    expect(adopted.observed_state?.source).toBe('user_assumption')
    expect(adopted.provenance).toBe('user_set')
    expect(adopted.observed_state).not.toHaveProperty('reviewed_by_user')
  })

  it('NAMED RESIDUAL (AIQ 5922083219): with no adoption fact stored, it still reads as the user’s assumption', () => {
    expect(classifyObservedValueProvenance(node('warm_introductions').observed_state)).toEqual({ kind: 'assumption', userOwned: true })
  })

  it('CONTRAST: Olumi’s estimate the user never accepted stays Olumi’s and is never "accepted"', () => {
    const cold = node('cold_emails')
    expect(classifyObservedValueProvenance(cold.observed_state)).toEqual({ kind: 'ai', userOwned: false })
    expect(factorValueSourceMark({ label: cold.label, provenance: cold.provenance, observedState: cold.observed_state })?.label).not.toBe(ACCEPTED)
  })
})

describe('every pre-run surface that names whose number it is says the same (52f8cd: the reader class, not one card)', () => {
  afterEach(cleanup)
  const rf = (observedState: Observed, provenance: string) =>
    ({ id: 'warm_introductions', type: 'factor', position: { x: 0, y: 0 }, data: factorData(observedState, provenance) }) as unknown as Node
  const ranking: RankingResult = { source: 'degree', weights: { warm_introductions: 1 }, ordered: ['warm_introductions'] } as RankingResult

  it('Model tab: the row carries the accepted fact and its pill says AIQ\u2019s words; the bare literal does not', () => {
    const [adopted] = toModelRows({ nodes: [rf(ADOPTED, 'ai_inferred')], edges: [], goalThreshold: null })
    const [bare] = toModelRows({ nodes: [rf(BRIEF_MARKED, 'user_set')], edges: [], goalThreshold: null })
    expect(adopted.provenanceAccepted).toBe(true)
    expect(bare).not.toHaveProperty('provenanceAccepted')
    const detail = { rowId: 'warm_introductions', priorIsExplicitlyUnquantified: false, classification: null, description: null,
      secondaryValues: [], basis: null, adjustments: [], affects: [], interventionCandidates: [], interventions: [], advancedParameters: [] } as unknown as ModelRowDetail
    render(<ModelDetailRegion row={adopted} detail={detail} tier="plain" />)
    expect(screen.getByTestId('model-detail-v2-provenance')).toHaveTextContent(ACCEPTED)
    cleanup()
    render(<ModelDetailRegion row={bare} detail={detail} tier="plain" />)
    expect(screen.getByTestId('model-detail-v2-provenance')).toHaveTextContent('Your assumption')
  })

  it('Model tab row mark (ModelRowView → ValueProvenanceMark, CODEX UI BUDDY 5922428997): accepted kind for the adopted row, assumption for the bare', () => {
    const [adopted] = toModelRows({ nodes: [rf(ADOPTED, 'ai_inferred')], edges: [], goalThreshold: null })
    const [bare] = toModelRows({ nodes: [rf(BRIEF_MARKED, 'user_set')], edges: [], goalThreshold: null })
    render(<><ModelRowView row={{ ...adopted, id: 'a' }} tier="plain" /><ModelRowView row={{ ...bare, id: 'b' }} tier="plain" /></>)
    expect(screen.getByTestId('model-row-v2-a-provenance-mark')).toHaveAttribute('data-provenance-kind', 'accepted')
    expect(screen.getByTestId('model-row-v2-b-provenance-mark')).toHaveAttribute('data-provenance-kind', 'assumption')
  })

  it('pre-analysis estimates: the adopted row is kind `accepted`; the bare literal stays `assumption`', () => {
    expect(buildEstimateRows([rf(ADOPTED, 'ai_inferred')], ranking, null)[0]?.provenanceKind).toBe('accepted')
    expect(buildEstimateRows([rf(BRIEF_MARKED, 'user_set')], ranking, null)[0]?.provenanceKind).toBe('assumption')
  })

  it('"What Olumi added": the accepted pill says AIQ\u2019s words; the bare literal keeps "Your assumption"', () => {
    expect(provenanceToPill(undefined, 'user_assumption', true)?.label).toBe(ACCEPTED)
    expect(provenanceToPill(undefined, 'user_assumption', false)?.label).toBe('Your assumption')
  })
})

describe('the rest of the reader class (AIQ census 5922532335; CODEX UI BUDDY 5922494814): one rule, every surface', () => {
  const adopted = factorData(ADOPTED, 'ai_inferred')
  const bare = factorData(BRIEF_MARKED, 'user_set')

  it('isAcceptedOlumiFigure reads canvas data, a wire node\u2019s observed state, and refuses the bare literal', () => {
    expect(isAcceptedOlumiFigure(adopted)).toBe(true)
    expect(isAcceptedOlumiFigure(ADOPTED)).toBe(true)
    expect(isAcceptedOlumiFigure({ observed_state: ADOPTED })).toBe(true)
    expect(isAcceptedOlumiFigure(bare)).toBe(false)
    expect(isAcceptedOlumiFigure(null)).toBe(false)
  })

  it('inspector: the value label, the provenance line and the input group never call the adopted figure the user\u2019s', () => {
    expect(factorValueSourceLabel(adopted)).toBe(ACCEPTED)
    expect(factorValueSourceLabel(bare)).toBe('Your assumption')
    expect(getProvenanceLabel('user_assumption', undefined, true)).toBe(ACCEPTED)
    expect(getProvenanceLabel('user_assumption')).toBe('Your assumption')
    expect(getInputGroupLabel('user_assumption', true, true)).toBe(getInputGroupLabel('cee_inference', true))
    expect(getInputGroupLabel('user_assumption', true, true)).not.toBe(getInputGroupLabel('user_assumption', true))
  })

  it('behaviour keyed on "the user\u2019s own": the adopted figure is Olumi\u2019s (no user value replaces the prior; not observed data)', () => {
    expect(userValueReplacesPrior(adopted)).toBe(false)
    expect(userValueReplacesPrior(bare)).toBe(true)
    expect(hasObservedData(adopted)).toBe(false)
    expect(hasObservedData(bare)).toBe(true)
  })

  it('Model tab: the adopted figure is stated (never "Not set") and its pasted source says AIQ\u2019s words', () => {
    const rf = { id: 'warm_introductions', type: 'factor', position: { x: 0, y: 0 }, data: adopted } as unknown as Node
    const [row] = toModelRows({ nodes: [rf], edges: [], goalThreshold: null })
    expect(row.primaryValue).not.toBeNull()
    expect(mapSourceToDisplay('user_assumption', true)).toBe(ACCEPTED)
    expect(mapSourceToDisplay('user_assumption')).toBe('Your assumption')
  })

  it('results strip: the node carries the accepted fact into the review tool; the bare literal does not', () => {
    const strip = (data: unknown) => buildModelStrip([{ id: 'warm_introductions', type: 'factor', data }])
    const nodeIn = (m: ReturnType<typeof buildModelStrip>) => m.rows.flatMap((r) => r.nodes).find((x) => x.id === 'warm_introductions')
    expect(nodeIn(strip(adopted))?.valueAccepted).toBe(true)
    expect(nodeIn(strip(bare))).not.toHaveProperty('valueAccepted')
  })

  it('Model outline: an unset row holding Olumi\u2019s accepted figure is never bucketed "yours"', () => {
    const [row] = toModelRows({ nodes: [{ id: 'warm_introductions', type: 'factor', position: { x: 0, y: 0 }, data: adopted } as unknown as Node], edges: [], goalThreshold: null })
    expect(unsetBucketOf({ ...row, primaryValue: null })).not.toBe('yours')
    expect(unsetBucketOf({ ...row, primaryValue: null, provenanceAccepted: undefined })).toBe('yours')
  })

  it('results review tool: the adopted figure is never "Your value"', () => {
    const f = { nodeId: 'warm_introductions', label: 'Warm introductions', valueText: '2', hasValue: true, valueSource: 'user_assumption', needsCheck: false }
    expect(reviewValueProvenance({ ...f, valueAccepted: true })).toBe(ACCEPTED)
    expect(reviewValueProvenance(f)).toBe(REVIEW_TOOL_COPY.yourValue)
  })
})
