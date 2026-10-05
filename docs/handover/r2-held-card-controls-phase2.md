# R2 phase 2: local restore acceptance

Reasoning lane 00351a; `rc/r2-held-card-controls`, building on `170788aa`. Local only; no push, merge or deployment.
Phase 1 remains a historical scope stop; the lane owner's phase-2 instruction authorises the server carrier.

The /graph read's optional `held_proposal_offers` is an array of `{turn_id, proposal_id,
suggested_actions: [approve, amend]}`. The exact original approve control, including detail, and the shared amend
control arrive only while CEE authorises execution for today's graph and caller. No executable offer: field absent.

Saved `actionChips` are never serialised or trusted. The transcript retains only the historical `heldProposalId`
association and the assistant's `clientTurnId`. Mount restore stays inert until the fresh server sidecar arrives;
the existing hydration handoff now reconciles controls even when local history is present. Server history still
fills only an empty panel with no local transcript. The pair is parsed by the pinned ActionSchema and matched by
turn/proposal identity; missing, empty, malformed or mismatched authority arms nothing. A late read leaves live
answers untouched. An older local save without historical proposal/turn association remains inert; no prose match
or guessed authority was added. A server-restored thread carries canonical turn identity for its next local save.

Compatibility was inspected BEFORE producer work. `package.json:117` pins `vendor/talchain-schemas-0.76.0.tgz`;
`node_modules/@talchain/schemas/package.json:3` confirms installed 0.76.0. No scenario_graph.v1 Zod envelope exists
in its dist. `src/adapters/cee/scenarioGraph.ts:352-354` manually reads an unknown record and accepts additive keys.
`serverConversationTurns.ts:47-52` likewise tolerates extra row keys. The strict OlumiResponse turn envelope
(`dist/boundary/olumi-response.js:383`) is not the /graph parser. ActionSchema (:22-28) is strict on individual
suggested actions; invalid actions fail closed locally without rejecting /graph. No reader-first deployment gate.

Changed UI files:

- `src/adapters/cee/scenarioGraph.ts`
- `src/canvas/conversation/serverConversationTurns.ts`
- `src/canvas/conversation/types.ts`
- `src/canvas/conversation/useConversation.ts`
- `src/canvas/conversation/utils/transcriptStore.ts`
- `src/canvas/conversation/utils/__tests__/transcriptStore.heldControls.reproduction.spec.tsx`
- `src/canvas/hydrate/serverGraphHydration.ts`
- `src/canvas/hydrate/__tests__/serverGraphHydration.heldOffers.spec.ts`
- `src/canvas/stores/serverConversationTurnsStore.ts`
- This handover.

Touched /graph readers: adapter parseOk; conversation-turn reader/new held-offer reader; hydrate handoff; its
scenario-bound store; useConversation restore; transcript association save/load. CEE's new held-offer route spec
pins the additive shape. Existing CEE conversation response-key assertions remain unchanged and pass 10/10.

Focused DGAI command (one file at a time):
`VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=dummy npx vitest run <file>`.

- Held-controls reproduction/acceptance spec: RED first 1 failed / 6 passed, missing BOTH control identities on
  first restore and next load; final 7/7. Same saved held transcript for row a (executable, first and next load)
  and row b (not executable/absent, plus empty/malformed authority). Injected real-looking saved chips are ignored.
  The live pair and another-turn/proposal mismatch are also checked. No actionChips on either saved load.
- Hydration held-offer spec: 3/3; real adapter -> hydrate -> store -> server thread, tolerant additive envelope,
  exact control detail, absent sidecar still handed off when conversation is empty.
- Existing transcriptStore spec: unchanged 14/14.

UI mutant: trust stored chips in fromStored and bypass server-sidecar reconciliation. 5 failed / 2 passed;
all four row-b variants fail (approve AND amend re-arm), plus row a fails because chips were never persisted.
Restored code: 7/7. CEE skip-authorise mutant: rows d/f/g fail (3 failed / 8 passed); restored code 11/11.
Unchanged CEE turn parity: replay 9/9, durable restart/card 38/38, offer/replay 25/25 (72 total).

UNVERIFIED: served staging reload journey, actual wire on staging, older local saves with no historical identity,
and full suites. CODED / TESTED locally; not MERGED / SERVED / JOURNEY-WITNESSED. No deployed screenshots or
interaction artefacts are claimed. The baseline, dependency pin, main branches and staging were not changed.

`npm run typecheck`: coverage and ratchet PASS, 5,823 / 5,863 tracked TS files loaded (40 declared exclusions),
2,059 existing baseline errors. New handoff spec is staged and covered. The gate reports the same added/removed
diagnostic identity in untouched `src/canvas/ui/inspector-v2/useInspectorMutations.ts` noted in phase 1. No baseline
was re-recorded. Initial 3 test-scaffolding diagnostics were corrected before the passing rerun.
