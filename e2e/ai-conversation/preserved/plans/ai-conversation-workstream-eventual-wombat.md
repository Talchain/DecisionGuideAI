# AI Conversation — increment 1 (slice A shipped as a draft; slice B lease-gated)

## Context
Brief: make the OpenAI chat feel like Olumi. After a Run the user should see the conclusion, a decisive caveat and one relevant next move, with depth on demand. The coaching action must be real, never a dead button, a fabricated edit or a surprise Run.

The Delivery Lead tightened the rules on #63, and these now govern:
- The cause of long replies stays a **hypothesis** until there is a fresh OpenAI-path capture and its rendered reply.
- A coaching action is promoted only when its **target, current analysis binding and accepted route behaviour are proven**.
- Actions are disabled when currentness is **unknown or stale**.
- "Sent" appears only after an **acknowledged** send, and is tested against the real wire payload and reply.
- The final head goes to the **Independent Review pool**. My own `/code-review` is self-review only.

**Hard constraint: OPENAI ONLY.** No Anthropic calls from tests, scripts, CI or witnesses. Every run must be verified as OpenAI, fixture-served or model-free before it starts. The conventional path stays in the code but is not executed.

The coordination channel is `Talchain/olumi-programme-docs#63`, not Paul. This container can't reach the laptop sessions, and staging hosts are blocked by the network policy.

## Done (slice A)
- **Branch:** `ai-conversation/run-reply-action`.
- **Draft PR:** Talchain/DecisionGuideAI#1961, head `9259859`. I'm subscribed to its activity, and a check-in is scheduled for about 19:45Z.
- **Files, cleared by RC in #63 5819307155:**
  - `src/v5/blocks/ActionChip.tsx`
    - `inert` + `describedBy` props.
    - A receipt shown only from a delivery outcome returned by `_sendChip`. Today the seam returns nothing, so no receipt shows.
    - "Not sent" re-arms the chip.
    - A ref guard stops a same-tick double send.
  - `src/v5/blocks/V5CoachingBlock.tsx`: the chip is inert whenever the card's freshness notice speaks, and the notice gets an id so it can serve as the chip's `aria-describedby`.
  - `src/canvas/conversation/__tests__/runReplyAcceptance.spec.tsx`, 33 tests:
    - four captured Run turns go through the shipped ingestion chain;
    - it asserts no conventional-path action is promoted;
    - it covers receipt, stale, rerun, reload, blocked and ineligible cases;
    - 10 checks fail on the previous source.
- **Checks:**
  - typecheck PASSED;
  - ESLint 0 errors;
  - `vitest --changed` 163 files / 1,855 tests green (with CI's dummy Supabase env);
  - `validate-prepush.sh` ALL CHECKS PASSED.
  - CI for this PR makes no model calls (verified from the workflows).
- **#63 posts:** 5819412579 (status, asks, Run-chip journey blocker routed to RC) and 5819846538 (PR, OpenAI-only ack, deferrals).

## Diagnosis (hypotheses; the OpenAI path is unverified)
- **Conventional captures:**
  - every action-bearing coaching card is in "Show N more";
  - `compactCoachingLines` also hides the button inside a closed row;
  - every one of those actions is target-less or on an unrouted intent (`confirm_factor`, `start_guided_chat` are not in `CEE_ACCEPTED_INTENTS`), so correctly **none is promoted**.
- **OpenAI agent lane:** 0 coaching blocks today, per R&C 5819000874 §4. The candidate action is R&C's run-turn "fragile-link challenge" card (contract PROPOSED; payload in 5819274938).
- **Run text** is short on the conventional captures; the volume is typed blocks, and `_answer_shape` is absent. Unverified for OpenAI.
- **j4-t2** renders a contradicted claim ("already reflects 12%" beside a blocker naming that factor as missing). That is a producer defect and the UI does not hide it.

## Slice B: only after the grants in #63 5819412579 §4
**Needed:**
- Canvas ACK on `messageComposition.ts` and `CoachingLine.tsx` (Panel has already ACKed both).
- RC grants for `phase3TypedBlocks.ts`, `coachingCurrency.ts`, `useCoachingCurrency.ts` and `src/canvas/conversation/types.ts`.
- The `_sendChip` delivery-outcome seam (`guidanceStore.ts` `withOlumiReveal` pass-through, plus `useConversation` `sendChip` resolving to the turn's `deliveryState`), granted to me or done by its owner.

**Work:**
1. Carry `source_handler` and `created_at` through `adaptTypedCoachingBlock` (`phase3TypedBlocks.ts`) and the `V5CoachingBlock` type (`types.ts`).
2. **Three-part currency rule, for `source_handler === 'run_analysis'` only** (`coachingCurrency.ts` / `useCoachingCurrency.ts`). A card is current only when:
   - `run_state.kind === 'complete_current'`, and
   - `graph_hash_at_generation === analysis_ready.current_graph_hash`, and
   - `created_at === run_state.computed_at`.
   
   Anything else, including unknown, is historical: the notice shows and the action is disabled. Draft-path cards keep today's behaviour.
3. **Promotion** (`messageComposition.ts`): a shared `firstPromotableActionIndex(blocks)` returns the first card with:
   - `v5_coaching` and `source_handler === 'run_analysis'`;
   - non-empty `target_refs`;
   - non-blank label and prompt;
   - no `action_intent` outside `CEE_ACCEPTED_INTENTS`.
   
   It displaces the last non-companion point and never grows the set. The whole step is **gated OFF by a named constant** until Runtime's click guard lands and TA's eval passes. RC flips it.
4. **`CoachingLine.tsx`:** `planCoachingLines` marks that same index `collapsible: false`. A historical card stays a collapsed row with its action disabled, as Panel asked in 5819355965.
5. **Wire + reply test:** a `useConversation` wire-level spec (pattern: `optionTargetRefusalSettles.wire.spec.ts`, mocked fetch). It checks:
   - a click POSTs `kind:'message'` with the producer's prompt verbatim, and with no `action_type` or `run_analysis`;
   - the mocked reply renders;
   - "Sent" appears only after the 200 response.
6. **Fixture:** R&C's producer payload (5819274938), labelled not-route-captured, until AI Quality or Runtime supply a route-captured OpenAI `/agent/v1/turn` Run.

## Verification
- Per slice: `pnpm run typecheck`, ESLint on the changed files, the focused specs plus `vitest --changed` (with CI's dummy Supabase env), `scripts/validate-prepush.sh`, and a mutation check that each new test goes red on the old source.
- **Served witness:** local `vite` with Playwright route-fulfilling the OpenAI turn from the fixture, so no model call is made. Screenshots of the Run reply, the clicked action with its receipt, stale-after-edit and reload. A live `?ai=openai` journey needs staging hosts allowed, or the Delivery Lead runs it.
- **Evidence kept separate:** source (diff) · CI · deployed UI · joined OpenAI journey.
- **Independent verdict:** request the pool on #63 at the final head.

## Open, routed (not mine to fix)
- **Run chip clickable while the gate refuses** (`SuggestedChips.tsx:175-182`). Journey blocker, owner requested from RC.
- **Dead-looking `action_label` pills** in `V5EvidenceBlock` / `V5ReviewCardBlock`. Owner requested.
- **Producer:** `_answer_shape` on Run turns; a question hidden inside `detail`; target-less `assumption_check` prompts; a click guard against surprise Run or authorise (Runtime).
