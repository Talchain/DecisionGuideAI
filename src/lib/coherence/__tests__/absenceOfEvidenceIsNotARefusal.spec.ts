/**
 * ⛔⛔ A "WE DID NOT LOOK" MUST NOT BECOME A DURABLE "NO".
 *
 * ## The defect
 *
 * `leader_claim.permitted: false` carries two different producer statements,
 * and CEE says so in its own source
 * (`orchestrator-v5/compose/analysis-state-v1.ts:189-215`):
 * `options_do_not_separate` means *we looked and declined*;
 * `separation_unavailable` means *we did not look — the separation half was
 * unreadable at this seam*.
 *
 * CEE classifies them (`LEADER_CLAIM_REASON_KINDS`). **The classification does
 * not cross the wire** — `AnalysisLeaderClaimSchema` is `.strict()` over
 * `{permitted, withheld_reason?, separation?}` — so this consumer received the
 * CODE and read only the BOOLEAN, collapsing the two.
 *
 * What that cost a user: the withholding is stamped onto the HELD report and
 * PERSISTED (`canvas/store.ts::resultsWithholdLeaderClaim`), and step 5b of
 * `applyV5State` states that nothing grants permission back — *"it subtracts
 * and never adds… permission returns the only way it safely can: with a NEW
 * run"*. So one unreadable turn — an ordinary follow-up question about a
 * finished analysis — cost the leading option until the whole analysis was
 * re-run. CEE's own file names the mismatch: *"A3 currently does NOT — it reads
 * `permitted` as a permission."*
 *
 * ## The direction, which is the whole safety argument
 *
 * ⛔ Only a POSITIVELY RECOGNISED "did not look" code relaxes. An unknown code,
 * an absent reason, an empty string and a non-string all keep withholding — so
 * a future CEE code this build has never seen behaves exactly as today. The
 * mirror can only go SHORT, and going short costs a leading option the run was
 * entitled to, never one it was not.
 *
 * ⚠ Q3 IS UNTOUCHED, and the last test pins that: `blocked_unusable` withdraws
 * the designation on its own account, so a producer calling its analysis
 * unusable is unaffected. Two harms, two predicates, deliberately not fused
 * (trap 21) — and a relaxation of one must not silently relax the other.
 *
 * ## Scope (trap 3)
 *
 * Pure-predicate assertions. They prove the classification and its direction.
 * They say nothing about layout, and nothing here is witnessed on a deployed
 * build.
 */
import { describe, it, expect } from 'vitest'
import {
  producerWithholdsLeaderClaim,
  producerMarksAnalysisUnusable,
} from '../crossSurfaceCoherence'
import { NOT_EVALUATED_REASON_CODES } from '../leaderClaimReasonKind'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

const claim = (permitted: boolean, withheld_reason?: unknown) =>
  ({ leader_claim: { permitted, ...(withheld_reason === undefined ? {} : { withheld_reason }) } }) as AnalysisStateV1

describe('a producer that could not look has not refused', () => {
  it.each(NOT_EVALUATED_REASON_CODES)('does NOT withhold on %s', (code) => {
    // PRECONDITION pinned: the payload really is a refusal-shaped one, so a
    // pass cannot come from `permitted` being anything other than false.
    expect(claim(false, code).leader_claim.permitted).toBe(false)
    expect(producerWithholdsLeaderClaim(claim(false, code))).toBe(false)
  })

  it.each([
    ['options_do_not_separate — the producer looked and declined', 'options_do_not_separate'],
    ['constraint_verdict_withheld — a verdict, not an absence', 'constraint_verdict_withheld'],
  ])('STILL withholds on %s', (_why, code) => {
    expect(producerWithholdsLeaderClaim(claim(false, code))).toBe(true)
  })
})

describe('fail-closed: only a recognised absence relaxes anything', () => {
  it.each([
    ['a code this build has never seen', 'some_code_minted_after_this_build'],
    ['an empty string', ''],
    ['a non-string', 42],
    ['an explicit null', null],
  ])('STILL withholds for %s', (_why, reason) => {
    expect(producerWithholdsLeaderClaim(claim(false, reason))).toBe(true)
  })

  it('STILL withholds when the reason is absent entirely', () => {
    expect(producerWithholdsLeaderClaim(claim(false))).toBe(true)
  })
})

describe('the untouched halves', () => {
  it('a permitting producer still withholds nothing, reason or no reason', () => {
    expect(producerWithholdsLeaderClaim(claim(true))).toBe(false)
    expect(producerWithholdsLeaderClaim(claim(true, 'separation_unavailable'))).toBe(false)
  })

  it('an absent producer has said nothing — absence is an older producer, never a refusal', () => {
    expect(producerWithholdsLeaderClaim(null)).toBe(false)
    expect(producerWithholdsLeaderClaim(undefined)).toBe(false)
  })

  it('⛔ Q3 is unaffected — an unusable analysis still withdraws the designation', () => {
    // The case that would prove this relaxation went too wide: a producer that
    // BOTH could not read the separation AND calls its analysis unusable must
    // still lose the leading option, on Q3's account.
    const state = {
      leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
      blocked_unusable: true,
    } as AnalysisStateV1
    expect(producerWithholdsLeaderClaim(state)).toBe(false)
    expect(producerMarksAnalysisUnusable(state)).toBe(true)
  })
})
