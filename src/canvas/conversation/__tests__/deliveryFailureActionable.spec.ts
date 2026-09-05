/**
 * A failure message the user can act on — and the retry premise, re-derived.
 *
 * Paul's standard for this product is that the first thing a user sees is
 * "relevant, science-grounded, action-oriented coaching", and that where there
 * is confusion the product "points that out with clarity and asks the right
 * questions". A failure notice is the hardest case for that standard and the
 * one the 2026-09-03 session failed: the user was told, twice, that we could
 * not confirm anything, and given nothing to do about it.
 *
 * ⚠ THIS FILE DELIBERATELY DOES NOT PURSUE "ONE HONEST FAILURE MESSAGE". The
 * three transport shapes make GENUINELY DIFFERENT claims — a network throw is
 * VERIFIED non-delivery, a proxy timeout and a wait expiry are not — and
 * collapsing them is the exact defect ROADMAP 2.665 fixed. Merging them again
 * would re-ship a falsehood on whichever half lost. What they must share is
 * ACTIONABILITY, and that is what is pinned here.
 *
 * The dead-end corpus is drawn from strings this product has actually shipped
 * (the pre-2026-09-03 copy, the 2026-08-07 witness sentence, the bubble marker
 * Paul quoted), not from what a dead end feels like to the author.
 */
import { describe, it, expect } from 'vitest'
import {
  WAIT_EXPIRY_UNKNOWN_COPY,
  PROXY_TIMEOUT_UNKNOWN_COPY,
  NEXT_STEP_PATTERNS,
  statesANextStep,
  assertsNonDelivery,
  assertsDeliveryUnknown,
  retrySafety,
} from '../deliveryUnknown'
import { buildTransportFailureCopy } from '../transportFailure'
import { buildRequestIdHeaders, generateRequestId } from '../../../types/requestId'

// ---------------------------------------------------------------------------
// Actionability — the two-sided guard
// ---------------------------------------------------------------------------

const SHIPPED_FAILURE_COPY: ReadonlyArray<[string, string]> = [
  ['WAIT_EXPIRY_UNKNOWN_COPY', WAIT_EXPIRY_UNKNOWN_COPY],
  ['PROXY_TIMEOUT_UNKNOWN_COPY', PROXY_TIMEOUT_UNKNOWN_COPY],
  ['transport copy (network throw)', buildTransportFailureCopy({ network: true }, true)],
  ['transport copy (proxy timeout)', buildTransportFailureCopy({ network: false }, true)],
]

/**
 * Dead ends this product has shipped. Written out in full rather than imported,
 * because they are RECORDS of sentences that were once on screen: a corpus that
 * pins what the product used to say is evidence, and rewriting it to track the
 * current copy would falsify it.
 */
const SHIPPED_DEAD_ENDS: ReadonlyArray<[string, string]> = [
  [
    'the pre-2026-09-03 wait-expiry copy — its only instruction was to wait, ' +
      'for an event the user cannot observe',
    'This is taking longer than expected, so we stopped waiting for a reply. ' +
      'Your message did reach the server and may still be being worked on — we cannot confirm from here whether it finished. ' +
      'Nothing you typed was lost. ' +
      'Sending it again would ask the same thing a second time, so give it a moment before you do.',
  ],
  [
    'the 2026-08-07 witness sentence',
    'This is taking longer than expected. We stopped waiting, so your message has not gone through.',
  ],
  ['the bubble marker Paul quoted', 'Sent — reply not received'],
]

describe('every failure the user reads offers a next step', () => {
  it.each(SHIPPED_FAILURE_COPY)('%s states a next step', (_name, copy) => {
    expect(statesANextStep(copy)).toBe(true)
  })

  it.each(SHIPPED_DEAD_ENDS)('the guard still rejects: %s', (_name, copy) => {
    // The other half of the pair. A guard that passed everything would be a
    // guard agreeing with itself; these are the strings it exists to refuse.
    expect(statesANextStep(copy)).toBe(false)
  })

  it('the vocabulary is non-empty and none of its members matches an empty string', () => {
    expect(NEXT_STEP_PATTERNS.length).toBeGreaterThan(0)
    expect(NEXT_STEP_PATTERNS.some((p) => p.test(''))).toBe(false)
  })
})

describe('the new clauses did not cost the old honesty', () => {
  const UNKNOWN_COPY: ReadonlyArray<[string, string]> = [
    ['WAIT_EXPIRY_UNKNOWN_COPY', WAIT_EXPIRY_UNKNOWN_COPY],
    ['PROXY_TIMEOUT_UNKNOWN_COPY', PROXY_TIMEOUT_UNKNOWN_COPY],
  ]

  it.each(UNKNOWN_COPY)('%s still asserts no non-delivery', (_n, copy) => {
    expect(assertsNonDelivery(copy)).toBe(false)
  })

  it.each(UNKNOWN_COPY)('%s still says the outcome is unknown', (_n, copy) => {
    expect(assertsDeliveryUnknown(copy)).toBe(true)
  })

  it.each(UNKNOWN_COPY)('%s still warns that re-sending asks twice', (_n, copy) => {
    // The client still mints a fresh request id per send, so this remains TRUE
    // and must not be softened by the retry derivation below.
    expect(copy).toMatch(/second time/i)
  })

  it.each(UNKNOWN_COPY)('%s tells the user what will NOT help', (_n, copy) => {
    expect(copy).toMatch(/reloading will not bring the reply back/i)
  })

  it('a network throw still claims non-delivery — the pair', () => {
    // The one shape where non-delivery is verified. If actionability had been
    // bought by softening this, the fix would have removed a TRUE statement.
    const copy = buildTransportFailureCopy({ network: true }, true)
    expect(assertsNonDelivery(copy)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// The retry premise, re-derived
// ---------------------------------------------------------------------------

describe('retry safety', () => {
  it('a verified non-delivery is always safe to re-send', () => {
    expect(retrySafety({ verifiedNonDelivery: true })).toEqual({
      safe: true,
      reason: 'never_reached_server',
    })
  })

  it('reusing the original request id makes an unknown-outcome re-send safe', () => {
    // The correction this lane derived. CEE takes its commit `turn_id` from
    // `X-Request-Id` and `append_turn_atomic` enforces
    // `UNIQUE (scenario_id, turn_id) ON CONFLICT DO NOTHING`.
    expect(
      retrySafety({
        verifiedNonDelivery: false,
        reusedRequestId: '884a202a-7ad1-441b-a672-1f5e6a34cd6b',
      }),
    ).toEqual({ safe: true, reason: 'request_id_reused' })
  })

  it('a fresh id duplicates — which is what the client does today, the pair', () => {
    expect(retrySafety({ verifiedNonDelivery: false })).toEqual({
      safe: false,
      reason: 'fresh_request_id',
    })
    expect(retrySafety({ verifiedNonDelivery: false, reusedRequestId: null }).safe).toBe(false)
  })

  it('an id CEE would reject is treated as unsafe, because CEE regenerates it', () => {
    // `SAFE_REQUEST_ID_PATTERN` is `^[A-Za-z0-9._-]{1,64}$`. A rejected id is
    // replaced server-side with a fresh UUID, so the commit key changes and the
    // re-send duplicates — the same outcome as sending no id at all.
    expect(retrySafety({ verifiedNonDelivery: false, reusedRequestId: 'has spaces' }).safe).toBe(false)
    expect(retrySafety({ verifiedNonDelivery: false, reusedRequestId: 'x'.repeat(65) }).safe).toBe(false)
    expect(retrySafety({ verifiedNonDelivery: false, reusedRequestId: '' }).safe).toBe(false)
  })

  it('the header BUILDER emits X-Request-Id in a shape CEE will honour', () => {
    // ⚠ THIS CASE DOES NOT PIN THE CALL SITE. An earlier version of this comment
    // said it did — "if the header stops being sent … this reds" — and that was
    // false. Measured 2026-09-04 with a discriminating pair, mutant = deleting
    // `...buildRequestIdHeaders(generateRequestId()),` from `useConversation.ts`
    // (applied-check: exactly 1 file):
    //
    //   this file                                  → 22/22 GREEN
    //   `useConversation.turnCorrelationHeader.spec.ts` → 6 failed / 2 passed
    //
    // It stays green because it calls a pure function and never loads the hook.
    // The real pin is that sibling suite
    // (`canvas/conversation/__tests__/useConversation.turnCorrelationHeader.spec.ts`),
    // 8 cases: four over the `v5Headers` initialiser's source shape — two guards
    // plus their own positive control and a vacuity pair — and four driving the
    // live V5 path. **Do not delete it believing this case covers it** —
    // `retrySafety`'s `request_id_reused` branch is only reachable in production
    // while that header is genuinely sent, and this case cannot observe that.
    //
    // What this case DOES cover is the other half of the five-hop derivation in
    // `deliveryUnknown.ts`: hop 2, that the minted id is one CEE accepts rather
    // than regenerates. An id CEE rejects is replaced server-side, and reuse
    // then buys no idempotency at all — so shape is load-bearing, not cosmetic.
    const headers = buildRequestIdHeaders(generateRequestId())
    expect(Object.keys(headers)).toContain('X-Request-Id')
    expect(Object.values(headers)[0]).toMatch(/^[A-Za-z0-9._-]{1,64}$/)
  })
})
