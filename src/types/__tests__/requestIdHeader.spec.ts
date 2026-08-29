/**
 * `buildRequestIdHeaders` — the UI's outbound correlation header.
 *
 * ── WHY THIS FUNCTION EXISTS ──────────────────────────────────────────────
 * The estate propagates ONE correlation id across CEE → PLoT → ISL, but the
 * browser never minted the first hop, so every id was BORN INSIDE CEE
 * (`cee/src/utils/request-id.ts::getOrGenerateRequestId` mints a fresh UUID
 * whenever no id header arrives). A turn that dies at the edge, at CORS, or on
 * a network error therefore had no id anywhere in the estate.
 *
 * ── WHY THE VALIDITY GUARD IS NOT DECORATIVE ──────────────────────────────
 * The UI's turn id is NOT always a UUID. `useConversation.ts` mints it as
 *   `retryClientTurnId ?? pendingContext?.chainId ?? crypto.randomUUID()`
 * and `pendingContext.chainId` can be a COMPOSITE interaction-chain key —
 * `GraphPatchBlockRenderer.tsx:106` builds `${turnId}:${block.patch_id}` and
 * `ConversationPanel.tsx:471` passes it as `chainId`. A colon is outside
 * SafeRequestId, so emitting it would make CEE log
 * `'Invalid request ID rejected, trying next header'` on every such turn and
 * then mint its own id anyway — strictly worse than sending nothing, because
 * it adds a per-turn warn line and still leaves the trace broken.
 *
 * The guard therefore reuses `isValidRequestId`, which is the SAME predicate
 * CEE applies (`SAFE_REQUEST_ID_PATTERN` here is byte-identical to CEE's).
 * One predicate, not a second copy — CLAUDE.md trap 12.
 */
import { describe, it, expect } from 'vitest'

import {
  REQUEST_ID_HEADER,
  SAFE_REQUEST_ID_PATTERN,
  buildRequestIdHeaders,
  generateRequestId,
} from '../requestId'

describe('buildRequestIdHeaders', () => {
  it('emits the header CEE reads FIRST, spelled exactly', () => {
    // Bound by IDENTITY, not by "some header was emitted": CEE's ladder is
    // x-request-id → x-cee-request-id → x-correlation-id, and only the first
    // is unambiguous in this repo (x-correlation-id is already in use with
    // PER-FETCH scope at adapters/cee/client.ts:636).
    expect(REQUEST_ID_HEADER).toBe('X-Request-Id')

    const id = '3f1c9a6e-1b2d-4e5f-8a9b-0c1d2e3f4a5b'
    expect(buildRequestIdHeaders(id)).toEqual({ 'X-Request-Id': id })
  })

  it('carries the id through UNCHANGED — it does not mint, hash or rewrite one', () => {
    // The whole point is that the id is the CALLER'S turn id. A function that
    // generated its own would satisfy "a header is present" and defeat the
    // purpose, so this asserts the exact value round-trips.
    const id = generateRequestId()
    expect(buildRequestIdHeaders(id)[REQUEST_ID_HEADER]).toBe(id)
  })

  it('emits NOTHING for a composite interaction-chain key (the real invalid case)', () => {
    // Not a hypothetical: this is the `${turnId}:${patch_id}` shape that
    // reaches `turnClientId` through `pendingContext.chainId`.
    const composite = '3f1c9a6e-1b2d-4e5f-8a9b-0c1d2e3f4a5b:patch-7'
    // Pin the precondition in-test (trap 13b) — if SafeRequestId ever admitted
    // a colon this case would pass while asserting nothing.
    expect(SAFE_REQUEST_ID_PATTERN.test(composite)).toBe(false)

    expect(buildRequestIdHeaders(composite)).toEqual({})
    expect(REQUEST_ID_HEADER in buildRequestIdHeaders(composite)).toBe(false)
  })

  it('emits nothing for absent / empty / over-long ids rather than an empty header', () => {
    expect(buildRequestIdHeaders(undefined)).toEqual({})
    expect(buildRequestIdHeaders(null)).toEqual({})
    expect(buildRequestIdHeaders('')).toEqual({})
    // 64 is the SafeRequestId ceiling; 65 must be refused.
    expect(buildRequestIdHeaders('a'.repeat(64))).toEqual({ [REQUEST_ID_HEADER]: 'a'.repeat(64) })
    expect(buildRequestIdHeaders('a'.repeat(65))).toEqual({})
  })
})
