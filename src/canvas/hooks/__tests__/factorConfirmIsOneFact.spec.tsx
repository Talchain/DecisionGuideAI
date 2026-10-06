/**
 * ⭐ SD-1 (domain 2, github-07): A SIGNED-IN FACTOR CONFIRM IS ONE FACT — sent to CEE, never stamped on this screen.
 *
 * J1 J14 measures the defect end to end (DGAI `journey/sd1-one-fact`): Confirm on A's screen dropped the factor from
 * "to review", nothing reached the wire, CEE's stored read held no review, and a fresh browser on the same account
 * offered the same Confirm again. These rows pin the two ends of the fix:
 *
 *   producer  signed-in → exactly ONE `factor_value_edit` `confirm_current`, built as a SET of the number the factor
 *             shows (identity: the set builder's own payload for that number, plus the intent), and NO local write;
 *             the served capless-percent shape (CEE's own confirm-is-review fixture) sends its stored figure verbatim.
 *             Guest → the local stamp, no send (SD-2 is theirs). No conversation → `no_carrier`; viewer → refused.
 *   consumer  CEE's `reviewed_by_user` confirm clears "still needs a person" (`factorIsConfirmable`, the one predicate
 *             every "to verify" count and Confirm offer reads). Its absence, or another intent, does not.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const sendSystemEvent = vi.fn((..._args: unknown[]) => Promise.resolve(undefined))
let connected = true
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => (connected ? { sendSystemEvent } : null) }
})

import { useModelEditAuthority } from '../useModelEditAuthority'
import { useCanvasStore } from '../../store'
import { buildFactorValueEditEvent } from '../../conversation/factorValueEdit'
import { factorIsConfirmable, factorNeedsVerification } from '../../domain/valueProvenance'
import { isTransitionBridgeReviewed } from '../../components/pre-analysis-v3/selectors/computeInfluenceCoverage'
import { buildContributionBreakdown } from '../../components/pre-analysis/utils/buildContributionBreakdown'
import { stripNodeValueSignature } from '../../../components/results/analysisNew/buildModelStrip'
import { isReviewedByUser } from '../../components/pre-analysis/utils/isReviewedByUser'
import { setPersistenceSessionActive, __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { setViewerScenario } from '../../../lib/viewerMode'
import { __resetThinClientForTests } from '../../thinClient/thinClient'

const FACTOR = 'monthly_churn'
/** CEE `factor-value-edit-confirm-is-review.test.ts`'s served shape: journey A's churn, capless percent. */
const CHURN = { unit: '%', value: 0.032, source: 'cee_inference', raw_value: 3.2, extractionType: 'inferred' }
/** A value-only factor (no `raw_value`): the seed is `value` itself. */
const PRICE = { value: 0.1, source: 'cee_inference' }

function seed(observedState: Record<string, unknown>) {
  useCanvasStore.setState(
    {
      nodes: [
        { id: FACTOR, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Monthly churn', kind: 'factor', observedState } },
      ],
      edges: [],
    } as never,
    false,
  )
}
const observedNow = () =>
  (useCanvasStore.getState().nodes.find(n => n.id === FACTOR)?.data as { observedState?: Record<string, unknown> })
    .observedState

beforeEach(() => {
  vi.clearAllMocks()
  connected = true
  __resetPersistenceSessionForTests()
  __resetThinClientForTests()
  setViewerScenario(null)
})
afterEach(() => {
  __resetPersistenceSessionForTests()
  __resetThinClientForTests()
  setViewerScenario(null)
})

describe('producer: a signed-in Confirm is a confirm_current wire act and nothing else', () => {
  it.each([
    ['capless percent (raw_value present)', CHURN],
    ['value only', PRICE],
  ])('%s: ONE factor_value_edit, the set of the shown number plus the intent, and no local write', (_name, shape) => {
    setPersistenceSessionActive(true)
    seed(shape)
    const before = JSON.stringify(observedNow())
    const { result } = renderHook(() => useModelEditAuthority(FACTOR))

    expect(result.current.proposeFactorConfirmation()).toBe('dispatched')

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const [event, opts] = sendSystemEvent.mock.calls[0] as [{ type: string; payload: Record<string, unknown> }, unknown]
    const raw = (shape as { raw_value?: unknown }).raw_value
    const shown = typeof raw === 'number' ? raw : shape.value
    const asSet = buildFactorValueEditEvent({ nodeId: FACTOR, typedValue: shown, nodeData: { observedState: shape } })!
    expect(event).toEqual({ type: 'factor_value_edit', payload: { ...asSet.payload, intent: 'confirm_current' } })
    expect(opts).toEqual({ deferIfBusy: false })
    // CEE's receipt owns the write: the browser stamps nothing.
    expect(JSON.stringify(observedNow())).toBe(before)
  })

  it('the served churn shape carries its stored figure verbatim (3.2 %, the number a set of it would send)', () => {
    setPersistenceSessionActive(true)
    seed(CHURN)
    const { result } = renderHook(() => useModelEditAuthority(FACTOR))
    result.current.proposeFactorConfirmation()
    const payload = (sendSystemEvent.mock.calls[0]![0] as { payload: Record<string, unknown> }).payload
    expect(payload).toMatchObject({ target_id: FACTOR, raw_value: 3.2, unit: '%', intent: 'confirm_current' })
  })

  it('CONTRAST, guest: the local user_confirmed stamp, and nothing is sent', () => {
    seed(PRICE)
    const { result } = renderHook(() => useModelEditAuthority(FACTOR))
    expect(result.current.proposeFactorConfirmation()).toBe('committed')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(observedNow()?.source).toBe('user_confirmed')
  })

  it('signed-in with no conversation: no_carrier, and nothing is written anywhere', () => {
    setPersistenceSessionActive(true)
    connected = false
    seed(PRICE)
    const before = JSON.stringify(observedNow())
    const { result } = renderHook(() => useModelEditAuthority(FACTOR))
    expect(result.current.proposeFactorConfirmation()).toBe('no_carrier')
    expect(JSON.stringify(observedNow())).toBe(before)
  })

  it('signed-in viewer: refused, nothing sent, nothing written', () => {
    setPersistenceSessionActive(true)
    setViewerScenario('11111111-1111-4111-8111-111111111111')
    seed(PRICE)
    const before = JSON.stringify(observedNow())
    const { result } = renderHook(() => useModelEditAuthority(FACTOR))
    expect(result.current.proposeFactorConfirmation()).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(JSON.stringify(observedNow())).toBe(before)
  })
})

describe("consumer: CEE's review record is what clears \"still needs a person\"", () => {
  const AT = '2026-10-06T00:00:00.000Z'
  it.each([
    ['canvas spelling', { observedState: { ...CHURN, reviewed_by_user: { intent: 'confirm', at: AT } } }],
    ['wire spelling', { observed_state: { ...CHURN, reviewed_by_user: { intent: 'confirm', at: AT } } }],
    ['absent source, value present', { observedState: { value: 0.2, reviewed_by_user: { intent: 'confirm', at: AT } } }],
  ])('%s: a recorded confirm is no longer offered or counted', (_name, data) => {
    expect(factorIsConfirmable(data)).toBe(false)
  })

  it.each([
    ['no review', { observedState: { ...CHURN } }],
    ['a review with another intent', { observedState: { ...CHURN, reviewed_by_user: { intent: 'confirm_pairing', at: AT } } }],
    ['a null review', { observedState: { ...CHURN, reviewed_by_user: null } }],
  ])('CONTRAST, %s: still offered', (_name, data) => {
    expect(factorIsConfirmable(data)).toBe(true)
  })
})

describe('consumer, buddy r1: every reader of "reviewed" sees the record, and a review-only receipt rebuilds the strip', () => {
  const AT = '2026-10-06T00:00:00.000Z'
  const node = (observedState: Record<string, unknown>) => ({ id: FACTOR, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', observedState } })
  it('the strip signature moves on a review-only change (else the confirmed factor stays offered)', () => {
    expect(stripNodeValueSignature(node({ ...CHURN, reviewed_by_user: { intent: 'confirm', at: AT } })))
      .not.toBe(stripNodeValueSignature(node({ ...CHURN })))
  })
  it('isReviewedByUser reads the record; CONTRAST: Olumi\'s unreviewed figure is not reviewed', () => {
    expect(isReviewedByUser(node({ ...CHURN, reviewed_by_user: { intent: 'confirm', at: AT } }) as never)).toBe(true)
    expect(isReviewedByUser(node({ ...CHURN }) as never)).toBe(false)
  })
})

describe('buddy r2: ONE reader of the review record, with the "to verify" predicate\'s precedence', () => {
  const AT = '2026-10-06T00:00:00.000Z'
  const REVIEWED = { ...CHURN, reviewed_by_user: { intent: 'confirm', at: AT } }
  const factorNode = (data: Record<string, unknown>) => ({ id: FACTOR, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', ...data } })
  it.each([
    ['snake unreviewed + camel confirmed (a receipt merged beside a stale wire copy)', { observed_state: { ...CHURN }, observedState: REVIEWED }],
    ['snake confirmed + camel unreviewed', { observed_state: REVIEWED, observedState: { ...CHURN } }],
  ])('%s: isReviewedByUser says what "to verify" says', (_name, data) => {
    expect(isReviewedByUser(factorNode(data) as never)).toBe(!factorNeedsVerification(data))
  })
  it('influence coverage counts a CEE-reviewed figure; CONTRAST: the unreviewed one is not', () => {
    expect(isTransitionBridgeReviewed(factorNode({ observedState: REVIEWED }) as never)).toBe(true)
    expect(isTransitionBridgeReviewed(factorNode({ observedState: { ...CHURN } }) as never)).toBe(false)
  })
  it('the contribution breakdown counts it verified; CONTRAST: the unreviewed one is estimated', () => {
    expect(buildContributionBreakdown([{ data: { observedState: REVIEWED } }])).toMatchObject({ verified: 1, estimated: 0 })
    expect(buildContributionBreakdown([{ data: { observedState: { ...CHURN } } }])).toMatchObject({ verified: 0, estimated: 1 })
  })
})
