# AI Conversation (chat panel): handover, 25 Sep 2026, about 16:20Z

This is for a new Claude Code session taking over the **AI Conversation** workstream: the OpenAI chat panel in `src/canvas/conversation/**` and `src/v5/blocks/**`, plus the reload/currency code in `src/canvas/hydrate/**` that this lane owns.

Every SHA and comment id below was checked at the time of writing. Anything **not** verified is labelled **UNVERIFIED**. Please keep that discipline: this lane's repeated mistake was stating things before checking them.

---

## 0. Read this first

### Hard constraint: OPENAI ONLY
Paul's words, still in force:
> "Do not make any Anthropic API calls or incur any Anthropic API usage/cost without Paul's explicit permission … use the OpenAI implementation only. Before running any test, evaluation, browser journey or script that could invoke an AI provider, verify that it is using OpenAI, a deterministic fixture/mock, or no model call at all. If you cannot verify this, do not run it. Do not delete or degrade the existing Conventional/Anthropic implementation."

Everything in this lane's tests and harnesses is fixture-served or model-free.

### Coordination
- **Where:** `Talchain/olumi-programme-docs#69` (the successor to #63, which is full). Read every new post and reply there, not to Paul.
- **Other lanes:** Delivery Lead / RC (release control), R&C (Reasoning & Coaching; they run the served browser witnesses), OpenAI Runtime, Canonical State, AI Quality, Panel, Canvas, Independent Review, ChatGPT/Codex.

### Merge rules as of 14:15Z on 25 Sep
- **Staging:** it has **no required status checks** (#69 5833840359). Full regression runs **after** each merge (#2032).
- **Self-merge:** under Paul's directive (#69 5833857290) and RC's record format (5833862133), you self-merge your own changes. Post a short SELF-MERGE RECORD on the PR, and label `review-ready` for post-merge independent review.
- **Self-merge is refused for:** auth/credentials, **LLM providers**, migrations, `.github/`, `supabase-store.ts`, and **anything Anthropic**. These need an independent verdict first.
- **`main`:** never push to it.
- **Train-built branches:** squash-merge anything cut from an RC train branch (U4c/U4d). Their histories carry other PRs' commits (see §6).
- **Staging CI:** the push-regression runs are **cancelled by newer pushes**, so a specific commit often gets no result. Run the relevant suites yourself on the integrated staging tree (§5).

### What this cloud container cannot do
- Reach the staging site `https://staging--olumi.netlify.app` or CEE staging: the proxy answers 403. Served verification comes from R&C/RC witnesses on #69, or from a session with network access.
- Use the GitHub API on `Talchain/olumi-assistants-service` (CEE); only `decisionguideai` and `olumi-programme-docs` are enabled. `/home/user/cee-staging-wt` is a **stale** local clone (24 Sep): read its source, never cite it as current.
- Push straight to `staging`: the permission classifier blocks it as a CI bypass. Use a `fix/` branch, a PR, and a squash-merge.

### First actions for the new session
1. Run the CLAUDE.md session preamble. Then read #69 from comment **5835286407** onward: everything before it is folded into this document.
2. **P0-1:** confirm the served build is `89716c13` or later, and get R&C's step-7b result. If it fails, act on the `[WARN] …boot_run_currency_declined` line.
3. **P0-2:** ship the RC-ruled `openai` default, only if your session is permitted to change provider routing or Paul approves. Otherwise leave it with RC.
4. Answer the #2042 post-merge review.
5. Then work through P1, verifying on served builds via R&C/RC.

---

## 1. The goal, and where each part stands

**Paul's brief:** the OpenAI chat is concise, specific, science-grounded and action-oriented. After a Run it shows the **conclusion first, one decisive caveat, one real next action, and detail behind disclosure**. No false claims, no fabricated edits, no surprise Run, and no duplicate actions after a reload.

**Programme exit criteria (Paul 5833857290):**
1. The architecture is integrated end-to-end.
2. The UI is complete.
3. The design works exactly as intended.

"DONE" counts only at system level.

| Requirement | UI half | Producer half | Served evidence |
|---|---|---|---|
| Conclusion first | **Done.** The producer's text is rendered in order, and the latest reply lands at its first line (#1981). | CEE reply text | Hermetic browser witness on staging `29a112fe` (§5), with screenshots `09-prb-run-reply-*` on the witness branch |
| Detail behind disclosure | **Done:** (a) `AnswerBody` renders the `_answer_shape` headline, ≤3 bullets and "Show more" (UI-SEM-090); (b) the shape persists across a reload (#2019); (c) the Analysis-result `summary` sits behind a closed **Details** whenever reply text is present (#2035) | CEE #1914 `_answer_shape`: merged `fe4c796a`, served from about 14:26Z (CEE `fe4c796` and later), per #69 5834033236 / 5834044988 | **UNVERIFIED** in a served browser: nobody has yet shown a served Run turn arriving with `_answer_shape` and rendering concise, then staying concise after a reload |
| One decisive caveat | Nothing more the UI can do. It must not rewrite producer text (CLAUDE.md "UI is a passthrough") | **Not met.** Run replies carry 3 or 4 caveats (the served `c673223` "C2 run" has 3 caveat bullets, plus the card's uncertainty line). Owner: Runtime / AI Quality | Not measured |
| One real next action | **Done:** one run-turn card is promoted (`RUN_TURN_COACHING_PROMOTION_ENABLED = true`, `messageComposition.ts:249`). A clicked card stays settled after a reload (G1, #1985) | **Partly:** R&C #1922 (`02c35f6a`) stands its card down only when the summary carries a repair step. The served pricing Run still shows "Pressure-test this link" beside a blocked churn limit (#69 5834880639), which is by #1922's design | Hermetic witness: one action click sends **one** turn carrying the producer's prompt verbatim |
| No false claims | Leader claims are withheld wherever the producer withholds them (UI-SEM-097, #2007; the Run card's currency notice) | Runtime's egress gates | R&C: the coaching journey passes 5/5 on UI `29a112fe` · CEE `a8fc101` (5834880639) |
| No surprise Run | A Run chip is gated by readiness (`SuggestedChips.tsx` `READINESS_GATED_ACTIONS`, `RunChipGate`) | — | Source-read only |
| No duplicate action after a reload | **Done** (G1, #1985) | — | R&C: G1 passes on the served build (5833719119) |
| **A current Run card stays current after a plain reload** | **Fixed today in #2042 → staging `89716c13`** (§2) | CEE boot read (correct per R&C 5834151007) | **UNVERIFIED on the served build: this is P0-1 below** |

---

## 2. Today's critical fix: the Run card after a reload (#2042)

**The symptom.** This was served-witnessed by R&C in the joined guest witness, step 7b, on UI `29a112fe`, and RC called it the #1 user-visible failure (5834646511). After a plain reload, the Run card says *"Olumi can't confirm this still matches your latest analysis."* #2015 ("fix 2", `5237e1a6`) was served but never fired.

**The root cause**, reproduced on served bytes:
- **Setup:** the served OpenAI draft (`src/canvas/conversation/__tests__/fixtures/openai-route-coaching-journey.c673223.json`, turn "C1 brief") was run through the **real** `applyDraftResult` → `hydrateCanvasFromServer` path.
- **Where it declined:** `applyBootRunCurrency` returned `canvas_not_proven_equal`. The **reverse** equality proof failed on the edge key **`defaulted: true`**, which is on 9 of the 18 served edges. A drafted canvas never carries it.
- **Why #2015's spec missed it:** it built its read from the canvas's own projection, so canvas and read were equal by construction.

**The fix** (`src/canvas/hydrate/serverGraphHydration.ts`):
1. **What the currency proof ignores:** exactly the fields that CEE's analysis-affecting hash **documents as excluded**, stripped from both sides (`NOT_ANALYSIS_AFFECTING`, `withoutNonAnalysisFields`). The source is CEE `src/orchestrator-v5/context/graph-hash.ts`, header of `computeAnalysisAffectingGraphHash`, the "Excluded" list.
   - It is an **exclusion list, not a whitelist**, so any other key still blocks: fail-closed.
   - The acknowledgement path is **unchanged**; it keeps its strict comparison.
2. **The diagnostic:** a declined restore logs at **`warn`** (PROD's level; the old `debug` was invisible when served):
   ```
   [WARN] server_graph_hydration.boot_run_currency_declined {scenarioId, exit, reason, unproven, dirty, mergeChanged, runStateKind, graphHash}
   ```
   `unproven` is the **first failing clause** of the proof: `fwd:`/`rev:`, then element id, key, and short excerpts. The proof and its explanation share one body (`whyCanvasNotProvenEqualToRead`, `firstProjectedValueTheReadLacks`, `firstReadValueTheCanvasLacks`), so they cannot disagree. It logs to the console only (`src/lib/logger.ts`); nothing leaves the device.

**Tests** (`src/canvas/hydrate/__tests__/bootRunCurrency.draftedCanvasReplay.spec.tsx`, 6 tests, served bytes, no model calls):
- the served positive case restores, and the Run card reads current;
- **controls:** an analysis-affecting difference (strength, observed value, `effect_direction`) still declines;
- a **pinned RESIDUAL** (below).
- **RED check:** reverting the normalisation makes the served positive case fail.
- **Totals:** `src/canvas/hydrate` 19 files / 240 pass; the other 24 spec files that read the hydration, 324 pass. Typecheck gate PASSED; ESLint clean.

**Pinned residual, not fixed:**
- **The case:** an approval stamps `observed_state.source` on CEE's copy, and the canvas lacks the stamp.
- **What happens:** the **boot merge** (`src/canvas/utils/mergeServerGraph.ts`, `modelChanged` → `markGraphStructurallyEdited`) counts that stamp as a model change, so the restore declines as `edited_since_read` with `mergeChanged: true`.
- **UNVERIFIED:** whether a served canvas lacks the stamp after an approval. R&C's 7b flow includes an approval, so their next run answers it.
- **If it bites:** the fix belongs in `mergeServerGraph.ts`, a shared file that gates staleness on **every** boot. Coordinate with Canvas / Canonical, then flip the test named "RESIDUAL, not fixed here".

---

## 3. Open items, ranked

### P0: do these first

**P0-1. Get #2042 served-witnessed.**
- Confirm staging serves `89716c13` or later: ask on #69, or wait for the Staging Operator's "SERVES" post.
- Ask R&C to re-run step 7b; they re-run within about 8 minutes of a served fix (5834151007). The request is already posted (5835197344).
- **If it still says "can't confirm":** get the `[WARN] …boot_run_currency_declined` console line from R&C's run. That line names the cause.
  - `edited_since_read` + `mergeChanged: true` → the residual in §2.
  - `canvas_not_proven_equal` → `unproven` names the key; add it **only** if CEE's hash excludes it.
- **Acceptance** (RC's contract, 5834646511): current after an unchanged reload, stale after an edit, settled after a click, all tested from served bytes.

**P0-2. OpenAI-only risk: staging's default route is `conventional`. RULED, NOT BUILT.**
- **The risk:** `src/v5/aiComparisonMode.ts:37-39` (#1878, `727e7eda`) resolves a staging URL **without** `?ai=` to `conventional`. That is the barred Anthropic comparison path: on 22 Sep, no header routed to `turn_executor` (PR #1878 comment 5785368179). So a plain staging link, bookmark or shared URL sends turns down it.
- **RC ruling (#69 5835243907), under Paul's instruction to make confident decisions and alert him:** **option (b). The UI staging default flips to `openai`.** `?ai=conventional` stays explicit, so the control path is preserved.
  - **Tests RC specified:** RED-first, no `?ai=` on the staging host → `openai` plus header `x-olumi-ai-mode: openai`; an explicit `?ai=conventional` still → conventional; production unchanged.
  - **Not self-mergeable** (provider routing): it needs an independent exact-head verdict.
  - **Runtime's answer (#69 5835289234, source read plus the Render env; no served probe):** a header-less turn is **NOT refused. It CALLS Anthropic.**
    - `proxy-v5-turn.ts:66-72` routes no-header traffic by `PROXY_V5_TARGET`, which is `orchestrator` on cee-staging, to `/orchestrate/v2/turn`.
    - That route runs outside any provider policy (`provider-policy.ts:279-282`), with `CEE_MODEL_ORCHESTRATOR = claude-sonnet-5` and `ANTHROPIC_API_KEY` present.
    - **So the UI flip closes the browser path only.** A script, a curl, an old tab, or `/bff/orchestrate/v2/turn` still reaches Anthropic.
    - **The server-side closure is Paul's call (env or credentials):** (1) set cee-staging `PROXY_V5_TARGET=agent`, or (2) remove `ANTHROPIC_API_KEY` from cee-staging, which fails closed everywhere.
- **Status:** this session wrote the RED spec (3/6 RED on the current source), but **the permission system blocked editing the provider-routing default**. Nothing was pushed; the branch was discarded. Reported in #69 5835286407.
- **Next:** do it only in a session with that permission, or with Paul's explicit approval. The edit is `aiComparisonMode.ts:39` (`'conventional'` → `'openai'`), its doc comment, and `src/v5/__tests__/aiComparisonMode.spec.ts`. The current spec pins the old default, so update it. `V5GraphPatchBlock.explainDiffHiddenInOpenAiMode.spec.tsx` sets `?ai=conventional` explicitly and is unaffected.
- **Until it is served:** every link must carry `?ai=openai` (RC's interim rule).

### P1

**P1-1. Served proof of the concise reply.**
- On a served `?ai=openai` Run: the reply shows a headline, ≤3 bullets and "Show more"; after a reload it is still concise (#2019); and the Analysis result's summary sits behind "Details" (#2035).
- AI Quality measured 279 words on the wire against about 95 shown at rest (#69 5834767211; the at-rest fold is #1987, `580d135b`).

**P1-2. Two conflicting next actions on a blocked Run.** This is a producer issue.
- **The case:** text asking to fix a limit, beside the card "Pressure-test this link".
- **Status:** R&C #1922 covers only a summary that carries a repair step. Since #1912 the summary says "It stays on the model", with no step.
- **UNVERIFIED:** whether the current CEE reply text still asks for the limit fix. Check a served pricing Run.
- **Owner:** R&C for the card. The reply text is Runtime's (`compose/withheld-reason-tail.ts`, per R&C 5834491163).

**P1-3. Producer copy defects visible in the chat** (route them; the UI must not rewrite them):
- the summary prints **"< 4percent per month"** (CEE constraint-label formatting; seen in `c673223` and in the rendered witness);
- Run replies carry several caveats, not **one decisive caveat** (Runtime / AI Quality).

**P1-4. #2042 post-merge review.** Picked up by `cse_01TBmeXZebvkDLGRj3XCXFzV` at 15:45Z (PR comment 5835212795). Address its findings on the PR, and fix forward on staging.

**P1-5. Unanswered question for Panel/Compare (#69 5833675898).**
- The Compare tab's run history (`src/services/analysisRunHistoryService.ts:95`, `v5_handler_facts`) reads the Agent's **internal** `run_analysis` fact.
- Does Compare render a **leader** from it on a withheld run? No reply yet.
- Chat is unaffected: its reload readers hold only what the browser received.

### P2: known residuals and risks, none known to be user-visible now

**P2-1. Goal constraints and options are outside the currency proof.**
- `buildRegistrationGraph` projects nodes and edges only. CEE's analysis-affecting hash also covers `options` and `goal_constraints`.
- So a canvas/CEE difference **only** in goal constraints cannot block the restore. It dates from #2015.
- **UNVERIFIED reachability:** for example, a guest's GoalPanel constraint never reaches CEE (UI-SEM-087). Check whether such a canvas survives a reload with the constraint, and whether the restore then claims "current".
- If reachable, add the canvas's constraints to both sides of the proof, fail-closed.

**P2-2. Transcript size.**
- Persisting `answerShape` (#2019) roughly doubles each shaped turn in localStorage.
- The cap is `MAX_SERIALISED_BYTES = 400_000` (`transcriptStore.ts:161`), so the earliest messages drop sooner in long sessions. This is disclosed through `droppedCount`.

**P2-3. ChatGPT's architecture ask (#69 5834761926, item 2):** one accepted-revision carrier that boot, turn responses and polling all agree on. Not built. #2042 fixes the proof rather than replacing it.

**P2-4. #2013 (per-card leader-claim hardening).**
- Closed. The branch `fix/ai-conversation-per-card-leader-claim` @ `20a90b32` is kept, APPROVED at that head (5832572352).
- It conflicts with the squashed #2007, and covers a case never observed on the wire (105/105 served withheld blocks carry a null id).
- Only revive it if a withheld claim that keeps its id is observed.

---

## 4. What this lane has on staging (verified with `git log origin/staging`)

| PR | Staging SHA | What the user gets |
|---|---|---|
| #1961 | `5dd24fd3` | A stale coaching card's action is disabled; the chip never claims delivery |
| #1968 | `e359bfc8` | Run-turn coaching currency (three-part rule); promotion constant, since switched ON |
| #1981 | `b737271c` | A long new reply lands at its first line |
| #1983 | `084cd94d` | The automatic first run no longer reads "The model has changed" |
| #1985 | `8b4167cd` | G1: a card action already taken stays settled after a reload (no duplicate action) |
| #1982 | `a9968d8c` | The readiness re-check no longer keeps a false "checking again" refusal |
| #2009 | `10e59320` | A consent turn keeps its layout after a reload |
| #2007 | `019fa47f` | A card with no licensed leader lists win shares in canvas order (UI-SEM-097) |
| #2015 | `5237e1a6` | Fix 2: boot run-currency restore (ineffective when served until #2042) |
| #2027 | `f08e1c41` | The "…" message menu is quiet at rest on past replies |
| #2035 | `e4c50027` | After a Run, the reply leads and the analysis summary waits behind "Details" |
| #2019 | `044ec515` | The answer shape persists, so a short reply stays short after a reload (squash-merged, see §6) |
| #2042 | `89716c13` | A reload of a drafted model keeps its current Run card current; a decline names its clause |

**Integrated check** on staging `29a112fe` (after #2019, #2035 and Panel's #2036):
- typecheck gate PASSED;
- `src/canvas/conversation` + `src/v5`: 385 files / 5,280 pass, 22 skipped, 0 failed.

**My open PRs:** none. **Scheduled routines of mine:** none (all deleted, disabled or fired).

---

## 5. How to verify, with no model calls

All vitest runs need the dummy Supabase env, otherwise whole files vanish at collect:
```bash
VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test npx vitest run src/canvas/conversation src/v5 --reporter=dot   # ~9 min
VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test npx vitest run src/canvas/hydrate
pnpm run typecheck   # the ratchet gate
```

**Hermetic browser witness** of the chat after a Run: the real app on local vite, every `/proxy/v5/turn` answered from a fixture, every off-origin request aborted, and zero model calls asserted. The harness lives only on the witness branch `witness/ai-conversation-local` (@ `32bd84b2`). **Never merge that branch.**
```bash
git worktree add --detach /tmp/wt origin/staging && cd /tmp/wt
git checkout origin/witness/ai-conversation-local -- e2e/ai-conversation playwright.aiconversation.config.ts
ln -s <repo>/node_modules node_modules
GEOMETRY_PORT=5297 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test \
  pnpm exec playwright test -c playwright.aiconversation.config.ts prbRunReply
```
- **Last run:** 5/5 passed on staging `29a112fe`.
- **What it asserts:** the promoted card; the summary behind a closed "Details"; one action click, one turn, verbatim prompt; the reply's start in view on arrival.
- **Screenshots:** `e2e/ai-conversation/evidence/09-prb-run-reply-*`.
- **Caveat:** its Run body is the route-generated `c933aabf` fixture (a scripted model), not a live capture.

**Served-byte fixtures:**
- `src/canvas/conversation/__tests__/fixtures/openai-route-coaching-journey.c673223.json`: six served OpenAI turns: brief, run, question, click, edit, re-run.
- `src/canvas/hydrate/__tests__/fixtures/pricing-provisional-poll.json`: a served scenario-graph read.

---

## 6. Traps this lane hit, so you don't

1. **Test from served bytes through the real path.** #2015's spec was equal by construction and hid a served failure for a whole day. For boot/currency work, build the canvas with `applyDraftResult` from a served turn.
2. **Verify before stating.** This session posted a made-up SHA, a miscount, a false "the merge bypassed CI" and a wrong card identifier, each corrected in place. Cite only what you have just read.
3. **The #2002 hitchhiker.** Branches cut from RC's U4c/U4d trains carry other PRs' commits in their history.
   - #2019 had #2002's unmerged canvas change in its diff; that was reset in its tree.
   - Its APPROVE was **squash-only**: a merge commit would later make #2002's fix silently do nothing.
   - Always run `git diff origin/staging...<head> --stat` before merging.
4. **Commit before any mutation check** or `git checkout -- src`. A checkout once wiped uncommitted fix code.
5. **The worktree `node_modules` symlink is not gitignored** (`node_modules/` with a slash does not match a symlink). Remove it before committing.
6. **`logger.debug` is invisible in PROD** (level `warn`). A served diagnosis needs `warn`.
7. **Staging push CI gets cancelled by newer pushes.** Don't wait on it for a specific commit; run the suites on the integrated tree.
8. **Superseded-head CI failures** show as "Full Test Suite Summary … 0 test files / shard artifacts missing". Explain it once on the PR; it is not a test failure.

---

## 7. Key files

| Area | File | Role |
|---|---|---|
| Answer shape | `src/canvas/conversation/answerShape.ts`, `AnswerBody.tsx` | parse / render `_answer_shape` (UI-SEM-090) |
| Transcript | `src/canvas/conversation/utils/transcriptStore.ts` | reload persistence: `answerShape`, `consentOffered`, taken-action records; 400 KB cap |
| Composition | `src/canvas/conversation/messageComposition.ts`, `CoachingLine.tsx`, `InlineBlocks.tsx` | promotion, collapsing, block order; `summaryBehindDisclosure` |
| Cards | `src/v5/blocks/V5CoachingBlock.tsx`, `ActionChip.tsx`, `coachingCurrency.ts`, `useCoachingCurrency.ts`, `V5AnalysisResultBlock.tsx` | card currency (the three-part rule), action chip, analysis card |
| Message chrome | `src/canvas/conversation/zones/ChatMessage.tsx`, `MessageMenu.tsx` | the "…" menu, quiet at rest (`MENU_QUIET_AT_REST`) |
| Reload currency | `src/canvas/hydrate/serverGraphHydration.ts`, `applyBootRunCurrency.ts` | boot read → merge → currency restore (§2) |
| Repeated cards | `src/canvas/conversation/analysisCardDedupe.ts` | drops a repeated analysis card on non-Run turns |
| Routing | `src/v5/aiComparisonMode.ts` | `?ai=openai` / `?ai=conventional` selector (P0-2) |
| Orchestration | `src/canvas/conversation/useConversation.ts` (about 7k lines) | turns, persistence, hydration |

---

## 8. Coordination posts from this lane, for context

- **#69 5834906701:** correction; the "run currency survives a reload" claim was false.
- **#69 5835197344:** #2042 merged, with a request to R&C to re-run 7b.
- **#69 5835210019:** the `?ai=openai` binding and the conventional-default risk. **RC ruled (b) in 5835243907.**
- **#69 5835286407:** this session cannot build (b); the permission system blocked it.
- **#69 5834275139:** the two-next-actions producer issue, sent to R&C.
- **#69 5833675898:** the internal-dispatch reload answer and the Compare question.
- **#69 5833806301:** #2019 is squash-only.
