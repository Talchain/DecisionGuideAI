# Batch B: send delivery outcomes and retry idempotency

Amendment from the PL, accepted by the DL on 12 Oct. It replaces c23de36's "no response means not delivered".

## Verdict: the deduplicated case applies

A resend that carries the same `payload.turn_id` is deduplicated server-side. So on outcome (b), "Try again" is offered and reuses the SAME key. It cannot apply twice.

## The three outcomes (UI)

| Outcome | Evidence | Copy | Sentry `turn_failure` | Bubble |
|---|---|---|---|---|
| (a) confirmed not sent | No transport reached its dispatch boundary (`onRequestStarted`, called just before `fetch`). Where a result exists, it also carries `requestNotStarted`. | "Your message wasn't sent — check your connection and try again." | `not_sent` | `failed`, Retry |
| (b) delivery unknown | Dispatched, but no HTTP response arrived: a network error after dispatch, a timeout, or an abort mid-flight. | "We couldn't confirm your message arrived. Check the conversation before sending it again." | `delivery_unknown` | `unconfirmed`, "Try again" chip (same `turn_id`) |
| (c) server error | A real HTTP 5xx. | Existing server copy. | `server` | Unchanged |

- **Classifier:** `classifyUnansweredSend` in `src/canvas/conversation/transportFailure.ts:117`. When the evidence is missing, it chooses (b).
- **Dispatch boundary:** `src/v5/v5Adapter.ts:145` (buffered) and `src/v5/streamedTurnTransport.ts:163` (stream).
- **Proof that no request was dispatched:** `src/v5/v5Adapter.ts:110` (offline) and `:214`.
- **Unchanged:** a timeout after HTTP headers arrived still reports `timeout`.

## How a turn is keyed

### UI (this tree, base c23de36)

- `turn_id` in the payload is `turnClientId`: `src/v5/buildPayload.ts:205`, minted at `src/canvas/conversation/useConversation.ts:4450` as `retryClientTurnId ?? chainId ?? randomUUID()`.
- The id is recorded for retry at dispatch: `useConversation.ts:4580` (`lastUserInputRef.current = { message, clientTurnId: turnClientId, … }`).
- `retryLast` re-sends with `retryClientTurnId: last.clientTurnId` (`useConversation.ts:7550`). The retry therefore carries the same `turn_id` and `scenario_id`.
- This is pinned on the wire by `useConversation.requestStartBoundary.spec.tsx`, test "(b) Try again re-sends the SAME payload turn_id".
- `X-Request-Id` is minted fresh for every send (`useConversation.ts:4976`). At the CEE tip below it is used for correlation only, not as the commit key.

### CEE (read from the local `origin/staging` ref 50530b5f, 11 Oct 12:57; no network this session, so the deployed commit is UNVERIFIED)

1. The durable commit key is `payload.turn_id`.
   - `src/orchestrator-v5/turn-executor.ts:1561`: `durableTurnId = payload.turn_id`.
   - It is forced on every executor commit at `:1868` (`turn_id: durableTurnId`, after `...commitMeta`).
   - route-v2 commits with `ingress.turn_id` (`src/orchestrator/route-v2.ts:3361`, `:4169`, `:4360`).
2. The append RPC is idempotent on that key: `ON CONFLICT (scenario_id, turn_id) DO NOTHING` (`supabase/migrations/20261009170000_b2_fact_revision_all_appends.sql:49`).
3. A graph-bearing replay is classified before the RPC.
   - `src/orchestrator-v5/session/supabase-store.ts:383` (`append`) and `:405` (`classifyPriorTurn`) give `replayedPriorTurn` or `priorTurnConflict`.
   - Either way the store writes nothing for that attempt (`src/orchestrator-v5/commit.ts:431` `thisAttemptWrote`), and the reply is built from an authoritative reread.
4. The fence claim for the same `turn_id` returns the same generation, so a replay never supersedes itself (`src/orchestrator-v5/session/turn-fence.ts:76`, row 8).
5. The Batch A (4e2f2966) and Batch C (025e2e67) CEE candidates leave `turn-executor.ts`, `route-v2.ts` and the append path unchanged.

## Limits (what dedupe does NOT cover)

- **What is proven:** dedupe for the turn row and the graph write, which happen inside the append transaction.
- **Not deduplicated:** the work before the commit runs again on a resend (provider calls, and analysis or PLoT calls). Whether analysis-run rows are keyed on `turn_id` is UNVERIFIED.
- **Reply on a non-graph replay:** the reply is newly generated, while the stored row keeps the original. Nothing is applied twice, but the words may differ.

## Residual risks seen, not fixed (outside this amendment)

1. **The reconcile key may not match on the served stack.**
   - `reconcileUnconfirmedServerTurns` matches the bubble's `deliveryRequestId` (= `X-Request-Id`) against the server row's `turn_id` (`src/canvas/conversation/serverConversationTurns.ts:213-224`).
   - At the CEE tip above, `turn_id` is `payload.turn_id`, so the two ids differ.
   - After a reload, an unconfirmed bubble may therefore not settle automatically.
   - The test fixtures assume `turn_id == X-Request-Id`.
2. **A resend from the hero composer is a new turn.** On the first-use hero, the text is restored to the box. Sending it from there mints a new `turn_id` and is not deduplicated. The (b) copy tells the user to check first.
3. **Stale comments.** These say CEE keys its commit on its own per-request id: the `deliveryUnknown.ts` header, the `retryLast` comment, and the 2.665 I-B comment in `useConversation.ts`. That is stale at this CEE tip. The no-retry rule for proxy timeouts (HTTP 504) still rests on it and was not changed here.
