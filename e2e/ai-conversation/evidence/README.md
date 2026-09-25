# AI Conversation — served-browser evidence (witness branch, not for merge)

All images come from local `vite`. Every `/proxy/v5/turn` response is fulfilled by Playwright `page.route` from a fixture. **No model calls**: off-origin requests are aborted, and the count of completed off-origin requests is asserted to be 0.

| File | PR / head | What it shows |
|---|---|---|
| `01-card-current.png` | #1961 `d0caf2b3` | Coaching card current: the action is live |
| `02-card-model-moved.png` | #1961 | CEE hash moved: stale notice, action disabled (`aria-describedby` points to the notice) |
| `03-run-chip-refused.png` | #1966 (merged) | Run chip routes to the run gate and refuses out loud. The chip is still clickable; the fix is in progress on `ai-conversation/run-chip-gate-visible` |
| `04-*/05-*` | AI Quality captures, CEE `57f903c` | OpenAI Run replies (pricing complete, hiring blocked) rendered in the dock |
| `06-runcard-current*.png` | #1968 `b94d7a9b` (merge `3922c099`) | Run-turn card, producer v3: current, no notice, live chip |
| `06-runcard-later_run*.png` | #1968 | Same hash, newer run: "Written about an earlier run of this model — the latest run may point somewhere else." Chip disabled |
| `06-runcard-model_changed*.png` | #1968 | Hash changed: "Your model has changed since this was written — it may no longer apply." Chip disabled |
| `06-runcard-not_current*.png` | #1968 | Run not `complete_current`: "Written about an earlier analysis — re-run to check it still holds." Chip disabled |
| `07-runchip-gate-closed*.png` | #1973 `56a8215a` (merge `89afedbe`) | Whole app, docked Olumi tab, real `useConversation`. Readiness `can_run_analysis:false` (fixture): the "Run the analysis" chip is disabled with `data-run-gated="true"`, the gate's sentence sits under the row as its `aria-describedby`, and "Explain the model" beside it stays live. Forced click, `el.click()` and a synthetic click sent 0 run turns |
| `07-runchip-gate-open*.png` | #1973 | Same journey, readiness `can_run_analysis:true`: the chip is enabled with no reason. `-dispatched`: one click sent exactly 1 `run_analysis` turn, and the user bubble reads the chip's own label ("Run the analysis") |

For `07-*`, `/bff/cee/graph-readiness` is also fulfilled from a fixture (`runChipGateFixtures.ts`). Every other `/bff` call gets the harness's in-page 503. The config sets `VITE_V5_ENDPOINT=/proxy/v5/turn` (same origin) so the app's own hook can send a turn.

Limit: Google Fonts is aborted, so the fallback sans replaces Inter.
Re-run: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm exec playwright test -c playwright.aiconversation.config.ts`
| `08-readiness-outage-chip-vs-dock.png` | #1973 merge `89afedbe`: exploratory run, not asserted | EXISTING DEFECT (not from #1973): graph-readiness 503 keeps a stale `can_run_analysis:false`. The chip reason says "Olumi is checking again", while the dock says "Could not re-check readiness (HTTP 503)" |

## 09 — PR-B: a route-generated OpenAI Run turn with its coaching card (CEE #1854 `c933aabf`)

Spec: `prbRunReply.witness.measure.ts`. Local witness branch = `witness/ai-conversation-local` + `origin/ai-conversation/run-turn-coaching` (`bea7b52f`).

The Run reply is `fixtures/prb-route-c933aabf-explicit-run.json`: the HTTP response body of CEE `POST /agent/v1/turn` at PR #1854's approved head `c933aabf` (byte-identical on `c933aabf` + staging `caf7d1a3`). It was produced by CEE's own route test double with a **scripted model**. It is **route-generated, not a live capture**: no OpenAI or Anthropic call was made, and `assistant_text` is a fixed 93-word interpretation. It is served byte for byte (sha256 `ca8ad216…675e`, re-derived by the spec).

| File | What it shows |
|---|---|
| `09-prb-run-reply-{1280x800,1440x900}-as-arrived.png` | The moment the reply lands, untouched. The thread auto-scrolls to the bottom: the analysis-result card and the coaching line are in view. The reply's opening finding is NOT in view (at 1280×800 the first sentence and first bullet are above the fold; at 1440×900 the first line is cut) |
| `09-prb-run-reply-{1280x800,1440x900}.png` | The same reply scrolled to its top: the whole 93-word reply (bold finding + caveat, 2 bullets, next step), then the analysis-result card |
| `09-prb-run-reply-{1280x800,1440x900}-bottom.png` | Scrolled to its end: the analysis-result card, then the coaching card as ONE collapsed line, "Pressure-test a sensitive link" |
| `09-prb-run-reply-card-crop-*.png` | The card as it sits on the face (promotion OFF): a closed `<details>` line, lightbulb + the producer title |
| `09-prb-run-reply-card-open-crop-*.png` | The line opened: producer body verbatim, "Grounded in decision science · medium evidence", the `Pro subscriber base → MRR` ref pill, the live "Pressure-test this link" chip, "Why this, and how sure". No notice: `data-currency="current"` |

Asserted in each viewport: turns = opening, ONE run, ONE card action; the card action's turn carries the producer's `action_prompt` verbatim, and a second click sends nothing. Store after the reply: `complete_current`, `computed_at` = card `created_at`, `currentGraphHash` = card hash, not dirty. No suggested-chip row, because the route offers none on a completed Run. 0 off-origin responses.

Harness caveats (read before judging the photos): the canvas is the seeded `pricing-model` starter, a DIFFERENT model (NRR, 4 options) from the one the route body analysed (MRR/Pro price, 3 options, served t2). The route body's `draft_graph` is the CEE harness's 5-node READY_GRAPH, and the product's zero-overlap guard declines to apply it over the seeded canvas. The opening turn's reply and the card action's reply are harness fixtures, labelled as such.

## 10 — the Run reply's first sentence is in view on arrival (`ai-conversation/reply-start-in-view` `7ec4d83e`)

Spec: `prbRunReply.witness.measure.ts`, tests "reply start in view @ {vp}". Same journey, route body and network rules as 09. Local witness branch = `witness/ai-conversation-local` + `ai-conversation/reply-start-in-view`.

| File | What it shows |
|---|---|
| `10-reply-start-in-view-{1280x800,1440x900}.png` | The moment the Run reply lands. The spec does not scroll the thread. The reply's first sentence (bold finding + caveat) is at the top of the thread, then both bullets, the next step and the analysis-result card |

Measured with a DOM Range over the first sentence's text: every line box is inside the thread's scroll box, and a hit test at the first line lands in the reply body. The spec reads this on arrival and again after 1.5 s. Readings (both viewports): `scrollTop 258`, `scrollHeight 1006`, `clientHeight` 608 / 708; the reply's top is 12 px below the thread's top; not at the bottom; no "New messages" pill; the dock stayed on the Olumi tab.

Negative control (same spec, hold bypassed, scratch output): both viewports RED on "every line of the first sentence is inside the thread". Readings: `scrollTop` 398 / 298 (pinned to the bottom); the reply's top at −128 / −28 px, which reproduces 09. The same spec is also RED when arrival detection runs in a passive effect instead of a layout effect (`scrollTop` 398 / 298).

Trade-off: at 1280×800 the coaching line ("Pressure-test a sensitive link") is now below the fold on arrival. In 09 it was in view. At 1440×900 it is still in view.

## 11 — served-equivalent: the CEE commit served on staging tonight (`c673223`), rendered by current staging

Spec: `servedC673223RunReply.witness.measure.ts`. The Run reply is `fixtures/served-route-c673223-explicit-run.json`: the HTTP response body of CEE `POST /agent/v1/turn` at `c673223d7bc3f83fc344b68de53b44baf04c75f7` (the CEE staging head on 2026-09-25), produced by CEE's own route test double with a **scripted model**. It is **route-generated, not a live capture**: no OpenAI or Anthropic call was made. It is byte-identical to the c933aabf body served in 09 (sha256 `ca8ad216…675e`, re-derived by the spec). Same journey, network rules and harness caveats as 09.

Two trees were measured, because the witness branch carries UI that staging does not:

| File | Tree | What it shows |
|---|---|---|
| `11-served-c673223-run-reply-{1280x800,1440x900}.png` | THIS branch: `witness/ai-conversation-local` + `origin/staging` `64a3b385` merged. So it also carries the unmerged PR-B UI (run-turn currency, promotion OFF) and `reply-start-in-view` | The moment the reply lands, untouched. The reply's first sentence is at the top of the thread (`scrollTop 258`, not at the bottom). At 1280×800 the coaching line is below the fold; at 1440×900 it is in view |
| `11-served-c673223-run-reply-{1280x800,1440x900}-staging-only.png` | `origin/staging` `64a3b385` + ONLY this spec, its fixture, `runChipGateFixtures.ts` and the config (scratch tree, not pushed) | **What tonight's build shows.** The thread is pinned to the bottom (`scrollTop` 398 / 298, `atBottom: true`): the reply's first sentence — the finding and its caveat — is out of view (1280×800: first sentence and first bullet above the fold; 1440×900: first line cut). The last sentence, the analysis-result card and the coaching line are in view |
| `11-served-c673223-run-reply-card-open-crop-*.png` (both trees) | | The line opened: body verbatim, "Grounded in decision science · medium evidence", the `Pro subscriber base → MRR` pill, the live "Pressure-test this link" chip. `data-currency="current"`, no notice |

Asserted in each viewport, on both trees (3 passed each): turns = opening, ONE run, ONE card action; the card action's turn carries `action_prompt` verbatim and a second click sends nothing; the reply renders in full (93 words); no suggested-chip row; no `data-leader="true"`; one closed line titled "Pressure-test a sensitive link", current; the store holds `complete_current`, `computed_at` = card `created_at`, `currentGraphHash` = card hash, not dirty; `leader_claim` withheld (`constraint_verdict_withheld`). 0 off-origin responses (only the Google Fonts CSS was attempted, and it was aborted).

Harness caveat visible in the photos: the canvas is the seeded `pricing-model` starter (NRR, **4** options) while the reply and result card speak of the analysed pricing model (MRR, **3** options). That mismatch is the harness's, not the product's.

## 12 — readiness outage: the Visual Regression diff on #1982, adjudicated from images (`fix/readiness-outage-honest-gate` `6736693d`)

Why: the advisory Visual Regression check reported extra pixel diffs on #1982 for `fresh-draft`, `model-tab` and `olumi-tab`. That check compares each head against committed linux references blessed at `c290e2fe` (#1872), which show an older dock ("Analysis (New)", "Re-analyse"). So its counts mix #1982 with unrelated drift. This entry compares **A against B only**, on one machine.

- **A** = merge-base `820aeed1` (the PR's base; `origin/staging` has since moved to `64a3b385`). **B** = PR head `6736693d`.
- Harness: the repo's own `e2e/visual/harness.ts` (`preparePage`, `openCanvas`, `seedStarterDraft('build-vs-buy')`, `clearNotifications`, `freezeMotion`, `waitForVisualQuiescence`), with the same steps and clip targets as `states.visual.spec.ts`. A throwaway config (port 5391, `PW_CHROMIUM_PATH`, identity-asserting `globalSetup` kept) wrote raw PNGs instead of calling `toHaveScreenshot`. No reference was read or written. Not committed.
- Network: the harness's hermetic 503 on `/bff/**` and `/api/**`, off-origin aborted. The only off-origin attempt was the Google Fonts CSS, which was aborted. **No model or provider calls.** The readiness fetch (`POST /bff/cee/graph-readiness`) gets 503 on both heads.
- Two captures per head per state: pixelmatch (threshold 0.2, the harness's own) A↔A = 0 px and B↔B = 0 px in all six cases.

Store at capture (read after the shutter): **A** `readiness` = the empty-canvas LOCAL verdict (`can_run_analysis:false`, "Add some nodes to get started", `verdictAtMs:null`), `stale:true`, `error:"…(HTTP 503)"`. **B** `readiness:null`, same `stale` and `error`.

| Files | A↔B (pixelmatch / exact) | What changed, A → B | Verdict |
|---|---|---|---|
| `12-readiness-1982-olumi-tab-{1440x900,1280x800}-{AB,diff,crop}.png` | 3847 / 4868 (both viewports) | Readiness bar only. Headline "Could not **re-**check readiness" → "Could not check readiness". "Analyse first pass" disabled (pale; `title` "Your model changed since the last check. Olumi is checking again, which takes a moment.") → enabled (solid primary, no title). The sub-line "The readiness service could not answer (HTTP 503).", the orange dot and Retry are unchanged | Intended |
| `12-readiness-1982-model-tab-{1440x900,1280x800}-{AB,diff,crop}.png` | 3212 / 8329 (1440), 3212 / 8263 (1280) | Bottom ReanalyseBar only. The sub-line "Olumi is checking again, which takes a moment." (`reanalyse-blocked-reason`) is removed, so the bar has one line and the button moves 1 px down. "Analyse" goes from disabled (pale, same `title`) to enabled. The Model outline, cards and tabs are unchanged | Intended (see note) |
| `12-readiness-1982-fresh-draft-{1440x900,1280x800}-{AB,diff,crop}.png` | 19743 / 62521 (1440), 19580 / 61856 (1280) | Dock on the Reasoning tab. The "What this model needs before it can be analysed / Your model changed since the last check. Olumi is checking again…" card (`analysis-new-why-no-analysis`) is replaced by the "Run the analysis" button (`analysis-new-status-pre-run-act`). Everything below it in the panel moves **up ~43 px**; this causes most of the count. The ReanalyseBar changes as in model-tab. **Graph and canvas chrome: 0 differing pixels (exact).** The node boxes, React Flow transform, non-dock controls and non-dock text are identical | Intended (see note) |

Outside the areas above, the exact diffs are sub-threshold (max channel delta ≤ 5/255): tab header text and the dock's rounded corners. The same kind of speckle appears in the A↔A and B↔B pairs. That is rasteriser noise; pixelmatch counts 0 px there.

**Control (attribution).** A again, but after the 503 lands the store is put into B's state (the local verdict is dropped; `error`/`stale` are kept). This is exactly what `publishCheckFailure` does, and nothing else was changed. Result vs B: pixelmatch **0 px** in all six captures. Exact diffs are ≤ 13 px at δ ≤ 1, except model-tab and olumi-tab at 1440: 7960 and 5222 px at δ ≤ 6. Those sit in the dock's left ~100 px at y 600–800, and only in runs whose canvas fit differed (see below). It is canvas content faintly showing through the dock. B↔B shows the same region when its two runs landed on different fits. The dock text, dock controls and store are identical. So the unchanged merge-base renderers, fed #1982's store state, draw #1982's pixels. The visual change is entirely the store change.

Note: the outage is disclosed only on the Olumi tab. On B, the Reasoning panel and the ReanalyseBar (Model and Reasoning tabs) show an enabled run with **no** readiness-outage line. Neither component takes the readiness error as input (`ReanalyseBar` props: `canRun`, `blockedReason`, `isAnalysing`). They draw an open gate the way they draw any unknown verdict, e.g. an outage on first load. #1982 does not introduce this. On A, these same surfaces claimed a check was running when it had failed. On B they make no readiness claim.

Unrelated harness behaviour seen here: `blocked-provisional` does not mount on either head (`[data-testid="pre-analysis-v3"]` not found). Under the dock-clipped tab states, the canvas fit alternates between `scale(0.5)` and `scale(0.511838)` from run to run on either head. The clipped images cannot see this. The full-viewport `fresh-draft` was stable across all five runs per viewport.

## 13 — joined pre-merge witness: #1968 + #1981 + #1985 on staging 64a3b385

Spec: `joinedPreMerge.witness.measure.ts`. One journey, the same script on two trees, at 1280×800 and 1440×900:

- **combined** = `origin/staging` `64a3b385` + `ai-conversation/run-turn-coaching` (#1968, `b17bfbe0`) + `ai-conversation/reply-start-in-view` (#1981, `7ec4d83e`) + `ai-conversation/card-action-settled-reload` (#1985 "G1", `06648ffd`). A detached scratch tree at merge `cea2908e`, not pushed. Since then #1985's head has moved to `99576e4a`. That commit changes only the held-proposal confirm restore (`useConversation.ts` + its spec), not the coaching chip measured here. It was not re-measured.
- **staging** = `origin/staging` `64a3b385` alone: the control.

The only files added to either tree were this spec, `runChipGateFixtures.ts`, the c673223 fixture and the config. The spec asks the dev server which tree it is serving (does `transcriptStore.ts` contain `settledSourceBlockKeys`?), and refuses to measure if the answer differs from `WITNESS_TREE`.

**Journey.** The whole app on `/#/canvas?ai=openai`. Every turn carried `x-olumi-ai-mode: openai`, and the dock reads "AI: OpenAI". The Olumi tab is docked, with the app's own `ConversationPanel` + `useConversation`. The canvas is the seeded `pricing-model` starter, as in 09–11.

1. The opening turn, then the Run chip. **Run #1** is answered with the c673223 route body, byte for byte (sha256 re-derived).
2. **Run #2** on the same model. The suggested Run chip is gone after a confirmed-current run (product rule `decideRunAnalysisPolish` → `suppress`; count 0 on both trees). So the Olumi tab's own "Re-run analysis" control (`ai-input-bar-strip-analyse`) is used. It sends a `run_analysis` chip turn. That turn is answered with the SAME c673223 bytes, with only the run identity moved to `2026-09-24T17:02:11.004Z`: `analysis_state.run_state.computed_at`, `analysis_ready.computed_at`, and the card's `created_at`, `signal_id` and `block_id` (`a13b0002-…0002`, harness-made). Same `graph_hash`. A test asserts that reverting those fields gives back run #1's bytes exactly.
3. Card #2's action chip is clicked once. The reply is the harness's short "Card action received" (no `analysis_state`, the same reply 11 uses).
4. A real `page.reload()`. The transcript is restored from localStorage. Card #2's chip is read, then force-clicked, and the turn POSTs are counted.
- 4b. A second real reload. Then one typed turn whose harness reply restates run #2's `analysis_state`, `analysis_ready` and `graph_hash` verbatim, with no blocks. Card #2's chip is read, force-clicked and counted again. Why: after a reload the store has no `analysis_state`, because it is turn-scoped and not persisted. So on a tree with #1968, step 4's disabled chip is ALSO inert, and step 4 alone cannot credit G1. 4b removes the inert cause.

**Network.** Every `/proxy/v5/turn` and `/bff/cee/graph-readiness` POST is fulfilled from a fixture. Every other `/bff` / `/api` call gets the harness's in-page 503. Every non-localhost request is aborted. **Completed off-origin requests: 0 in all four runs.** Each run attempted 3 off-origin requests, all to the Google Fonts CSS (one per page load), and all were aborted. No model or provider host was contacted or probed.

Harness departure: `preparePage` clears localStorage in an init script on EVERY navigation, so a reload would wipe the transcript. `prepareOnce` in the spec is `preparePage` line for line, except that the clear runs only on the test's first navigation.

### Facts (DOM read in-page; per-step JSON beside each image)

"chip" = card #2's `v5-coaching-action` unless stated. ∅ = attribute absent.

| Step | combined 1280×800 | combined 1440×900 | staging 1280×800 | staging 1440×900 |
|---|---|---|---|---|
| **1** Run #1 on arrival: first sentence in the thread's visible band? | **yes**. `scrollTop 258`/1006, not at bottom; reply top +12 px, first line +14…+28 px | **yes**. `scrollTop 258`/1006; reply top +12 px | **no**. `scrollTop 398` (pinned to bottom); reply top **−128 px**, first line −126…−112 | **no**. `scrollTop 298` (bottom); reply top **−28 px**, first line −26…−12 |
| 1, after 1.5 s | unchanged (258, in view) | unchanged | unchanged (398, out of view) | unchanged (298, out of view) |
| **2** Run #2 on arrival (same reading) | in view: `scrollTop 1052`/1800, reply top +12 | in view: `scrollTop 1052`/1800, reply top +12 | out of view: `scrollTop 1192` (bottom), reply top −128 | out of view: `scrollTop 1092` (bottom), reply top −28 |
| **2** card #1 after run #2 (store `complete_current` @ 17:02:11.004Z, hash unchanged) | `data-currency="changed"`, `data-run-turn-reason="earlier_run"`, notice **"Written about an earlier run of this model — the latest run may point somewhere else."**, chip `disabled`, `data-inert="true"`, `aria-describedby` = the notice | same | `data-currency="current"`, **no notice, chip live** (`disabled=false`) | same |
| 2 card #2 | current, no notice, chip live | same | same | same |
| **3** click card #2's chip | 1 card-action turn. Chip `disabled`, **`data-settled="true"`**, also `data-inert="true"` (see finding B). Transcript saves `sourceBlockKey coach:<turn>:a13b0002-…` | same | 1 turn. Chip `disabled`, `data-settled="true"`, currency still current. Transcript saves no key | same |
| **4** after reload: card #2's chip | `disabled`, **`data-settled="true"`**, `data-inert="true"`, notice "Written about an earlier analysis — re-run to check it still holds." (store: no verdict) | same | **live again**: `disabled=false`, `data-settled` ∅, `data-currency="cannot_confirm"`, no notice | same |
| 4 card #1 (never clicked) | `disabled`, `data-settled` ∅, `data-inert="true"`, "earlier analysis" notice | same | live, `cannot_confirm` | same |
| **4** force-click card #2 after reload | **0 turn POSTs** | **0** | **1 turn POST** (a second `card_action`, same prompt) | **1** |
| **4b** second reload, verdict restated: card #2 | `data-currency="current"`, no notice, `data-inert` ∅, **`disabled`, `data-settled="true"`**. The transcript alone holds it | same | current, **live**, `data-settled` ∅ | same |
| 4b card #1 | `earlier_run` notice again, inert, `data-settled` ∅ | same | current, live | same |
| **4b** force-click card #2 | **0 turn POSTs** | **0** | **1 turn POST** | **1** |
| Turns fulfilled (in order) | opening, run1, run2, card_action, [reload], [reload] restate | same | opening, run1, run2, card_action, [reload] **card_action**, [reload] restate, **card_action** | same |

Images per tree and viewport: `13-joined-1-run1-arrival-*`, `13-joined-2-run2-arrival-*`, `13-joined-2-later-run-card1{,-crop}-*`, `13-joined-3-card2-action-clicked{,-crop}-*`, `13-joined-4-after-reload-card2{,-crop}-*`, `13-joined-4b-verdict-restated-card2{,-crop}-*`. JSON: `13-joined-{1-run1-arrival,2-later-run,3-card-action,4-after-reload,4b-verdict-restated}-*.json` and `13-joined-network-*.json`.

### Verdict

The combined tree shows each fixed behaviour at both viewports:
- #1981: both Run replies open at their first sentence.
- #1968: the earlier run's card has the notice and its action is disabled.
- G1: the taken action stays settled across reloads, and a click sends 0 turns. 4b shows this with the card current and not inert.

Staging shows each defect:
- The replies are pinned to the bottom.
- The earlier run's card looks current and its action is live.
- After a reload the taken action is live again, and one click sends a duplicate turn, twice in this journey.

### Findings to read alongside the table

- **A. Overlap between #1968 and G1 after any reload.** `analysis_state` is turn-scoped and is not persisted. After a reload, every run-turn card on the combined tree reads "Written about an earlier analysis — re-run to check it still holds." with its action inert. This lasts until the next turn restates a verdict. It happens even when the card IS about the latest run: card #2 in step 4. Card #1 also loses its more specific "earlier run" reason until then. G1's `data-settled` is present underneath, but in step 4 it is not what the user sees. This is #1968's fail-closed rule (b) (`classifyRunTurn`: no `complete_current` → `earlier_analysis`), not G1.
- **B. A verdict-less turn flips the current card.** In step 3 the harness's card-action reply carries no `analysis_state`. `applyV5State` CLEARS the verdict on absence, by contract. So on the combined tree, card #2 changes from "current" to "Written about an earlier analysis…" the moment its own reply lands, and card #1 changes from "earlier run" to "earlier analysis". Whether users see this depends on CEE stamping `analysis_state` on every turn, as the applicator's comments say it does. The harness replies (as in 11) do not.
- **C. The settled chip does not explain itself.** In 4b, card #2's chip is greyed and disabled with no notice and no `aria-describedby`. The only record of the action is the user bubble above it.
- **D. Staging after a reload.** Staging's cards read `data-currency="cannot_confirm"` but render no notice and a live action.

Re-run: `WITNESS_TREE=combined|staging GEOMETRY_PORT=5301 WITNESS_OUT_DIR=<dir> PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm exec playwright test -c playwright.aiconversation.config.ts joinedPreMerge`
