/**
 * A CEE REFUSAL IS NOT THE USER OWING INPUT.
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `analysis_ready.status: 'blocked'` means CEE REFUSED — "a validation failure
 * prevents analysis", carrying `blocked_reason`, and reachable WITH POPULATED
 * OPTIONS (`adapters/cee/types.ts:443-455`). So a refusal arrives as a
 * NON-NULL `ceeAnalysisReady`.
 *
 * The card's ladder missed it in the one way that reads as the user's fault:
 *
 *   !analysisReady        -> 'unassessed'     (refusal is not null, misses)
 *   hasBlockerCritique    -> 'blocked'        (a DIFFERENT carrier, misses)
 *   status !== 'ready'    -> 'needs_input'    (the refusal lands HERE)
 *
 * so the product answered its own refusal with **"Olumi needs a little more
 * from you"** — false, and actionable-sounding, which is worse than merely
 * unhelpful. The truthful rung existed in the same enum all along and was
 * bypassed; it is also the only state exempt from post-analysis auto-collapse,
 * so the refusal was mis-attributed AND folded away.
 *
 * ── The shape, stated precisely, because it changes the fix ────────────────
 * This is NOT two-questions-under-one-name. That is two authorities answering
 * different questions while somebody RECONCILES them; the tell is that a
 * reconciliation happened. None did here — a case simply arrived at the union
 * after the ladder was written, and one disjunct was never added.
 *
 * What IS real is the NAME: `hasBlockerCritique` is named for its CARRIER and
 * was used as if it answered a CONCLUSION. Both carriers are independently
 * sufficient reasons to be blocked, so picking either one drops real cases.
 * The fix names the conclusion apart from its evidence.
 *
 * ⚠ AND THE COMMENT ON THE LINE ABOVE THE DEFECT IS WHY NOBODY LOOKED —
 * UI-SEM-079 read "Only ready / needs-input arrive from the wire
 * (analysis_ready.status)". True when written. `'blocked'` joined the union
 * afterwards, and the sentence quietly became the reason not to check.
 *
 * ── Both directions, because the two harms cannot share one window ─────────
 * A false `needs_input` on a refusal blames the user for the product's call.
 * A false `blocked` on an ABSENCE is the inverse and is worse at scale:
 * `ANALYSIS_READY_STATUS_UNSUPPLIED` ('unknown') is "an ABSENCE, not a verdict
 * of any kind, and specifically NOT a synonym for `blocked`", emitted on the
 * 12 of 22 turn exits that supply no readiness payload. It gets its own
 * assertion below, never a row in a table.
 *
 * ── Why the corpus is DERIVED, and EXACTLY WHAT THAT BUYS ─────────────────
 * `EXPECTED` is a `Record<AnalysisReadyStatus, …>`, so a status added to the
 * producer union is a COMPILE error until someone decides which rung it means,
 * and the runtime key check REDs if the type is widened without the map. A new
 * status can therefore no longer default silently into `needs_input`, which is
 * exactly how `'blocked'` got here.
 *
 * ⚠⚠ AND HERE IS THE LIMIT OF THAT, WRITTEN DOWN BECAUSE I CLAIMED MORE AND WAS
 * WRONG WITHIN THE HOUR. The first version of this spec treated union
 * exhaustiveness as making the CLASSIFICATION safe. It does not, and the proof
 * is the case two tests below: keying on `status === 'blocked'` alone passed
 * every row of this table while fabricating a blocking issue on every legacy
 * reload.
 *
 *   EXHAUSTIVENESS OVER THE STATUS UNION IS NOT EXHAUSTIVENESS OVER THE
 *   CARRIERS THAT PRODUCE A STATUS. A corpus cannot catch a carrier it never
 *   sends, and every payload this table sends is a well-formed refusal.
 *
 * So this table pins that each status maps to its rung. It says NOTHING about
 * whether a given payload is the carrier its status implies — that is the
 * `blocked_reason` discriminator's job, pinned separately, and it is the half
 * that actually decides truthfulness. Do not cite this table as evidence the
 * predicate is safe.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { DecisionOverviewCard } from '../DecisionOverviewCard'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import {
  ANALYSIS_READY_STATUSES,
  ANALYSIS_READY_STATUS_UNSUPPLIED,
  type AnalysisReadyStatus,
} from '../../../../adapters/cee/types'

const BLOCKED_LINE = /the model has a blocking issue/i
const NEEDS_INPUT_LINE = /olumi needs a little more from you/i
const UNASSESSED_LINE = /framing not yet assessed/i

const GOAL_NODE = { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'G' } }
const BLOCKER_HEALTH = { issues: [{ severity: 'blocker', message: 'Goal is not reachable' }] }

/** `graphHealth: null` throughout — the OTHER carrier must not supply the verdict. */
function mount(ready: unknown, opts: { blockerCritique?: boolean } = {}) {
  localStorage.setItem('feature.decisionOverview', '1')
  useCanvasStore.setState({
    ceeAnalysisReady: ready,
    nodes: [GOAL_NODE],
    goalThreshold: null,
    goalConstraints: null,
    currentBriefText: null,
    graphHealth: opts.blockerCritique ? BLOCKER_HEALTH : null,
    results: null,
  } as never)
  render(<DecisionOverviewCard title="Draft decision" />)
  return screen.getByTestId('brief-bar').textContent ?? ''
}

/**
 * What each producer status MEANS to a reader of this card. Exhaustive by
 * construction: adding a member to `AnalysisReadyStatus` fails to typecheck
 * here until it is classified.
 *
 * 'ready-family' = neither blocked nor needs_input — which rung it lands on
 * ('ready' vs 'thin') is the success-measure question and is pinned elsewhere.
 */
const EXPECTED: Record<AnalysisReadyStatus, 'blocked' | 'needs_input' | 'ready-family'> = {
  ready: 'ready-family',
  needs_user_mapping: 'needs_input',
  needs_encoding: 'needs_input',
  needs_user_input: 'needs_input',
  blocked: 'blocked',
}

describe('Decision overview: a refusal reads as blocked, not as the user owing input', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ guidanceItems: [] } as never)
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('THE DEFECT: a CEE refusal does not say the user owes input', () => {
    const bar = mount({ status: 'blocked', options: [{ id: 'o1' }], goal_node_id: 'g1', blocked_reason: 'validation_failed' })
    expect(bar, 'CEE refused — the product must not answer that with "Olumi needs a little more from you"').not.toMatch(NEEDS_INPUT_LINE)
    expect(bar, 'the truthful rung exists in the same enum').toMatch(BLOCKED_LINE)
  })

  it('THE OPPOSITE-DIRECTION TWIN: an absent readiness verdict is NOT blocked', () => {
    // 'unknown' is emitted on 12 of 22 turn exits. Reading it as blocked would
    // tell most users their model is broken.
    const bar = mount({ status: ANALYSIS_READY_STATUS_UNSUPPLIED, options: [], goal_node_id: 'g1' })
    expect(bar, 'an ABSENCE is not a verdict — it must never render as blocked').not.toMatch(BLOCKED_LINE)
  })

  it('THE SECOND CARRIER: a legacy freshness payload must not fabricate a blocking issue', () => {
    // ⚠ THIS CAUGHT THIS FIX'S OWN FIRST VERSION. Two distinct `status:
    // 'blocked'` carriers exist (`analysisRefusalNotice.ts:39-55`, derived at
    // the CEE bytes): the REFUSAL always carries a non-empty `blocked_reason`;
    // `synthesiseFreshnessOnlyAnalysisReady()` carries `status: 'blocked'` with
    // NONE, on legacy/unparseable RELOADS, and says nothing about a refusal.
    // Keying on status alone announced "The model has a blocking issue" on
    // every one of those reloads — the exact inverse harm this spec exists to
    // prevent, introduced by the fix for the first one.
    const bar = mount({ status: 'blocked', goal_node_id: '', options: [], bias_findings: [] })
    expect(bar, 'a freshness carrier with no blocked_reason is not a refusal').not.toMatch(BLOCKED_LINE)
  })

  it('no CEE assessment at all stays in the quiet no-claim state', () => {
    expect(mount(null)).toMatch(UNASSESSED_LINE)
  })

  it('the blocker-severity critique carrier still reaches blocked on its own', () => {
    // The pre-existing disjunct must survive the fix — dropping it would trade
    // one silent failure for another.
    const bar = mount({ status: 'ready', options: [{ id: 'o1' }], goal_node_id: 'g1' }, { blockerCritique: true })
    expect(bar).toMatch(BLOCKED_LINE)
  })

  it('EXHAUSTIVE over the producer union — every status maps to its rung', () => {
    // Completeness at runtime as well as at the type level: if the union is
    // widened without updating EXPECTED, this REDs rather than defaulting.
    expect(
      [...Object.keys(EXPECTED)].sort(),
      'EXPECTED must cover exactly ANALYSIS_READY_STATUSES — a new status needs a decision, not a default',
    ).toEqual([...ANALYSIS_READY_STATUSES].sort())

    for (const status of ANALYSIS_READY_STATUSES) {
      // A real refusal always carries a non-empty `blocked_reason` — that is
      // the discriminator, not the status. The legacy carrier that does NOT is
      // its own case below.
      const bar = mount({
        status,
        options: [{ id: 'o1' }],
        goal_node_id: 'g1',
        ...(status === 'blocked' ? { blocked_reason: 'validation_failed' } : {}),
      })
      const want = EXPECTED[status]
      expect(bar.match(BLOCKED_LINE) !== null, `status '${status}' -> blocked?`).toBe(want === 'blocked')
      expect(bar.match(NEEDS_INPUT_LINE) !== null, `status '${status}' -> needs_input?`).toBe(want === 'needs_input')
      document.body.innerHTML = ''
    }
  })
})
