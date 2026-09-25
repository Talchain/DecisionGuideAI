# AI Conversation — overnight drive (Paul asleep; manual test in the morning)

## North star (re-read every wake)
A shareable PoC, where the OpenAI chat after a Run shows the **conclusion first**, a **decisive caveat**, and **one real, working next action**.
- Nothing is duplicated after a reload. There are no fabricated edits and no surprise Run.
- Work is judged as a SYSTEM:
  - producer (CEE route) → wire → UI render → click → send → persistence → reload;
  - served, not just merged.
- **Hard constraint: OPENAI ONLY.** No Anthropic calls, ever, including probes; guard proofs use `.invalid` hosts only. No model calls in tests.

## Every wake — the loop (never end a wake idle if a lever exists)
1. **My open PRs.** Fix anything red or conflicted NOW. Known noise (Visual Regression advisory, close/reopen churn) gets no action.
2. **Landing.** Is RC landing my approved PRs? If one has been green and approved for more than 45 min, post one line to RC on #63.
3. **Leases and decisions** (#63): act the moment one lands.
4. **Workers.** Verify each report yourself (real exit codes, screenshots) → push → PR → `review-ready`.
5. **No lever pending?** Start the next item from the backlog below with a worker (on a branch; merging needs the lease).
6. **Re-arm** the check-in. The hourly recurring routine is the backstop.
7. **#69** (⛔ #63 is FULL since 04:23Z): at most one consolidated post per wake, and only when a boundary changed.

## Lessons (applied)
- **Read EVERY RC post on each wake, not only posts addressed to me.** At 01:50Z RC pointed out that G1, #1981 and #1982 had all been granted or accepted 45–65 min earlier.
- A ratchet keyed by file:line breaks on any line shift. Before pushing a change to a file, grep `scripts/ci/*baseline*` for that file.
- Before saying a PR "never had a verdict", read its PR comments and grep #69 for its number plus VERDICT. At 08:01Z I claimed #1982 had none; it had an APPROVE (5827024994).

## State (update as it moves)
- **02:05Z UI merge order (RC 5825364435):** #1983 → #1968 → #1981 → #1978 → Canvas ×3 → **G1** → **#1982** → promotion flip.
- **#1982:** baseline line-shift fix pushed as `ce3b55bd`; `review-ready` applied (ACCEPTED 5825076157).
- **G1 = DGAI #1985** (`06648ffd`, `review-ready`, subscribed). Posted on #63 at 5825499637. Next: the verdict, then RC merges in queue order (after Canvas).
- **#1982:** visual adjudication posted (PR 5825467326). Reviewer pickup: 5825388994.
- **Combined trial (02:15Z):** staging `64a3b385` + #1968 + #1981 + #1985 merge cleanly. Typecheck PASSED; their 46 spec files (598 tests) green. A worker is producing the joined witness `13-joined-*` (combined vs staging, 4 steps, 2 viewports).
- **#1981 APPROVED 02:03Z** at `7ec4d83e` (5825469455). Required checks green; only the advisory Visual Regression is red. Per RC's window rule, it is RC's to merge next. No action is needed from me.
- **#1985 G1:** CHANGES_REQUIRED (5825570570). The restore did not apply the retirement rule to re-issued handles. FIXED in `99576e4a` (pin + mutant), replied in 5825674883, `review-ready` re-applied for a delta review.
  - Disclosed residual: a declined held proposal returns live after a reload (it needs a `dismissed` key form). Build it only if the reviewer calls it blocking.
- **RC merge train U1 = #1986:** 64a3b385 + #1983 + #1981 + #1975 + #1980. #1968 and #1985 come in a later train.
- **R&C target-less promotion (`d4577e7b`):** ACKed with an evidence condition (5825550889): a served click on a no-flagged-link card.
- **The full morning stack merges clean** (02:30Z): staging + #1968 + #1981 + #1985 + `rc/promotion-on-v2` + #1983 (`f7a9d313`). Typecheck PASSED; 43 files, 650 tests green.
  - R&C's `openaiRouteCoachingJourney.served.acceptance` spec **needs #1983**: it is RED without #1983 (verified with #1968 + promotion only). Tell R&C in the next post.
- **Long-reply hypothesis CONFIRMED resolved by copy v2** (served capture e39f6e0 in R&C's fixture):
  - Run reply 109 words (was 195 on 57f903c), conclusion first; the question reply is 84 words; the rerun 95 words; construction is still 269 words.
  - A side defect for CEE copy: the edit reply says "49 £ per month" (unit after the number).
  - Report both in the next consolidated post.
- **Joined witness 13 (`0c4936aa`):** all three fixes are shown on the combined tree; staging shows all three defects.
  - Defect A: after a reload the latest card reads "earlier analysis" because the boot restore declines `complete_current`. Routed: the `unknown` reason copy → R&C's promotion PR (5825740518); the boot restore → the hydrate owner, whom RC is to name.
  - Question B for Runtime: does every turn carry `analysis_state`?
- **03:00Z**
  - **#1985 APPROVED** at `99576e4a` (5825814486); CI queued; train **U3**. ⛔ No pushes to PRs in a train.
  - **Trains:** U1 = #1986 (#1983, #1981, #1975, #1980). U2 = #1968, #1978, #1976, #1982. U3 = #1985, …
  - **Fix 2** (restore `complete_current` at boot) was assigned to me by RC 5825756972 §4. I recommended DEFER in 5825898473: a reload never takes `unchanged`, because the token lives only in memory; a correct rule needs the caller's lease.
  - R&C's `unknown` copy is built as `39a58b97` on `rc/promotion-on-v2`.
  - The decline residual can't be reached today (CEE emits no decline chip). Noted on #1985 (5825906648).
- **03:05Z #1982 × U1 conflict.** `ui-decides-baseline.txt`: the resolution keeps #1983's `store.ts:7887` plus #1982's `readinessStore 782/875`. Verified on U1 + #1982: 19/19.
  - Told RC in 5825921384. **When U1 merges: merge `staging` into #1982 with this resolution and push.**
  - #1968 and #1985 merge clean onto U1: typecheck PASSED, 14 files / 194 tests.
- **03:12Z #1968 APPROVED** at `b17bfbe0`, with all required checks green (the advisory Visual Regression is the only red). Ready for train U2.
- **03:13Z: U1 VOIDED; replaced by U2 = #1988** (64a3b385 + #1983 + #1968 + #1981 + #1980 + #1987). The #1982 conflict resolution still applies once U2 merges; the 03:31Z check-in was retargeted to U2.
- **03:35Z**
  - #1983 merged to staging (`084cd94d`). U2's remaining members (#1968, #1981, #1980, #1987) merge next.
  - **#1982 re-bound → `37edd6f1`** (baseline union + shift note; 19/19 and 351/351; typecheck PASSED). Delta REVIEW_REQUEST posted; `review-ready` re-applied. Rides U2 if the verdict comes in time, else U3.
  - RC ACCEPTED the fix-2 deferral (5825921912).
  - **G1 #1985 needs an update-branch plus a delta after U2** (it shares `useConversation.ts` with #1983). RC runs it; the trial merge was clean.
  - R&C's consent-turn flip rule is ACKed, with a flag: `consentPending` reads `actionChips`, which are dropped on save, so it flips after a reload. Proposed (a) accept tonight, (b) persist `consentOffered` after the morning (5826260421).
- **03:34Z #1985: all required checks GREEN** at `99576e4a`; only the advisory Visual Regression is red (commented). APPROVED. It waits for U2 to land, then an update-branch plus a delta, then U3.
- **03:55Z order (RC 5826265580):** U2 (#1983 merged; #1968, #1981, #1980, #1987 pending) → U3 (bundle 3 + the flip #1989 + #1982?) → **U4 = G1 #1985**, update-branched onto U3's tip.
  - G1 on the flip is clean: typecheck PASSED, 52 files / 750 tests green (5826421759).
  - (b) `consentOffered` is first after the morning, on G1's merge SHA.
  - If U3 slips past about 05:00Z, the flip goes ahead of bundle 3.
- **Morning test implication:** G1 may NOT be served by morning (it is U4). If it isn't, step 4 must say "not in this build".
- **04:05Z: #1968 MERGED** → staging `e359bfc8` (after #1983 `084cd94d`). Unsubscribed. File hand-off to R&C per 5824401606: `coachingCurrency.ts`, `messageComposition.ts`, `CoachingLine.tsx`. Next: #1981, #1980, #1987 (rest of U2), then U3.
- **04:06Z: #1981 MERGED.** Both of tonight's served gaps (conclusion off-screen; later-run card looks current) are now fixed on staging. Next: wait for RC's SERVED post (`version.json`), then G1 (U4).
- **04:35Z: U2 LANDED** (`580d135b`: #1968, #1981, #1980, #1987). Served: UI `580d135b`, CEE `6dfbd11`.
  - **U3** = #1992 (the flip) + #1984 + #1994, then #1993 (bundle 3). The deadline is 06:00Z; quiet window 06:00–09:00Z.
  - #1982: no verdict ever (the pickup went silent). Requested an exact-head reviewer on #69 (5826736919).
  - G1: U4 after U3. I push the update-branch the moment U3 lands and asked RC for a call on (a) before 06:00, (b) Paul's go, or (c) after the window.
  - New P0 (not mine): the hiring brief dead-ends after "Use as starting assumptions" (Runtime/MG).
- **04:45Z G1 update-branched onto post-U2 staging → `8a4dbc4e`** (clean; 41 files / 564 tests; typecheck PASSED). Delta REVIEW_REQUEST posted (5826781442); `review-ready` re-applied. One more trivial update-branch after U3 (`InlineBlocks.tsx`).
- **04:55Z**
  - **G1 delta APPROVED at `8a4dbc4e`** (5826857665, source only). RC cancelled its CI under the runner rule; G1 rides **U4 after 09:00Z**. NOT in the morning build.
  - **U3b = #1997** (flip #1992 + bundle 3 #1993 + #1994) is in CI and must land before 06:00Z. The old U3 #1996 is void.
  - #1982: still no reviewer, and not in U3b.
  - **Morning rows rewritten for a build without G1.** Step 4: the clicked card is disabled after a reload (unknown currency, #1968). Step 5: after the next reply the clicked button turns LIVE again = the G1 gap.
- **06:20Z SERVED tuple: UI `b017e3c2` (U2 + U3b: flip #1992, bundle 3 #1993, #1994) · CEE `9417228`.** Quiet window 06:00–09:00Z.
  - **New assignment (RC 5827490138):** the chat result card ranks win shares under a withheld leader, on 29 of 30 Runs.
    - FIX BANKED: `bank/ai-conversation-withheld-leader-no-win-ranking` @ `ef03d078` (UI-SEM-097). RED-first on the served capture; 934 tests; typecheck.
    - A worker is running the browser check (section 14). The PR opens after 09:00Z on RC's go; it needs RC's ACK on the CLAUDE.md row.
  - Posted my guide rows to RC (5827640106): G1 NOT served, and the known gap at "one more question".
  - After 09:00Z: open the UI-SEM-097 PR; G1 U4 update-branch onto `b017e3c2`; #1982 needs a reviewer.
- **06:08Z G1 pushed `25f4939c`** (the staging `b017e3c2` merge; 43 files / 567 tests; typecheck PASSED). Delta REVIEW_REQUEST posted (5827700266); `review-ready` re-applied. Pushed after the 06:00 runner-rule end so CI and review finish inside the window; merge on RC's call after 09:00Z.
- **06:30Z UI-SEM-097 browser-checked** (witness 14 @ `96ca2952`): the fix card has no win-share row; staging shows 53/47/<1%; everything else identical; 0 off-origin. Posted on #69 (5827900859). R&C independently reproduced G1's `25f4939c` tree.
- **06:45Z G1 → `647de9b5`.** Pre-review 5827937918: the unconfirmed send lost its "reply not received" marker after a reload. FIXED by persisting `deliveryState: 'unconfirmed'`; the card stays taken per RC's ruling. Pins + mutant (2/23); 665 tests; typecheck PASSED. Replied (5827999760) and re-applied `review-ready`.
- **06:55Z**
  - G1 APPROVED at `25f4939c` (5827982612); delta pickup for `647de9b5` is in progress (5828024205). Told RC to build U4 on `647de9b5` (post on #69).
  - RC ACKed the CLAUDE.md UI-SEM-097 row (5827762655 §1). The win card PR opens after 09:00Z on Paul's go, joining U4 if it is file-disjoint.
  - AI Quality found five other surfaces leaking the withheld leader; they are assigned to Panel and Canvas, each following my `ef03d078` rule.
  - AI Quality validated my gate: null `leading_option_id` matched `permitted:false` in 105/105 withheld and 11/11 permitted served blocks.
- **06:52Z G1 `647de9b5`: all required checks GREEN** (15 success; only the advisory Visual Regression is red). The delta verdict is pending (`cse_01B75riKDQz772W9dr3r5RLs`).
- **08:20Z**
  - **G1 APPROVED at `647de9b5`** (5828233578); U4 = #1985 `647de9b5` + #1984 + #1991 + #1999 + #2001. RC is getting three `[skip ci]` heads CI'd; the train builds for Paul's go.
  - **UI-SEM-097 opened: #2004 @ `6426f563`** (fix/ branch, NOT LOW, `review-ready`, subscribed), per RC round 7 §2. Adds the pre-review's mounted chain spec (8 tests; RED 5/8 on staging; each gate half has a killing mutant). If approved in time → U4+ = U4 + #2004; else it follows U4.
  - **#1982 → `78a55bca`** (b017e3c2 merge; delta pickup 5829026291). Goes AFTER U4: re-merge onto U4's tip with the baseline union (#1991 `store.ts:7895` + `readinessStore.ts:782/875`), then a delta, then RC places it into U5.
  - **Consent-turn reload fix BANKED:** `ai-conversation/consent-turn-reload-stable` @ `7f3a742e` on G1 `647de9b5` (transcriptStore `consentOffered` + 1 line MessageBubble). Needs R&C's ACK on the MessageBubble line; opens after U4 lands.
- **08:50Z**
  - **#2004** @ `6426f563`: reviewer `cse_018Hknq7i9mRzoyvEQgpD5hm` picked up 08:18Z. Pre-review 5829256617 (cross-Run conflicting wire) CONFIRMED + NARROWED in the PR body; answered 5829375876. Do not push mid-review.
  - **RC round 8 (5829442152):** §4 card order = option 2 (no licensed leader → every number in CANVAS order); per-card carrier accepted after U4. #1982 APPROVED @ `78a55bca` → after U4 (baseline union). U4 = #2003 (train), merges after I/J on Paul's go.
  - **Banked (open later):**
    - `bank/ai-conversation-win-share-canvas-order` @ `11d52481` (stacked on #2004): open when #2004 merges.
    - `bank/ai-conversation-per-card-leader-claim` @ `036595a2` (G1 + #2004): open after U4 (and after #2004).
    - `bank/ai-conversation-consent-turn-reload-stable` @ `dc5f4807` (G1): R&C ACKed the MessageBubble line with conditions, all met (5829620686). Open after U4.
    - The order and per-card branches both edit `V5AnalysisResultBlock.tsx` and the mounted spec: whichever lands second needs a re-merge.
- **08:53Z** R&C ACK on the consent `MessageBubble.tsx` line is UNCONDITIONAL (5829627305). #1982 VR advisory answered on the PR (5829628859: identical 32/53 as G1; the 503 state never mounts). #2004 CI running, nothing red. Hourly heartbeat prompt refreshed to the current state.
- **09:03Z** Window over, but RC round 9 (5829662359): nothing merges before Paul's EXPLICIT go. Runbook on the go: CEE J (or I) first, then UI U4 (#2003) once its three tree-identity deltas land. #2004: all required CI green at `6426f563` (Staging Gate queued); verdict pending (reviewer since 08:18Z). Next check-in 09:30Z.
- **09:25Z** Paul's go 09:08Z; hold LIFTED (ChatGPT/RC 5829870663: joined-journey truth fixes first; then prove the loop on one served tuple).
  - **#2004 MERGED** → staging `940bf15d` (merged ahead of U4). Unsubscribed. When SERVED: update Paul's Run row (no win-% ranking under a withheld leader).
  - **#2007 OPENED** @ `017c1c04` (canvas order + #2004 nits), `review-ready`, subscribed.
  - Per-card branch → `3b0a08f9` (+ opposite-direction control). After U4 it needs a rebuild on staging (its base carries #2004's unsquashed commits: cherry-pick `7ae5c421`'s successors onto staging).
  - Asked RC (5829842626) for the reload-currency fix ("fix 2") lease + slot after U4: TOP engineering priority.
  - LESSON: commit before running mutants that use `git checkout -- <file>` (it reverted an uncommitted edit once).
- **09:40Z** #2004 SERVED 09:16:52Z (RC). Morning row 2 updated. U4b = #2006 waits only on #1991's tree-identity verdict. R&C will witness G1 (row R5d) on U4's served tuple.
  - **Fix 2 traced (5830148774):** after a reload the card needs (1) a `complete_current` verdict (boot declines it) AND (2) `analysisFreshness.currentGraphHash`, which is NULL after every reload (the boot read carries no `analysis_ready`). A UI-only fix would invent producer state. Proposed: CEE adds `analysis_ready.current_graph_hash` to the scenario-graph read; UI routes it via `setAnalysisFreshness` at the accepted exit and restores `complete_current` only under `readCarriesEveryProjectedValue` + no edit hold + scenario match. Asked RC for owners/lease. Worktree `reload-current` is ready (staging `940bf15d`), with no changes.
  - #2007 picked up 09:21Z (`cse_01WUft8wVXQg7Eb2vQbysPWE`).
- **09:58Z PRE-STAGED on U4b (#2006 `2b25faf7`), so each post-U4 step is mechanical:**
  - consent branch `dc5f4807`: merges CLEAN.
  - #1982: conflict only in `ui-decides-baseline.txt`; resolution = `store.ts:7895` + `readinessStore.ts:782`/`:875` (19/19 on the U4b tree). Saved as local `scratch/1982-on-u4b` @ `c39a9101` (worktree agent-a4dfcf1d…). After U4 lands: `git merge origin/staging` on the fix branch with the same union.
  - per-card: cherry-pick `036595a2` + `3b0a08f9` onto U4b is clean, and 10 files / 157 tests pass (card specs + G1). Saved as local `scratch/percard-on-u4b` @ `ad31e7f8`. After U4 (and after #2007, which edits the same files): cherry-pick onto staging → fix/ branch → PR.
  - #2007: CI running (nothing red), reviewer `cse_01WUft8wVXQg7Eb2vQbysPWE`.
- **10:25Z U4 LANDED** (staging `5f8d9095`, tree `23bf12cb`; G1 = `8b4167cd`). Unsubscribed from #1985.
  - #1982 → `624667b6` (union; control-tested: either side alone fails 2). Delta requested 5830672761, relabelled.
  - **#2009 OPENED** (consent reload) @ `ed71d16d`, subscribed, `review-ready`.
  - Per-card carrier waits for #2007 (shared file). Scratch `scratch/percard-on-u4b` @ `ad31e7f8`.
  - NEXT: when U4 is SERVED → morning rows step 4/5 (G1 closes the duplicate-after-reload gap); when #2007 merges → open per-card from a fix/ branch on staging.
- **10:30Z #2007 APPROVED** @ `017c1c04` (5830534604) with required checks green → RC merges. Body corrected (RED 5/7 + 1 re-pin). #1982 delta picked up 10:13Z (`cse_01KWMg9zAWkRwiZAXtPCjsSM`).
  - When #2007 merges: rebuild per-card on staging (cherry-pick `036595a2`+`3b0a08f9`; resolve against #2007's `canvasRank`), AND carry review note 2: filter `canvasRank` to OPTION nodes (not every labelled node).
- **Morning draft:** `scratchpad/morning-test.md`. Fill it from the served SHAs at about 06:00Z.
- **#1973: MERGED 01:01Z** (at `ad2e9122`). `ConversationPanel.tsx` and `ChatThread.tsx` are unfrozen; leases are still needed for the G1 line and the reply-start change.
- **#1968** (run-turn currency + notice copy, promotion OFF): APPROVE `bea7b52f`, green → RC merges after #1973.
- **G1** (a used card action stays settled after reload): GO + lease (5824401606).
  - Branch `ai-conversation/card-action-settled-reload` @ `d98da259` holds the in-lease half.
  - Waiting on a lease for 3 lines (5824726600): `ConversationPanel.tsx:~689` (after #1973 merges), `guidanceStore.ts:281` (type), `V5HeldProposalBlock.tsx:~274` + its spec.
  - The full patch is parked at `witness/ai-conversation-local:e2e/ai-conversation/pending-g1/`.
- **Reply-start scroll: PR #1981** (`7ec4d83e`, `review-ready`, NOT LOW).
  - Served check 2/2 (`10-*` screenshots); I verified the conclusion is on screen.
  - Lease ACKs pending: RC for `ChatThread.tsx` + `useSmartScroll.ts`; R&C for `ChatMessage.tsx`, where the change is only a `data-message-id` attribute (asked 5824935707).
- **Promotion flip:** OWNED by R&C.
  - Local `4bd07230` on `bea7b52f`. R&C will cherry-pick it onto staging after #1968 merges and open a PR, which merges after #1854 AND R&C's card-copy/badge fix are served.
  - The notice copy is folded in; `coachingCurrency.ts` goes to R&C after #1968. I only need to ACK if they touch `V5CoachingBlock.tsx`, which stays in my G1 lease.
- **G1 extra test (R&C 5824576658 §4):** ChatThread remounts a message's subtree when the next reply swaps its chip group, which resets ActionChip's local settled state. G1 derives settled from delivered in-memory messages, so this is covered. Pin it with a test when the lease lands.
- **Readiness-outage patch: PR #1982** (`6736693d`, NOT LOW).
  - NOT `review-ready` until RC accepts or leases `readinessStore.ts` + `canRunAnalysis.ts` (asked 5825059456).
  - A remaining sentence defect needs the `OutputsDock`/`ConversationPanel` owner.
- **#1968:** RC update-branch → `27256227`. The author evidence is posted (5825016201: empty PR-file diff; 367/5,074 green). Awaiting the delta verdict → RC merges.
- **PR-B #1854: SERVED** (CEE `c673223`, per 5824866305).
  - The joined browser witness goes to Panel or Canvas (first to post) on UI = #1973's merge SHA + CEE `c673223`.
  - RC re-imposes a MERGE HOLD when the witness starts, so **G1 must land before then**. If the G1 lease (5824726600) is still unanswered at 01:51Z, nudge RC once.
  - Known live leak until CEE #1857 lands: "What changed?" can name a withheld leader. Not mine.
  - Route evidence: `ai-conversation/prb-route-acceptance` + witness `09-*`.
- **R&C** now owns the reply shape (`ChatMessage.tsx`, `MessageBubble.tsx`, then `messageComposition`/`CoachingLine` after #1968 merges).

- **Served evidence (01:50Z, 5825343191):** CEE `c673223` is byte-identical to `c933aabf`. Tonight's UI `staging` `64a3b385` has two gaps:
  - (1) the conclusion is off-screen on arrival → #1981;
  - (2) a later-run card still looks current → #1968.
  - Getting both landed is the top priority for Paul's morning test.
  - Screenshots: `11-served-c673223-*` on the witness branch.
- **#1982 visual adjudication:** a worker is producing same-machine before/after images (`12-readiness-1982-*`).

## Backlog (next levers, in priority order)
1. **Readiness-outage false copy.** The gate says "Olumi is checking again" while the dock shows HTTP 503; the owner is unassigned (5822762653).
   - Build a patch on a branch for the owner: `canRunAnalysis.ts` / `readinessStore.ts`.
   - Offer it on #63.
2. **After the #1973/#1968/G1 merges: the joined served witness.** On the pinned tuple: Run → card → click → acknowledgement → reload → no duplicate.
3. **Morning deliverable for Paul:** RC owns Paul's guide, and R&C has `MORNING-TEST-coaching-and-chat-shape.md`. **Do NOT publish a competing instruction.**
   - At about 06:00Z, verify which of #1981, #1968 and #1985 are SERVED (`version.json` / RC's SERVED post).
   - Post my rows to RC for the guide: build, step, expect, and "not in this build" where applicable. Source: `scratchpad/morning-test.md`.
4. **When #1854 is served:** re-run the route capture on the served build's SHA, and re-raise promotion with it.

- **10:52Z Paul: "deploy everything to staging ASAP, use cloud resources".** Posted to RC (#69 5831111678):
  - #1982 APPROVED + green → next train.
  - #2009 APPROVED, CI queued → same train.
  - #2007 is in U4c #2008 (do not touch).
  - NEW **#2013** (per-card carrier + note 2, option-only `canvasRank`) @ `20a90b32`, review-ready, subscribed, stacked on #2007. Worktree `.claude/worktrees/per-card-fix`.
  - Fix 2 still awaits RC's lease.

- **11:15Z**
  - **Audit posted** (5831201569).
  - **Fix 2 is PR #2015** @ `3cbea81c`: NOT LOW, review-ready, subscribed; REVIEW_REQUEST 5831348237.
    - `applyBootRunCurrency` restores `complete_current` + the read's `graph_hash` at both accepted exits, only under `canvasProvenEqualToRead` + not dirty + gate open.
    - Evidence: 3 RED → 20/20; 4 mutants caught.
  - **Pre-built U4d = draft #2014** @ `061914a1` (U4c tip + #1982 + #2009), for RC to adopt (5831275067).
  - Paul was given the ETAs: #2007 ~20–30 min; #1982/#2009 ~45–90 min; fix 2 ~2–3 h.
- **11:25Z**
  - #1982 MERGED (staging `a9968d8c`).
  - #2015 head `2a93df10`:
    - adds the reverse-direction proof (pre-review 5831362210 reproduced a false current at `unchanged`);
    - applies the `EdgeV3Schema` `edge_type` default (served pricing read failed 15/15 edges, so fix 2 would never have fired);
    - 25/25 tests; 6 mutants caught.
  - Replies: PR 5831462316; #69 5831463041.
  - LESSON: always run a served-bytes positive control before claiming a proof works on real data.
- **12:10Z**
  - Runtime took `_answer_shape` on agent-lane Run turns (5831886008, PR ETA ~13:15Z).
  - **NEW #2019** @ `df577a40`: the answer shape persists across reload. Stacked on #2014; REVIEW_REQUEST 5832046825; subscribed.
  - RC adopted #2014 as U4d.
  - #2015 is under review (pickup 5831784122).
  - Cleanup: released 14 clean, finished worktrees; 8 left (main + 7 active).
  - Drive check `send_later` trig_01UvvMJ37YJ4DAjF92atb9Eq at 12:08Z.
- **12:30Z**
  - #2015 APPROVED @ `2a93df10` (5831954952).
  - Pre-built **U4e = draft #2020** @ `50e7ef12` (U4d + #2019 + #2015); asked RC 5832125921.
  - Paul's manual-test defects (all producer) routed in 5832088673:
    - "Shall I record them?" followed by "The model was saved.";
    - the approve chip label doesn't match the "save £50k" question;
    - the £50k one-off fee recorded as annual salary.
  - Fix 2 residual (non-blocking): graph-level `goal_constraints`/`options` are not in the reverse proof.
    - Build only against served bytes carrying constraints. The pricing turn `draft_graph.goal_constraints` exists in the c673223 fixture; the store's goalConstraints come via autosave.
    - Verify store == read on a real chain first, or a strict check will disable fix 2 for the pricing brief.
- **12:52Z**
  - #2019 APPROVED (5832209044). #2020 (U4e) CI queued.
  - **NEW #2027** @ `a1fbbb25` (LOW): only the latest reply's "…" menu shows at rest (Panel 5832347190 §C). REVIEW_REQUEST 5832695479.
  - UI check of CEE #1914's `_answer_shape`: compatible (5832694495).
  - Runtime CEE #1913 covers Paul's 3 defects.
  - LESSON (again): commit before any mutation or `git checkout -- src`.
- **13:35Z**
  - MERGED to staging `5237e1a6`: #2015 (fix 2), #2007, #2009 (plus #2005 and #1982). #2002 not yet.
  - #2019 base-merged to `1e6f2fcd` (4 additive conflicts); delta requested 5833213928; relabelled.
  - #2027 relabelled 13:23Z.
  - #2013 conflicts with the squashed #2007 (held).
  - Asked R&C for the served R5b re-run once `5237e1a6` serves (5833232454).
