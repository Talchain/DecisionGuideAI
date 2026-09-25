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
