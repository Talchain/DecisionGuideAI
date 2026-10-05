# R2 held controls: measured defect, server-carrier scope stop

Lease: Reasoning lane 00351a. UI base `400a71f198f83504f925b3ec3e3e456b8000b6cf`;
CEE base `a4977d9de07a1a9deb630f9f3fc2e5e235ff1b84`. Local work only on
`rc/r2-held-card-controls`. R2 is **not fixed**. No runtime code changed.

## Measured loss

`src/canvas/conversation/utils/transcriptStore.ts:302` (`toStored`) selects
persisted fields and omits `actionChips`; line 316 stores only the historical
`consentOffered` fact. `fromStored` (line 336) cannot recover the controls.
`useConversation.ts:2981` restores this local history without a server action
read. Its server-turn effect (line 3004) declines server history when local
messages exist; that history is text only in any case.

The witnessed labels identify the Agent's suggested-action controls:
`agent-approve-proposal:<proposal id>` and `agent-amend-proposal`. They are
rendered by `SuggestedChips`, rather than the separate `V5HeldProposalBlock`
confirm/dismiss path. The reproduction uses the real suggested-action mapper,
transcript save/load functions, and rendered control testids.

Focused command:

```sh
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=dummy npx vitest run src/canvas/conversation/utils/__tests__/transcriptStore.heldControls.reproduction.spec.tsx
```

Result: **4 tests, 2 passed, 2 failed**. The live control row and inert-client
safety baseline pass. Both the first restore and the save/restored-message/next
restore rows fail for each control:

```text
missing control agent-approve-proposal:prop_0123456789abcdef0123456789abcdef: expected null not to be null
missing control agent-amend-proposal: expected null not to be null
```

This is deliberately diagnostic RED coverage. It does **not** claim the required
server-executable/non-executable acceptance pair: no such current verdict reaches
the restore path. Do not satisfy these REDs by serialising old chips. The two
reload expectations need to be integrated with fresh server truth, and the
safety row strengthened to an explicit non-executable server response using
the same saved transcript, once that carrier is authorised.

## Existing server authority, and missing read carrier

CEE `src/routes/agent-v1-turn.ts:428` calls `ProposalStore.authorise` on the
current graph identity and caller, requiring `status === 'execute'`.
At line 1961, `offeredApproveChipOnRow` recovers the exact originally offered
control from its durable answer-row `pending_actions`; line 1973 applies
`stillValidOffers` against current executable authority. Latest durable
carriers are rehydrated before replay at line 2033. These seams are used on
`POST /agent/v1/turn`, not a reload read.

The read already loaded by the UI is
`POST /assist/v1/scenarios/:scenarioId/graph` with
`include_conversation_turns: true`. CEE
`src/routes/assist.v1.scenario-graph.ts:332` projects answer rows into just
turn id, timestamp, user text and assistant text. No pending/approve carrier is
served. UI `src/adapters/cee/scenarioGraph.ts:420` and
`src/canvas/conversation/serverConversationTurns.ts:44` carry/read that text
projection only.

Replaying a write-route request on load is not a safe substitute: it requires
the original request identity/hash, and an absent committed row falls through
into a new turn. No production reload replay was added.

Smallest proposed addition: an opt-in held-offer sidecar on the **existing graph
read**, bound to its current canonical graph and verified caller. Reuse the
Agent's executable/durable-offer authority, including latest-carrier membership,
expiry, original offer identity and settlement. Return the exact approve/amend
controls only for a proposal that would execute now; fail closed for unknown
authority. Pass that sidecar through the existing hydration handoff even when
local history is present, and reconcile by proposal/turn identity. Persist only
the historical association needed for the next reload, never action authority.

This requires a CEE approval-semantics change (**HIGH**) and a focused route
acceptance row plus revert-to-RED mutant. Per the user's scope rule, stop here
before implementing a new read carrier/route. No new endpoint was built.

## Remaining verification

Completed validation: the existing focused `transcriptStore.spec.ts` passes
**14/14**. `npm run typecheck` passes coverage and ratchet at the existing
**2,059-error** baseline. The compiler's loaded-file list includes the new
reproduction spec, with no diagnostic against it. The gate reports one added
and one removed diagnostic identity in untouched
`src/canvas/ui/inspector-v2/useInspectorMutations.ts`; no baseline was updated.
`git diff --cached --check` passes.

- Required server-executable/non-executable acceptance pair: not implemented.
- Fix and revert-fix mutant: not implemented.
- Executed, superseded, expired and graph-stale route controls: not verified.
- Served browser/reload journey: not verified; staging was not changed.
- CEE has no changes or local commit; its typecheck was not run.
- No baseline, digest, guard, dependency or main-branch changes. No push.
